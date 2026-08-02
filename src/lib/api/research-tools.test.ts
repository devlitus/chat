// src/lib/api/research-tools.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateFetchUrl, extractTextFromHtml, executeResearchTool } from './research-tools';

describe('research-tools', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('validateFetchUrl', () => {
    it('acepta una URL https valida', () => {
      expect(() => validateFetchUrl('https://example.com/articulo')).not.toThrow();
    });

    it('rechaza URLs no https', () => {
      expect(() => validateFetchUrl('http://example.com')).toThrow('Solo se permiten URLs HTTPS');
    });

    it('rechaza URLs malformadas', () => {
      expect(() => validateFetchUrl('no-es-una-url')).toThrow('URL invalida');
    });

    it('rechaza hosts bloqueados (localhost)', () => {
      expect(() => validateFetchUrl('https://localhost/path')).toThrow('Host bloqueado');
    });

    it('rechaza IPs privadas RFC1918', () => {
      expect(() => validateFetchUrl('https://192.168.1.1/')).toThrow('IPs privadas no permitidas');
      expect(() => validateFetchUrl('https://10.0.0.5/')).toThrow('IPs privadas no permitidas');
    });
  });

  describe('extractTextFromHtml', () => {
    it('elimina scripts, estilos y tags, decodifica entidades basicas', () => {
      const html = '<html><head><style>.a{color:red}</style><script>alert(1)</script></head><body><p>Hola &amp; mundo</p></body></html>';
      const text = extractTextFromHtml(html);
      expect(text).not.toContain('<script');
      expect(text).not.toContain('alert');
      expect(text).not.toContain('color:red');
      expect(text).toContain('Hola & mundo');
    });
  });

  describe('executeResearchTool - fetch_url (no depende de terceros)', () => {
    it('no lanza excepcion cuando la peticion de red falla; devuelve mensaje descriptivo', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

      const result = await executeResearchTool('fetch_url', { url: 'https://example.com' });

      expect(result).toContain('Error al leer URL: fetch failed');
      // La tool nunca debe propagar "Error interno:" - ese prefijo es exclusivo
      // del catch de nivel superior en chat-stream.ts/deep-research.ts (fallo
      // de conexion con el backend del LLM, no de fetch_url).
      expect(result).not.toContain('Error interno');
    });

    it('valida la URL antes de intentar el fetch (host bloqueado)', async () => {
      const result = await executeResearchTool('fetch_url', { url: 'https://127.0.0.1/secret' });
      expect(result).toContain('Error de validación: Host bloqueado');
    });
  });

  describe('executeResearchTool - web_search_deep (depende de Tavily)', () => {
    it('devuelve un mensaje claro si TAVILY_API_KEY no esta configurado (no es un bug de fetch_url)', async () => {
      vi.stubEnv('TAVILY_API_KEY', '');
      const result = await executeResearchTool('web_search_deep', { query: 'test' });
      expect(result).toContain('Error: TAVILY_API_KEY no está configurado.');
    });

    // Regresion: antes del fix, un fallo de red hacia Tavily (con la API key
    // configurada) no estaba envuelto en try/catch en webSearchDeep(), por lo
    // que la excepcion escapaba de executeResearchTool() en vez de devolver
    // un string descriptivo (inconsistente con fetchUrl(), que si lo hacia).
    it('no lanza excepcion cuando Tavily falla por red; devuelve mensaje descriptivo', async () => {
      vi.stubEnv('TAVILY_API_KEY', 'fake-key');
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        executeResearchTool('web_search_deep', { query: 'test' })
      ).resolves.toContain('Error en búsqueda avanzada: fetch failed');
    });
  });
});
