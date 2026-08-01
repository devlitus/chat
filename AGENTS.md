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

## Sistema de Memoria (3 Capas)

Este proyecto usa un sistema de memoria en 3 capas con ciclo de vida determinista.

| Capa | Archivo | Vive | Contiene |
|------|---------|------|----------|
| **Corto plazo** | `.agents/memory/session.md` | 24h | Tarea actual, decisiones del día |
| **Medio plazo** | `.agents/memory/inbox.md` | 1-2 sem | Features sin terminar, bugs pendientes |
| **Largo plazo** | `.agents/memory/long-term/` | Todo el proyecto | Reglas, lecciones, patrones confirmados |

### Archivos de largo plazo

- `.agents/memory/long-term/ui_and_styling.md` — Tailwind, CSS, accesibilidad, responsive
- `.agents/memory/long-term/performance.md` — Optimizaciones, Core Web Vitals, Big O
- `.agents/memory/long-term/security.md` — Vulnerabilidades conocidas, secretos, OWASP

### Protocolo de memoria

Todo agente debe usar el skill `memory-cycle` (`.agents/skills/memory-cycle.md`) para:
- **`log`**: Registrar decisiones, errores y avances en `session.md`
- **`promote`**: Mover lecciones a `inbox.md` o `long-term/`
- **`cleanup`**: Eliminar entradas caducadas

Si un agente descubre un error recurrente o una nueva regla, **debe registrarlo con `memory-cycle log` y promoverlo a `long-term/`** en el dominio correspondiente.

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

### 🌿 Feature Branches (Obligatorio)

**Nunca se commitea en `main`.** Cada tarea va en su propia rama:

| Prefijo | Uso | Agente |
|---------|-----|--------|
| `feature/` | Nuevas funcionalidades | Nexus, Leo |
| `fix/` | Corrección de bugs | Félix |
| `refactor/` | Refactorización | Ada |
| `security/` | Parches de seguridad | Cipher |
| `chore/` | Mantenimiento/config | Cualquiera |

### Flujo recomendado para nuevas features

```
feature/nueva-feature: @nexus → @leo (arquitectura) → @cloe (implementación) → @max (QA) → @cipher (seguridad si aplica) → merge a main
```

### Flujo para bugs

```
fix/<bug>: @felix → fix → actualizar memoria → @max (verificar build) → merge a main
```

### Flujo para optimización

```
refactor/<área>: @ada → refactor → @max (verificar que no se rompió nada) → merge a main
```

## MCP Apps

Integración experimental de MCP para renderizar UIs interactivas en burbujas del asistente.

- `src/pages/api/mcp.ts` — Endpoint del servidor MCP
- `src/pages/mcp-app.astro` — Página standalone con `McpClientApp`
- `src/components/mcp/McpClientApp.tsx` — Cliente MCP React

Protocolo host ↔ iframe via `window.postMessage`:
- Iframe → Host: `mcp_call_tool`
- Host → Iframe: `mcp_tool_result`
