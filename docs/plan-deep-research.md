# Plan: Deep Research Mode

## Resumen

Modo de investigacion profunda que resuelve preguntas complejas mediante multiples busquedas encadenadas, lectura de URLs completas y sintesis estructurada con fuentes citadas. Funciona con ambos providers (Ollama y Groq) y emite eventos SSE tipados de progreso al frontend.

---

## Contexto

El tool calling actual de Ollama ejecuta hasta 5 iteraciones con `web_search` (5 resultados, snippet corto). Groq no tiene tool calling. Ninguno puede resolver preguntas que requieren:

- Investigar multiples subtemas en paralelo o secuencia
- Leer el contenido completo de paginas web relevantes
- Sintetizar desde 5-10 fuentes con citas verificables

---

## Diseno propuesto

### Archivos nuevos a crear

```
src/lib/api/deep-research.ts          — loop agentico de deep research (Ollama y Groq)
src/lib/api/research-tools.ts         — tools web_search_deep y fetch_url
src/components/react/research/ResearchProgress.tsx  — indicador de progreso SSE
src/components/react/input/ResearchToggle.tsx       — boton toggle en ChatInput
```

### Archivos existentes a modificar

```
src/lib/api/chat-stream.ts            — exportar streamGroqWithTools()
src/lib/api/tools.ts                  — re-exportar RESEARCH_TOOL_DEFINITIONS y executeResearchTool()
src/pages/api/chat.ts                 — enrutar research:true al stream correcto
src/lib/groq-client.ts                — añadir campo research al ChatRequestBody
src/stores/chat-store.ts              — añadir $researchMode, $researchProgress atoms
src/stores/chat-actions.ts            — añadir setResearchProgress(), clearResearchProgress()
src/components/react/ChatInput.tsx    — montar ResearchToggle
src/components/react/MessageArea.tsx  — mostrar ResearchProgress durante streaming
src/components/react/hooks/useSendMessage.ts — leer $researchMode y parsear SSE de progreso
```

### Estructura de componentes

```
ChatInput
  └── ResearchToggle          (island React, estado local + atom $researchMode)

MessageArea
  └── ResearchProgress        (island React, consume $researchProgress)
  └── StreamingBotMessage     (existente, sin cambios)
```

---

## Schema de los eventos SSE de progreso

El stream de deep research intercala eventos de progreso con los tokens de respuesta final. Se distinguen por el campo `type` en el objeto JSON del data.

### Tokens de texto (sin cambios, compatibles con parser existente)

```
data: {"choices":[{"delta":{"content":"token"}}]}
```

### Evento: planificacion iniciada

```json
data: {"type":"research_plan","queries":["query1","query2","query3"]}
```

### Evento: busqueda en curso

```json
data: {"type":"searching","query":"inteligencia artificial en medicina 2025","index":1,"total":3}
```

### Evento: URL siendo leida

```json
data: {"type":"reading_url","url":"https://ejemplo.com/articulo","title":"Titulo del articulo"}
```

### Evento: sintesis iniciada

```json
data: {"type":"synthesizing","sources_count":7}
```

### Evento: fin de investigacion (antes del stream de respuesta)

```json
data: {"type":"research_done","sources":[{"title":"...","url":"..."}]}
```

### Evento de fin (sin cambios)

```
data: [DONE]
```

Los eventos de progreso NO contienen `choices`, por lo que el parser actual de `groq-client.ts` los descarta silenciosamente. Solo `useSendMessage.ts` los consume antes de pasarlos al stream de tokens.

---

## Schema de las nuevas herramientas

### `web_search_deep`

Llama a Tavily con `search_depth: "advanced"`, `max_results: 10` e `include_raw_content: "markdown"`. Devuelve titulo, URL, contenido completo (hasta 3000 chars por resultado) y puntuacion de relevancia.

```typescript
{
  type: 'function',
  function: {
    name: 'web_search_deep',
    description: 'Busqueda avanzada de alta relevancia con contenido completo de cada resultado. Usa esta herramienta en modo deep research para obtener informacion detallada sobre un subtema especifico.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Consulta de busqueda especifica y enfocada en un subtema concreto.'
        },
        time_range: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year'],
          description: 'Rango temporal para filtrar resultados. Opcional.'
        }
      },
      required: ['query']
    }
  }
}
```

Retorno (string formateado para el LLM):

```
[Resultado 1]
Titulo: ...
URL: https://...
Contenido: ... (hasta 3000 chars, truncado con [truncado])

[Resultado 2]
...
```

### `fetch_url`

Descarga y extrae texto limpio de una URL. Usa `fetch()` nativo de Node 18+ con AbortController (timeout 30s). Filtra HTML con expresiones regulares antes de entregar al LLM.

```typescript
{
  type: 'function',
  function: {
    name: 'fetch_url',
    description: 'Descarga y extrae el texto completo de una URL. Usa esta herramienta para leer en profundidad una pagina relevante encontrada en una busqueda.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL completa (https://) de la pagina a leer.'
        },
        max_chars: {
          type: 'number',
          description: 'Maximo de caracteres a retornar. Por defecto 8000.'
        }
      },
      required: ['url']
    }
  }
}
```

---

## Flujo de datos completo

```
[Usuario activa ResearchToggle]
       |
       v
$researchMode = true  (atom Nanostores)

[Usuario envía mensaje]
       |
       v
useSendMessage.ts
  - Lee $researchMode
  - Llama streamChat(..., research: true)
       |
       v
POST /api/chat  { messages, research: true, provider, groqModel }
       |
       v
chat.ts (APIRoute)
  - Si research=true → streamDeepResearch(messages, provider, model)
  - Si no           → flujo actual sin cambios
       |
       v
deep-research.ts: streamDeepResearch()
  ┌─────────────────────────────────────────────────────┐
  │  1. Llamada inicial al LLM (sin tools)              │
  │     Prompt: "Planifica 3-5 queries para investigar" │
  │     Emite: SSE {"type":"research_plan","queries":[]} │
  │                                                     │
  │  2. Loop agentico (max 12 iteraciones)              │
  │     Por cada tool_call:                             │
  │       - web_search_deep → emite {"type":"searching"}│
  │       - fetch_url       → emite {"type":"reading_url"}│
  │       - Ejecuta la tool (research-tools.ts)         │
  │       - Añade resultado al historial                │
  │                                                     │
  │  3. LLM llama finish_reason = "stop"               │
  │     Emite: {"type":"synthesizing"}                  │
  │     Emite: {"type":"research_done","sources":[...]} │
  │     Stream de tokens de respuesta final             │
  │     Emite: data: [DONE]                             │
  └─────────────────────────────────────────────────────┘
       |
       v
useSendMessage.ts (cliente)
  - Parser SSE lee cada linea
  - Si parsed.type === 'searching'    → setResearchProgress({...})
  - Si parsed.type === 'reading_url'  → setResearchProgress({...})
  - Si parsed.type === 'synthesizing' → setResearchProgress({...})
  - Si parsed.type === 'research_done'→ guarda sources en ref local
  - Si parsed.choices[0].delta.content → acumula fullContent (igual que ahora)
       |
       v
$researchProgress atom → ResearchProgress.tsx renderiza estado actual

[Stream termina]
  - finishStreaming(botMessage) con sources appended en content
  - clearResearchProgress()
```

---

## Implementacion de `streamDeepResearch()`

La funcion vive en `src/lib/api/deep-research.ts` y es la unica funcion nueva que exporta el modulo. Internamente delega a dos helpers privados:

- `runDeepResearchOllama()` — igual que `streamOllamaWithTools` pero con `RESEARCH_TOOL_DEFINITIONS`, `MAX_ITERATIONS = 12` y llamadas a `emitProgress()`
- `runDeepResearchGroq()` — implementacion nueva con `groq-sdk` tool calling (no streaming durante el loop, streaming solo en la respuesta final)

```typescript
export function streamDeepResearch(
  messages: Message[],
  provider: 'ollama' | 'groq',
  requestModel?: string
): ReadableStream
```

### Loop Groq con tool calling

`streamGroq()` actual usa `stream: true` sin tools. Para deep research se necesita un modo distinto: `stream: false` durante el loop agentico y `stream: true` solo al emitir la respuesta final. La implementacion en `deep-research.ts`:

```typescript
// Fase loop (sin stream)
const response = await groq.chat.completions.create({
  messages: history,
  model: modelId,
  tools: RESEARCH_TOOL_DEFINITIONS,
  tool_choice: 'auto',
  stream: false,
  max_completion_tokens: 4096,
});

// Cuando finish_reason === 'stop': emitir respuesta en stream
const finalStream = await groq.chat.completions.create({
  messages: history,
  model: modelId,
  stream: true,
  max_completion_tokens: 8192,
});
for await (const chunk of finalStream) {
  const token = chunk.choices[0]?.delta?.content;
  if (token) emit(token);
}
```

Esto no modifica `streamGroq()` existente, preservando el flujo normal de Groq.

---

## Implementacion de `research-tools.ts`

Exporta:

- `RESEARCH_TOOL_DEFINITIONS: ToolDefinition[]` — las dos tools nuevas mas las existentes (se pasan al LLM completas para que pueda usar `web_search` normal si lo necesita)
- `executeResearchTool(name, args, emitProgress): Promise<string>` — ejecuta la tool y llama a emitProgress con el evento tipado adecuado

### Seguridad de `fetch_url` (anti-SSRF)

```typescript
const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const ALLOWED_PROTOCOLS = new Set(['https:']);
const FETCH_URL_TIMEOUT_MS = 30_000;
const FETCH_URL_MAX_CHARS = 8_000;

function validateFetchUrl(rawUrl: string): URL {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new Error('URL invalida'); }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) throw new Error('Solo se permiten URLs HTTPS');
  if (BLOCKED_HOSTS.has(parsed.hostname)) throw new Error('Host bloqueado');
  // Bloquear IPs privadas RFC1918
  const ipv4 = parsed.hostname.match(/^(\d{1,3})\.(\d{1,3})\./);
  if (ipv4) {
    const [,a,b] = ipv4.map(Number);
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      throw new Error('IPs privadas no permitidas');
    }
  }
  return parsed;
}
```

### Extraccion de texto limpio

Sin dependencias nuevas. Expresion regular para eliminar tags HTML, scripts, estilos y entidades:

```typescript
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```

El resultado se trunca a `max_chars` (default 8000) antes de pasarse al LLM, protegido ademas por `sanitizeToolResult()` existente.

---

## Cambios en el frontend

### `src/stores/chat-store.ts`

Anadir dos atoms:

```typescript
export const $researchMode = atom<boolean>(false);
export const $researchProgress = atom<ResearchProgressEvent | null>(null);
```

Donde `ResearchProgressEvent` es el tipo union de los eventos de progreso definidos arriba.

### `src/stores/chat-actions.ts`

```typescript
export function setResearchProgress(event: ResearchProgressEvent): void {
  $researchProgress.set(event);
}
export function clearResearchProgress(): void {
  $researchProgress.set(null);
}
```

### `src/components/react/input/ResearchToggle.tsx`

Boton toggle simple sin dependencias externas. Se ubica dentro del `.input-wrapper` de `ChatInput`, a la izquierda del textarea. Al activarse: establece `$researchMode.set(true)` y muestra un indicador visual (background del boton destacado). Accesible con `aria-pressed` y `title`.

```tsx
export function ResearchToggle() {
  const active = useStore($researchMode);
  return (
    <button
      className={`icon-btn research-toggle${active ? ' research-toggle--active' : ''}`}
      aria-pressed={active}
      title={active ? 'Modo investigacion activo' : 'Activar modo investigacion profunda'}
      onClick={() => $researchMode.set(!active)}
    >
      <span className="material-symbols-outlined" aria-hidden="true">travel_explore</span>
    </button>
  );
}
```

### `src/components/react/research/ResearchProgress.tsx`

Burbuja de progreso que reemplaza al `StreamingIndicator` de `MessageArea.tsx` cuando `$researchMode` esta activo. Muestra el ultimo evento de progreso con icono y texto descriptivo. Se desmonta cuando `$researchProgress` vuelve a `null`.

```tsx
export function ResearchProgress() {
  const progress = useStore($researchProgress);
  if (!progress) return <StreamingIndicator />;

  const label = {
    research_plan:  `Planificando investigacion...`,
    searching:      `Buscando: "${progress.query}" (${progress.index}/${progress.total})`,
    reading_url:    `Leyendo: ${progress.title ?? progress.url}`,
    synthesizing:   `Sintetizando ${progress.sources_count} fuentes...`,
    research_done:  `Investigacion completada`,
  }[progress.type] ?? 'Investigando...';

  return (
    <div className="message-bot">
      <div className="avatar bot-avatar">
        <span className="material-symbols-outlined">travel_explore</span>
      </div>
      <div className="msg-content">
        <div className="meta"><span className="msg-name">Deep Research</span></div>
        <div className="bubble bot-bubble research-progress-bubble">
          <span className="material-symbols-outlined research-spinner" aria-hidden="true">
            refresh
          </span>
          <span role="status">{label}</span>
        </div>
      </div>
    </div>
  );
}
```

### `src/components/react/MessageArea.tsx`

Sustituir `StreamingIndicator` por renderizado condicional:

```tsx
// Antes
{isStreaming && <StreamingIndicator />}

// Despues
{isStreaming && (researchMode ? <ResearchProgress /> : <StreamingIndicator />)}
```

### `src/lib/groq-client.ts`

Anadir campo `research` al tipo `ChatRequestBody` y pasarlo en el body del fetch:

```typescript
export interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  model?: string;
  provider?: 'ollama' | 'groq';
  groqModel?: string;
  research?: boolean;   // nuevo
}
```

### `src/pages/api/chat.ts`

```typescript
const { messages, model, provider: reqProvider, groqModel, research } = await request.json();
// ...
const isResearch = research === true;
const stream = isResearch
  ? streamDeepResearch(messages, provider, isGroq ? groqModel : safeModel)
  : (provider === 'groq'
      ? await streamGroq(messages, groqModel)
      : streamOllamaWithTools(messages, safeModel));
```

---

## Sistema de prompts para deep research

`src/lib/system-prompt.ts` expone una nueva funcion `DEEP_RESEARCH_SYSTEM_PROMPT` (mantiene `SYSTEM_PROMPT` sin tocar):

```
Eres un investigador experto. Tu tarea es responder la pregunta del usuario con maxima profundidad.

PROCESO OBLIGATORIO:
1. Usa web_search_deep con 3-5 queries distintas y especificas sobre el tema.
2. Para las 2-3 URLs mas relevantes de los resultados, usa fetch_url para leer su contenido completo.
3. Sintetiza toda la informacion en una respuesta estructurada con secciones claras.
4. Termina SIEMPRE con una seccion "## Fuentes" listando las URLs usadas con su titulo.

REGLAS:
- No respondas hasta haber buscado al menos 3 veces.
- Cada query debe ser diferente y complementaria (no repitas la misma busqueda).
- Cita la fuente cuando uses informacion especifica de una URL.
- Si fetch_url falla para una URL, continua con las demas.
```

---

## Consideraciones tecnicas

### Rendimiento

- El loop de deep research puede tardar 30-90 segundos. Los eventos SSE de progreso evitan que el usuario perciba bloqueo.
- `web_search_deep` consume 2 creditos Tavily por llamada (vs 1 de `web_search`). Con 5 queries: 10 creditos por sesion de deep research. Documentar en `.env.example`.
- `fetch_url` tiene timeout de 30s por URL. El loop no espera URLs fallidas gracias al manejo de errores en `executeResearchTool`.
- El historial del LLM puede crecer mucho (10+ tool results). Para Groq se aplica la misma logica de `GROQ_MAX_HISTORY` pero ampliada a 40 mensajes solo en modo research.

### Accesibilidad

- `ResearchToggle` tiene `aria-pressed` y `title` descriptivo.
- `ResearchProgress` usa `role="status"` en el texto de progreso (live region implicita).
- El boton toggle es distinguible del icono de adjuntar archivo por icono (`travel_explore` vs `attach_file`) y por el estado visual `--active`.

### SEO

No aplica: la feature es exclusivamente de UI interactiva del cliente en una SPA.

### Sin estado en IndexedDB

Los eventos de progreso son efimeros: no se persisten en IndexedDB. Solo el mensaje final del bot (con las fuentes embebidas en markdown) se guarda normalmente via `addMessage()`.

---

## Dependencias nuevas

Ninguna. Todo se implementa con:
- `groq-sdk` (ya instalado) — tool calling en Groq
- `fetch()` nativo Node 18+ — `fetch_url`
- APIs ya configuradas — Tavily para `web_search_deep`

---

## Plan de implementacion

### Paso 1 — Tipos y contratos compartidos

Crear en `src/lib/api/research-tools.ts` el enum/union `ResearchProgressEvent`, `RESEARCH_TOOL_DEFINITIONS` y `executeResearchTool()`. Incluye la validacion SSRF de `fetch_url` y `extractTextFromHtml()`.

Tests unitarios: validar que URLs privadas lanzan error, que el extractor elimina scripts y tags.

### Paso 2 — Stream server-side

Crear `src/lib/api/deep-research.ts` con `streamDeepResearch()`. Implementar primero la rama Ollama (mas facil de probar localmente) y luego la rama Groq. Verificar manualmente con `curl` que los eventos SSE tienen el formato correcto.

### Paso 3 — Endpoint

Modificar `src/pages/api/chat.ts` para leer el campo `research` y enrutar a `streamDeepResearch`. Mantener la rama existente intacta.

### Paso 4 — Estado cliente

Anadir `$researchMode` y `$researchProgress` a `chat-store.ts` y las acciones correspondientes a `chat-actions.ts`.

### Paso 5 — Parser SSE cliente

Modificar `src/lib/groq-client.ts`: anadir `research` a `ChatRequestBody`. Modificar `src/components/react/hooks/useSendMessage.ts` para interceptar eventos de tipo `research_*` y llamar a `setResearchProgress()`.

### Paso 6 — Componentes React

Crear `ResearchToggle.tsx` y `ResearchProgress.tsx`. Modificar `ChatInput.tsx` para montar el toggle. Modificar `MessageArea.tsx` para usar `ResearchProgress` condicionalmente.

### Paso 7 — System prompt

Anadir `DEEP_RESEARCH_SYSTEM_PROMPT` en `system-prompt.ts`. Pasarlo en `deep-research.ts` como primer mensaje del historial en lugar de `SYSTEM_PROMPT`.

### Paso 8 — CSS

Anadir en el stylesheet existente los estilos para:
- `.research-toggle`, `.research-toggle--active`
- `.research-progress-bubble`
- `.research-spinner` (animacion rotate)

### Paso 9 — `.env.example`

Documentar que `web_search_deep` usa 2 creditos Tavily por llamada y que deep research puede consumir hasta 10 creditos por sesion.

### Paso 10 — Tests

- Test unitario de `validateFetchUrl` (URLs validas, privadas, sin https, malformadas)
- Test unitario de `extractTextFromHtml` (scripts eliminados, entidades decodificadas)
- Test de integracion del endpoint: mock de `streamDeepResearch`, verificar que `research=true` enruta correctamente
- Test del parser SSE en `useSendMessage`: verificar que eventos de progreso no llegan a `fullContent`

---

## Alternativas consideradas

### A1 — Usar endpoint separado `/api/research`

Se descarto porque duplicaria la logica de autenticacion, validacion de mensajes y manejo de errores que ya existe en `/api/chat`. La bandera `research: boolean` en el request existente es suficiente para bifurcar el comportamiento.

### A2 — Implementar Groq tool calling en `streamGroq()` existente

Modificar `streamGroq()` para aceptar tools optionals implicaria cambiar la firma de una funcion que funciona correctamente para el caso basico y que tiene tests asociados. Crear `streamDeepResearch()` separado con su propia instancia del cliente Groq es mas seguro y no rompe el flujo actual.

### A3 — Emitir progreso via campo `reasoning_content` de Groq

Los modelos de razonamiento de Groq emiten `reasoning_content` que ya se filtra en `groq-client.ts`. Reutilizar ese canal para progreso seria un hack que acoplaría la logica de progreso al modelo especifico y romperia con Ollama. Los eventos tipados en `data:` son mas limpios y funcionan igual para ambos providers.

### A4 — Usar `cheerio` o `node-html-parser` para extraer texto de URLs

Añadiria una dependencia de ~200KB para hacer lo mismo que tres expresiones regulares. El texto resultante va al LLM (contexto), no al DOM del navegador, por lo que no se necesita un parser completo. Se descarto para mantener zero dependencias nuevas.

### A5 — Mostrar progreso en un panel lateral en lugar de en el flujo del chat

Requeriria cambios de layout significativos. Insertar el progreso inline en el flujo de mensajes (como hace Perplexity) es mas simple y consistente con la UX actual del chat.

### A6 — Persistir las fuentes como campo separado en IndexedDB

Añadiria complejidad al schema de `Message` y requeriria migracion de la base de datos. Incrustar las fuentes como seccion markdown al final del mensaje es suficiente para el caso de uso y preserva la renderizacion existente.

---

## Referencias

- [Groq — Local Tool Calling](https://console.groq.com/docs/tool-use/local-tool-calling)
- [Tavily Search API Reference](https://docs.tavily.com/documentation/api-reference/endpoint/search)
- [groq-sdk npm](https://www.npmjs.com/package/groq-sdk)
