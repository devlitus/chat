# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Always respond in Spanish.
The operating system I work on is Windows 11.

## Commands

- `pnpm dev` — Start dev server at localhost:4321
- `pnpm build` — Production build to `./dist/`
- `pnpm preview` — Preview production build locally
- `pnpm test` — Run all unit tests (Vitest)
- `pnpm test:watch` — Run tests in watch mode during development
- `pnpm test:ui` — Open interactive test UI in browser
- `pnpm test:coverage` — Generate coverage report

## Testing

Vitest is configured with happy-dom environment and fake-indexeddb support. 49 unit tests cover critical business logic in:
- `src/lib/` (session, markdown, db, groq-client)
- `src/pages/api/` (chat endpoint validation)

Tests are co-located with source files using `*.test.ts` naming convention.

## Architecture

Astro 5 project with React integration and server-side rendering (SSR mode with Node adapter).

- `src/pages/` — File-based routing (`.astro` files become routes)
- `src/layouts/` — HTML document wrappers using `<slot />` for content injection
- `src/components/` — Mix of Astro components (static) and React components (interactive)
  - `src/components/react/` — React island components (ChatApp with client:load directive)
  - `src/components/*.astro` — Astro components with scoped `<style>` blocks
- `src/lib/` — Utility libraries (db.ts, session.ts, markdown.ts, groq-client.ts)
- `src/assets/` — Images/SVGs imported as modules (use `.src` for the URL)
- `public/` — Static files served at site root

Uses pnpm, ES modules, and strict TypeScript (`astro/tsconfigs/strict`). Plain CSS with global styles. React for interactive chat UI with Context-based state management.

## Modelo LLM

- Proveedor: **Groq** vía `groq-sdk`
- Modelo actual: `openai/gpt-oss-20b` (modelo de razonamiento)
- Configurado en `src/pages/api/chat.ts` con `reasoning_effort: 'low'` y `stream: true`
- Los chunks de razonamiento (`reasoning_content`) se ignoran en el cliente: `groq-client.ts` solo emite `parsed.choices?.[0]?.delta?.content`. El spinner es visible mientras el modelo razona.

## Sistema MCP (Model Context Protocol)

Integración experimental de MCP dentro del chat para renderizar UIs interactivas en burbujas del asistente.

### Archivos clave

- `src/pages/api/mcp.ts` — Endpoint POST/OPTIONS del servidor MCP usando `@modelcontextprotocol/sdk`. Registra la herramienta `get-time` con `registerAppTool` de `@modelcontextprotocol/ext-apps/server`. Usa un mock de Express (`reqMock`/`resMock`) para compatibilizar `StreamableHTTPServerTransport` con Astro SSR.
- `src/pages/mcp-app.astro` — Página standalone (cargada en iframe) que monta `McpClientApp`. Usa Tailwind CDN y fuentes de Google. No tiene layout propio.
- `src/components/mcp/McpClientApp.tsx` — React component del cliente MCP. Se comunica con el host padre via `window.postMessage` usando el protocolo interno `mcp_call_tool` / `mcp_tool_result`.

### Protocolo host ↔ iframe

| Dirección | `type` | Datos |
|---|---|---|
| Iframe → Host | `mcp_call_tool` | `{ toolName: 'get-time' }` |
| Host → Iframe | `mcp_tool_result` | `{ toolName: 'get-time', time: ISOString }` |

El host maneja los mensajes en `MessageBubble.tsx`. Si un mensaje del asistente tiene `uiResourceUri`, se renderiza el iframe en lugar de HTML markdown.

## Agentes

Este proyecto usa seis subagentes especializados con un pipeline secuencial automático:

1. **planner** — Planifica y diseña nuevas features. Analiza el codebase, investiga buenas prácticas y genera documentos de diseño en `docs/`. Siempre ejecutar primero.
2. **implementer** — Implementa features a partir de los planes del planner. Ejecutar después del planner.
3. **quality** — Revisa calidad del código (TypeScript, complejidad, convenciones, build, tests). Ejecutar automáticamente después del implementer.
4. **security** — Audita vulnerabilidades OWASP, secretos expuestos, XSS e inyecciones. Ejecutar automáticamente después del quality.
5. **accessibility** — Verifica WCAG 2.1, HTML semántico, ARIA y navegación por teclado. Ejecutar automáticamente después del security. Genera el resumen consolidado del pipeline.
6. **performance-auditor** — Audita rendimiento: React re-renders, IndexedDB, streaming Groq, SSR waterfalls, complejidad algorítmica. Ejecutar bajo demanda cuando los cambios afectan rendering, data fetching, streaming o base de datos.

### Flujo de trabajo automático

**IMPORTANTE**: Después de que el `implementer` termine cualquier implementación, ejecuta automáticamente los agentes de QA en este orden:

```
planner → implementer → quality → security → accessibility
```

1. Usar el agente **planner** para analizar requisitos y escribir el plan en `docs/`.
2. Usar el agente **implementer** para implementar el plan.
3. **Clasificar cambios** (ver tabla de ejecución selectiva abajo).
4. Usar el agente **quality** para revisar calidad — genera `.claude/reports/quality-report.md`.
5. Si quality reporta `## Pipeline: HALT` (build fallido), **DETENER el pipeline** y devolver solo el reporte de quality al usuario. No ejecutar security ni accessibility.
6. Usar el agente **security** (si aplica) — genera `.claude/reports/security-report.md`.
7. Usar el agente **accessibility** (si aplica) — genera `.claude/reports/accessibility-report.md` y `.claude/reports/pipeline-summary.md`.
8. Usar el agente **performance-auditor** (si aplica, ver tabla) — genera `.claude/reports/performance-report.md`.

### Ejecución selectiva

Antes de lanzar los agentes QA, clasifica los archivos modificados y salta agentes irrelevantes:

| Archivos modificados | quality | security | accessibility | performance |
|---|---|---|---|---|
| `src/pages/api/`, `src/lib/`, `src/middleware/` | SI | SI | NO | SI |
| `src/components/`, `src/pages/*.astro`, `src/layouts/` | SI | SI | SI | SI |
| Solo `.css`, solo estilos en `<style>` | SI | NO | SI | NO |
| Solo `docs/`, `README`, `.md` | NO | NO | NO | NO |
| `package.json`, config files | SI | SI | NO | NO |
| Mezcla de archivos | SI | SI | SI | SI |

**quality** siempre se ejecuta (excepto para docs). **performance** se ejecuta solo cuando los cambios tocan rendering, data fetching, streaming o base de datos.

### Fail-fast

Si el agente **quality** detecta que el build falla (`pnpm build` retorna error), el pipeline se detiene inmediatamente. No tiene sentido auditar seguridad ni accesibilidad de código que no compila. El reporte de quality incluirá `## Pipeline: HALT` como señal.

### Ciclo de corrección

Cuando el pipeline detecta problemas **críticos** en cualquier reporte:
1. Presentar el `pipeline-summary.md` al usuario con los hallazgos críticos.
2. Usar el agente **implementer** para corregir SOLO los problemas marcados como críticos.
3. Re-ejecutar SOLO los agentes QA que reportaron problemas (no todos).
4. **Máximo 2 iteraciones** de corrección. Si después de 2 ciclos aún hay críticos, presentar el reporte final al usuario para decisión manual.

```
implementer → QA (ciclo 1) → implementer (fixes) → QA (ciclo 2) → STOP
```

### Sistema de memoria de agentes

Cada agente de QA mantiene memoria persistente entre sesiones para acumular conocimiento del proyecto:

- `.claude/memory/quality-memory.md` — patrones de calidad del proyecto
- `.claude/memory/security-memory.md` — vulnerabilidades conocidas y superficie de ataque
- `.claude/memory/accessibility-memory.md` — estado de accesibilidad por componente
- `.claude/memory/performance-memory.md` — anti-patrones de rendimiento, tamaños de bundle base, componentes problemáticos

### Comunicación entre agentes

Los agentes se comunican via archivos compartidos en `.claude/reports/`:
- El agente **security** lee el reporte de **quality** para contexto
- El agente **accessibility** lee ambos reportes anteriores
- El agente **accessibility** consolida todo en `pipeline-summary.md`
- El agente **performance-auditor** lee `quality-report.md` para evitar duplicar hallazgos

Si el pipeline-summary reporta problemas críticos, resolver antes del siguiente commit.

### referencias de documentación

- [GROQ — Quickstart](https://console.groq.com/docs/quickstart)
- [MCP SDK — TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
