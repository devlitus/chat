# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Always respond in Spanish.

## Rol del orquestador — REGLA ABSOLUTA

El orquestador (Claude Code principal) **NUNCA escribe código directamente**.
Su único rol es: analizar, clasificar intención, coordinar y delegar.

### Clasificación de intención antes de actuar

| Señales del usuario | Intención | Acción del orquestador |
|---|---|---|
| "cómo", "qué piensas", "tiene sentido", "explícame" | Exploración | Responder en conversación |
| "planifica", "diseña", "qué caminos hay" | Planificación | Agente `planner` |
| "implementa", "hazlo", "procede", "vamos con X" | Implementación | `planner` (si no hay plan) → `implementer` → pipeline QA |
| "arregla", "está roto", "bug", "error", "falla", "fix", "no funciona", "broken", "crash", stack trace, test fallido | Corrección de bug | Agente `debugger` → pipeline QA |

### Pipelines obligatorios para cualquier cambio de código

**Implementación de feature:**
```
planner → implementer → quality → security → accessibility → monitor
```

**Corrección de bug:**
```
debugger → quality → security → accessibility → monitor
```

Si el orquestador escribe código directamente:
- El monitor no registra el run
- Los agentes no aprenden
- No hay reporte de quality/security/accessibility
- El sistema de auto-mejora se rompe

## Commands

- `pnpm dev` — Start dev server at localhost:4321
- `pnpm build` — Production build to `./dist/`
- `pnpm preview` — Preview production build locally
- `pnpm test` — Run all unit tests (Vitest)
- `pnpm test:watch` — Run tests in watch mode during development
- `pnpm test:ui` — Open interactive test UI in browser
- `pnpm test:coverage` — Generate coverage report
- `pnpm test -- src/lib/db.test.ts` — Run a single test file

## Architecture

Astro 5 SSR project (Node adapter) with React islands for interactive UI.

- `src/pages/` — File-based routing. Widget pages (`weather-app.astro`, `crypto-app.astro`, etc.) are **standalone pages without a Layout**, loaded as iframes inside chat bubbles.
- `src/components/react/` — All interactive UI. Entry point is `ChatApp` (mounted via `client:load`).
- `src/stores/` — Global state via **Nanostores atoms** (`chat-store.ts`). Mutations go through `chat-actions.ts`. No React Context.
- `src/lib/db/` — IndexedDB layer split into `db-core.ts` (connection), `db-chats.ts`, `db-messages.ts`, `db-types.ts`. Public API re-exported from `src/lib/db.ts`.
- `src/lib/api/` — Server-side logic: `chat-stream.ts` (Ollama/Groq streaming), `mcp-server.ts` (MCP tool registration).

### LLM providers

Controlled by `LLM_PROVIDER` env var (default: `ollama`):

- `ollama` — calls `OLLAMA_BASE_URL/v1/chat/completions`. Model set via `OLLAMA_MODEL` (default: `gemma4`) or overridden per-request.
- `groq` — uses `groq-sdk` with model `openai/gpt-oss-20b`. Chunks with `reasoning_content` are silently dropped in `groq-client.ts`; the spinner stays visible while the model reasons.

See `.env.example` for all env vars.

### Widget pipeline

When the model response contains a `[WIDGET:type]` marker, the chat renders an interactive iframe instead of markdown:

1. `system-prompt.ts` instructs the model to emit `[WIDGET:weather|time|crypto|travel|chart]` as the last line.
2. `widget-detector.ts` matches the marker and maps it to a `ui://mcp-app-demo/<path>` URI.
3. `useSendMessage.ts` stores the URI as `uiResourceUri` on the `Message` record in IndexedDB.
4. `BotMessage.tsx` renders `<WidgetFrame>` instead of HTML when `uiResourceUri` is set.
5. `WidgetFrame.tsx` loads the standalone Astro page in a sandboxed iframe. `ALLOWED_UI_PATHS` is the security allowlist.
6. `useMcpTools.ts` bridges data between host and iframe via `postMessage` (`mcp_call_tool` / `mcp_tool_result`).

### Adding a new widget

1. Create `src/pages/<name>-app.astro` (standalone, no layout).
2. Add the route to `ALLOWED_UI_PATHS` in `WidgetFrame.tsx` and `widgetConfig`.
3. Add `[WIDGET:<name>]` instruction to `SYSTEM_PROMPT` in `system-prompt.ts`.
4. Add the URI mapping to `uriMap` in `widget-detector.ts`.
5. Handle the tool call in `useMcpTools.ts` if the widget needs host data.

### File uploads

`src/pages/api/upload.ts` writes files to a temp store; `src/pages/api/read-temp.ts` reads them back. `build-history-context.ts` injects CSV content into the last user message to trigger the chart widget.

## Testing

Vitest with happy-dom and fake-indexeddb. Tests are co-located (`*.test.ts`). Covers `src/lib/` (session, markdown, db, groq-client) and `src/pages/api/chat.ts` validation.

## MCP Server

`src/lib/api/mcp-server.ts` registers tools with `registerAppTool` from `@modelcontextprotocol/ext-apps/server`. Each tool declares a `_meta.ui.resourceUri` that maps to a widget page. The transport uses a mock Express-like `req/res` to bridge `StreamableHTTPServerTransport` with Astro SSR (no native Express).

## Agentes QA (pipeline automático)

Después de que el `implementer` termine cualquier implementación, ejecuta automáticamente:

```
planner → implementer → quality → security → accessibility → monitor
```

### Ejecución selectiva

| Archivos modificados | quality | security | accessibility | performance | monitor |
|---|---|---|---|---|---|
| `src/pages/api/`, `src/lib/`, `src/middleware/` | SI | SI | NO | SI | SI |
| `src/components/`, `src/pages/*.astro`, `src/layouts/` | SI | SI | SI | SI | SI |
| Solo `.css` / `<style>` | SI | NO | SI | NO | SI |
| Solo `docs/`, `README`, `.md` | NO | NO | NO | NO | NO |
| `package.json`, config files | SI | SI | NO | NO | SI |
| Mezcla | SI | SI | SI | SI | SI |

**performance** solo cuando los cambios tocan rendering, data fetching, streaming o base de datos.
**monitor** siempre corre al final del pipeline cuando al menos un agente QA corrió, incluso si el resultado es PASS.

### Fail-fast

Si `quality` detecta build fallido, incluirá `## Pipeline: HALT` y el pipeline se detiene. No ejecutar security ni accessibility. Sí ejecutar `monitor` para registrar el fallo en el historial.

### Ciclo de corrección

Máximo 2 iteraciones: `implementer → QA → implementer (fixes) → QA → STOP`. Si aún hay críticos tras 2 ciclos, presentar al usuario.

### Reportes y memoria de agentes

- `.claude/reports/` — reportes de cada agente (`debugger-report.md`, `quality-report.md`, `security-report.md`, `accessibility-report.md`, `pipeline-summary.md`, `performance-report.md`)
- `.claude/memory/` — memoria persistente entre sesiones por agente (incluye `debugger-memory.md`)
- `.claude/metrics/` — histórico de métricas y propuestas del sistema de monitoreo

### Sistema de monitoreo y auto-mejora

El agente `monitor` (modelo haiku) corre al final de cada pipeline y:
1. Registra métricas del run en `.claude/metrics/runs.json` (máx. 30 runs)
2. Actualiza el rastreo de patrones recurrentes en `.claude/metrics/patterns.json`
3. Genera propuestas en `.claude/metrics/tuning-proposals.md` para patrones con confianza ALTA (≥3 runs consecutivos)

**Aplicación de propuestas — al inicio del siguiente pipeline QA:**

Antes de lanzar el agente `quality`, lee `.claude/metrics/tuning-proposals.md`. Si hay propuestas marcadas `[PENDIENTE]` con confianza ALTA:

1. Crea un commit de checkpoint: `git commit --allow-empty -m "chore: checkpoint antes de aplicar ajustes de monitor"`
2. Para cada propuesta PENDIENTE ALTA: aplica el cambio descrito usando `Edit` en el archivo objetivo (siempre dentro de `.claude/memory/`)
3. Cambia el estado de la propuesta de `[PENDIENTE]` a `[APLICADA]` en `tuning-proposals.md`

Si no hay propuestas ALTA pendientes, continúa con el pipeline sin interrupciones.

**Seguridad del sistema de monitoreo:**
- El monitor solo escribe en `.claude/metrics/` (nunca en `.claude/agents/` ni en `src/`)
- Las propuestas solo pueden modificar archivos en `.claude/memory/` (memorias de agentes, no sus instrucciones)
- Cualquier cambio aplicado es reversible con `git revert` gracias al commit de checkpoint

### Referencias

- [GROQ — Quickstart](https://console.groq.com/docs/quickstart)
- [MCP SDK — TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
