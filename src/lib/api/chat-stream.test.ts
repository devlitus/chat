// src/lib/api/chat-stream.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamOllamaWithTools } from './chat-stream';

async function readStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

describe('chat-stream - origen de "Error interno: fetch failed"', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Documenta el diagnostico del bug reportado como "no funciona la tool
  // fetch": el mensaje "Error interno: fetch failed" no proviene de
  // fetch_url ni de web_search/web_search_deep (Tavily) - esas tools
  // capturan sus propios errores de red y devuelven strings descriptivos
  // (ver research-tools.test.ts / tools.test.ts). Ese mensaje solo puede
  // originarse en el catch de nivel superior que envuelve la llamada al
  // backend del LLM (Ollama/LM Studio) cuando esa conexion falla, y ocurre
  // en CUALQUIER mensaje, no solo en los que activan tool-use.
  it('surge cuando falla la conexion con el backend del LLM, no con las tools', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    const stream = streamOllamaWithTools([{ role: 'user', content: 'hola' }]);
    const out = await readStream(stream);

    expect(out).toContain('Error interno: fetch failed');
  });
});
