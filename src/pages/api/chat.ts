import type { APIRoute } from "astro";
import {
  validateMessages,
  streamOllamaWithTools,
  streamGroqWithTools,
  type MessageContent,
} from "../../lib/api/chat-stream";
import { streamDeepResearch } from "../../lib/api/deep-research";

function contentToString(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

// Nombres de modelo del servidor local: alfanuméricos en minúscula, guiones,
// puntos, dos puntos (tags de Ollama), barras (rutas anidadas de LM Studio,
// p.ej. "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF/....Q4_K_M.gguf").
// Límite subido a 200 para admitir ids largos típicos de LM Studio.
const OLLAMA_MODEL_RE = /^[a-z0-9][a-z0-9_.\-:/]{0,199}$/i;
const ALLOWED_GROQ_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "gemma-7b-it",
  "qwen-qwq-32b",
  "deepseek-r1-distill-llama-70b",
  "deepseek-r1-distill-qwen-32b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "openai/gpt-oss-20b",
  "compound-beta",
  "compound-beta-mini",
]);

// Valor de proveedor expuesto al store/cliente: 'local' | 'groq'.
// Se acepta 'ollama' como alias legacy tanto en el body del request como en
// la env var LLM_PROVIDER, para no romper despliegues existentes que ya
// tuvieran ese valor persistido (localStorage) o configurado en su .env.
type Provider = 'local' | 'groq';

function normalizeProvider(value: unknown): Provider | undefined {
  if (value === 'local' || value === 'ollama') return 'local';
  if (value === 'groq') return 'groq';
  return undefined;
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const {
      messages,
      model,
      provider: reqProvider,
      groqModel,
      research,
    } = await request.json();
    if (!validateMessages(messages))
      return new Response(
        JSON.stringify({
          error: "Messages array is required or has invalid format",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    const safeModel =
      typeof model === "string" && OLLAMA_MODEL_RE.test(model)
        ? model
        : undefined;
    const provider: Provider =
      normalizeProvider(reqProvider) ??
      normalizeProvider(import.meta.env.LLM_PROVIDER) ??
      "local";
    const isResearch = research === true;
    const isGroq = provider === "groq";
    const rawGroqModel = typeof groqModel === "string" ? groqModel : undefined;
    const safeGroqModel =
      rawGroqModel && ALLOWED_GROQ_MODELS.has(rawGroqModel)
        ? rawGroqModel
        : undefined;
    const stream = isResearch
      ? await streamDeepResearch(
          messages.map(m => ({ ...m, content: contentToString(m.content) })),
          provider,
          isGroq ? safeGroqModel : safeModel,
        )
      : isGroq
        ? streamGroqWithTools(messages, safeGroqModel)
        : streamOllamaWithTools(messages, safeModel);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[api/chat]", error);
    const msg =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
