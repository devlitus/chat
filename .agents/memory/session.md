# Memoria de Corto Plazo — Sesión Actual

> **Ciclo de vida**: 24 horas. Se limpia al iniciar nueva sesión.
> **Formato**: `## [YYYY-MM-DD HH:MM] @agente | tipo`
> **Tipos**: decisión | error | fix | wip | bloqueo | descubrimiento

---

## Estado actual

**Rama**: refactor/tabiji-migration
**Feature en progreso**: Tabiji Migration — Wikivoyage + LLM local para /api/travel
**Último agente activo**: @felix
**Timestamp inicio**: 2026-08-02

---

## Registro de sesión

## [2026-08-01] @nexus | decisión

Se modificaron los pipelines en AGENTS.md:

1. **Ada integrada al pipeline de features**: ahora la secuencia es `@nexus → @leo → @cloe → @ada → @max → @cipher?`. Ada actúa como puerta de calidad post-implementación validando SOLID y Big O antes del QA final de Max.

2. **Félix como rollback handler**: si @max detecta build roto o regresión en cualquier pipeline (feature, bug, refactor), deriva a @felix para RCA + fix en lugar de devolver el trabajo al implementador original (@cloe o @ada). Esto aplica a los 3 pipelines.

## [2026-08-01 19:00] @leo | decisión

**Feature**: feature/observabilidad-metricas-agentes
**Estado**: en-progreso
**Qué**: Diseño del sistema de observabilidad para agentes OpenCode. Se decide arquitectura híbrida: agentes auto-reportan métricas JSON a `.agents/metrics/queue/inbox/` + nuevo agente `monitor` agrega/analiza/genera tuning. Separado del sistema `.claude/metrics/` (que mide calidad de código, no desempeño de agentes).
**Por qué**: OpenCode no produce reports de pipeline como Claude Code, necesita captura distribuida con agregación centralizada. El enfoque plugin (100% determinista) no es viable porque los plugins de OpenCode no tienen acceso al contexto semántico de lo que hizo el LLM.
**Archivos**: .agents/metrics/ (nuevo), .opencode/agents/monitor.md (nuevo), AGENTS.md (modificar pipelines)

## [2026-08-01 20:00] @nexus | decisión

**Feature**: feature/observabilidad-metricas-agentes
**Estado**: completado
**Qué**: Rediseño completo tras push-back del usuario: se descarta el subagente `@monitor`. En su lugar, se implementa un plugin determinista `metrics-observer.ts` que captura métricas en `session.created`/`session.idle` sin intervención del LLM, más un agente `@analista` puramente consultivo (a demanda) para interpretación semántica.
**Por qué**: El usuario pidió máximo determinismo, sin depender de un subagente para la captura. El plugin garantiza cobertura 100% en todas las sesiones. El analista añade la capa semántica sin ser dependencia de pipeline.
**Archivos**: .opencode/plugins/metrics-observer.ts (nuevo), .opencode/agents/analista.md (nuevo), .agents/metrics/runs.json (nuevo), .agents/metrics/patterns.json (nuevo), .agents/metrics/tuning-proposals.md (nuevo), .agents/metrics/schema.md (nuevo), AGENTS.md (actualizado)

## [2026-08-01] @nexus | decisión

**Feature**: chore/commitlint-plugin
**Estado**: completado
**Qué**: Se eliminó por completo el ecosistema commitlint CLI (config, hooks y dependencias npm). Se creó `commitlint.ts` como plugin de OpenCode que (a) intercepta `git commit` en sesiones de agentes y valida mensajes, y (b) inyecta las reglas en el system prompt vía `experimental.chat.system.transform`. Es ahora la única fuente de verdad para Conventional Commits.
**Por qué**: El usuario pidió organizar la config de commitlint dentro del ecosistema de plugins de OpenCode. Al eliminarse simple-git-hooks, el plugin es el único guardián de commits en el proyecto.
**Archivos**: .opencode/plugins/commitlint.ts (nuevo), commitlint.config.js (eliminado), .simple-git-hooks.mjs (eliminado), package.json (limpiado: -3 devDeps, -script prepare), pnpm-lock.yaml (actualizado)

## [2026-08-02] @nexus | descubrimiento

**Bug reportado**: "cualquier pregunta devuelve 'Error interno: fetch failed'"
**Resultado**: Falso bug. El servidor LM Studio en `http://192.168.1.133:1234` estaba apagado. Al encenderlo, el error desapareció (HTTP 200 confirmado).
**Lección**: El mensaje "Error interno: fetch failed" es críptico. Sería útil mejorarlo para indicar explícitamente que el servidor local no responde y sugerir acciones (encender LM Studio o cambiar a Groq). Pendiente de implementar en el futuro.

## [2026-08-02 11:30] @felix | error

**Bug**: Crypto widget no se renderiza cuando el usuario usa la palabra "criptos".
**Rama**: fix/crypto-widget-no-renderiza
**Causa raíz**: La función `detectWidgetFromKeywords()` en `src/components/react/hooks/useSendMessage.ts` no incluía "cripto" ni "criptos" en su lista de keywords para detección de criptomonedas. Solo tenía "criptomoneda" (singular). El modelo `openai/gpt-oss-20b` con `reasoning_effort: 'low'` no es 100% fiable invocando `show_widget` por tool calling (Camino A), por lo que el fallback por keywords (Camino B) era la única defensa. Ambas rutas fallaban para "criptos".

**Fix**: Cambiar `'criptomoneda'` → `'cripto'` en la línea 29 de `useSendMessage.ts`. Esto cubre "cripto", "criptos", "criptomoneda" y "criptomonedas" por substring match. Además, se mejoró el system prompt en `src/lib/system-prompt.ts` L11 para explicitar ejemplos de palabras clave que deben disparar `show_widget` (incluyendo "criptos" y "criptomonedas"), y se enfatizó "Llama SIEMPRE".

**Tests**: 58/62 pasan. Los 4 fallos son preexistentes en `markdown.test.ts` (dependen de Ollama en `127.0.0.1:11434`, ECONNREFUSED). El fix no introdujo regresiones.

## [2026-08-02 11:30] @felix | fix

Se promovió la lección a `long-term/ui_and_styling.md`:
- **Regla**: Toda keyword de detección de widgets debe usar la raíz más corta posible (ej: `'cripto'` en vez de `'criptomoneda'`) para maximizar cobertura de variantes por substring match.
- **Regla**: El system prompt de `show_widget` debe incluir ejemplos concretos en español coloquial para guiar al LLM.

## [2026-08-02 12:00] @felix | error

**Bug**: TravelApp muestra "Error al obtener sugerencias" sin indicar la causa real.
**Rama**: fix/travel-suggestions-error
**Causa raíz**: Doble fallo:
1. **Cliente (useTravelData.ts L28)**: `if (!res.ok) throw new Error('Error al obtener sugerencias')` descarta el body de error del servidor. El endpoint `/api/travel` sí devuelve `{error: "mensaje real"}` en cada fallo, pero el hook nunca lo lee.
2. **Servidor (travel.ts)**: El catch único metía todos los errores (auth 401, rate limit 429, parseo JSON, timeout de red) en un mismo 500, sin logs ni granularidad. Imposible diagnosticar si el fallo era `GROQ_API_KEY` no configurada, rate limit de Groq, o JSON malformado del modelo.

**Fix**: 
- `useTravelData.ts`: ahora intenta `res.json()` en el body de error y usa el mensaje del servidor. Si falla el parseo, muestra `Error del servidor (${res.status})`.
- `travel.ts`: manejo granular de errores de Groq (auth → 502, rate limit → 503, parseo JSON → 502), se extrae `cleanJsonContent()` con flags `gi` para limpiar markdown blocks robustamente, y se añaden `console.error` para diagnóstico server-side.

## [2026-08-02 12:00] @felix | fix

**Build**: `pnpm build` → PASS (7.12s, server output)
**Commit**: `8b77e1a` fix(travel): propagar mensajes de error del servidor al cliente
**Archivos modificados**: `src/components/mcp/travel/useTravelData.ts`, `src/pages/api/travel.ts`
**Lección promovida** a `long-term/ui_and_styling.md` → Regla: Nunca descartar el body de error en hooks de fetch.

## [2026-08-02 12:15] @cloe | decisión

**Feature**: refactor/tabiji-migration
**Estado**: completado
**Qué**: Reescritura completa de `src/pages/api/travel.ts` (135→403 líneas). Se reemplaza Groq (`groq-sdk`) por un pipeline gratuito: Wikivoyage REST API → Wikivoyage Action API (extracts) → LLM Local LM Studio como traductor/enriquecedor. Fallback directo con datos crudos si el LLM falla.
**Por qué**: Eliminar costo de API de Groq para sugerencias de viaje. Wikivoyage es gratuito y sin API key. El LLM local ya está disponible vía LM Studio.
**Pipeline**: Validación → Wikivoyage search (5s timeout) → Extracts paralelos (5s c/u, fallback individual) → LLM local (25s timeout) → Parseo JSON 2 intentos (raw + cleanJsonContent) → Validación esquema → Fallback buildFallbackSuggestions()
**Decisiones de implementación**:
1. `fetchWithTimeout` usa `AbortController` con chequeo defensivo de `AbortError` para Node.js (no tiene `DOMException`)
2. `cleanJsonContent` mejorado: primero busca `{...}`, luego intenta limpiar markdown blocks
3. `isValidSuggestion` como type guard para filtrar items inválidos del LLM
4. `buildFallbackSuggestions` extrae highlights de frases cortas del extract/excerpt; si insuficientes, usa tags genéricos rotativos
5. Contract `{ suggestions: TravelSuggestion[] }` sin cambios → `useTravelData.ts` sin modificar
6. `response_format: { type: 'json_object' }` para forzar JSON en el LLM local
7. System prompt en español con datos de Wikivoyage + parámetros del usuario inyectados
**Archivos modificados**: `src/pages/api/travel.ts` (reescrito), `src/components/mcp/TravelApp.tsx` (3 cambios copy: subtítulo, loading, footer), `.env` (2 vars), `.env.example` (2 vars)
**No tocados**: `useTravelData.ts`, `groq-client.ts`, `package.json`
**Build**: `pnpm build` → PASS (7.35s) | **Tests**: `pnpm test` → 62/62 PASS, 0 regresiones
**Commit**: `a3c5c3e` refactor(travel): reemplazar Groq por Wikivoyage + LLM local (Tabiji Migration)

## [2026-08-02 12:16] @ada | decisión

**Refactor**: Prioridades altas sobre `refactor/tabiji-migration`
**Estado**: completado
**Qué**: 4 correcciones de calidad aplicadas a `src/pages/api/travel.ts`:

1. **5.1 Pipeline a funciones composables**: Se extrajeron 4 funciones con SRP del handler monolítico (139→42 líneas):
   - `searchWikivoyage(destination)` — búsqueda en Wikivoyage REST API
   - `fetchExtracts(pages)` — extracts paralelos con fallback individual
   - `assembleContext(pages, extracts)` — ensamblado con truncado de extracts
   - `callLLM(context, userParams)` — LLM + parseo JSON + validación + fallback interno

2. **5.2 Constantes nombradas**: 8 números mágicos reemplazados por constantes al inicio del módulo: `WIKIVOYAGE_TIMEOUT_MS`, `LLM_TIMEOUT_MS`, `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `MAX_SUGGESTIONS`, `MAX_EXTRACT_CHARS`, `HIGHLIGHT_MIN_LENGTH`, `HIGHLIGHT_MAX_LENGTH`, `FALLBACK_EXTRACT_CHARS`.

3. **5.3 Dedesduplicar `extractJsonBraces`**: Lógica de extracción de `{...}` extraída a función pura, eliminando duplicación en `cleanJsonContent`.

4. **5.4 Truncar extracts**: `MAX_EXTRACT_CHARS = 1500` aplicado en `assembleContext()` para reducir payload al LLM sin perder información útil para el fallback.

**Archivos modificados**: `src/pages/api/travel.ts` (único archivo)
**Build**: `pnpm build` → PASS (7.06s) | **Tests**: `pnpm test` → 62/62 PASS, 0 regresiones
**Contrato**: `{ suggestions: TravelSuggestion[] }` — sin cambios. `useTravelData.ts` no requiere modificación.

## [2026-08-02 12:20] @max | decisión

**Feature**: refactor/tabiji-migration
**Estado**: completado
**Qué**: QA final — verificación de build, tests, código, accesibilidad y variables de entorno. Veredicto: PASS.
**Por qué**: Build pasa (7.60s), tests 62/62 sin regresiones, código limpio con SRP, constantes nombradas, mensajes de error en español claros, copy de TravelApp correcto, .env.example documentado. Observaciones menores de accesibilidad preexistentes (labels sin htmlFor, footer bajo contraste) — no bloqueantes.
**Archivos**: src/pages/api/travel.ts, src/components/mcp/TravelApp.tsx, .env.example

## [2026-08-02 12:25] @felix | error

**Bug**: POST /api/travel devuelve HTTP 502 con mensaje genérico "No se pudo consultar la base de datos de viajes" sin indicar la causa real (timeout, DNS, SSL, HTTP upstream).
**Rama**: refactor/tabiji-migration
**Causa raíz**: Defecto de diagnóstico — el `catch` en el handler y `searchWikivoyage` descartan el error real imprimiéndolo solo en `console.error` y devuelven al cliente un mensaje genérico idéntico para timeout, DNS, connection refused, SSL y HTTP 5xx de Wikivoyage. El usuario no recibe ninguna pista sobre qué falló ni cómo solucionarlo.

**Fix**: 4 mejoras aplicadas a `src/pages/api/travel.ts`:
1. **`classifyFetchError(err, url): ClassifiedError`** — nueva función que clasifica errores de red en `timeout | dns | connection | ssl | http | unknown` analizando `err.message`, `err.name === 'AbortError'`, `err.cause?.message` (Node.js 18+), y patrones de DNS/SSL en TypeError.
2. **`fetchWithRetryOnTimeout(url, options, timeoutMs)`** — wrapper con 1 retry automático en caso de timeout, mejorando la resiliencia ante latencia transitoria.
3. **`searchWikivoyage` modificado**: usa `fetchWithRetryOnTimeout`, clasifica errores de red vía `classifyFetchError`, y lanza `ClassifiedError` estructurado (no `new Error` genérico). Para HTTP no-ok, lanza `{type: 'http', ...}`.
4. **Handler modificado**: detecta si el error es un `ClassifiedError` y devuelve `jsonError(502, classified.userMessage)` con el mensaje orientativo según el tipo (ej: timeout → "Inténtalo de nuevo", DNS → "Verifica tu conexión", SSL → "Verifica fecha y hora del sistema").

**Build**: `pnpm build` → PASS (7.07s) | **Tests**: `pnpm test` → 62/62 PASS, 0 regresiones
**Commit**: `3995760` fix(travel): mejorar diagnóstico de errores de red en Wikivoyage

## [2026-08-02 12:25] @felix | fix

Se promovió la lección a `long-term/ui_and_styling.md`:
- **Regla**: Todo endpoint que haga fetch a servicios externos debe clasificar errores de red (timeout/DNS/SSL/HTTP) y devolver mensajes orientativos al usuario, no genéricos.
- **Regla**: Incluir `fetchWithRetryOnTimeout` con 1 retry para mejorar resiliencia ante latencia transitoria.
- **Regla**: Logs server-side deben incluir URL, tipo de error y detalles técnicos para diagnóstico post-mortem.

## [2026-08-02 12:32] @felix | error

**Bug**: POST /api/travel devuelve HTTP 502 genérico para errores 429 (Rate Limit) de Wikivoyage. No se diferencia entre 404, 429, 500, 503 del upstream — todos caen en el mismo `type: 'http'` → 502.
**Rama**: refactor/tabiji-migration
**Causa raíz**: `searchWikivoyage` (L388-396) lanzaba `ClassifiedError` con `type: 'http'` para cualquier `!searchRes.ok`, sin inspeccionar el código de estado. El handler mapeaba todo `type: 'http'` a 502.

**Fix**: 3 cambios en `src/pages/api/travel.ts`:
1. **Nuevo tipo `'ratelimit'`** en `ClassifiedError.type` union.
2. **`searchWikivoyage`**: si `searchRes.status === 429`, espera `Retry-After` header (o 2s default) y reintenta 1 vez. Si el retry también falla con 429, lanza `{type: 'ratelimit'}` con mensaje orientativo. Otros códigos (503, etc.) lanzan `{type: 'http'}`.
3. **Handler**: `statusMap` mapea `ratelimit` → 503 (Service Unavailable), resto de tipos → 502.

**Build**: `pnpm build` → PASS (7.38s) | **Tests**: `pnpm test` → 62/62 PASS, 0 regresiones

## [2026-08-02 12:32] @felix | fix

Se promovió la lección a `long-term/ui_and_styling.md`:
- **Regla**: Todo fetch a servicios externos debe diferenciar códigos HTTP del upstream (429 → rate limit con retry + backoff, 503 → servicio no disponible, etc.) y propagar mensajes orientativos al cliente.
- **Regla**: Usar `Retry-After` header cuando el upstream lo provee en respuestas 429.
- **Regla**: Mapear tipos de error del upstream a códigos HTTP semánticamente correctos (ej: `ratelimit` → 503, no 502).

## [2026-08-02 12:46] @ada | decisión

**Refactor**: Eliminar Wikivoyage del pipeline de `/api/travel` → estrategia LLM-only
**Rama**: refactor/tabiji-migration
**Estado**: completado
**Qué**: Refactorización radical de `src/pages/api/travel.ts` (610→202 líneas, -67%). Se elimina toda la dependencia de Wikivoyage REST API (search, extracts, assemble, fetchWithTimeout/Retry, classifyFetchError, buildFallbackSuggestions, 6 interfaces, 6 constantes). El nuevo pipeline es: Validar inputs → System Prompt (conocimiento interno) → LLM Local (AbortController directo) → Parseo JSON → isValidSuggestion → 200. Sin fallback — solo LLM local.
**Por qué**: Wikivoyage sufría rate limiting (HTTP 429) y hacia el widget inútil. El LLM local responde en <5s con conocimiento interno real sobre destinos. Eliminar 400 líneas de código de red/error handling simplifica drásticamente el mantenimiento. Contrato `{ suggestions: TravelSuggestion[] }` sin cambios — `useTravelData.ts` y `TravelApp.tsx` intactos.
**Archivos**: src/pages/api/travel.ts (reescrito)
**Build**: `pnpm build` → PASS (7.60s) | **Tests**: `pnpm test` → 62/62 PASS, 0 regresiones

## [2026-08-02 13:01] @nexus | fix

**Bug**: POST /api/travel devuelve HTTP 502 con "El modelo de IA no está disponible" aunque LM Studio sí responde.
**Rama**: refactor/travel-llm-only
**Causa raíz**: `travel.ts` L151 usa `response_format: { type: 'json_object' }` que **no es soportado** por LM Studio con el modelo `google/gemma-4-12b-qat`. LM Studio devuelve HTTP 400: `'response_format.type' must be 'json_schema' or 'text'`. El código interpretaba `!llmRes.ok` como error genérico.
**Fix**: 
1. Se eliminó `response_format: { type: 'json_object' }` — el system prompt ya instruye al modelo a devolver JSON puro y el parser tiene doble intento (directo + limpieza markdown).
2. Se aumentó `LLM_TIMEOUT_MS` de 25000 → 60000 porque Gemma es un modelo de razonamiento que gasta tokens en `reasoning_content` antes de generar `content`.
**Verificación Playwright**: Widget de travel devuelve 3 sugerencias correctas para "Kyoto" (Esencia Tradicional, Serenidad en Arashiyama, Puertas Torii) con highlights, descripciones y precios.
**Build**: `pnpm build` → PASS (7.18s) | **Tests**: `pnpm test` → 62/62 PASS, 0 regresiones
**Archivos modificados**: `src/pages/api/travel.ts`

## [2026-08-02 13:15] @nexus | feature

**Feature**: /api/travel respeta el selector de provider (Local ↔ Groq)
**Rama**: refactor/tabiji-migration
**Estado**: completado
**Qué**: El endpoint `/api/travel` ahora enruta al LLM según el provider seleccionado por el usuario en el `ProviderSelector` del `ChatHeader`. Antes siempre usaba LM Studio local, ignorando el selector.
**Cambios**:
1. `travel.ts` (+90 líneas): se añade `fetchGroqTravelSuggestions()` que usa el Groq SDK. Se extrae `parseLLMResponse()` compartido. El handler POST recibe `provider` y `groqModel` del body y enruta: `groq` → Groq Cloud, resto → LM Studio. Whitelist de modelos Groq idéntica a `/api/chat`. Timeout de 60s para ambos providers.
2. `useTravelData.ts` (+2 líneas): lee `$selectedProvider` y `$selectedGroqModel` del nanostore y los envía en el body del POST.
3. `TravelApp.tsx` (+3 líneas): textos dinámicos — subtítulo "100% Groq"/"100% IA local", loading "Consultando Groq..."/"Consultando IA local...", footer "Generado con Groq"/"Generado con IA local".
**Build**: `pnpm build` → PASS (7.88s) | **Tests**: `pnpm test` → 62/62 PASS, 0 regresiones
**Archivos**: `src/pages/api/travel.ts`, `src/components/mcp/travel/useTravelData.ts`, `src/components/mcp/TravelApp.tsx`
