import type { APIRoute } from 'astro';
import { validateMessages, streamOllamaWithTools, streamGroq } from '../../lib/api/chat-stream';

const ALLOWED_MODELS = new Set(['gemma4', 'llama3.2', 'llama3.1', 'qwen2.5', 'mistral-nemo', 'mistral']);

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages, model, provider: reqProvider, groqModel } = await request.json();
    if (!validateMessages(messages)) return new Response(JSON.stringify({ error: 'Messages array is required or has invalid format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const modelBase = typeof model === 'string' ? model.split(':')[0] : '';
    const safeModel = ALLOWED_MODELS.has(modelBase) ? model : undefined;
    const provider = (reqProvider === 'ollama' || reqProvider === 'groq') ? reqProvider : (import.meta.env.LLM_PROVIDER ?? 'ollama');
    const stream = provider === 'groq' ? await streamGroq(messages, typeof groqModel === 'string' ? groqModel : undefined) : streamOllamaWithTools(messages, safeModel);
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
  } catch (error) {
    console.error('[api/chat]', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
