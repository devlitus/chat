# Especificación Técnica — Refactor Travel Endpoint (Tabiji Migration)

> **Rama**: `refactor/tabiji-migration`
> **Autor**: @leo (Arquitecto)
> **Fecha**: 2026-08-02
> **Dirigido a**: @cloe (Frontend Developer)
> **Estado**: ✅ Aprobado por el usuario — listo para implementar

---

## Resumen

Se reemplaza por completo la dependencia de **Groq** en el endpoint `/api/travel` por un pipeline de 3 etapas: **Wikivoyage REST API → Wikivoyage Action API (extracts) → LLM Local (LM Studio)** como traductor y enriquecedor de datos. El LLM local ya no **genera** sugerencias desde cero, sino que **traduce y adapta** datos factuales de Wikivoyage al español. Si el LLM falla (timeout, JSON inválido), se activa un **fallback directo** con datos crudos de Wikivoyage.

---

## 1. Archivos a modificar

| Archivo | Tipo de cambio | Descripción |
|---------|----------------|-------------|
| `src/pages/api/travel.ts` | **Reescritura completa** | Nuevo pipeline Wikivoyage + LLM local |
| `src/components/mcp/travel/useTravelData.ts` | Ajustes mínimos | Sin cambios en la lógica, solo copy/loading text |
| `src/components/mcp/TravelApp.tsx` | Cambios de copy | Subtítulo y texto de loading |
| `.env` | Añadir variables | `LLM_LOCAL_URL`, `LLM_LOCAL_MODEL` |
| `.env.example` | Añadir variables | Mismas que `.env` sin valores sensibles |

### Archivos que NO se modifican

- `src/lib/groq-client.ts` — sigue siendo usado por el chat principal
- `src/lib/groq-models.ts` — ídem
- `src/lib/system-prompt.ts` — la detección del widget `travel` no cambia
- `src/lib/session.ts` — no aplica
- `package.json` — no se añaden ni eliminan dependencias (se usa `fetch` nativo)

---

## 2. APIs externas utilizadas

### 2.1 Wikivoyage REST API

| Propiedad | Valor |
|-----------|-------|
| Base URL | `https://en.wikivoyage.org/w/rest.php/v1` |
| Endpoint search | `GET /search/page?q={query}&limit=3` |
| Timeout | 5 segundos |
| Rate limit | No documentado; usar con moderación |

**Formato de respuesta (search)**:
```ts
interface WikivoyageSearchResponse {
  pages: Array<{
    id: number;
    key: string;          // ej: "Tokyo"
    title: string;        // ej: "Tokyo"
    excerpt: string;      // HTML snippet con <span class=\"searchmatch\">
    description: string;  // puede ser undefined
  }>;
}
```

### 2.2 Wikivoyage Action API (MediaWiki)

| Propiedad | Valor |
|-----------|-------|
| Base URL | `https://en.wikivoyage.org/w/api.php` |
| Parámetros | `action=query&prop=extracts&exintro=1&explaintext=1&titles={title}&format=json` |
| Timeout | 5 segundos |
| Fallback | Si falla, se continúa con solo excerpt |

**Formato de respuesta (extract)**:
```ts
interface WikivoyageExtractResponse {
  query: {
    pages: {
      [pageId: string]: {
        pageid: number;
        title: string;
        extract: string;   // texto plano, primeras secciones
      };
    };
  };
}
```

### 2.3 LLM Local (LM Studio — OpenAI-compatible)

| Propiedad | Valor |
|-----------|-------|
| URL | Configurable vía `LLM_LOCAL_URL` |
| Endpoint | `{LLM_LOCAL_URL}/chat/completions` |
| Verbo HTTP | `POST` |
| Timeout | 25 segundos |
| Fallback | Si falla, se activa fallback directo de Wikivoyage |

---

## 3. Variables de entorno

### 3.1 Nuevas variables requeridas

```bash
# .env y .env.example

# LLM Local para el endpoint /api/travel
# URL base del servidor LM Studio (OpenAI-compatible)
LLM_LOCAL_URL=http://192.168.1.133:1234/v1

# Modelo a usar en el LLM local (debe estar cargado en LM Studio)
LLM_LOCAL_MODEL=lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF
```

### 3.2 Variables que se eliminan del endpoint travel.ts

- `GROQ_API_KEY` — **ya no se usa** en este endpoint. El endpoint deja de importar `groq-sdk`.
- `OLLAMA_BASE_URL` y `OLLAMA_MODEL` — **no se tocan**, siguen siendo usados por el chat principal.

### 3.3 Acceso en Astro

```ts
const llmUrl = import.meta.env.LLM_LOCAL_URL || 'http://192.168.1.133:1234/v1';
const llmModel = import.meta.env.LLM_LOCAL_MODEL || 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF';
```

---

## 4. Flujo del endpoint (paso a paso)

### Diagrama de flujo

```
POST /api/travel
    │
    ├─ [1] Validar inputs
    │   ├─ destination requerido y no vacío
    │   ├─ days requerido, entero positivo
    │   └─ budget, interests opcionales → defaults
    │
    ├─ [2] Wikivoyage Search (timeout: 5s)
    │   ├─ GET /w/rest.php/v1/search/page?q={destination}&limit=3
    │   ├─ ¿Éxito?
    │   │   ├─ Sí → continuar a [3]
    │   │   └─ No → Error 502: "No se pudo consultar Wikivoyage"
    │   └─ ¿0 resultados?
    │       └─ Error 404: "No se encontró información para '{destination}'"
    │
    ├─ [3] Wikivoyage Extracts (timeout: 5s por página, en paralelo)
    │   ├─ GET /w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={title}&format=json
    │   ├─ por cada page.key de [2]
    │   ├─ ¿Éxito?
    │   │   ├─ Sí → añadir extract al objeto
    │   │   └─ No → continuar sin extract (solo excerpt del search)
    │
    ├─ [4] Ensamblar contexto para LLM
    │   ├─ Estructurar datos de Wikivoyage
    │   ├─ Inyectar parámetros del usuario (destination, budget, days, interests)
    │   └─ Construir el system prompt (ver sección 5)
    │
    ├─ [5] Llamada al LLM Local (timeout: 25s)
    │   ├─ POST {LLM_LOCAL_URL}/chat/completions
    │   ├─ Body: { model, messages, temperature, max_tokens, response_format }
    │   ├─ ¿Éxito?
    │   │   ├─ Sí → continuar a [6]
    │   │   └─ No → ir a [8] fallback directo
    │
    ├─ [6] Parseo de JSON (Intento 1)
    │   ├─ JSON.parse(rawContent)
    │   ├─ ¿Éxito?
    │   │   ├─ Sí → continuar a [7]
    │   │   └─ No → ir a [6b]
    │
    ├─ [6b] Parseo de JSON (Intento 2 — limpiar markdown)
    │   ├─ cleanJsonContent(rawContent) → eliminar ```json ... ```
    │   ├─ JSON.parse(cleanedContent)
    │   ├─ ¿Éxito?
    │   │   ├─ Sí → continuar a [7]
    │   │   └─ No → ir a [8] fallback directo
    │
    ├─ [7] Validar esquema de respuesta
    │   ├─ result.suggestions es array de 1-3 items
    │   ├─ Cada item tiene { id, title, description, estimatedCost, highlights }
    │   ├─ ¿Válido?
    │   │   ├─ Sí → 200 { suggestions }
    │   │   └─ No → filtrar items inválidos; si quedan ≥1 → 200; si 0 → [8] fallback
    │
    └─ [8] Fallback directo de Wikivoyage
        ├─ Construir TravelSuggestion[] desde datos crudos de Wikivoyage
        ├─ title: "{destination} — Descubre sus encantos"
        ├─ description: excerpt (inglés, con nota "Información de Wikivoyage")
        ├─ estimatedCost: inferir del budget del usuario
        ├─ highlights: ["Patrimonio cultural", "Naturaleza", ...] tags genéricos
        └─ 200 { suggestions }
```

### Pseudocódigo del endpoint completo

```ts
// src/pages/api/travel.ts

export const POST: APIRoute = async ({ request }) => {
  // ─── 1. PARSEAR Y VALIDAR INPUTS ───
  const body = await request.json();
  const { destination, budget = 'Standard', days, interests = '' } = body;

  if (!destination?.trim()) {
    return jsonError(400, 'El destino es obligatorio');
  }
  if (!days || isNaN(Number(days)) || Number(days) < 1) {
    return jsonError(400, 'El número de días debe ser un entero positivo');
  }

  // ─── 2. CONFIGURAR TIMEOUTS ───
  const LLM_URL = import.meta.env.LLM_LOCAL_URL || 'http://192.168.1.133:1234/v1';
  const LLM_MODEL = import.meta.env.LLM_LOCAL_MODEL || 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF';
  const WIKI_REST = 'https://en.wikivoyage.org/w/rest.php/v1';
  const WIKI_ACTION = 'https://en.wikivoyage.org/w/api.php';

  async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  try {
    // ─── 3. WIKIVOYAGE SEARCH ───
    const searchUrl = `${WIKI_REST}/search/page?q=${encodeURIComponent(destination)}&limit=3`;
    const searchRes = await fetchWithTimeout(searchUrl, {}, 5000);

    if (!searchRes.ok) {
      console.error('[travel] Wikivoyage search falló:', searchRes.status);
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
    const wikivoyageContext = pages.map((page, i) => ({
      title: page.title,
      description: page.description || '',
      excerpt: page.excerpt?.replace(/<[^>]+>/g, '') || '',
      extract: extracts[i] || '',
    }));

    const userParams = {
      destino: destination,
      presupuesto: budget,
      dias: Number(days),
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

      if (!llmRes.ok) throw new Error(`LLM HTTP ${llmRes.status}`);

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
        throw new Error('Respuesta sin array suggestions');
      }

      // Filtrar solo items válidos
      llmResult = parsed.suggestions.filter(isValidSuggestion);
      if (llmResult.length === 0) throw new Error('Ninguna sugerencia válida');

    } catch (llmError) {
      console.error('[travel] LLM falló, usando fallback:', llmError);
      llmResult = buildFallbackSuggestions(wikivoyageContext, userParams);
    }

    return jsonSuccess({ suggestions: llmResult.slice(0, 3) });

  } catch (error) {
    console.error('[travel] Error inesperado:', error);
    return jsonError(500, 'Error interno del servidor');
  }
};
```

---

## 5. System Prompt del LLM Local (texto exacto)

```text
Eres un asistente especializado en planificación de viajes. Recibirás datos de Wikivoyage en inglés y los parámetros del usuario en español. Tu tarea es traducir, adaptar y enriquecer esos datos para producir sugerencias de viaje en español.

## REGLAS ESTRICTAS

1. **NO inventes información.** Todo lo que escribas debe estar basado en los datos de Wikivoyage proporcionados. Si un dato no está en el contexto, no lo incluyas.
2. **Genera EXACTAMENTE 3 sugerencias.** Ni más ni menos. Si solo tienes 2 páginas de Wikivoyage, adapta la información para crear 3 variaciones (ej: "ruta cultural", "ruta gastronómica", "ruta naturaleza").
3. **Traduce todo al español natural.** Nada de inglés en la salida. Usa un tono cálido y entusiasta, como un guía turístico experto.
4. **estimatedCost debe reflejar el presupuesto del usuario.** Usa rangos como "$500-$800 USD", "$200-$400 USD", "$1,500-$2,500 USD" según el presupuesto indicado (Económico ≈ bajo, Standard ≈ medio, Lujo ≈ alto).
5. **highlights debe tener exactamente 3 elementos.** Cada uno debe ser una frase corta (máx. 5 palabras) que describa una atracción o actividad concreta del destino.

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

NO envuelvas el JSON en bloques de markdown (```json). Devuelve el JSON puro.
```

### Ejemplos de campos esperados (para guiar al LLM)

```
title:          "Tokio — Fusión de tradición y futuro en 5 días"
description:    "Explora templos milenarios en Asakusa, piérdete en las luces de Shibuya y degusta el mejor ramen en Shinjuku. Una experiencia que mezcla la serenidad japonesa con la energía urbana más vibrante del planeta."
estimatedCost:  "$800-$1,200 USD"
highlights:     ["Templo Senso-ji", "Cruce de Shibuya", "Mercado Tsukiji"]
```

---

## 6. Estrategia de Parseo y Reparación de JSON

### Función `cleanJsonContent` (se reutiliza la existente con ajuste)

```ts
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
```

### Función de validación de sugerencia individual

```ts
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
```

### Pipeline de parseo completo

```
rawContent (string del LLM)
    │
    ├─ Paso 1: JSON.parse(rawContent)
    │   ├─ Éxito → validar esquema → devolver
    │   └─ Falla (SyntaxError) → Paso 2
    │
    ├─ Paso 2: cleaned = cleanJsonContent(rawContent)
    │          JSON.parse(cleaned)
    │   ├─ Éxito → validar esquema → devolver
    │   └─ Falla (SyntaxError) → Paso 3
    │
    └─ Paso 3: FALLBACK — usar buildFallbackSuggestions()
               (ignorar completamente la respuesta del LLM)
```

---

## 7. Estrategia de Fallback (sin LLM)

Cuando el LLM falla por timeout, error HTTP, o JSON inválido tras 2 intentos de parseo, se construyen sugerencias directamente de los datos de Wikivoyage:

### Pseudocódigo de `buildFallbackSuggestions`

```ts
function buildFallbackSuggestions(
  wikiData: WikivoyageContext[],
  userParams: UserParams
): TravelSuggestion[] {
  const budgetRanges: Record<string, string> = {
    'Económico': '$200-$500 USD',
    'Standard': '$500-$1,200 USD',
    'Lujo': '$1,500-$3,000 USD',
  };

  // Tags genéricos de viaje que combinamos con el destino
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
```

### Nota sobre el idioma en fallback

El contenido de Wikivoyage está en **inglés**. En modo fallback, las descripciones se mostrarán en inglés con una indicación de fuente. Esto es aceptable porque el fallback es una ruta de degradación, no el camino feliz.

---

## 8. Contrato de Respuesta (sin cambios)

### TypeScript interfaces (en `useTravelData.ts`, sin cambios)

```ts
interface TravelSuggestion {
  id: string;
  title: string;
  description: string;
  estimatedCost: string;
  highlights: string[];
}
```

### Respuesta exitosa (HTTP 200)

```json
{
  "suggestions": [
    {
      "id": "1",
      "title": "Tokio — Fusión de tradición y futuro en 5 días",
      "description": "Explora templos milenarios en Asakusa, piérdete en las luces de Shibuya...",
      "estimatedCost": "$800-$1,200 USD",
      "highlights": ["Templo Senso-ji", "Cruce de Shibuya", "Mercado Tsukiji"]
    }
    // ... hasta 3 sugerencias
  ]
}
```

### Respuesta de error

```json
{
  "error": "Mensaje descriptivo del error"
}
```

Códigos de error posibles:
| HTTP Status | Significado |
|-------------|-------------|
| 400 | Input inválido (destination vacío, days no numérico) |
| 404 | Wikivoyage no tiene datos para ese destino |
| 500 | Error interno inesperado |
| 502 | Fallo en APIs externas (Wikivoyage search, LLM con fallback también fallido) |

---

## 9. Timeouts por etapa

| Etapa | Timeout | Tipo de timeout | Acción si falla |
|-------|---------|-----------------|-----------------|
| Wikivoyage search | **5s** | `AbortController` | `502` — "No se pudo consultar la base de datos de viajes" |
| Wikivoyage extract (×N) | **5s** cada uno | `AbortController` individual | Continuar sin extract para esa página (solo excerpt) |
| LLM local | **25s** | `AbortController` | Activar `buildFallbackSuggestions()` |
| Total endpoint | **~30s** | Timeout de Vercel Function (10s default en Hobby → 30s configurable) | Error 504 del platform |

### Implementación de fetch con timeout

```ts
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
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Timeout de ${timeoutMs}ms excedido para ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
```

> **Nota**: En Node.js (entorno de Vercel Functions), `DOMException` no existe; `AbortError` se manifiesta como un `Error` con `error.name === 'AbortError'` o `error.code === 'ABORT_ERR'`. Usar chequeo defensivo:
> ```ts
> const isAbortError = (err: unknown): boolean => {
>   if (err instanceof Error) {
>     return err.name === 'AbortError' || (err as any).code === 'ABORT_ERR';
>   }
>   return false;
> };
> ```

---

## 10. Cambios en Frontend

### 10.1 `TravelApp.tsx` — Cambios de copy

| Ubicación | Texto actual | Texto nuevo |
|-----------|-------------|-------------|
| Línea 400 (subtítulo header) | `Impulsado por IA` | `Datos de Wikivoyage · IA local` |
| Línea 511 (loading subtitle) | `Consultando agentes expertos...` | `Explorando Wikivoyage...` |
| Línea 510 (loading title) | `Diseñando tu viaje ideal` | Sin cambios (está bien) |
| Línea 404 (form, después de results) | Sin cambios | Se añade footer sutil en results: `Fuente: Wikivoyage` |

#### Footer de fuente (solo visible en resultados)

```tsx
// Añadir después del cierre del div resultsScroll (antes del botón "Nueva Búsqueda")
<div style={{
  textAlign: 'center' as const,
  fontSize: '10px',
  color: '#4b5563',
  padding: '4px 0',
  flexShrink: 0,
}}>
  Datos obtenidos de Wikivoyage · Enriquecidos con IA local
</div>
```

### 10.2 `useTravelData.ts` — Sin cambios de lógica

Este archivo **no necesita cambios funcionales**. El contrato `TravelSuggestion` es idéntico, el endpoint devuelve el mismo formato. Solo verificar que el mensaje de error del servidor se siga propagando correctamente (ya está bien implementado desde el fix de @felix).

### 10.3 Interfaz TypeScript

La interfaz `TravelSuggestion` **permanece idéntica** en `useTravelData.ts`. Si se desea compartir el tipo entre frontend y backend, se puede extraer a `src/lib/travel-types.ts` como mejora opcional (no requerida para este refactor).

```ts
// Opcional: src/lib/travel-types.ts
export interface TravelSuggestion {
  id: string;
  title: string;
  description: string;
  estimatedCost: string;
  highlights: string[];
}

export interface TravelRequest {
  destination: string;
  budget?: string;
  days: string;
  interests?: string;
}

export interface TravelResponse {
  suggestions: TravelSuggestion[];
}

export interface TravelError {
  error: string;
}
```

---

## 11. Utilidades auxiliares (`json-response.ts`)

Se recomienda crear un pequeño helper para estandarizar respuestas JSON del endpoint:

```ts
// Puede ir inline en travel.ts o en src/lib/json-response.ts

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
```

---

## 12. Eliminaciones

### Dependencias que se eliminan del endpoint

- `import Groq from 'groq-sdk'` — **eliminar** (ya no se usa en travel.ts)
- La variable `groq` y todo el bloque de `groq.chat.completions.create()` — **eliminar**
- El manejo granular de errores de Groq (401, 429, etc.) — **reemplazar** por manejo de errores HTTP genérico del LLM local

### NOTA: NO eliminar del proyecto

- `groq-sdk` del `package.json` — se sigue usando en el chat principal (`src/pages/api/chat.ts`)
- `GROQ_API_KEY` del `.env` — se sigue usando en el chat principal

---

## 13. Testabilidad

### Puntos a considerar para tests

1. **Mock de `fetch`**: El endpoint depende de `fetch` nativo. En tests de Vitest, usar `vi.stubGlobal('fetch', mockFetch)`.
2. **Wikivoyage search vacío**: Testear que `{ pages: [] }` devuelve 404.
3. **Timeout de Wikivoyage**: Testear que `AbortController` dispara un 502.
4. **LLM devuelve markdown**: Testear que ` ```json ... ``` ` se limpia correctamente.
5. **LLM timeout**: Testear que tras 25s se activa fallback.
6. **Fallback con 0 páginas**: Si Wikivoyage search devuelve 0 resultados, el fallback no debería ejecutarse (se devuelve 404 antes).

---

## 14. Resumen de cambios para @cloe

### Archivos a crear
| Archivo | Descripción |
|---------|-------------|
| _(ninguno obligatorio)_ | Las utilidades pueden ir inline |

### Archivos a modificar
| Archivo | Prioridad | Complejidad |
|---------|-----------|-------------|
| `src/pages/api/travel.ts` | **Alta** | Alta — reescritura completa (~150 líneas nuevas) |
| `src/components/mcp/TravelApp.tsx` | Media | Baja — 3 cambios de copy |
| `.env` | Media | Baja — añadir 2 variables |
| `.env.example` | Media | Baja — añadir 2 variables |

### Archivos a NO tocar
- `src/components/mcp/travel/useTravelData.ts` — sin cambios funcionales
- `src/lib/groq-client.ts` — sin cambios
- `package.json` — sin cambios de dependencias

---

## 15. Checklist de implementación

- [ ] Crear rama `refactor/tabiji-migration` desde `main` (si no existe ya)
- [ ] Añadir `LLM_LOCAL_URL` y `LLM_LOCAL_MODEL` a `.env` y `.env.example`
- [ ] Reescribir `src/pages/api/travel.ts`:
  - [ ] Eliminar import de Groq
  - [ ] Implementar `fetchWithTimeout` con `AbortController`
  - [ ] Implementar etapa 1: Wikivoyage search
  - [ ] Implementar etapa 2: Wikivoyage extracts (paralelo)
  - [ ] Implementar etapa 3: llamada LLM local con system prompt
  - [ ] Implementar parseo JSON (2 intentos + validación esquema)
  - [ ] Implementar `buildFallbackSuggestions`
  - [ ] Implementar helpers `jsonResponse`, `jsonError`, `jsonSuccess`
  - [ ] Manejar todos los casos de error con códigos HTTP correctos
- [ ] Modificar `src/components/mcp/TravelApp.tsx`:
  - [ ] Cambiar subtítulo: `Impulsado por IA` → `Datos de Wikivoyage · IA local`
  - [ ] Cambiar loading subtitle: `Consultando agentes expertos...` → `Explorando Wikivoyage...`
  - [ ] Añadir footer de fuente en resultados
- [ ] Ejecutar `pnpm build` — verificar que compila sin errores
- [ ] Ejecutar `pnpm test` — verificar que no hay regresiones
- [ ] Probar manualmente con un destino real (ej: "Tokyo")
- [ ] Registrar decisión en memoria con `memory-cycle log`

---

> **@cloe**: Este documento contiene toda la información necesaria para implementar el refactor. El contrato de respuesta NO cambia, por lo que el frontend solo requiere ajustes de copy. El endpoint es una reescritura completa — asegúrate de manejar todos los casos de error y timeouts según lo especificado. ¡Adelante!
