# Memoria de Largo Plazo — UI y Estilizado

> **Ciclo de vida**: Todo el proyecto.
> **Formato**: `## [YYYY-MM-DD] @agente | lección | regla | patrón`

---

## Reglas activas

<!-- Reglas de estilo que todos los agentes deben cumplir -->

## Lecciones aprendidas

<!-- Errores recurrentes de UI/estilizado y cómo evitarlos -->

### [2026-08-02] Widget detection: usar raíz más corta para keywords (@felix)

**Error**: Crypto widget no se renderizaba con "criptos" porque la keyword era `'criptomoneda'` (singular, larga).
**Fix**: Cambiar a `'cripto'` (raíz más corta) para cubrir "cripto", "criptos", "criptomoneda", "criptomonedas" por substring match.
**Regla**: Las keywords de `detectWidgetFromKeywords()` deben usar la forma más corta posible de cada raíz léxica (ej: `'cripto'` en vez de `'criptomoneda'`, `'lluv'` en vez de `'lluvia'` o `'lloviendo'`) para maximizar cobertura de variantes y coloquialismos.

### [2026-08-02] System prompt: incluir ejemplos coloquiales para tool calling (@felix)

**Error**: El modelo `openai/gpt-oss-20b` con `reasoning_effort: 'low'` no siempre invoca `show_widget` cuando el usuario usa términos coloquiales.
**Fix**: El system prompt de `show_widget` ahora incluye ejemplos concretos como "criptos", "criptomonedas" y enfatiza "Llama SIEMPRE".
**Regla**: Las descripciones de tool calling en el system prompt deben incluir sinónimos coloquiales en español para guiar al LLM, especialmente cuando el modelo tiene baja fidelidad de tool calling.

### [2026-08-02] Fetch hooks: nunca descartar el body de error del servidor (@felix)

**Error**: TravelApp mostraba "Error al obtener sugerencias" aunque el servidor devolvía `{error: "mensaje específico"}`. El hook `useTravelData` lanzaba `throw new Error('Error al obtener sugerencias')` sin leer `res.json()`.
**Fix**: Leer el body JSON del error antes de lanzar. Si el body contiene `{error}`, propagar ese mensaje. Si no, usar `Error del servidor (${res.status})` como fallback.
**Regla**: Todo hook que haga `fetch` debe intentar extraer el mensaje de error del body con `await res.json()` y propagarlo. Nunca lanzar un `Error` genérico sin antes intentar leer la respuesta del servidor. Esto aplica a errores 4xx y 5xx.
**Patrón de código**:
```ts
// Correcto: propagar el mensaje del servidor
if (!res.ok) {
  let msg = `Error del servidor (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) msg = body.error;
  } catch {}
  throw new Error(msg);
}

// Incorrecto: descartar el mensaje del servidor
if (!res.ok) throw new Error('Error al obtener sugerencias');
```

### [2026-08-02] fetchWithTimeout: AbortError no es DOMException en Node.js (@cloe)

**Error**: Código que chequea `error instanceof DOMException` para detectar `AbortError` falla en Node.js (entorno de Vercel Functions), donde `AbortError` es un `Error` plano.
**Fix**: Usar chequeo defensivo: `error.name === 'AbortError' || (error as any).code === 'ABORT_ERR'`.
**Regla**: Todo `fetchWithTimeout` en endpoints Astro debe usar `isAbortError()` con ambos chequeos (`name` y `code`), nunca depender de `DOMException`.
**Patrón de código**:
```ts
function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.name === 'AbortError' || (err as any).code === 'ABORT_ERR';
  }
  return false;
}
```

### [2026-08-02] cleanJsonContent: extraer llaves antes de limpiar markdown (@cloe)

**Error**: La versión anterior usaba `.replace()` con regex para eliminar bloques markdown, pero esto puede dañar JSON con backticks en strings o no capturar bloques anidados.
**Fix**: Algoritmo en 2 pasos: (1) buscar primer `{` y último `}` para extraer el objeto JSON, (2) si falla, usar regex para detectar ``` ```json ``` y re-extraer.
**Regla**: La limpieza de JSON del LLM debe priorizar la extracción estructural (`indexOf('{')` → `lastIndexOf('}')`) sobre la limpieza por regex. Los modelos locales tienden a envolver el JSON en markdown incluso con `response_format: { type: 'json_object' }`.

### [2026-08-02] Clasificar errores de red en endpoints (@felix)

**Error**: POST /api/travel devolvía HTTP 502 con mensaje genérico "No se pudo consultar la base de datos de viajes" para timeout, DNS, SSL, y HTTP 5xx — todos con el mismo mensaje. El usuario no sabía si era un problema de su red o del servicio.
**Fix**: Se creó `classifyFetchError(err, url): ClassifiedError` que analiza `err.message`, `err.name`, y `err.cause?.message` (Node.js 18+) para categorizar en `timeout | dns | connection | ssl | http | unknown`. Cada tipo tiene un `userMessage` orientativo y un `technical` para logs.
**Regla**: Todo endpoint que haga `fetch` a servicios externos debe clasificar errores de red y devolver mensajes orientativos al usuario según el tipo:
- `timeout` → "El servicio tardó demasiado en responder. Inténtalo de nuevo."
- `dns` → "No se pudo conectar con el servicio. Verifica tu conexión a internet."
- `ssl` → "Error de seguridad al conectar. Verifica la fecha y hora de tu sistema."
- `http` → "El servicio externo no está disponible. Inténtalo más tarde."
- `unknown` → mensaje genérico como fallback.
**Regla**: Usar `fetchWithRetryOnTimeout` con 1 retry para mejorar resiliencia ante latencia transitoria en servicios externos (Wikivoyage, APIs de IA, etc.).
**Regla**: Los logs server-side (`console.error`) deben incluir URL, tipo de error y detalles técnicos (mensaje + causa en Node.js 18+) para diagnóstico post-mortem; nunca solo el mensaje orientativo al usuario.
**Patrón de código**:
```ts
interface ClassifiedError {
  type: 'timeout' | 'dns' | 'connection' | 'ssl' | 'http' | 'unknown';
  userMessage: string;
  technical: string;
}

function classifyFetchError(err: unknown, url: string): ClassifiedError {
  // 1. Timeout (Error lanzado por fetchWithTimeout)
  if (err instanceof Error && err.message.startsWith('Timeout de')) {
    return { type: 'timeout', userMessage: '...', technical: err.message };
  }
  // 2. TypeError con .cause (Node.js 18+): DNS, connection, SSL
  if (err instanceof TypeError) {
    const causeMsg = (err as any).cause?.message?.toLowerCase() || '';
    if (causeMsg.includes('enotfound')) return { type: 'dns', ... };
    if (causeMsg.includes('econnrefused')) return { type: 'connection', ... };
    // ...
  }
  return { type: 'unknown', ... };
}
```

## Patrones establecidos

<!-- Patrones de diseño visual confirmados como estándar del proyecto -->

---

## [2026-08-02] @felix | lección | Manejo de Rate Limits (HTTP 429)

**Contexto**: Wikivoyage REST API devolvía 429 sin diferenciación del resto de errores HTTP, resultando en mensajes genéricos "502 Bad Gateway" sin pistas para el usuario.

### Reglas

1. **Todo fetch a servicios externos debe diferenciar códigos HTTP del upstream** (429 → rate limit con retry + backoff, 503 → servicio no disponible, etc.) y propagar mensajes orientativos al cliente. No agrupar todos los `!res.ok` en un mismo tipo de error.

2. **Usar `Retry-After` header cuando el upstream lo provee en respuestas 429**. Si no está presente, usar un backoff por defecto (2s). Reintentar exactamente 1 vez.

3. **Mapear tipos de error del upstream a códigos HTTP semánticamente correctos**:
   - `ratelimit` → 503 (Service Unavailable), no 502 (Bad Gateway)
   - `http` (genérico) → 502
   - Usar un `statusMap` explícito en lugar de ternarios o if/else para facilitar la extensión futura.

### Patrón de implementación

```ts
// 1. Tipo explícito en el union
type: 'timeout' | 'dns' | 'connection' | 'ssl' | 'http' | 'ratelimit' | 'unknown';

// 2. En searchWikivoyage — retry + backoff para 429
if (searchRes.status === 429) {
  const retryAfter = searchRes.headers.get('Retry-After');
  const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
  await new Promise(resolve => setTimeout(resolve, delayMs));
  // ... reintentar 1 vez ...
  if (retryRes.status === 429) {
    throw { type: 'ratelimit', userMessage: '...', technical: '...' };
  }
}

// 3. En el handler — statusMap semántico
const statusMap: Record<ClassifiedError['type'], number> = {
  timeout: 502, dns: 502, connection: 502, ssl: 502,
  http: 502, ratelimit: 503, unknown: 502,
};
const status = statusMap[classified.type] || 502;
```

