import Groq from 'groq-sdk';
import { RESEARCH_TOOL_DEFINITIONS, executeResearchTool, type ResearchProgressEvent } from './research-tools';
import { isReasoningModel, DEFAULT_GROQ_MODEL } from '../groq-models';
import type { ToolCall } from './tools';

type Message = { role: 'user' | 'assistant'; content: string };
type OllamaMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

const DEEP_RESEARCH_SYSTEM_PROMPT = `Eres un investigador experto. Tu tarea es responder la pregunta del usuario con maxima profundidad.

PROCESO OBLIGATORIO:
1. Usa web_search_deep con 3-5 queries distintas y especificas sobre el tema.
2. Para las 2-3 URLs mas relevantes de los resultados, usa fetch_url para leer su contenido completo.
3. Sintetiza toda la informacion en una respuesta estructurada con secciones claras.
4. Termina SIEMPRE con una seccion "## Fuentes" listando las URLs usadas con su titulo.

REGLAS:
- No respondas hasta haber buscado al menos 3 veces.
- Cada query debe ser diferente y complementaria (no repitas la misma busqueda).
- Cita la fuente cuando uses informacion especifica de una URL.
- Si fetch_url falla para una URL, continua con las demas.`;

const OLLAMA_TIMEOUT_MS = 60_000;
const MAX_ITERATIONS = 12;
const GROQ_MAX_HISTORY = 40;

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

function emitProgress(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: ResearchProgressEvent,
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

function runDeepResearchOllama(messages: Message[], requestModel?: string): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const emit = (content: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`),
        );
      };

      const done = () => {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };

      const baseUrl = safeOllamaBaseUrl();
      const model = requestModel || import.meta.env.OLLAMA_MODEL || 'gemma4';
      const history: OllamaMessage[] = [
        { role: 'system', content: DEEP_RESEARCH_SYSTEM_PROMPT },
        ...messages,
      ];

      const sources: { title: string; url: string }[] = [];
      let searchCount = 0;
      let searchTotal = 0;

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const response = await fetchOllama(`${baseUrl}/v1/chat/completions`, {
            model,
            messages: history,
            tools: RESEARCH_TOOL_DEFINITIONS,
            tool_choice: 'auto',
            stream: false,
          });

          if (!response.ok) {
            const err = await response.text();
            emit(`Error de Ollama (${response.status}): ${err}`);
            return done();
          }

          const data = await response.json() as {
            choices?: {
              finish_reason: string;
              message: OllamaMessage & { tool_calls?: ToolCall[] };
            }[];
          };
          const choice = data.choices?.[0];

          if (!choice) {
            emit('Respuesta inesperada de Ollama: sin choices.');
            return done();
          }

          if (choice.finish_reason === 'tool_calls') {
            const assistantMsg = choice.message;
            history.push(assistantMsg);

            const toolCalls = assistantMsg.tool_calls ?? [];

            const webSearchCalls = toolCalls.filter(
              tc => tc.function.name === 'web_search_deep' || tc.function.name === 'web_search',
            );
            if (webSearchCalls.length > 0) {
              searchTotal += webSearchCalls.length;
            }

            const results = await Promise.all(
              toolCalls.map(async (toolCall) => {
                try {
                  const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
                  const name = toolCall.function.name;

                  if (name === 'web_search_deep' || name === 'web_search') {
                    searchCount++;
                    emitProgress(controller, encoder, {
                      type: 'searching',
                      query: String(args.query ?? ''),
                      index: searchCount,
                      total: Math.max(searchTotal, searchCount),
                    });
                  } else if (name === 'fetch_url') {
                    const url = String(args.url ?? '');
                    emitProgress(controller, encoder, { type: 'reading_url', url });
                    sources.push({ title: url, url });
                  }

                  const content = await executeResearchTool(name, args);
                  return { tool_call_id: toolCall.id, content };
                } catch (e) {
                  return {
                    tool_call_id: toolCall.id,
                    content: `Error ejecutando herramienta: ${e instanceof Error ? e.message : 'unknown'}`,
                  };
                }
              }),
            );

            for (const r of results) history.push({ role: 'tool', ...r });
            continue;
          }

          emitProgress(controller, encoder, { type: 'synthesizing', sources_count: sources.length });
          emitProgress(controller, encoder, { type: 'research_done', sources });

          emit(choice.message?.content ?? '');
          return done();
        }

        emit('El agente alcanzó el límite de iteraciones sin completar la investigación.');
        done();
      } catch (e) {
        emit(`Error interno: ${e instanceof Error ? e.message : 'unknown'}`);
        done();
      }
    },
  });
}

async function runDeepResearchGroq(messages: Message[], requestModel?: string): Promise<ReadableStream> {
  const apiKey = import.meta.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY no está configurada');

  const groq = new Groq({ apiKey });
  const truncated = messages.slice(-GROQ_MAX_HISTORY);
  const modelId = requestModel ?? DEFAULT_GROQ_MODEL;
  const isReasoning = isReasoningModel(modelId);

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const emit = (content: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`),
        );
      };

      const done = () => {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };

      type GroqMessage = {
        role: 'system' | 'user' | 'assistant' | 'tool';
        content: string | null;
        tool_calls?: {
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }[];
        tool_call_id?: string;
      };

      const history: GroqMessage[] = [
        { role: 'system', content: DEEP_RESEARCH_SYSTEM_PROMPT },
        ...truncated,
      ];

      const sources: { title: string; url: string }[] = [];
      let searchCount = 0;
      let searchTotal = 0;

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const response = await groq.chat.completions.create({
            messages: history as Parameters<typeof groq.chat.completions.create>[0]['messages'],
            model: modelId,
            tools: RESEARCH_TOOL_DEFINITIONS as Parameters<typeof groq.chat.completions.create>[0]['tools'],
            tool_choice: 'auto',
            stream: false,
            max_completion_tokens: 4096,
            ...(isReasoning ? { reasoning_effort: 'medium' as const } : {}),
          });

          const choice = response.choices[0];
          if (!choice) {
            emit('Respuesta inesperada de Groq: sin choices.');
            return done();
          }

          const msg = choice.message;

          if (choice.finish_reason === 'tool_calls' && msg.tool_calls && msg.tool_calls.length > 0) {
            history.push({
              role: 'assistant',
              content: msg.content ?? null,
              tool_calls: msg.tool_calls,
            });

            const webCalls = msg.tool_calls.filter(
              tc => tc.function.name === 'web_search_deep' || tc.function.name === 'web_search',
            );
            if (webCalls.length > 0) searchTotal += webCalls.length;

            const results = await Promise.all(
              msg.tool_calls.map(async (toolCall) => {
                try {
                  const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
                  const name = toolCall.function.name;

                  if (name === 'web_search_deep' || name === 'web_search') {
                    searchCount++;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'searching',
                          query: String(args.query ?? ''),
                          index: searchCount,
                          total: Math.max(searchTotal, searchCount),
                        })}\n\n`,
                      ),
                    );
                  } else if (name === 'fetch_url') {
                    const url = String(args.url ?? '');
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'reading_url', url })}\n\n`),
                    );
                    sources.push({ title: url, url });
                  }

                  const content = await executeResearchTool(name, args);
                  return { tool_call_id: toolCall.id, content };
                } catch (e) {
                  return {
                    tool_call_id: toolCall.id,
                    content: `Error ejecutando herramienta: ${e instanceof Error ? e.message : 'unknown'}`,
                  };
                }
              }),
            );

            for (const r of results) {
              history.push({ role: 'tool', content: r.content, tool_call_id: r.tool_call_id });
            }
            continue;
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'synthesizing', sources_count: sources.length })}\n\n`,
            ),
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'research_done', sources })}\n\n`),
          );

          const finalStream = await groq.chat.completions.create({
            messages: history as Parameters<typeof groq.chat.completions.create>[0]['messages'],
            model: modelId,
            stream: true,
            max_completion_tokens: 8192,
            ...(isReasoning ? { reasoning_effort: 'medium' as const } : {}),
          });

          for await (const chunk of finalStream) {
            const token = chunk.choices[0]?.delta?.content;
            if (token) emit(token);
          }

          return done();
        }

        emit('El agente alcanzó el límite de iteraciones sin completar la investigación.');
        done();
      } catch (e) {
        emit(`Error interno: ${e instanceof Error ? e.message : 'unknown'}`);
        done();
      }
    },
  });
}

export async function streamDeepResearch(
  messages: Message[],
  provider: 'ollama' | 'groq',
  requestModel?: string,
): Promise<ReadableStream> {
  if (provider === 'groq') {
    return runDeepResearchGroq(messages, requestModel);
  }
  return runDeepResearchOllama(messages, requestModel);
}
