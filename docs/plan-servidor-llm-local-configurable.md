# Plan: Servidor LLM local configurable (Ollama / LM Studio) + selector de modelos en UI

## Resumen

Cambiar la base URL del proveedor local de `http://localhost:11434` a
`http://192.168.1.133:1234`, y exponer en la UI la lista de modelos
disponibles en ese servidor local junto con el nombre del modelo
seleccionado — sin romper streaming SSE, tool-calling, detección de
widgets, timeout de 30s ni la validación de modelo/URL ya existentes.

Hallazgo clave de la investigación: **gran parte de la funcionalidad de
UI pedida en el punto 2 ya existe** (`ModelSelector` en `ChatHeader.tsx`
+ endpoint `GET /api/models`). El trabajo real no es "construir un
selector nuevo", sino **hacer que ese selector y su endpoint funcionen
también contra un servidor que no sea Ollama nativo** (LM Studio), y
actualizar la configuración de entorno.

## Contexto

`CLAUDE.md` documenta hoy el proveedor local explícitamente como
"Ollama... calls `OLLAMA_BASE_URL/v1/chat/completions`". Todo el código
(`chat-stream.ts`, `deep-research.ts`, `models.ts`) asume Ollama. El
cambio de IP/puerto pedido apunta a otra máquina de la LAN
(`192.168.1.133`) en el puerto `1234`, que es el puerto **por defecto
de LM Studio**, no el de Ollama (`11434`).

No hay ningún README, `.env` de ejemplo previo, commit ni comentario en
el repo que mencione LM Studio o un Ollama reconfigurado a otro puerto.
Por tanto la hipótesis debe declararse explícitamente (ver siguiente
sección) y el diseño debe funcionar para ambos casos, tal como pide el
encargo.

### Hipótesis sobre el servidor local: Ollama vs LM Studio

**Hipótesis principal (recomendada): es LM Studio.**

Evidencia a favor:
- El puerto `1234` es el default exacto de LM Studio (`http://localhost:1234/v1`); Ollama usa `11434` siempre que no se sobreescriba `OLLAMA_HOST`.
- La IP `192.168.1.133` es una dirección LAN de **otra máquina**, no `localhost`. Este entorno de desarrollo corre en WSL2 sobre Linux; un patrón muy común es tener LM Studio corriendo en un host Windows/Mac con GPU en la misma red, con el toggle "Serve on Local Network" activado en la pestaña Developer (por defecto LM Studio solo escucha en loopback, así que si responde desde otra IP es porque alguien activó esa opción a propósito).
- No hay ninguna pista en el repo de un Ollama con `OLLAMA_HOST=0.0.0.0:1234` custom, que sería la única forma de que fuera Ollama en ese puerto.

**Hipótesis alternativa: sigue siendo Ollama**, corriendo en otra máquina de la LAN con `OLLAMA_HOST` apuntando al puerto `1234` en vez del `11434` por defecto. Es técnicamente posible pero no hay evidencia de ello, y sería una configuración no estándar.

**Por qué el diseño no depende de resolver la ambigüedad:** Ollama y LM
Studio exponen la **misma superficie OpenAI-compatible**:

| Capacidad | Ollama | LM Studio |
|---|---|---|
| Chat completions (streaming y no streaming) | `POST /v1/chat/completions` | `POST /v1/chat/completions` |
| Listado de modelos | `GET /v1/models` (compat. OpenAI) *y* `GET /api/tags` (nativo) | `GET /v1/models` (compat. OpenAI) — no tiene `/api/tags` |
| Auth | Ninguna real; acepta cualquier `Authorization` | Ninguna; ignora `Authorization` |

Fuentes: [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), [LM Studio OpenAI-compat endpoints](https://lmstudio.ai/docs/developer/openai-compat), [LM Studio local server docs](https://lmstudio.ai/docs/developer/core/server).

**Consecuencia directa para el código:** `chat-stream.ts` y
`deep-research.ts` ya usan `/v1/chat/completions` — funcionan sin
cambios contra ambos servidores. El único punto que **hoy usa el
endpoint nativo de Ollama** (`/api/tags`, que LM Studio no implementa)
es `src/pages/api/models.ts`. Ese es el único archivo que debe cambiar
de endpoint para que el listado de modelos siga funcionando si el
servidor resulta ser LM Studio.

**Esto se debe confirmar con el usuario antes de implementar** (ver
sección "Preguntas abiertas").

## Diseño propuesto

### Archivos nuevos a crear

Ninguno. Toda la infraestructura de UI y API necesaria ya existe
(`ChatHeader.tsx` → `ModelSelector`, `src/pages/api/models.ts`,
`$selectedModel` en el store). No se justifica crear componentes o
endpoints nuevos; el cambio es de configuración + adaptar un endpoint
existente a una superficie de API unificada.

### Archivos existentes a modificar

1. **`.env.example`**
   - Cambiar el valor de ejemplo de `OLLAMA_BASE_URL` a
     `http://192.168.1.133:1234`.
   - Añadir comentario aclarando que el servidor puede ser Ollama o
     LM Studio (ambos exponen la misma API `/v1/...`).
   - `OLLAMA_MODEL` debe seguir existiendo como fallback opcional; su
     valor de ejemplo debería reflejar un modelo real cargado en ese
     servidor (a confirmar con el usuario — `gemma4` no es un id de
     modelo válido en ningún backend real, es probable que ya fuera un
     placeholder).

2. **`src/pages/api/models.ts`**
   - Sustituir la llamada a `GET {baseUrl}/api/tags` (endpoint nativo
     de Ollama, inexistente en LM Studio) por `GET {baseUrl}/v1/models`
     (superficie OpenAI-compatible que ambos implementan).
   - Adaptar el parseo de la respuesta: en vez de
     `data.models.map(m => m.name)` (formato nativo de Ollama), usar
     `data.data.map(m => m.id)` (formato lista OpenAI, igual al que ya
     usa `src/pages/api/groq-models.ts` con `groq.models.list()`).
   - Mantener como *fallback* opcional una segunda llamada a
     `/api/tags` si `/v1/models` no responde (protege a quien siga
     usando Ollama plano sin degradar la experiencia, y cubre versiones
     antiguas de Ollama previas al soporte de `/v1/models`). Si ambas
     fallan, mantener el comportamiento actual: `{ models: [], error }`.
   - No cambiar la forma de la respuesta HTTP (`{ models: string[] }`)
     para no requerir cambios en `ChatHeader.tsx`.

3. **`src/lib/api/chat-stream.ts`**
   - **Sin cambios de código.** `streamOllama`, `streamOllamaWithTools`
     y `safeOllamaBaseUrl` ya leen `OLLAMA_BASE_URL` desde el entorno y
     llaman a `/v1/chat/completions`, que es válido para ambos
     servidores. El cambio de IP/puerto es puramente de configuración
     (`.env`), no de código.
   - Único ajuste opcional a evaluar (no bloqueante): el literal de
     fallback `'http://localhost:11434'` que aparece si
     `OLLAMA_BASE_URL` es inválida. Se recomienda dejarlo como está —
     es una red de seguridad para desarrollo local, no el valor real
     que se usará en producción (ese vendrá de `.env`).

4. **`src/lib/api/deep-research.ts`**
   - Mismo razonamiento que el punto anterior: `safeOllamaBaseUrl` y
     `runDeepResearchOllama` ya usan `/v1/chat/completions`. Sin
     cambios de código necesarios.

5. **`src/pages/api/chat.ts`**
   - Revisar `OLLAMA_MODEL_RE` (`/^[a-z0-9][a-z0-9_.\-:/]{0,99}$/i`).
     Los identificadores de modelo de LM Studio suelen incluir rutas
     con múltiples segmentos y sufijos de cuantización, por ejemplo
     `lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf`,
     que puede superar el límite actual de 100 caracteres y contiene un
     punto adicional en la extensión `.gguf` (ya permitido por la
     clase de caracteres, el punto ya está en el charset). **Se
     recomienda subir el límite de longitud** (p.ej. a 200) para no
     rechazar modelos LM Studio legítimos. No se necesita ampliar el
     charset por ahora (letras, dígitos, `_`, `.`, `-`, `:`, `/` ya
     cubren los formatos observados de Ollama y LM Studio), pero debe
     verificarse contra los ids reales una vez confirmado el servidor.

6. **`src/components/react/ChatHeader.tsx`** (cambio menor, cosmético)
   - El botón de `ProviderSelector` para el proveedor local tiene
     `title="Local (Ollama)"`. Si el servidor termina siendo LM
     Studio, ese tooltip es engañoso. Se recomienda generalizarlo a
     `title="Servidor local"` (sin acoplar el texto a un backend
     específico), ya que el valor interno del store (`'ollama'`) no
     cambia — solo la etiqueta visible.
   - `ModelSelector` (el componente ya existente, líneas 122-186) no
     requiere cambios funcionales: sigue leyendo `/api/models`,
     guardando en `$selectedModel` + `localStorage`, y mostrando el
     nombre del modelo activo. Único ajuste opcional de UX: la lógica
     `selectedModel.split(':')[0]` en `displayName` (línea 148) y en
     el badge del header (línea 203) asume nomenclatura Ollama
     (`modelo:tag`). Para ids largos estilo LM Studio
     (`carpeta/subcarpeta/archivo.gguf`) puede convenir mostrar solo el
     último segmento tras la última `/` en vez de partir por `:`. Se
     deja como mejora opcional, no bloqueante — no rompe nada si se
     omite, solo se vería un nombre más largo en el badge.

### Estructura de componentes (sin cambios estructurales)

```
ChatHeader.tsx
 ├─ ProviderSelector          (ya existe — botones "Local" / "Groq")
 ├─ ModelSelector             (ya existe — proveedor local, GET /api/models)
 └─ GroqModelSelector         (ya existe — proveedor Groq, GET /api/groq-models)
```

No se añade ningún componente nuevo. `ModelSelector` ya cubre punto 2
del encargo (lista de modelos + modelo seleccionado) para el proveedor
local; solo se corrige su fuente de datos backend.

### Flujo de datos (actualizado)

```
1. Usuario abre el chat → ChatHeader monta ModelSelector
2. ModelSelector.useEffect() → fetch('/api/models')
3. GET /api/models → fetch(`${OLLAMA_BASE_URL}/v1/models`)
   (fallback a /api/tags si /v1/models falla)
4. Respuesta → { models: string[] } → setModels() en el componente
5. Si no hay modelo guardado en localStorage o el guardado ya no
   existe en la lista → se autoselecciona el primero (o 'gemma4' si
   está presente) → $selectedModel.set() + localStorage
6. Usuario elige modelo del dropdown → $selectedModel.set(m) + localStorage
7. Al enviar mensaje, useSendMessage.ts lee $selectedModel.get()
   (vía prop `selectedModel`) y lo manda como `model` en el body de
   POST /api/chat
8. chat.ts valida `model` con OLLAMA_MODEL_RE → safeModel
9. streamOllamaWithTools(messages, safeModel) → fetch a
   `${OLLAMA_BASE_URL}/v1/chat/completions` (ahora apuntando a
   192.168.1.133:1234)
```

No cambia ningún paso de este flujo salvo el paso 3 (endpoint de
listado) y el valor de `OLLAMA_BASE_URL` en `.env`.

## Consideraciones técnicas

- **Rendimiento**: sin impacto. Mismo número de requests, mismo
  patrón de streaming SSE simulado (`streamOllamaWithTools` construye
  el SSE manualmente a partir de una respuesta no-streaming con
  `stream: false` para poder interceptar `tool_calls`). Si LM Studio
  tarda más en cargar un modelo en memoria (JIT model loading) la
  primera petición tras encender el servidor puede tardar más — el
  timeout actual de `OLLAMA_TIMEOUT_MS = 30_000` (30s) podría no ser
  suficiente para la carga inicial de un modelo grande en LM Studio.
  Se recomienda documentarlo como riesgo (ver más abajo), no
  necesariamente subir el timeout sin confirmarlo con el usuario.
- **Accesibilidad**: `ModelSelector` y `ProviderSelector` ya tienen
  `aria-haspopup`, `aria-expanded`, `role="listbox"`/`role="option"`,
  `aria-selected`. Los cambios propuestos son solo de texto (`title`)
  y fuente de datos, no tocan la semántica ARIA existente.
- **SEO**: no aplica — `ChatHeader` y el endpoint `/api/models` no son
  contenido indexable (SSR de una app de chat autenticada por sesión
  local).
- **Seguridad**: `safeOllamaBaseUrl()` ya valida que la URL tenga
  protocolo `http:`/`https:`. Al apuntar a una IP de LAN en vez de
  `localhost`, conviene confirmar que esa red es de confianza (la
  petición desde el servidor Astro SSR hacia `192.168.1.133:1234` sale
  del proceso Node, no del navegador, así que no hay problema de CORS,
  pero sí de exposición si el servidor Astro está en un entorno
  compartido). No se propone ningún cambio de seguridad adicional más
  allá de lo ya existente (`OLLAMA_MODEL_RE`, límite de payload de
  10MB en `chat.ts`, timeout con `AbortController`).

## Dependencias

Ninguna dependencia nueva. Todo se implementa con `fetch` nativo,
igual que el código actual — no se requiere un SDK de LM Studio (no
existe uno oficial equivalente a `groq-sdk`; LM Studio se consume igual
que cualquier servidor OpenAI-compatible vía `fetch`).

## Funcionalidad existente que debe preservarse (checklist para el implementer)

| Funcionalidad | Dónde vive hoy | Riesgo si se rompe |
|---|---|---|
| Streaming simulado vía SSE para tool-calling | `streamOllamaWithTools` en `chat-stream.ts` (construye eventos `data: ...\n\n` manualmente) | Widgets y respuestas del proveedor local dejarían de renderizarse token a token |
| Bucle de tool-calling (máx. 5 iteraciones) | `MAX_ITERATIONS = 5` en `streamOllamaWithTools`, `chat-stream.ts` línea 107 | Herramientas (clima, cripto, etc.) dejarían de resolverse en varias vueltas |
| Detección de `show_widget` y mapeo a `WIDGET_URI_MAP` | `chat-stream.ts` líneas 134-146, importa `WIDGET_URI_MAP` de `./tools` | Los widgets dejarían de aparecer en el chat |
| Timeout de 30s con `AbortController` | `fetchOllama()` + `OLLAMA_TIMEOUT_MS = 30_000`, `chat-stream.ts` líneas 15, 67-80 | Peticiones colgadas indefinidamente si el servidor local no responde |
| Validación de la base URL | `safeOllamaBaseUrl()`, `chat-stream.ts` líneas 56-65 (y copia idéntica en `deep-research.ts` líneas 32-41) | URL maliciosa o mal formada podría causar SSRF o crash |
| Selección de modelo por request + regex de validación | `OLLAMA_MODEL_RE`, `src/pages/api/chat.ts` líneas 19, 65-68 | Modelo no confiable podría inyectarse en el body hacia el servidor local |
| Autoselección y persistencia del modelo local en UI | `ModelSelector`, `ChatHeader.tsx` líneas 122-186, usa `localStorage['selectedModel']` + `$selectedModel` | El usuario perdería su modelo preferido entre sesiones |
| Fallback a `{ models: [], error }` si el servidor no responde | `src/pages/api/models.ts` líneas 23-27 | El header quedaría roto (`ModelSelector` retorna `null` si `models.length === 0`, lo cual ya es el comportamiento esperado) en vez de mostrar un error visible |
| Deep research usando el proveedor local | `runDeepResearchOllama`, `deep-research.ts` (misma superficie `/v1/chat/completions`) | El modo investigación con proveedor local dejaría de funcionar |
| Provider switch Ollama/Groq sin perder estado | `$selectedProvider`, `ProviderSelector`, `ChatHeader.tsx` | Cambiar de proveedor no debe resetear el modelo Groq ni viceversa |

**Nota importante para el implementer**: no renombrar las funciones
`streamOllama`, `streamOllamaWithTools`, `safeOllamaBaseUrl`, ni el
valor interno del provider `'ollama'` en el store/tipo
(`$selectedProvider: 'ollama' | 'groq'`), aunque el backend real
termine siendo LM Studio. Renombrar rompería `localStorage` de
usuarios existentes (`selectedProvider` ya persistido con valor
`'ollama'`) y ampliaría innecesariamente el diff. Solo se debe tocar
texto visible en UI (`title`), no identificadores internos.

## Plan de implementación

1. **Confirmar con el usuario** (bloqueante, ver preguntas abiertas)
   qué servidor corre realmente en `192.168.1.133:1234` — o al menos
   confirmar que aceptan el diseño "funciona para ambos" sin más
   certeza.
2. Actualizar `.env.example`: nuevo valor de `OLLAMA_BASE_URL`,
   comentario aclaratorio sobre Ollama/LM Studio, y modelo de ejemplo
   realista en `OLLAMA_MODEL`.
3. Modificar `src/pages/api/models.ts`: cambiar de `/api/tags` a
   `/v1/models`, adaptar el mapeo de la respuesta (`data.data.map(m =>
   m.id)`), con fallback a `/api/tags` si `/v1/models` falla.
4. Ajustar `OLLAMA_MODEL_RE` en `src/pages/api/chat.ts` (subir límite
   de longitud) tras confirmar formato real de los ids de modelo del
   servidor.
5. Cambio cosmético opcional en `ChatHeader.tsx`: `title="Servidor
   local"` en vez de `title="Local (Ollama)"`.
6. Cambio opcional de UX en `ChatHeader.tsx`: mostrar el último
   segmento de ruta del modelo en el badge si el id contiene `/`.
7. Probar manualmente contra el servidor real en
   `192.168.1.133:1234`: listar modelos, seleccionar uno, enviar un
   mensaje con tool-calling (p.ej. pedir el clima), confirmar que el
   widget se activa y que el timeout de 30s no corta una carga inicial
   de modelo grande.
8. Ejecutar `pnpm test` — no hay tests que mockeen `OLLAMA_BASE_URL` o
   `/api/models` hoy, así que no se espera romper nada existente, pero
   confirmar tras el cambio.
9. Pipeline QA estándar del proyecto (`quality → security →
   accessibility → monitor`, ya que se tocan `src/pages/api/` y
   `src/components/react/`).

## Alternativas consideradas

- **Crear un tercer proveedor `'lmstudio'` explícito** (además de
  `'ollama'` y `'groq'`), con su propio selector y endpoint. Descartada
  por ahora: añade un enum, un store, un endpoint y un componente
  duplicados para un backend que expone *exactamente* la misma API que
  ya se consume. Si en el futuro se quiere soportar Ollama **y** LM
  Studio simultáneamente (dos servidores locales distintos a la vez),
  esta alternativa se vuelve necesaria y debería reconsiderarse
  entonces.
- **Detectar el tipo de servidor en runtime** (probar `/api/tags`
  primero, y si responde asumir Ollama, si no asumir LM Studio) para
  adaptar textos de UI dinámicamente. Descartada por complejidad
  innecesaria: no cambia ningún comportamiento funcional, solo
  cosmética de un tooltip; se prefiere el texto genérico "Servidor
  local".
- **Mantener `/api/tags` como única fuente y exigir que el usuario siga
  usando Ollama**. Descartada porque contradice el objetivo explícito
  del punto 1 (apuntar a `192.168.1.133:1234`, que muy probablemente es
  LM Studio) y porque `/v1/models` es un superset compatible que no
  pierde nada frente a `/api/tags` para el caso de uso actual (solo se
  necesita el `id`/`name` del modelo, no metadata adicional de Ollama
  como tamaño o `modified_at`, que hoy tampoco se usa en `ModelSelector`).
- **Subir el timeout de 30s preventivamente** para cubrir cargas
  iniciales lentas de modelos en LM Studio. Descartada como cambio
  automático: se documenta como riesgo a validar con el usuario en vez
  de asumir un nuevo valor sin datos reales de latencia del servidor.

## Decisiones confirmadas por el usuario (2026-08-02)

1. **Servidor confirmado: LM Studio.** No hace falta fallback a
   `/api/tags`; `src/pages/api/models.ts` debe usar únicamente
   `GET {baseUrl}/v1/models` y mapear `data.data.map(m => m.id)`.
2. **Timeout: subir a 120s o más** (`OLLAMA_TIMEOUT_MS` en
   `chat-stream.ts`, y el timeout equivalente en `deep-research.ts` si
   existe uno separado) para cubrir la carga inicial de modelos grandes
   en LM Studio.
3. **Migrar el nombre interno del proveedor de `'ollama'` a `'local'`**
   (contradice la recomendación por defecto del plan, pero es la
   decisión explícita del usuario). Esto implica:
   - Cambiar el tipo `$selectedProvider: 'ollama' | 'groq'` a
     `'local' | 'groq'` en `chat-store.ts` (y cualquier otro tipo
     compartido, p.ej. en `chat.ts` o `chat-actions.ts`).
   - Actualizar todas las comparaciones `=== 'ollama'` /
     `'ollama' as const` en `chat.ts`, `ChatHeader.tsx`,
     `useSendMessage.ts`, `chat-store.ts`, etc.
   - **Migración de `localStorage` para usuarios existentes**: al leer
     el valor persistido de `selectedProvider`, si es `'ollama'`
     convertirlo a `'local'` de forma transparente (leer valor legacy,
     re-guardar como `'local'`), para no romper la preferencia de
     usuarios que ya tenían el valor viejo guardado.
   - Evaluar si `LLM_PROVIDER` (env var) también debe aceptar
     `'local'` además de (o en vez de) `'ollama'` como valor válido,
     manteniendo compatibilidad si algún despliegue ya tiene
     `LLM_PROVIDER=ollama` en su `.env`.
   - Los nombres de función (`streamOllama`, `streamOllamaWithTools`,
     `safeOllamaBaseUrl`) NO se renombran — el plan original ya
     recomendaba esto y sigue aplicando: son detalles internos de
     implementación, no el valor de tipo/proveedor expuesto al usuario.

## Riesgos y preguntas abiertas (requieren confirmación del usuario)

1. **¿Es LM Studio o Ollama en `192.168.1.133:1234`?** El diseño
   funciona para ambos gracias a `/v1/chat/completions` +
   `/v1/models`, pero conviene confirmarlo para:
   - Saber si hace falta el fallback a `/api/tags` en `/api/models.ts`
     (solo aplica si es Ollama, o si en el futuro se vuelve a
     `localhost:11434`).
   - Ajustar el texto de UI (`title`) con el nombre correcto.
2. **¿LM Studio tiene "Serve on Local Network" activado y el modelo ya
   cargado en memoria?** Si el modelo no está cargado, la primera
   petición de chat puede tardar bastante (carga en RAM/VRAM) y podría
   superar el timeout de 30s (`OLLAMA_TIMEOUT_MS`). Confirmar si hace
   falta subir ese valor.
3. **¿Cuál es el formato real de los ids de modelo** que devolverá
   `/v1/models` en ese servidor? Determina si `OLLAMA_MODEL_RE` necesita
   más que un simple aumento del límite de longitud (100 → 200), o si
   el charset actual (`[a-z0-9_.\-:/]`, case-insensitive) ya es
   suficiente.
4. **¿El valor de ejemplo `OLLAMA_MODEL=gemma4` en `.env.example` era ya
   un placeholder incorrecto,** o corresponde a un modelo real que el
   usuario tenía en su Ollama anterior? Si el servidor cambia, este
   valor de fallback debería actualizarse a un modelo real disponible
   en el nuevo servidor para que el fallback (`requestModel ||
   OLLAMA_MODEL || 'gemma4'`) tenga sentido.
5. **¿Debe seguir llamándose `'ollama'` el proveedor internamente en
   el store/localStorage** (recomendado, para no romper la persistencia
   de usuarios existentes), o se prefiere una migración a un nombre más
   neutro (`'local'`) con la consiguiente migración de `localStorage`?
6. Si en algún momento se quiere soportar **ambos servidores locales a
   la vez** (Ollama y LM Studio corriendo en paralelo, por ejemplo uno
   para chat rápido y otro para modelos más grandes), este diseño no lo
   cubre — requeriría la alternativa descartada de un tercer proveedor
   explícito.
