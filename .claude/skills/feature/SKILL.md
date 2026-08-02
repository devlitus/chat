---
name: feature
description: "Pipeline determinista para crear una nueva feature: crea rama feature/<slug> desde main → planner → aprobación explícita del usuario → implementer → gates de quality/security/accessibility*/performance-auditor* (cada uno con ciclo de corrección vía implementer) → monitor. Úsala cuando el usuario pida implementar, crear o construir una funcionalidad nueva vía /feature \"<descripción>\"."
---

# feature

Orquesta la creación de una feature nueva de principio a fin, delegando cada paso a un subagente. El orquestador **nunca escribe código ni reportes él mismo** — solo invoca agentes (`Agent` tool), lee sus outputs, decide el siguiente paso e informa al usuario. Ver `## Rol del orquestador — REGLA ABSOLUTA` en `CLAUDE.md`.

## Uso

```
/feature <descripción de la feature>
```

La descripción de la feature (los argumentos pasados al comando) es el único input obligatorio y se reenvía tal cual al agente `planner` en el paso 1. Si el usuario invoca `/feature` sin descripción, pídesela antes de continuar — no inventes el alcance.

## Diagrama del pipeline

```
git checkout -b feature/<slug> main
  │
  ▼
planner
  │
  ▼
[APROBACIÓN EXPLÍCITA DEL USUARIO]  ← hard gate, no automatizable
  │
  ▼
implementer
  │
  ▼
quality  ──WARN/FAIL──▶ implementer (fix) ──▶ quality   (máx. 2 ciclos)
  │ PASS
  ▼
security ──WARN/FAIL──▶ implementer (fix) ──▶ security  (máx. 2 ciclos)
  │ PASS
  ▼
accessibility* ──WARN/FAIL──▶ implementer (fix) ──▶ accessibility  (máx. 2 ciclos)
  │ PASS / N-A
  ▼
performance-auditor* ──WARN/FAIL──▶ implementer (fix) ──▶ performance-auditor  (máx. 2 ciclos)
  │ PASS / N-A
  ▼
monitor (siempre, no bloqueante)
  │
  ▼
cierre + resumen al usuario
```

`*` accessibility y performance-auditor son condicionales — ver "Ejecución selectiva" más abajo. Todas las demás reglas transversales (fail-fast, ciclo de corrección, checkpoint de tuning-proposals) son las ya definidas en `CLAUDE.md` → `## Agentes QA (pipeline automático)`; esta skill las aplica de forma estricta y secuencial, gate por gate, en vez de lanzar todo el bloque QA de una vez.

## Pasos

### Paso 0 — Crear la rama de la feature

Antes de invocar a ningún agente:

1. Ejecuta `git status --short`. Si hay cambios sin commitear que no formen parte de esta ejecución (trabajo previo del usuario), avísalo y confirma cómo proceder antes de cambiar de rama — no los descartes ni los lleves a la nueva rama a ciegas.
2. Asegúrate de partir de `main` actualizado: `git fetch origin main` (si existe remoto `origin`) y verifica que no hay commits locales en `main` sin subir que se perderían de contexto.
3. Deriva un slug corto en kebab-case a partir de la descripción de la feature (p. ej. "sistema de notificaciones push" → `notificaciones-push`), siguiendo la convención ya usada en el repo (`feature/observabilidad-metricas-agentes`, `feature/convencion-ramas-y-commits`, etc.).
4. Crea y cambia a la rama con `git checkout -b feature/<slug> main` (o `git switch -c feature/<slug> main`).
5. Informa al usuario el nombre de la rama creada antes de pasar al paso 1.

Si ya estás en una rama `feature/*` distinta con trabajo en curso relacionado, pregunta al usuario si quiere continuar ahí en vez de crear una nueva, en lugar de asumirlo.

### Paso 1 — Planificación

Invoca al agente `planner` (vía `Agent`) pasándole la descripción de la feature recibida como argumento. El planner analiza el codebase, investiga si hace falta, y escribe el plan en `docs/plan-<feature>.md`.

### Paso 2 — Informar el plan

Presenta al usuario un resumen del plan generado (no pegues el documento completo si es muy largo — sintetiza: qué se va a crear/modificar, decisiones de diseño clave, alternativas descartadas) junto con la ruta del archivo en `docs/`.

### Paso 3 — Aprobación explícita del usuario

**Hard gate.** No invoques a `implementer` hasta que el usuario apruebe el plan explícitamente (ej. "apruebo", "adelante", "sí", "procede con el plan", o similar confirmación inequívoca). Si el usuario pide cambios, vuelve al paso 1 con el feedback y regenera el plan — no lo edites tú mismo. Si el usuario rechaza la feature, detén el pipeline aquí.

### Paso 4 — Implementación

Invoca a `implementer` con el plan aprobado como contexto (ruta del doc en `docs/`).

### Paso 5 — Informar la implementación

Resume al usuario qué archivos se crearon/modificaron y si `pnpm build` pasó.

### Paso 6 — Gate: quality

Antes de invocar `quality`, sigue el procedimiento de checkpoint de `CLAUDE.md` → `## Agentes QA (pipeline automático)` → "Aplicación de propuestas": si hay propuestas `[PENDIENTE]` con confianza ALTA en `.claude/metrics/tuning-proposals.md`, aplícalas primero.

Invoca a `quality`. Lee `.claude/reports/quality-report.md`.

**Criterio PASS**: Verificación de Tipos = PASS, Build de Producción = PASS, Tests = PASS (0 fallidos), sin críticos en el análisis de calidad.
Cualquier otro caso (incluye `## Pipeline: HALT`) = WARN/FAIL.

### Paso 7 — Informar resultado de quality

Resume al usuario el veredicto y, si hay hallazgos, la lista de críticos/advertencias.

### Paso 8 — Corrección de quality (si aplica)

Si el paso 6 fue WARN/FAIL: invoca a `implementer` con los hallazgos del reporte para que los resuelva, luego vuelve al **paso 6** (re-ejecuta `quality`, no reinicies el pipeline completo). Máximo 2 ciclos de corrección (`CLAUDE.md` → "Ciclo de corrección"). Si tras 2 ciclos sigue habiendo críticos, detén el pipeline y presenta el estado al usuario para que decida cómo proceder.

### Paso 9 — Gate: security

Si quality = PASS, invoca a `security`. Lee `.claude/reports/security-report.md`.

**Criterio PASS**: `pnpm audit` = PASS (sin vulnerabilidades high/critical) y grep de patrones peligrosos = PASS (sin hallazgos confirmados de severidad alta/crítica tras el análisis LLM).

### Paso 10 — Informar resultado de security

Igual que el paso 7, aplicado a security.

### Paso 11 — Corrección de security (si aplica)

Igual que el paso 8: `implementer` corrige → vuelve al **paso 9**. Máximo 2 ciclos, luego escalar al usuario.

### Paso 12 — Gate: accessibility (condicional)

Evalúa si aplica según la tabla "Ejecución selectiva" de `CLAUDE.md` (se ejecuta cuando se tocaron `src/components/`, `src/pages/*.astro`, `src/layouts/`, o hubo mezcla de tipos de archivo; se omite si los cambios fueron solo backend/API/lib sin impacto en HTML renderizado).

Si aplica y security = PASS, invoca a `accessibility`. Lee `.claude/reports/accessibility-report.md` (y el `pipeline-summary.md` consolidado que este agente genera).

**Criterio PASS**: Conformidad Nivel A = PASS y Nivel AA = PASS (sin críticos).

Si no aplica, sáltate este gate y anótalo en el resumen final ("accessibility: N/A — sin cambios en HTML/UI").

### Paso 13 — Informar resultado de accessibility

Igual que el paso 7, aplicado a accessibility (si se ejecutó).

### Paso 14 — Corrección de accessibility (si aplica)

Igual que el paso 8: `implementer` corrige → vuelve al **paso 12**. Máximo 2 ciclos, luego escalar al usuario.

### Paso 15 — Gate: performance-auditor (condicional)

Se ejecuta cuando los cambios tocan rendering, data fetching, streaming o base de datos (misma columna "performance" de la tabla de ejecución selectiva de `CLAUDE.md`).

Si aplica y el gate anterior (accessibility, o security si accessibility no aplicaba) = PASS, invoca a `performance-auditor`. Lee `.claude/reports/performance-report.md`.

**Criterio PASS**: sin "Hallazgos Críticos 🔴" y sin `## Pipeline: HALT`. Los "Hallazgos Importantes 🟡" no bloquean, pero repórtalos al usuario igualmente.

Si no aplica, sáltate este gate y anótalo en el resumen final ("performance: N/A — sin impacto en rendering/data/streaming/DB").

### Paso 16 — Informar resultado de performance-auditor

Igual que el paso 7, aplicado a performance (si se ejecutó).

### Paso 17 — Corrección de performance (si aplica)

Igual que el paso 8: `implementer` corrige → vuelve al **paso 15**. Máximo 2 ciclos, luego escalar al usuario.

### Paso 18 — Monitor (siempre, no bloqueante)

Invoca a `monitor`. Este agente **no es un gate**: solo registra métricas en `.claude/metrics/` y genera propuestas advisory — nunca corrige código ni bloquea el cierre del pipeline. No repitas ningún ciclo de corrección por su causa.

`monitor` depende de que exista `.claude/reports/pipeline-summary.md`, y hoy ese archivo solo lo genera `accessibility` (`CLAUDE.md` → `Reportes y memoria de agentes`). Si el paso 12 se saltó (accessibility N/A), `pipeline-summary.md` no existirá: antes de invocar a `monitor`, crea tú mismo ese archivo consolidando los veredictos ya conocidos (quality/security/performance-auditor) siguiendo el mismo formato que usa `accessibility` en su Paso 6 (tabla `Agente | Estado (OK/WARN/FAIL) | Críticos | Advertencias` + `Veredicto: PASS | NEEDS_FIX | FAIL`). Esto es bookkeeping del pipeline, no código fuente — no viola la regla del orquestador.

### Paso 19 — Cierre

Presenta al usuario un resumen final: feature implementada, plan (`docs/`), archivos modificados, veredicto de cada gate ejecutado (y los N/A), y si el `monitor` generó alguna propuesta de tuning pendiente de revisión.

## Reglas transversales

- **Nunca escribas código ni reportes tú mismo.** Todo pasa por `Agent` (planner/implementer/quality/security/accessibility/performance-auditor/monitor), salvo la excepción puntual de `pipeline-summary.md` descrita en el Paso 18.
- **Ciclo de corrección**: máximo 2 iteraciones por gate (`implementer → gate → implementer (fix) → gate → STOP`). Al tercer fallo consecutivo del mismo gate, detén el pipeline y presenta el estado al usuario — no sigas iterando indefinidamente.
- **Fail-fast**: si `quality` marca `## Pipeline: HALT` (build roto), no ejecutes `security` ni `accessibility` ni `performance-auditor` — corrige primero con `implementer` y vuelve a intentar `quality`. `monitor` sí se ejecuta igualmente para registrar el fallo.
- **Ejecución selectiva**: usa siempre la tabla de `CLAUDE.md` → `## Agentes QA (pipeline automático)` → "Ejecución selectiva" para decidir si accessibility/performance-auditor aplican.
- El plan del paso 1 solo puede volver a generarse vía `planner` (feedback del usuario), nunca editado directamente por el orquestador.
