---
name: bug
description: "Pipeline determinista para corregir un bug: debugger reproduce, diagnostica causa raiz y aplica el fix -> gates de quality/security/accessibility* (cada uno con ciclo de correccion via debugger) -> monitor. Sin creacion de rama -> se ejecuta sobre la rama actual. Sin fase de planificacion ni aprobacion previa, ya que el fix ya se aplica en el primer paso. Usala cuando el usuario reporte un error, bug, stack trace, comportamiento roto o test fallido via /bug \"<descripcion>\"."
---

# bug

Orquesta la correccion de un bug de principio a fin, delegando cada paso a un subagente. El orquestador **nunca escribe codigo ni reportes el mismo** — solo invoca agentes (`Agent` tool), lee sus outputs, decide el siguiente paso e informa al usuario. Ver `## Rol del orquestador — REGLA ABSOLUTA` en `CLAUDE.md`.

Es analoga a `/refactor` en que **no crea rama nueva** — se ejecuta sobre la rama en la que ya esta el usuario. Se diferencia de `/feature` y `/refactor` en que no hay fase de planificacion ni gate de aprobacion explicita: el agente `debugger` reproduce el fallo, identifica la causa raiz y aplica el fix directamente en el primer paso, porque retrasar la correccion detras de un plan no aporta valor para un bug ya reproducible.

## Uso

```
/bug <descripcion del bug>
```

La descripcion (argumentos pasados al comando) es el unico input obligatorio y se reenvia tal cual al agente `debugger` en el Paso 1. Si el usuario invoca `/bug` sin descripcion, pidesela antes de continuar: como minimo necesitas el comportamiento observado vs. esperado, y si existe, el stack trace o el test que falla. No inventes el alcance del bug.

## Diagrama del pipeline

```
[confirmar rama actual, sin crear ninguna]
  │
  ▼
debugger (reproduce + diagnostica causa raiz + fix + test de regresion)
  │
  ▼
quality  ──WARN/FAIL──▶ debugger (fix) ──▶ quality        (max. 2 ciclos)
  │ PASS
  ▼
security ──WARN/FAIL──▶ debugger (fix) ──▶ security       (max. 2 ciclos)
  │ PASS
  ▼
accessibility* ──WARN/FAIL──▶ debugger (fix) ──▶ accessibility  (max. 2 ciclos)
  │ PASS / N-A
  ▼
monitor (siempre, no bloqueante)
  │
  ▼
cierre + resumen al usuario
```

`*` accessibility es condicional — ver "Ejecucion selectiva" en `CLAUDE.md` → `## Agentes QA (pipeline automático)`. Este pipeline **no incluye `performance-auditor`**: el flujo de bug definido en `CLAUDE.md` (`## Rol del orquestador` → tabla de clasificacion → "Corrección de bug") es explicitamente `debugger → quality → security → accessibility → monitor`. Si el bug corregido resulta tener implicaciones de rendimiento evidentes, menciónalo al usuario en el cierre en vez de anadir el gate por tu cuenta.

## Pasos

### Paso 0 — Confirmar rama y contexto del bug

Antes de invocar a ningun agente:

1. Ejecuta `git branch --show-current` e informa al usuario en que rama vas a trabajar. **No crees ninguna rama** — a diferencia de `/feature`, este pipeline siempre corre sobre la rama actual, sea cual sea.
2. Ejecuta `git status --short`. Si hay cambios sin commitear que no formen parte de esta correccion (trabajo previo del usuario), avisalo antes de continuar — no los descartes.
3. Si la descripcion del bug recibida como argumento no incluye comportamiento esperado vs. observado, ni stack trace/pasos de reproduccion cuando existen, pideselos al usuario antes de pasar al Paso 1.

### Paso 1 — Diagnostico y fix

Invoca al agente `debugger` (via `Agent`) pasandole la descripcion del bug recibida como argumento, junto con cualquier stack trace o contexto adicional que haya dado el usuario. El debugger reproduce el fallo, identifica la causa raiz, aplica el fix minimo, anade test de regresion si hacia falta, y escribe `.claude/reports/debugger-report.md`.

### Paso 2 — Informar diagnostico y fix

Resume al usuario: sintoma, causa raiz (en terminos claros, no solo el mensaje de error), archivos modificados, y si se anadio un test de regresion.

**Si el reporte contiene `## Pipeline: HALT`** (el debugger no logro reproducir o resolver el bug): detén el pipeline aqui mismo. No invoques quality/security/accessibility. Informa al usuario que informacion adicional necesita el debugger (segun el propio reporte) y salta directo al Paso 12 (monitor) para dejar registro del intento, luego cierra.

### Paso 3 — Gate: quality

Antes de invocar `quality`, sigue el procedimiento de checkpoint de `CLAUDE.md` → `## Agentes QA (pipeline automático)` → "Aplicación de propuestas": si hay propuestas `[PENDIENTE]` con confianza ALTA en `.claude/metrics/tuning-proposals.md`, aplicalas primero.

Invoca a `quality`. Lee `.claude/reports/quality-report.md`.

**Criterio PASS**: Verificacion de Tipos = PASS, Build de Produccion = PASS, Tests = PASS (0 fallidos), sin criticos en el analisis de calidad.
Cualquier otro caso (incluye `## Pipeline: HALT`) = WARN/FAIL.

### Paso 4 — Informar resultado de quality

Resume al usuario el veredicto y, si hay hallazgos, la lista de criticos/advertencias.

### Paso 5 — Correccion de quality (si aplica)

Si el Paso 3 fue WARN/FAIL: invoca a `debugger` (no `implementer` — es quien tiene el contexto de la causa raiz de este bug) con los hallazgos del reporte para que los resuelva, luego vuelve al **Paso 3** (re-ejecuta `quality`, no reinicies el pipeline completo). Maximo 2 ciclos de correccion (`CLAUDE.md` → "Ciclo de corrección"). Si tras 2 ciclos sigue habiendo criticos, detén el pipeline y presenta el estado al usuario para que decida como proceder.

### Paso 6 — Gate: security

Si quality = PASS, invoca a `security`. Lee `.claude/reports/security-report.md`.

**Criterio PASS**: `pnpm audit` = PASS (sin vulnerabilidades high/critical) y grep de patrones peligrosos = PASS (sin hallazgos confirmados de severidad alta/critica tras el analisis LLM).

### Paso 7 — Informar resultado de security

Igual que el Paso 4, aplicado a security.

### Paso 8 — Correccion de security (si aplica)

Igual que el Paso 5: `debugger` corrige → vuelve al **Paso 6**. Maximo 2 ciclos, luego escalar al usuario.

### Paso 9 — Gate: accessibility (condicional)

Evalua si aplica segun la tabla "Ejecución selectiva" de `CLAUDE.md` (se ejecuta cuando el fix del debugger toco `src/components/`, `src/pages/*.astro`, `src/layouts/`, o hubo mezcla de tipos de archivo; se omite si el fix fue puramente backend/API/lib sin impacto en HTML renderizado).

Si aplica y security = PASS, invoca a `accessibility`. Lee `.claude/reports/accessibility-report.md` (y el `pipeline-summary.md` consolidado que este agente genera).

**Criterio PASS**: Conformidad Nivel A = PASS y Nivel AA = PASS (sin criticos).

Si no aplica, saltate este gate y anotalo en el resumen final ("accessibility: N/A — sin cambios en HTML/UI").

### Paso 10 — Informar resultado de accessibility

Igual que el Paso 4, aplicado a accessibility (si se ejecuto).

### Paso 11 — Correccion de accessibility (si aplica)

Igual que el Paso 5: `debugger` corrige → vuelve al **Paso 9**. Maximo 2 ciclos, luego escalar al usuario.

### Paso 12 — Monitor (siempre, no bloqueante)

Invoca a `monitor`. Este agente **no es un gate**: solo registra metricas en `.claude/metrics/` y genera propuestas advisory — nunca corrige codigo ni bloquea el cierre del pipeline. No repitas ningun ciclo de correccion por su causa.

`monitor` depende de que exista `.claude/reports/pipeline-summary.md`, y hoy ese archivo solo lo genera `accessibility`. Si el Paso 9 se salto (accessibility N/A) o el pipeline se detuvo en el Paso 2 (debugger HALT), `pipeline-summary.md` no existira: antes de invocar a `monitor`, crea tu mismo ese archivo consolidando los veredictos ya conocidos (debugger/quality/security) siguiendo el mismo formato que usa `accessibility` en su Paso 6 (tabla `Agente | Estado (OK/WARN/FAIL) | Críticos | Advertencias` + `Veredicto: PASS | NEEDS_FIX | FAIL`). Esto es bookkeeping del pipeline, no codigo fuente — no viola la regla del orquestador.

### Paso 13 — Cierre

Presenta al usuario un resumen final: bug corregido (o motivo de HALT), causa raiz, archivos modificados, test de regresion anadido (si aplica), veredicto de cada gate ejecutado (y los N/A), y si el `monitor` genero alguna propuesta de tuning pendiente de revision.

## Reglas transversales

- **Nunca escribas codigo ni reportes tu mismo.** Todo pasa por `Agent` (debugger/quality/security/accessibility/monitor), salvo la excepcion puntual de `pipeline-summary.md` descrita en el Paso 12.
- **No crees rama.** Este pipeline se ejecuta siempre sobre la rama actual del usuario, sea `main` o cualquier otra.
- **Ciclo de correccion**: maximo 2 iteraciones por gate (`debugger → gate → debugger (fix) → gate → STOP`). Al tercer fallo consecutivo del mismo gate, detén el pipeline y presenta el estado al usuario — no sigas iterando indefinidamente. Las correcciones post-gate siempre vuelven a `debugger`, no a `implementer`, para preservar el contexto de causa raiz.
- **Fail-fast**: si `quality` marca `## Pipeline: HALT` (build roto), no ejecutes `security` ni `accessibility` — corrige primero con `debugger` y vuelve a intentar `quality`. `monitor` si se ejecuta igualmente para registrar el fallo.
- **HALT del debugger**: si el propio `debugger` no logra reproducir o resolver el bug (Paso 2), el pipeline se detiene ahi — no hay codigo que auditar todavia. `monitor` corre igual para dejar registro.
- **Ejecución selectiva**: usa siempre la tabla de `CLAUDE.md` → `## Agentes QA (pipeline automático)` → "Ejecución selectiva" para decidir si accessibility aplica. `performance-auditor` no forma parte de este pipeline.
