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
| `analista` | Análisis de métricas y recomendaciones — solo a demanda | `@analista` |

### 🌿 Feature Branches (Obligatorio)

**Nunca se commitea en `main`.** Cada tarea va en su propia rama:

| Prefijo | Uso | Agente |
|---------|-----|--------|
| `feature/` | Nuevas funcionalidades | Nexus, Leo, Ada |
| `fix/` | Corrección de bugs | Félix |
| `refactor/` | Refactorización | Ada |
| `security/` | Parches de seguridad | Cipher |
| `chore/` | Mantenimiento/config | Cualquiera |

### Flujo recomendado para nuevas features

```
feature/nueva-feature: @nexus → @leo (arquitectura) → @cloe (implementación) → @ada (revisión SOLID/BigO) → @max (QA) → @cipher (seguridad si aplica) → merge a main

> **Rollback**: Si @max detecta build roto o regresión, deriva a @felix para RCA + fix en lugar de devolver a @cloe.
```

### Flujo para bugs

```
fix/<bug>: @felix → fix → actualizar memoria → @max (verificar build) → merge a main

> **Rollback**: Si @max detecta build roto o regresión, deriva de nuevo a @felix para RCA + fix.
```

### Flujo para optimización

```
refactor/<área>: @ada → refactor → @max (verificar que no se rompió nada) → merge a main

> **Rollback**: Si @max detecta build roto o regresión, deriva a @felix para RCA + fix en lugar de devolver a @ada.
```

## Sistema de Observabilidad de Agentes

### Plugin metrics-observer (determinista)

El plugin `.opencode/plugins/metrics-observer.ts` captura métricas **100% deterministas** en cada sesión de agente, sin intervención del LLM:

| Hook | Acción |
|------|--------|
| `session.created` | Snapshot del estado inicial: agente activo, rama git, commit, timestamp |
| `session.idle` | Diff vs snapshot: archivos modificados, líneas +/-, duración, errores en session.md. Agrega a runs.json y actualiza patterns. |

### Archivos de métricas

| Archivo | Contenido | Gestionado por |
|---------|-----------|----------------|
| `.agents/metrics/runs.json` | Histórico de ejecuciones (máx. 30) | Plugin (escritura) |
| `.agents/metrics/patterns.json` | Patrones detectados con fingerprints y confianza | Plugin (escritura) |
| `.agents/metrics/tuning-proposals.md` | Propuestas de ajuste para patrones ALTA (≥3 runs) | Plugin (escritura) |
| `.agents/metrics/schema.md` | Documentación del contrato de datos | Manual |
| `.agents/metrics/queue/inbox/` | Métricas crudas pendientes de procesar | Plugin (escritura/lectura) |

### Confianza de patrones

| Runs consecutivos | Confianza | Acción |
|---|---|---|
| ≥3 | ALTA | Propuesta en tuning-proposals.md |
| 2 | MEDIA | Monitoreo pasivo |
| 1 | BAJA | Registro |
| 0 | RESUELTA | Limpieza automática |

### Agente analista (semántico)

El agente `@analista` se invoca **solo a demanda del usuario** para leer los datos del plugin y generar:
- Reportes de desempeño por agente
- Tendencias de duración, hotspots, tasa de errores
- Recomendaciones proactivas basadas en patrones
- Aplicación de propuestas pendientes en tuning-proposals.md

**No es parte de ningún pipeline** — es puramente consultivo. Invocar con `@analista` o `@analista ¿cómo van los agentes?`.

### Plugins del ecosistema

| Plugin | Archivo | Función |
|--------|---------|---------|
| Memory Cycle | `.opencode/plugins/memory-cycle.ts` | Ciclo de vida de memoria (session → inbox → long-term) |
| Metrics Observer | `.opencode/plugins/metrics-observer.ts` | Captura determinista de métricas de agentes |

## MCP Apps

Integración experimental de MCP para renderizar UIs interactivas en burbujas del asistente.

- `src/pages/api/mcp.ts` — Endpoint del servidor MCP
- `src/pages/mcp-app.astro` — Página standalone con `McpClientApp`
- `src/components/mcp/McpClientApp.tsx` — Cliente MCP React

Protocolo host ↔ iframe via `window.postMessage`:
- Iframe → Host: `mcp_call_tool`
- Host → Iframe: `mcp_tool_result`
