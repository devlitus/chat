// src/pages/api/travel.ts
// Endpoint de sugerencias de viaje usando Wikivoyage + LLM local (Tabiji Migration)
// Pipeline: Validación → Wikivoyage Search → Wikivoyage Extracts → LLM Local → Parseo JSON → Fallback

import type { APIRoute } from 'astro';

export const prerender = false;

// ─── TIPOS ───

interface TravelSuggestion {
  id: string;
  title: string;
  description: string;
  estimatedCost: string;
  highlights: string[];
}

interface WikivoyageSearchPage {
  id: number;
  key: string;
  title: string;
  excerpt: string;
  description?: string;
}

interface WikivoyageSearchResponse {
  pages: WikivoyageSearchPage[];
}

interface WikivoyageExtractResponse {
  query: {
    pages: {
      [pageId: string]: {
        pageid: number;
        title: string;
        extract: string;
      };
    };
  };
}

interface WikivoyageContext {
  title: string;
  description: string;
  excerpt: string;
  extract: string;
}

interface UserParams {
  destino: string;
  presupuesto: string;
  dias: number;
  intereses: string;
}

// ─── HELPERS DE RESPUESTA ───

function jsonResponse(data: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string>),
    },
  });
}

function jsonError(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

function jsonSuccess<T>(data: T): Response {
  return jsonResponse(data, 200);
}

// ─── HELPERS DE FETCH ───

function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.name === 'AbortError' || (err as any).code === 'ABORT_ERR';
  }
  return false;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Timeout de ${timeoutMs}ms excedido para ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ─── HELPER DE LIMPIEZA DE JSON ───

function cleanJsonContent(raw: string): string {
  let cleaned = raw.trim();

  // Intento 1: buscar un objeto JSON directo
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  // Intento 2: limpiar markdown blocks ```json ... ```
  const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (mdMatch) {
    cleaned = mdMatch[1].trim();
    // Reintentar extracción de JSON dentro
    const fb = cleaned.indexOf('{');
    const lb = cleaned.lastIndexOf('}');
    if (fb !== -1 && lb > fb) {
      cleaned = cleaned.slice(fb, lb + 1);
    }
  }

  return cleaned;
}

// ─── VALIDADOR DE SUGERENCIA ───

function isValidSuggestion(item: unknown): item is TravelSuggestion {
  if (!item || typeof item !== 'object') return false;
  const s = item as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.title === 'string' && s.title.length > 0 &&
    typeof s.description === 'string' && s.description.length > 0 &&
    typeof s.estimatedCost === 'string' && s.estimatedCost.length > 0 &&
    Array.isArray(s.highlights) && s.highlights.length > 0 &&
    s.highlights.every((h: unknown) => typeof h === 'string')
  );
}

// ─── SYSTEM PROMPT ───

function buildSystemPrompt(
  wikiContext: WikivoyageContext[],
  userParams: UserParams
): string {
  const contextJson = JSON.stringify(wikiContext, null, 2);
  return `Eres un asistente especializado en planificación de viajes. Recibirás datos de Wikivoyage en inglés y los parámetros del usuario en español. Tu tarea es traducir, adaptar y enriquecer esos datos para producir sugerencias de viaje en español.

## REGLAS ESTRICTAS

1. **NO inventes información.** Todo lo que escribas debe estar basado en los datos de Wikivoyage proporcionados. Si un dato no está en el contexto, no lo incluyas.
2. **Genera EXACTAMENTE 3 sugerencias.** Ni más ni menos. Si solo tienes 2 páginas de Wikivoyage, adapta la información para crear 3 variaciones (ej: "ruta cultural", "ruta gastronómica", "ruta naturaleza").
3. **Traduce todo al español natural.** Nada de inglés en la salida. Usa un tono cálido y entusiasta, como un guía turístico experto.
4. **estimatedCost debe reflejar el presupuesto del usuario.** Usa rangos como "$500-$800 USD", "$200-$400 USD", "$1,500-$2,500 USD" según el presupuesto indicado (Económico ≈ bajo, Standard ≈ medio, Lujo ≈ alto).
5. **highlights debe tener exactamente 3 elementos.** Cada uno debe ser una frase corta (máx. 5 palabras) que describa una atracción o actividad concreta del destino.

## DATOS DE WIKIVOYAGE

${contextJson}

## PARÁMETROS DEL USUARIO

- Destino: ${userParams.destino}
- Presupuesto: ${userParams.presupuesto}
- Días: ${userParams.dias}
- Intereses: ${userParams.intereses}

## FORMATO DE SALIDA

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:

{
  "suggestions": [
    {
      "id": "1",
      "title": "Nombre atractivo de la sugerencia en español",
      "description": "2-3 frases describiendo el ambiente y actividades principales. Debe basarse en el extract de Wikivoyage.",
      "estimatedCost": "$XXX-$YYY USD",
      "highlights": ["Atracción 1", "Atracción 2", "Atracción 3"]
    },
    {
      "id": "2",
      "title": "...",
      "description": "...",
      "estimatedCost": "...",
      "highlights": ["...", "...", "..."]
    },
    {
      "id": "3",
      "title": "...",
      "description": "...",
      "estimatedCost": "...",
      "highlights": ["...", "...", "..."]
    }
  ]
}

NO envuelvas el JSON en bloques de markdown (\`\`\`json). Devuelve el JSON puro.`;
}

// ─── FALLBACK ───

function buildFallbackSuggestions(
  wikiData: WikivoyageContext[],
  userParams: UserParams
): TravelSuggestion[] {
  const budgetRanges: Record<string, string> = {
    'Económico': '$200-$500 USD',
    'Standard': '$500-$1,200 USD',
    'Lujo': '$1,500-$3,000 USD',
  };

  const genericHighlights = [
    'Centro histórico',
    'Gastronomía local',
    'Museos y cultura',
    'Naturaleza y parques',
    'Vida nocturna',
    'Arquitectura emblemática',
    'Mercados tradicionales',
  ];

  return wikiData.slice(0, 3).map((page, i) => {
    // Extraer frases clave del excerpt/extract como highlights
    const contentText = (page.extract || page.excerpt || '');
    const highlightCandidates = contentText
      .split(/[.;]/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && s.length < 80)
      .slice(0, 3);

    return {
      id: String(i + 1),
      title: `${page.title} — Descubre sus encantos`,
      description: page.extract
        ? page.extract.slice(0, 300) + (page.extract.length > 300 ? '...' : '')
        : `Explora ${page.title}, un destino fascinante lleno de historia, cultura y experiencias únicas. Información de Wikivoyage.`,
      estimatedCost: budgetRanges[userParams.presupuesto] || budgetRanges['Standard'],
      highlights: highlightCandidates.length >= 3
        ? highlightCandidates.slice(0, 3)
        : [
            genericHighlights[i * 3 % genericHighlights.length],
            genericHighlights[(i * 3 + 1) % genericHighlights.length],
            genericHighlights[(i * 3 + 2) % genericHighlights.length],
          ],
    };
  });
}

// ─── ENDPOINT ───

export const POST: APIRoute = async ({ request }) => {
  // ─── 1. PARSEAR Y VALIDAR INPUTS ───
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'El cuerpo de la solicitud debe ser JSON válido');
  }

  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  const budget = typeof body.budget === 'string' && body.budget.trim() ? body.budget.trim() : 'Standard';
  const daysRaw = body.days;
  const interests = typeof body.interests === 'string' ? body.interests.trim() : '';

  if (!destination) {
    return jsonError(400, 'El destino es obligatorio');
  }
  if (!daysRaw || isNaN(Number(daysRaw)) || Number(daysRaw) < 1) {
    return jsonError(400, 'El número de días debe ser un entero positivo');
  }
  const days = Number(daysRaw);

  // ─── 2. CONFIGURACIÓN ───
  const LLM_URL = import.meta.env.LLM_LOCAL_URL || 'http://192.168.1.133:1234/v1';
  const LLM_MODEL = import.meta.env.LLM_LOCAL_MODEL || 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF';
  const WIKI_REST = 'https://en.wikivoyage.org/w/rest.php/v1';
  const WIKI_ACTION = 'https://en.wikivoyage.org/w/api.php';

  try {
    // ─── 3. WIKIVOYAGE SEARCH ───
    const searchUrl = `${WIKI_REST}/search/page?q=${encodeURIComponent(destination)}&limit=3`;
    let searchRes: Response;
    try {
      searchRes = await fetchWithTimeout(searchUrl, {}, 5000);
    } catch (err) {
      console.error('[travel] Wikivoyage search falló:', err);
      return jsonError(502, 'No se pudo consultar la base de datos de viajes');
    }

    if (!searchRes.ok) {
      console.error('[travel] Wikivoyage search HTTP', searchRes.status);
      return jsonError(502, 'No se pudo consultar la base de datos de viajes');
    }

    const searchData: WikivoyageSearchResponse = await searchRes.json();
    const pages = searchData.pages || [];

    if (pages.length === 0) {
      return jsonError(404, `No se encontró información de viaje para "${destination}"`);
    }

    // ─── 4. WIKIVOYAGE EXTRACTS (paralelo con fallback individual) ───
    const extracts = await Promise.all(
      pages.map(async (page) => {
        const extractUrl = `${WIKI_ACTION}?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(page.key)}&format=json`;
        try {
          const extractRes = await fetchWithTimeout(extractUrl, {}, 5000);
          if (!extractRes.ok) return null;
          const data: WikivoyageExtractResponse = await extractRes.json();
          const pageData = Object.values(data.query?.pages || {})[0];
          return pageData?.extract || null;
        } catch {
          return null; // fallback: sin extract
        }
      })
    );

    // ─── 5. ENSAMBLAR CONTEXTO ───
    const wikivoyageContext: WikivoyageContext[] = pages.map((page, i) => ({
      title: page.title,
      description: page.description || '',
      excerpt: page.excerpt?.replace(/<[^>]+>/g, '') || '',
      extract: extracts[i] || '',
    }));

    const userParams: UserParams = {
      destino: destination,
      presupuesto: budget,
      dias: days,
      intereses: interests || 'turismo general',
    };

    const systemPrompt = buildSystemPrompt(wikivoyageContext, userParams);

    // ─── 6. LLAMADA AL LLM LOCAL ───
    let llmResult: TravelSuggestion[];
    try {
      const llmRes = await fetchWithTimeout(`${LLM_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Genera exactamente 3 sugerencias de viaje.' },
          ],
          temperature: 0.7,
          max_tokens: 2048,
          response_format: { type: 'json_object' },
        }),
      }, 25000);

      if (!llmRes.ok) {
        console.error('[travel] LLM local respondió con error HTTP', llmRes.status);
        throw new Error(`LLM HTTP ${llmRes.status}`);
      }

      const llmData = await llmRes.json();
      const rawContent = llmData.choices?.[0]?.message?.content || '{}';

      // ─── 7. PARSEO DE JSON (2 intentos) ───
      let parsed: { suggestions?: TravelSuggestion[] };
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        // Intento 2: limpiar markdown
        const cleaned = cleanJsonContent(rawContent);
        parsed = JSON.parse(cleaned);
      }

      // ─── 8. VALIDAR ESQUEMA ───
      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        throw new Error('Respuesta del LLM sin array suggestions');
      }

      llmResult = parsed.suggestions.filter(isValidSuggestion);
      if (llmResult.length === 0) throw new Error('Ninguna sugerencia válida del LLM');

    } catch (llmError) {
      console.error('[travel] LLM falló, usando fallback directo de Wikivoyage:', llmError);
      llmResult = buildFallbackSuggestions(wikivoyageContext, userParams);
    }

    return jsonSuccess({ suggestions: llmResult.slice(0, 3) });

  } catch (error) {
    console.error('[travel] Error inesperado:', error);
    return jsonError(500, 'Error interno del servidor');
  }
};
