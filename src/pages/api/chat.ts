import type { APIRoute } from 'astro';
import { validateMessages, streamOllamaWithTools, streamGroq } from '../../lib/api/chat-stream';

const ALLOWED_MODELS = new Set(['gemma4', 'llama3.2', 'llama3.1', 'qwen2.5', 'mistral-nemo', 'mistral']);

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages, model } = await request.json();
    if (!validateMessages(messages)) return new Response(JSON.stringify({ error: 'Messages array is required or has invalid format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const safeModel = typeof model === 'string' && ALLOWED_MODELS.has(model) ? model : undefined;
    const provider = import.meta.env.LLM_PROVIDER ?? 'ollama';
    const stream = provider === 'groq' ? await streamGroq(messages) : await streamOllamaWithTools(messages, safeModel);
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
  } catch (error) {
    console.error('[api/chat]', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
