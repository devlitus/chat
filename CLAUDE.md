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

## Agentes

Este proyecto usa dos subagentes especializados con un flujo secuencial:

1. **planner** — Planifica y diseña nuevas features. Analiza el codebase, investiga buenas prácticas y genera documentos de diseño detallados en `docs/`. Siempre ejecutar primero.
2. **implementer** — Implementa features a partir de los planes generados por el planner en `docs/`. Ejecutar después de que el planner haya terminado su plan.

### Flujo de trabajo

1. Usar el agente **planner** para analizar requisitos y escribir el plan de diseño en `docs/`.
2. Usar el agente **implementer** para implementar el plan generado.

### referencias de documentación

- [GROQ — Quickstart](https://console.groq.com/docs/quickstart)
