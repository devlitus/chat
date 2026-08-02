// src/lib/api/tools.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest';
import { executeTool } from './tools';

describe('tools - web_search (depende de Tavily)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('devuelve un mensaje claro si TAVILY_API_KEY no esta configurado', async () => {
    vi.stubEnv('TAVILY_API_KEY', '');
    const result = await executeTool('web_search', { query: 'test' });
    expect(result).toContain('Error: TAVILY_API_KEY no está configurado.');
  });

  // Regresion: mismo bug que en research-tools.ts/webSearchDeep - el fetch a
  // Tavily no estaba envuelto en try/catch, por lo que un fallo de red hacia
  // Tavily escapaba de executeTool() como una excepcion sin manejar en vez de
  // devolver un string descriptivo.
  it('no lanza excepcion cuando Tavily falla por red; devuelve mensaje descriptivo', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'fake-key');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    const result = await executeTool('web_search', { query: 'test' });
    expect(result).toContain('Error en búsqueda web: fetch failed');
  });
});
