// src/pages/api/models.ts

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  const baseUrl = import.meta.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      return new Response(JSON.stringify({ models: [], error: 'Ollama not available' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = await response.json();
    const models: string[] = (data.models ?? []).map((m: { name: string }) => m.name);
    return new Response(JSON.stringify({ models }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ models: [], error: 'Cannot connect to Ollama' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
