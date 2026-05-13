# Tool-use con Ollama (Agentic Loop)

## Objetivo

Permitir que el LLM local (Ollama) llame herramientas del servidor para responder preguntas que requieren datos externos o cálculos. El cliente no cambia: sigue recibiendo SSE igual que ahora.

## Restricción clave

Ollama **no soporta streaming cuando hay `tools` en el request**. Por eso el flujo es:

```
[No-streaming] Ollama + tools → tool_calls → ejecutar → [No-streaming] Ollama + results → ... → [Streaming] respuesta final
```

El endpoint Astro maneja el loop completo y al final emite SSE para el cliente.

## Herramientas

| Nombre | API | Auth |
|---|---|---|
| `web_search` | Tavily Search API | `TAVILY_API_KEY` |
| `get_weather` | Open-Meteo (free) | ninguna |
| `get_datetime` | servidor local | ninguna |
| `calculate` | evaluación segura en JS | ninguna |
| `get_crypto_prices` | CoinGecko (free) | ninguna |

## Variables de entorno nuevas

```
TAVILY_API_KEY=tvly-...
```

## Archivos a crear / modificar

### Nuevo: `src/lib/api/tools.ts`

Define las herramientas en formato OpenAI tool schema y las funciones de ejecución:

```ts
export interface ToolDefinition { /* OpenAI tool schema */ }
export interface ToolCall { id: string; function: { name: string; arguments: string } }

export const TOOL_DEFINITIONS: ToolDefinition[] = [ /* web_search, get_weather, ... */ ]

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string>
```

Cada herramienta devuelve un `string` (el resultado serializado como texto) para pasarlo como `tool` role en el historial.

### Modificar: `src/lib/api/chat-stream.ts`

Nueva función `streamOllamaWithTools`:

```
async function* streamOllamaWithTools(messages, model):
  1. Llamada no-streaming con tools (max 5 iteraciones):
     - POST /v1/chat/completions con tools + tool_choice: 'auto'
     - Si finish_reason === 'tool_calls':
         * Añadir assistant message con tool_calls al historial
         * Para cada tool_call: executeTool() → añadir tool message
         * Continuar loop
     - Si finish_reason === 'stop': salir del loop con el content
  2. Si el content final existe: emitirlo como stream SSE token a token
  3. Si se agotaron iteraciones: emitir mensaje de error
```

Para simular streaming del texto final (ya tenemos el string completo), emitimos los tokens palabra a palabra con un pequeño delay, o en chunks de N caracteres. Esto mantiene la UX de streaming.

### Modificar: `src/pages/api/chat.ts`

```ts
const stream = provider === 'groq'
  ? await streamGroq(messages)
  : await streamOllamaWithTools(messages, model)  // antes: streamOllama
```

### Modificar: `src/lib/system-prompt.ts`

Añadir instrucción al system prompt: el modelo debe usar las herramientas cuando el usuario pida información externa (clima, búsqueda, cripto, cálculos) en lugar de inventar datos.

### No modificar

- `src/lib/groq-client.ts` — el cliente no cambia
- `src/components/react/` — nada cambia en el frontend
- El sistema de widgets `[WIDGET:type]` sigue igual

## Seguridad de `calculate`

Usar `new Function()` en un contexto controlado, solo permitir operadores matemáticos (+, -, *, /, **, %, paréntesis, números). Rechazar cualquier string con letras (excepto `Math.*`).

## Formato de mensajes con tools (OpenAI compatible)

```json
// Mensaje del assistant con tool_calls
{ "role": "assistant", "tool_calls": [{ "id": "call_1", "type": "function", "function": { "name": "web_search", "arguments": "{\"query\": \"...\"}" } }] }

// Respuesta de la herramienta
{ "role": "tool", "tool_call_id": "call_1", "content": "resultado como string" }
```

## Límites y errores

- Máximo 5 iteraciones de tool calling por request
- Timeout por herramienta: 8 segundos
- Si una herramienta falla, insertar un mensaje de error como `tool` result y dejar que el modelo responda
