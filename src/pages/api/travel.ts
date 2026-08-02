// src/pages/api/travel.ts
// Endpoint de sugerencias de viaje con soporte dual: LLM local (LM Studio) o Groq Cloud.
// Pipeline: Validación → System Prompt → LLM (Local o Groq) → Parseo JSON → Validación → 200

import type { APIRoute } from 'astro';
import Groq from 'groq-sdk';
import { DEFAULT_GROQ_MODEL } from '../../lib/groq-models';

export const prerender = false;

// ─── CONFIGURACIÓN DEL MÓDULO ───

const LLM_URL = import.meta.env.LLM_LOCAL_URL || 'http://192.168.1.133:1234/v1';
const LLM_MODEL = import.meta.env.LLM_LOCAL_MODEL || 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF';

// ─── CONSTANTES ───

const LLM_LOCAL_TIMEOUT_MS = 60000;
const GROQ_TIMEOUT_MS = 60000;
const LLM_TEMPERATURE = 0.7;
const LLM_MAX_TOKENS = 2048;
const MAX_SUGGESTIONS = 3;

// Whitelist de modelos Groq (misma que /api/chat)
const ALLOWED_GROQ_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "gemma-7b-it",
  "qwen-qwq-32b",
  "deepseek-r1-distill-llama-70b",
  "deepseek-r1-distill-qwen-32b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "openai/gpt-oss-20b",
  "compound-beta",
  "compound-beta-mini",
]);

// ─── TIPOS ───

interface TravelSuggestion {
  id: string;
  title: string;
  description: string;
  estimatedCost: string;
  highlights: string[];
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

function buildSystemPrompt(params: UserParams): string {
  return `Eres un asistente especializado en planificación de viajes con amplio conocimiento sobre destinos turísticos de todo el mundo. Tu tarea es generar sugerencias de viaje personalizadas en español usando tu conocimiento interno.

## REGLAS ESTRICTAS

1. **Usa tu conocimiento interno.** Genera sugerencias basadas en lo que sabes sobre el destino. Sé específico: menciona lugares, barrios, platos típicos y actividades reales del destino.
2. **NO inventes datos factuales falsos.** Si no estás seguro de un detalle concreto (ej: el nombre exacto de un templo o museo), sé vago pero no inventes. Por ejemplo: "un mercado tradicional de especias" en lugar de inventar un nombre.
3. **Genera EXACTAMENTE ${MAX_SUGGESTIONS} sugerencias.** Cada una debe ser una ruta o experiencia diferente (ej: cultural, gastronómica, naturaleza, histórica, aventura).
4. **Escribe todo en español natural.** Usa un tono cálido y entusiasta, como un guía turístico experto. Nada de inglés en la salida.
5. **estimatedCost debe reflejar el presupuesto.** Usa rangos orientativos según el nivel:
   - Económico: "$200-$600 USD"
   - Standard: "$600-$1,500 USD"
   - Lujo: "$1,500-$4,000 USD"
   Adapta el rango según el destino (Tailandia es más barato que Suiza).
6. **highlights debe tener exactamente 3 elementos.** Cada uno debe ser una frase corta de 3 a 5 palabras describiendo una atracción, actividad o experiencia concreta.
7. **description debe tener 2 a 4 frases.** Describe el ambiente, las actividades principales y por qué esa experiencia es especial. Menciona al menos un lugar o actividad concreta.

## PARÁMETROS DEL USUARIO

- Destino: ${params.destino}
- Presupuesto: ${params.presupuesto}
- Días: ${params.dias}
- Intereses: ${params.intereses || 'turismo general'}

## FORMATO DE SALIDA

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:

{
  "suggestions": [
    {
      "id": "1",
      "title": "Nombre atractivo de la sugerencia en español",
      "description": "2-4 frases describiendo el ambiente y actividades principales.",
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

// ─── PARSEO DE JSON COMPARTIDO ───

function parseLLMResponse(rawContent: string): TravelSuggestion[] {
  // Parseo de JSON (2 intentos: directo + limpieza de markdown)
  let parsed: { suggestions?: unknown[] };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    const cleaned = rawContent
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```/g, '')
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[travel] JSON inválido del LLM:', rawContent.slice(0, 500));
      throw new Error('El modelo de IA devolvió un formato incorrecto. Inténtalo de nuevo.');
    }
  }

  if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
    console.error('[travel] Respuesta del LLM sin array suggestions:', rawContent.slice(0, 300));
    throw new Error('El modelo de IA no generó sugerencias válidas. Inténtalo de nuevo.');
  }

  const result = parsed.suggestions.filter(isValidSuggestion);
  if (result.length === 0) {
    console.error('[travel] Ninguna sugerencia válida del LLM tras filtrar');
    throw new Error('El modelo de IA no pudo generar sugerencias con el formato requerido. Inténtalo de nuevo.');
  }

  return result;
}

// ─── LLM LOCAL ───

async function fetchLocalTravelSuggestions(params: UserParams): Promise<TravelSuggestion[]> {
  const systemPrompt = buildSystemPrompt(params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_LOCAL_TIMEOUT_MS);

  try {
    const llmRes = await fetch(`${LLM_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera exactamente ${MAX_SUGGESTIONS} sugerencias de viaje para ${params.destino}.` },
        ],
        temperature: LLM_TEMPERATURE,
        max_tokens: LLM_MAX_TOKENS,
        // Nota: response_format: { type: 'json_object' } eliminado.
        // LM Studio con Gemma 4 solo acepta 'json_schema' o 'text'.
        // El system prompt instruye al modelo a devolver JSON puro,
        // y el parser tiene lógica de doble intento (directo + limpieza markdown).
      }),
      signal: controller.signal,
    });

    if (!llmRes.ok) {
      console.error('[travel] LLM local respondió con error HTTP', llmRes.status);
      throw new Error('El modelo de IA no está disponible. Verifica que LM Studio esté encendido y funcionando.');
    }

    const llmData = await llmRes.json();
    const rawContent = llmData.choices?.[0]?.message?.content || '{}';

    return parseLLMResponse(rawContent);
  } catch (err) {
    // Timeout (AbortController)
    if ((err as any)?.name === 'AbortError') {
      throw new Error('El modelo de IA tardó demasiado en responder. Inténtalo de nuevo en unos segundos.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── LLM GROQ ───

async function fetchGroqTravelSuggestions(params: UserParams, groqModel?: string): Promise<TravelSuggestion[]> {
  const apiKey = import.meta.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY no está configurada. Configúrala en .env o usa el proveedor local.');
  }

  const groq = new Groq({ apiKey });
  const systemPrompt = buildSystemPrompt(params);

  // Validar el modelo contra la whitelist, usar default si no es válido
  const modelId = (groqModel && ALLOWED_GROQ_MODELS.has(groqModel))
    ? groqModel
    : DEFAULT_GROQ_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Genera exactamente ${MAX_SUGGESTIONS} sugerencias de viaje para ${params.destino}.` },
      ],
      model: modelId,
      temperature: LLM_TEMPERATURE,
      max_completion_tokens: LLM_MAX_TOKENS,
      stream: false,
    }, { signal: controller.signal });

    const rawContent = completion.choices?.[0]?.message?.content || '{}';

    return parseLLMResponse(rawContent);
  } catch (err) {
    // Errores del SDK de Groq (APIError, APIConnectionError, etc.)
    const groqErr = err as { status?: number; message?: string; name?: string };
    if (groqErr.status) {
      console.error('[travel] Groq API error:', groqErr.status, groqErr.message);
      throw new Error(`Error del servicio Groq (${groqErr.status}). Inténtalo de nuevo.`);
    }
    if (groqErr.name === 'AbortError') {
      throw new Error('Groq tardó demasiado en responder. Inténtalo de nuevo.');
    }
    // Error de conexión/red (APIConnectionError, "Premature close", etc.) sin status HTTP
    if (groqErr.message) {
      console.error('[travel] Groq connection error:', groqErr.message);
      throw new Error('No se pudo conectar con Groq. Verifica tu conexión a internet o cambia al proveedor local.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
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

  const userParams: UserParams = {
    destino: destination,
    presupuesto: budget,
    dias: days,
    intereses: interests || 'turismo general',
  };

  // 2. Determinar proveedor (respeta el selector del usuario)
  const provider = typeof body.provider === 'string' ? body.provider : undefined;
  const normalizedProvider = (provider === 'groq') ? 'groq' : 'local';
  const groqModel = typeof body.groqModel === 'string' ? body.groqModel : undefined;

  // 3. Llamar al LLM según el proveedor
  try {
    const suggestions = normalizedProvider === 'groq'
      ? await fetchGroqTravelSuggestions(userParams, groqModel)
      : await fetchLocalTravelSuggestions(userParams);
    return jsonSuccess({ suggestions: suggestions.slice(0, MAX_SUGGESTIONS) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    console.error('[travel] Error en endpoint:', message);
    return jsonError(502, message);
  }
};
