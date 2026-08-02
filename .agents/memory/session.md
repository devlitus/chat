# Memoria de Corto Plazo — Sesión Actual

> **Ciclo de vida**: 24 horas. Se limpia al iniciar nueva sesión.
> **Formato**: `## [YYYY-MM-DD HH:MM] @agente | tipo`
> **Tipos**: decisión | error | fix | wip | bloqueo | descubrimiento

---

## Estado actual

**Rama**: feature/observabilidad-metricas-agentes
**Feature en progreso**: Sistema de observabilidad de agentes (plugin + analista)
**Último agente activo**: @nexus
**Timestamp inicio**: 2026-08-01

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
