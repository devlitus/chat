# Reglas del Proyecto — Chat App (Astro 5 + React)

**Idioma**: Responde siempre en español.
**Gestor de paquetes**: `pnpm` (nunca npm ni yarn).
**SO del usuario**: Windows 11.

## Comandos

- `pnpm dev` — Dev server en localhost:4321
- `pnpm build` — Build de producción a `./dist/`
- `pnpm preview` — Preview del build de producción
- `pnpm test` — Ejecutar tests unitarios (Vitest)
- `pnpm test:watch` — Tests en modo watch
- `pnpm test:ui` — Test UI en navegador
- `pnpm test:coverage` — Reporte de cobertura

## Arquitectura

Astro 5 con React + SSR (Node adapter).

- `src/pages/` — Rutas basadas en archivos (`.astro`)
- `src/layouts/` — Wrappers HTML con `<slot />`
- `src/components/` — Astro (estáticos) + React (interactivos)
  - `src/components/react/` — React islands (`client:load`)
  - `src/components/*.astro` — Astro con `<style>` scoped
- `src/lib/` — Utilidades (db.ts, session.ts, markdown.ts, groq-client.ts)
- `src/assets/` — Imágenes/SVGs como módulos (usar `.src`)
- `public/` — Archivos estáticos

TypeScript estricto (`astro/tsconfigs/strict`). CSS plano con estilos globales.

## Modelo LLM

- Proveedor: **Groq** vía `groq-sdk`
- Modelo: `openai/gpt-oss-20b` con `reasoning_effort: 'low'` y `stream: true`
- Los chunks de `reasoning_content` se ignoran en el cliente

## Sistema de Memoria

Este proyecto usa un sistema de memoria dividida por dominios en `.agents/memory/`.
**ANTES de cualquier tarea, lee los archivos de memoria relevantes:**

- `.agents/memory/architecture.md` — Reglas de arquitectura, estructura, imports
- `.agents/memory/ui_and_styling.md` — Tailwind, CSS, accesibilidad, responsive
- `.agents/memory/performance.md` — Optimizaciones, Core Web Vitals, Big O
- `.agents/memory/security.md` — Vulnerabilidades conocidas, secretos, OWASP
- `.agents/memory/rules.md` — Reglas generales y lecciones aprendidas

Si un agente descubre un error recurrente o una nueva regla, **debe añadirlo** al archivo de memoria correspondiente.

## Sistema Multi-Agente

Agentes disponibles en `.opencode/agents/`:

| Agente | Rol | Invocación |
|--------|-----|------------|
| `nexus` | Agente principal con enrutamiento dinámico | Default / `@nexus` |
| `leo` | Arquitecto y PM — diseño antes de código | `@leo` |
| `cloe` | Frontend Developer — implementación Mobile-First | `@cloe` |
| `max` | QA y Tester — build, SEO, accesibilidad | `@max` |
| `felix` | Fixer — debugging y root cause analysis | `@felix` |
| `ada` | Optimizadora — refactorización y Big O | `@ada` |
| `cipher` | DevSecOps — seguridad y OWASP | `@cipher` |

### Flujo recomendado para nuevas features

```
@nexus → @leo (arquitectura) → @cloe (implementación) → @max (QA) → @cipher (seguridad si aplica)
```

### Flujo para bugs

```
@felix → fix → actualizar memoria → @max (verificar build)
```

### Flujo para optimización

```
@ada → refactor → @max (verificar que no se rompió nada)
```

## MCP Apps

Integración experimental de MCP para renderizar UIs interactivas en burbujas del asistente.

- `src/pages/api/mcp.ts` — Endpoint del servidor MCP
- `src/pages/mcp-app.astro` — Página standalone con `McpClientApp`
- `src/components/mcp/McpClientApp.tsx` — Cliente MCP React

Protocolo host ↔ iframe via `window.postMessage`:
- Iframe → Host: `mcp_call_tool`
- Host → Iframe: `mcp_tool_result`
