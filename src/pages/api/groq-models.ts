import type { APIRoute } from 'astro';
import Groq from 'groq-sdk';

export const prerender = false;

const EXCLUDE_PATTERNS = ['whisper', 'guard', 'tts'];

export const GET: APIRoute = async () => {
  const apiKey = import.meta.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ models: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const groq = new Groq({ apiKey });
    const { data } = await groq.models.list();
    const models = data
      .map(m => m.id)
      .filter(id => !EXCLUDE_PATTERNS.some(p => id.toLowerCase().includes(p)))
      .sort();
    return new Response(JSON.stringify({ models }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ models: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
