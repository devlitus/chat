import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from '../system-prompt';
import { TOOL_DEFINITIONS, executeTool, type ToolCall } from './tools';

type Message = { role: 'user' | 'assistant'; content: string };
type OllamaMessage = { role: 'user' | 'assistant' | 'system' | 'tool'; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };

const OLLAMA_TIMEOUT_MS = 30_000;

export async function streamOllama(messages: Message[], requestModel?: string): Promise<ReadableStream> {
  const baseUrl = import.meta.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = requestModel || import.meta.env.OLLAMA_MODEL || 'gemma4';
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ollama' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages], stream: true }),
  });
  if (!response.ok || !response.body) { const err = await response.text(); throw new Error(`Ollama error ${response.status}: ${err}`); }
  return response.body;
}

export async function streamGroq(messages: Message[]): Promise<ReadableStream> {
  const apiKey = import.meta.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');
  const groq = new Groq({ apiKey });
  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    model: 'openai/gpt-oss-20b', temperature: 1, max_completion_tokens: 8192, top_p: 1, stream: true, reasoning_effort: 'medium', stop: null,
  });
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of chatCompletion) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (error) { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`)); }
      finally { controller.close(); }
    },
  });
}

function safeOllamaBaseUrl(): string {
  const raw = import.meta.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return raw.replace(/\/$/, '');
  } catch {
    return 'http://localhost:11434';
  }
}

async function fetchOllama(url: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function streamOllamaWithTools(messages: Message[], requestModel?: string): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (content: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
      };
      const done = () => {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };

      const baseUrl = safeOllamaBaseUrl();
      const model = requestModel || import.meta.env.OLLAMA_MODEL || 'gemma4';
      const MAX_ITERATIONS = 5;
      const history: OllamaMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const response = await fetchOllama(`${baseUrl}/v1/chat/completions`, {
            model, messages: history, tools: TOOL_DEFINITIONS, tool_choice: 'auto', stream: false,
          });

          if (!response.ok) {
            const err = await response.text();
            emit(`Error de Ollama (${response.status}): ${err}`);
            return done();
          }

          const data = await response.json() as { choices?: { finish_reason: string; message: OllamaMessage & { tool_calls?: ToolCall[] } }[] };
          const choice = data.choices?.[0];

          if (!choice) {
            emit('Respuesta inesperada de Ollama: sin choices.');
            return done();
          }

          if (choice.finish_reason === 'tool_calls') {
            const assistantMsg = choice.message;
            history.push(assistantMsg);

            const results = await Promise.all(
              (assistantMsg.tool_calls ?? []).map(async (toolCall) => {
                try {
                  const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
                  const content = await executeTool(toolCall.function.name, args);
                  return { tool_call_id: toolCall.id, content };
                } catch (e) {
                  return { tool_call_id: toolCall.id, content: `Error ejecutando herramienta: ${e instanceof Error ? e.message : 'unknown'}` };
                }
              })
            );
            for (const r of results) history.push({ role: 'tool', ...r });
            continue;
          }

          emit(choice.message?.content ?? '');
          return done();
        }

        emit('El agente alcanzó el límite de iteraciones sin completar la tarea.');
        done();
      } catch (e) {
        emit(`Error interno: ${e instanceof Error ? e.message : 'unknown'}`);
        done();
      }
    },
  });
}

export function validateMessages(messages: unknown): messages is Message[] {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every((m) => m && typeof m === 'object' && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string');
}
