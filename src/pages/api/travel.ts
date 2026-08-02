// src/pages/api/travel.ts
// Endpoint de sugerencias de viaje usando Wikivoyage + LLM local (Tabiji Migration)
// Pipeline: Validación → Wikivoyage Search → Wikivoyage Extracts → LLM Local → Parseo JSON → Fallback

import type { APIRoute } from 'astro';

export const prerender = false;

// ─── CONFIGURACIÓN DEL MÓDULO ───

const LLM_URL = import.meta.env.LLM_LOCAL_URL || 'http://192.168.1.133:1234/v1';
const LLM_MODEL = import.meta.env.LLM_LOCAL_MODEL || 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF';
const WIKI_REST = 'https://en.wikivoyage.org/w/rest.php/v1';
const WIKI_ACTION = 'https://en.wikivoyage.org/w/api.php';

// ─── CONSTANTES (números mágicos) ───

const WIKIVOYAGE_TIMEOUT_MS = 5000;
const LLM_TIMEOUT_MS = 25000;
const LLM_TEMPERATURE = 0.7;
const LLM_MAX_TOKENS = 2048;
const MAX_SUGGESTIONS = 3;
const MAX_EXTRACT_CHARS = 1500;
const HIGHLIGHT_MIN_LENGTH = 10;
const HIGHLIGHT_MAX_LENGTH = 80;
const FALLBACK_EXTRACT_CHARS = 300;

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

/** Clasifica un error de red en categorías diagnósticas para el cliente */
interface ClassifiedError {
  type: 'timeout' | 'dns' | 'connection' | 'ssl' | 'http' | 'unknown';
  userMessage: string;
  technical: string;
}

function classifyFetchError(err: unknown, url: string): ClassifiedError {
  // 1. Timeout (nuestro propio Error desde fetchWithTimeout)
  if (err instanceof Error && err.message.startsWith('Timeout de')) {
    return {
      type: 'timeout',
      userMessage: 'El servicio de viajes tardó demasiado en responder. Inténtalo de nuevo en unos segundos.',
      technical: err.message,
    };
  }

  // 2. AbortError crudo (no debería ocurrir con fetchWithTimeout, pero por si acaso)
  if (isAbortError(err)) {
    return {
      type: 'timeout',
      userMessage: 'El servicio de viajes tardó demasiado en responder. Inténtalo de nuevo en unos segundos.',
      technical: `AbortError sin capturar para ${url}`,
    };
  }

  // 3. Error de red (TypeError en Node.js: DNS, connection refused, etc.)
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    // Node.js 18+ usa err.cause para el error subyacente
    const causeMsg = (err as any).cause?.message?.toLowerCase() || '';

    if (msg.includes('fetch failed') || msg.includes('network') || causeMsg.includes('econnrefused')) {
      return {
        type: 'connection',
        userMessage: 'No se pudo conectar con el servicio de viajes. Verifica tu conexión a internet.',
        technical: `Connection error: ${err.message}${(err as any).cause ? ' | cause: ' + (err as any).cause.message : ''}`,
      };
    }

    if (msg.includes('dns') || msg.includes('enotfound') || msg.includes('eai_again') ||
        causeMsg.includes('enotfound') || causeMsg.includes('eai_again')) {
      return {
        type: 'dns',
        userMessage: 'No se pudo conectar con el servicio de viajes. Verifica tu conexión a internet.',
        technical: `DNS error: ${err.message}${(err as any).cause ? ' | cause: ' + (err as any).cause.message : ''}`,
      };
    }

    if (msg.includes('ssl') || msg.includes('tls') || msg.includes('certificate') || msg.includes('unverified') ||
        causeMsg.includes('ssl') || causeMsg.includes('tls')) {
      return {
        type: 'ssl',
        userMessage: 'Error de seguridad al conectar con el servicio de viajes. Verifica la fecha y hora de tu sistema.',
        technical: `SSL error: ${err.message}${(err as any).cause ? ' | cause: ' + (err as any).cause.message : ''}`,
      };
    }

    return {
      type: 'unknown',
      userMessage: 'Error de red al consultar el servicio de viajes.',
      technical: `TypeError: ${err.message}`,
    };
  }

  // 4. Error genérico
  return {
    type: 'unknown',
    userMessage: 'Error inesperado al consultar el servicio de viajes.',
    technical: err instanceof Error ? err.message : String(err),
  };
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

/** Intenta un fetch con un único retry en caso de timeout */
async function fetchWithRetryOnTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  try {
    return await fetchWithTimeout(url, options, timeoutMs);
  } catch (firstError) {
    if (firstError instanceof Error && firstError.message.startsWith('Timeout de')) {
      console.warn(`[travel] Reintentando fetch a ${url} tras timeout...`);
      return await fetchWithTimeout(url, options, timeoutMs);
    }
    throw firstError;
  }
}

// ─── HELPERS DE LIMPIEZA DE JSON ───

/** Extrae el contenido entre la primera `{` y la última `}` de un texto. */
function extractJsonBraces(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

function cleanJsonContent(raw: string): string {
  let cleaned = raw.trim();

  // Intento 1: buscar un objeto JSON directo
  cleaned = extractJsonBraces(cleaned);

  // Intento 2: limpiar markdown blocks ```json ... ```
  const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (mdMatch) {
    cleaned = mdMatch[1].trim();
    // Reintentar extracción de JSON dentro
    cleaned = extractJsonBraces(cleaned);
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
2. **Genera EXACTAMENTE ${MAX_SUGGESTIONS} sugerencias.** Ni más ni menos. Si solo tienes 2 páginas de Wikivoyage, adapta la información para crear ${MAX_SUGGESTIONS} variaciones (ej: "ruta cultural", "ruta gastronómica", "ruta naturaleza").
3. **Traduce todo al español natural.** Nada de inglés en la salida. Usa un tono cálido y entusiasta, como un guía turístico experto.
4. **estimatedCost debe reflejar el presupuesto del usuario.** Usa rangos como "$500-$800 USD", "$200-$400 USD", "$1,500-$2,500 USD" según el presupuesto indicado (Económico ≈ bajo, Standard ≈ medio, Lujo ≈ alto).
5. **highlights debe tener exactamente ${MAX_SUGGESTIONS} elementos.** Cada uno debe ser una frase corta (máx. 5 palabras) que describa una atracción o actividad concreta del destino.

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

  return wikiData.slice(0, MAX_SUGGESTIONS).map((page, i) => {
    // Extraer frases clave del excerpt/extract como highlights
    const contentText = (page.extract || page.excerpt || '');
    const highlightCandidates = contentText
      .split(/[.;]/)
      .map(s => s.trim())
      .filter(s => s.length > HIGHLIGHT_MIN_LENGTH && s.length < HIGHLIGHT_MAX_LENGTH)
      .slice(0, MAX_SUGGESTIONS);

    return {
      id: String(i + 1),
      title: `${page.title} — Descubre sus encantos`,
      description: page.extract
        ? page.extract.slice(0, FALLBACK_EXTRACT_CHARS) + (page.extract.length > FALLBACK_EXTRACT_CHARS ? '...' : '')
        : `Explora ${page.title}, un destino fascinante lleno de historia, cultura y experiencias únicas. Información de Wikivoyage.`,
      estimatedCost: budgetRanges[userParams.presupuesto] || budgetRanges['Standard'],
      highlights: highlightCandidates.length >= MAX_SUGGESTIONS
        ? highlightCandidates.slice(0, MAX_SUGGESTIONS)
        : [
            genericHighlights[i * MAX_SUGGESTIONS % genericHighlights.length],
            genericHighlights[(i * MAX_SUGGESTIONS + 1) % genericHighlights.length],
            genericHighlights[(i * MAX_SUGGESTIONS + 2) % genericHighlights.length],
          ],
    };
  });
}

// ─── PIPELINE: FUNCIONES COMPONIBLES ───

/** 3. Buscar páginas de Wikivoyage para el destino */
async function searchWikivoyage(destination: string): Promise<WikivoyageSearchPage[]> {
  const searchUrl = `${WIKI_REST}/search/page?q=${encodeURIComponent(destination)}&limit=${MAX_SUGGESTIONS}`;

  let searchRes: Response;
  try {
    searchRes = await fetchWithRetryOnTimeout(searchUrl, {}, WIKIVOYAGE_TIMEOUT_MS);
  } catch (fetchErr) {
    const classified = classifyFetchError(fetchErr, searchUrl);
    console.error(`[travel] Wikivoyage search falló [${classified.type}]:`, classified.technical);
    throw classified;
  }

  if (!searchRes.ok) {
    console.error(`[travel] Wikivoyage search HTTP ${searchRes.status} (${searchRes.statusText})`);
    const classified: ClassifiedError = {
      type: 'http',
      userMessage: 'El servicio de información de viajes no está disponible en este momento. Inténtalo más tarde.',
      technical: `Wikivoyage HTTP ${searchRes.status}: ${searchRes.statusText}`,
    };
    throw classified;
  }

  const searchData: WikivoyageSearchResponse = await searchRes.json();
  return searchData.pages || [];
}

/** 4. Obtener extracts de Wikivoyage en paralelo con fallback individual */
async function fetchExtracts(pages: WikivoyageSearchPage[]): Promise<(string | null)[]> {
  return Promise.all(
    pages.map(async (page) => {
      const extractUrl = `${WIKI_ACTION}?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(page.key)}&format=json`;
      try {
        const extractRes = await fetchWithTimeout(extractUrl, {}, WIKIVOYAGE_TIMEOUT_MS);
        if (!extractRes.ok) return null;
        const data: WikivoyageExtractResponse = await extractRes.json();
        const pageData = Object.values(data.query?.pages || {})[0];
        return pageData?.extract || null;
      } catch {
        return null;
      }
    })
  );
}

/** 5. Ensamblar el contexto de Wikivoyage, truncando extracts para reducir payload al LLM */
function assembleContext(
  pages: WikivoyageSearchPage[],
  extracts: (string | null)[]
): WikivoyageContext[] {
  return pages.map((page, i) => ({
    title: page.title,
    description: (page.description || '').slice(0, MAX_EXTRACT_CHARS),
    excerpt: (page.excerpt?.replace(/<[^>]+>/g, '') || '').slice(0, MAX_EXTRACT_CHARS),
    extract: (extracts[i] || '').slice(0, MAX_EXTRACT_CHARS),
  }));
}

/** 6. Llamar al LLM local (con parseo JSON, validación y fallback interno) */
async function callLLM(
  context: WikivoyageContext[],
  userParams: UserParams
): Promise<TravelSuggestion[]> {
  const systemPrompt = buildSystemPrompt(context, userParams);

  try {
    const llmRes = await fetchWithTimeout(`${LLM_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera exactamente ${MAX_SUGGESTIONS} sugerencias de viaje.` },
        ],
        temperature: LLM_TEMPERATURE,
        max_tokens: LLM_MAX_TOKENS,
        response_format: { type: 'json_object' },
      }),
    }, LLM_TIMEOUT_MS);

    if (!llmRes.ok) {
      console.error('[travel] LLM local respondió con error HTTP', llmRes.status);
      throw new Error(`LLM HTTP ${llmRes.status}`);
    }

    const llmData = await llmRes.json();
    const rawContent = llmData.choices?.[0]?.message?.content || '{}';

    // Parseo de JSON (2 intentos)
    let parsed: { suggestions?: TravelSuggestion[] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Intento 2: limpiar markdown
      const cleaned = cleanJsonContent(rawContent);
      parsed = JSON.parse(cleaned);
    }

    // Validar esquema
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      throw new Error('Respuesta del LLM sin array suggestions');
    }

    const result = parsed.suggestions.filter(isValidSuggestion);
    if (result.length === 0) throw new Error('Ninguna sugerencia válida del LLM');

    return result;
  } catch (llmError) {
    console.error('[travel] LLM falló, usando fallback directo de Wikivoyage:', llmError);
    return buildFallbackSuggestions(context, userParams);
  }
}

// ─── ENDPOINT ───

export const POST: APIRoute = async ({ request }) => {
  // 1. Parsear y validar inputs
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

  try {
    // 2. Wikivoyage search
    let pages: WikivoyageSearchPage[];
    try {
      pages = await searchWikivoyage(destination);
    } catch (err) {
      // Clasificar el error para dar un mensaje orientativo al usuario
      if (err && typeof err === 'object' && 'type' in err && 'userMessage' in err && 'technical' in err) {
        const classified = err as ClassifiedError;
        console.error(`[travel] Wikivoyage search falló [${classified.type}]: ${classified.technical}`);
        const status = classified.type === 'http' ? 502 : 502;
        return jsonError(status, classified.userMessage);
      }
      console.error('[travel] Wikivoyage search falló (sin clasificar):', err);
      return jsonError(502, 'No se pudo consultar la base de datos de viajes');
    }

    if (pages.length === 0) {
      return jsonError(404, `No se encontró información de viaje para "${destination}"`);
    }

    // 3. Wikivoyage extracts (paralelo con fallback individual)
    const extracts = await fetchExtracts(pages);

    // 4. Ensamblar contexto (con truncado de extracts)
    const wikivoyageContext = assembleContext(pages, extracts);

    const userParams: UserParams = {
      destino: destination,
      presupuesto: budget,
      dias: days,
      intereses: interests || 'turismo general',
    };

    // 5. LLM local (con parseo y fallback interno)
    const suggestions = await callLLM(wikivoyageContext, userParams);

    return jsonSuccess({ suggestions: suggestions.slice(0, MAX_SUGGESTIONS) });
  } catch (error) {
    console.error('[travel] Error inesperado:', error);
    return jsonError(500, 'Error interno del servidor');
  }
};
