// src/pages/api/models.ts

import type { APIRoute } from 'astro';

export const prerender = false;

// Servidor local confirmado: LM Studio. Expone únicamente la superficie
// OpenAI-compatible (GET /v1/models), no el endpoint nativo de Ollama
// (/api/tags). Por eso no hay fallback: si el servidor cambiara a un
// Ollama plano, también expone /v1/models desde versiones recientes.
export const GET: APIRoute = async () => {
  const baseUrl = import.meta.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

  try {
    const response = await fetch(`${baseUrl}/v1/models`);
    if (!response.ok) {
      return new Response(JSON.stringify({ models: [], error: 'Servidor local no disponible' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = await response.json();
    const models: string[] = (data.data ?? []).map((m: { id: string }) => m.id);
    return new Response(JSON.stringify({ models }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ models: [], error: 'No se pudo conectar con el servidor local' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
