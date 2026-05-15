import type { APIRoute } from 'astro';
import { validateMessages, streamOllamaWithTools, streamGroq } from '../../lib/api/chat-stream';
import { streamDeepResearch } from '../../lib/api/deep-research';

const ALLOWED_MODELS = new Set(['gemma4', 'llama3.2', 'llama3.1', 'qwen2.5', 'mistral-nemo', 'mistral']);
const ALLOWED_GROQ_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'gemma-7b-it',
  'qwen-qwq-32b',
  'deepseek-r1-distill-llama-70b',
  'deepseek-r1-distill-qwen-32b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'openai/gpt-oss-20b',
  'compound-beta',
  'compound-beta-mini',
]);

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages, model, provider: reqProvider, groqModel, research } = await request.json();
    if (!validateMessages(messages)) return new Response(JSON.stringify({ error: 'Messages array is required or has invalid format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const modelBase = typeof model === 'string' ? model.split(':')[0] : '';
    const safeModel = ALLOWED_MODELS.has(modelBase) ? model : undefined;
    const provider = (reqProvider === 'ollama' || reqProvider === 'groq') ? reqProvider : (import.meta.env.LLM_PROVIDER ?? 'ollama');
    const isResearch = research === true;
    const isGroq = provider === 'groq';
    const rawGroqModel = typeof groqModel === 'string' ? groqModel : undefined;
    const safeGroqModel = rawGroqModel && ALLOWED_GROQ_MODELS.has(rawGroqModel) ? rawGroqModel : undefined;
    const stream = isResearch
      ? await streamDeepResearch(messages, provider, isGroq ? safeGroqModel : safeModel)
      : (isGroq ? await streamGroq(messages, safeGroqModel) : streamOllamaWithTools(messages, safeModel));
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
  } catch (error) {
    console.error('[api/chat]', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
