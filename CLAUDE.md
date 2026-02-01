# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Always respond in Spanish.
The operating system I work on is Windows 11.

## Commands

- `pnpm dev` — Start dev server at localhost:4321
- `pnpm build` — Production build to `./dist/`
- `pnpm preview` — Preview production build locally

No test framework is configured.

## Architecture

Astro 5 project using the default starter template. Pure static site with no client-side JavaScript.

- `src/pages/` — File-based routing (`.astro` files become routes)
- `src/layouts/` — HTML document wrappers using `<slot />` for content injection
- `src/components/` — Reusable Astro components with scoped `<style>` blocks
- `src/assets/` — Images/SVGs imported as modules (use `.src` for the URL)
- `public/` — Static files served at site root

Uses pnpm, ES modules, and strict TypeScript (`astro/tsconfigs/strict`). No CSS framework — plain CSS with scoped styles per component.

## Agentes

Este proyecto usa dos subagentes especializados con un flujo secuencial:

1. **planner** — Planifica y diseña nuevas features. Analiza el codebase, investiga buenas prácticas y genera documentos de diseño detallados en `docs/`. Siempre ejecutar primero.
2. **implementer** — Implementa features a partir de los planes generados por el planner en `docs/`. Ejecutar después de que el planner haya terminado su plan.

### Flujo de trabajo

1. Usar el agente **planner** para analizar requisitos y escribir el plan de diseño en `docs/`.
2. Usar el agente **implementer** para implementar el plan generado.

### referencias de documentación

- [GROQ — Quickstart](https://console.groq.com/docs/quickstart)
