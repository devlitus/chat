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

Este proyecto usa dos subagentes especializados con un flujo secuencial:

1. **planner** — Planifica y diseña nuevas features. Analiza el codebase, investiga buenas prácticas y genera documentos de diseño detallados en `docs/`. Siempre ejecutar primero.
2. **implementer** — Implementa features a partir de los planes generados por el planner en `docs/`. Ejecutar después de que el planner haya terminado su plan.

### Flujo de trabajo

1. Usar el agente **planner** para analizar requisitos y escribir el plan de diseño en `docs/`.
2. Usar el agente **implementer** para implementar el plan generado.

### referencias de documentación

- [GROQ — Quickstart](https://console.groq.com/docs/quickstart)
- [MCP SDK — TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
