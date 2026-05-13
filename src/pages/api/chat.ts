import type { APIRoute } from 'astro';
import { validateMessages, streamOllama, streamGroq } from '../../lib/api/chat-stream';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages, model } = await request.json();
    if (!validateMessages(messages)) return new Response(JSON.stringify({ error: 'Messages array is required or has invalid format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const provider = import.meta.env.LLM_PROVIDER ?? 'ollama';
    const stream = provider === 'groq' ? await streamGroq(messages) : await streamOllama(messages, model);
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
