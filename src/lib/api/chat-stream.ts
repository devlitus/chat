import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from '../system-prompt';
import { TOOL_DEFINITIONS, WIDGET_URI_MAP, executeTool, type ToolCall } from './tools';
import { isReasoningModel, DEFAULT_GROQ_MODEL } from '../groq-models';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type MessageContent = string | ContentPart[];

type Message = { role: 'user' | 'assistant'; content: MessageContent };
type OllamaMessage = { role: 'user' | 'assistant' | 'system' | 'tool'; content: MessageContent | null; tool_calls?: ToolCall[]; tool_call_id?: string };

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

const GROQ_MAX_HISTORY = 20;

export async function streamGroq(messages: Message[], requestModel?: string): Promise<ReadableStream> {
  const apiKey = import.meta.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY no está configurada');
  const groq = new Groq({ apiKey });
  const truncated = messages.slice(-GROQ_MAX_HISTORY);
  const modelId = requestModel ?? DEFAULT_GROQ_MODEL;
  const isReasoning = isReasoningModel(modelId);
  type GroqParams = Parameters<typeof groq.chat.completions.create>[0];
  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...truncated] as GroqParams['messages'],
    model: modelId, temperature: 1, max_completion_tokens: 4096, top_p: 1, stream: true, stop: null,
    ...(isReasoning ? { reasoning_effort: 'medium' } : {}),
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

function extractTextContent(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(c => (typeof c === 'object' && c !== null && 'text' in c ? (c as { text: string }).text : String(c)))
      .join('');
  }
  return String(content);
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

            const widgetCall = (assistantMsg.tool_calls ?? []).find(tc => tc.function.name === 'show_widget');
            if (widgetCall) {
              const args = JSON.parse(widgetCall.function.arguments || '{}') as Record<string, unknown>;
              const widgetType = String(args.type ?? '');
              const uri = WIDGET_URI_MAP[widgetType];
              if (!uri) {
                emit(`Error: tipo de widget desconocido "${widgetType}".`);
                return done();
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'widget', uri })}\n\n`));
              history.push({ role: 'tool', tool_call_id: widgetCall.id, content: 'Widget activado.' });
              return done();
            }

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

          emit(extractTextContent(choice.message?.content));
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

type GroqMessage =
  | { role: 'system' | 'user' | 'assistant'; content: MessageContent | null; tool_calls?: ToolCall[]; tool_call_id?: string }
  | { role: 'tool'; content: string; tool_call_id: string };

const GROQ_MAX_ITERATIONS = 5;
const GROQ_CALL_TIMEOUT_MS = 60_000;

export function streamGroqWithTools(messages: Message[], requestModel?: string): ReadableStream {
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

      const apiKey = import.meta.env.GROQ_API_KEY;
      if (!apiKey) { emit('Error: GROQ_API_KEY no está configurada.'); return done(); }

      const groq = new Groq({ apiKey });
      const modelId = requestModel ?? DEFAULT_GROQ_MODEL;
      const isReasoning = isReasoningModel(modelId);
      const history: GroqMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

      try {
        for (let i = 0; i < GROQ_MAX_ITERATIONS; i++) {
          const ac = new AbortController();
          const timer = setTimeout(() => ac.abort(), GROQ_CALL_TIMEOUT_MS);
          let completion: Groq.Chat.Completions.ChatCompletion;
          try {
            completion = await groq.chat.completions.create(
              {
                messages: history.slice(-GROQ_MAX_HISTORY) as Parameters<typeof groq.chat.completions.create>[0]['messages'],
                model: modelId,
                temperature: 1,
                max_completion_tokens: 4096,
                top_p: 1,
                stream: false,
                stop: null,
                tools: TOOL_DEFINITIONS,
                tool_choice: 'auto',
                ...(isReasoning ? { reasoning_effort: 'medium' } : {}),
              },
              { signal: ac.signal }
            ) as Groq.Chat.Completions.ChatCompletion;
          } finally {
            clearTimeout(timer);
          }

          const choice = completion.choices?.[0];
          if (!choice) { emit('Respuesta inesperada de Groq: sin choices.'); return done(); }

          if (choice.finish_reason === 'tool_calls') {
            const assistantMsg = choice.message;
            const toolCalls: ToolCall[] = (assistantMsg.tool_calls ?? []).map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            }));
            history.push({ role: 'assistant', content: assistantMsg.content ?? null, tool_calls: toolCalls });
            const widgetCall = toolCalls.find(tc => tc.function.name === 'show_widget');
            if (widgetCall) {
              const args = JSON.parse(widgetCall.function.arguments || '{}') as Record<string, unknown>;
              const widgetType = String(args.type ?? '');
              const uri = WIDGET_URI_MAP[widgetType];
              if (!uri) { emit(`Error: tipo de widget desconocido "${widgetType}".`); return done(); }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'widget', uri })}\n\n`));
              return done();
            }

            const results = await Promise.all(
              toolCalls.map(async (toolCall) => {
                try {
                  const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
                  const content = await executeTool(toolCall.function.name, args);
                  return { tool_call_id: toolCall.id, content };
                } catch (e) {
                  return { tool_call_id: toolCall.id, content: `Error ejecutando herramienta: ${e instanceof Error ? e.message : 'unknown'}` };
                }
              })
            );
            for (const r of results) history.push({ role: 'tool', content: r.content, tool_call_id: r.tool_call_id });
            continue;
          }

          const content = choice.message?.content ?? '';
          emit(content);
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

function isValidContent(content: unknown): content is MessageContent {
  if (typeof content === 'string') return true;
  if (!Array.isArray(content) || content.length === 0) return false;
  return content.every(
    (part) =>
      part &&
      typeof part === 'object' &&
      (part.type === 'text' || (part.type === 'image_url' && typeof part.image_url?.url === 'string')),
  );
}

export function validateMessages(messages: unknown): messages is Message[] {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every(
    (m) =>
      m &&
      typeof m === 'object' &&
      ['user', 'assistant'].includes(m.role) &&
      isValidContent(m.content),
  );
}
