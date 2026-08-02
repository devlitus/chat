---
name: refactor
description: "Pipeline determinista para refactorizar código existente: planner → aprobación explícita del usuario → implementer → gates de quality/security/accessibility*/performance-auditor* (cada uno con ciclo de corrección vía implementer) → monitor. Igual que la skill `feature` pero SIN crear una rama nueva — se ejecuta sobre la rama actual. Úsala cuando el usuario pida refactorizar, limpiar o reestructurar código vía /refactor \"<descripción>\"."
---

# refactor

Es el mismo pipeline que la skill `feature` (ver `.claude/skills/feature/SKILL.md`), con una única diferencia: **no crea una rama nueva**. Se ejecuta sobre la rama en la que ya está el usuario.

Para no duplicar la definición del pipeline, esta skill reutiliza tal cual los **Pasos 1 a 19** de `.claude/skills/feature/SKILL.md` (planificación, aprobación explícita, implementación, y los gates de quality/security/accessibility*/performance-auditor* con sus ciclos de corrección, hasta el cierre con monitor). Lee ese archivo y sigue esos pasos literalmente, con estos reemplazos:

- Ignora por completo el **Paso 0** de `feature` (creación de rama) — no lo ejecutes bajo ningún concepto.
- En todo lugar donde `feature/SKILL.md` diga "la descripción de la feature", usa la descripción del refactor recibida como argumento de `/refactor`.
- El agente `planner` sigue escribiendo el plan en `docs/plan-<nombre>.md` como de costumbre; el hecho de que sea un refactor en vez de una feature nueva no cambia dónde ni cómo documenta.

## Uso

```
/refactor <descripción del refactor>
```

Igual que en `/feature`, si el usuario invoca `/refactor` sin descripción, pídesela antes de continuar — no inventes el alcance del refactor.

## Diagrama

```
planner
  │
  ▼
[APROBACIÓN EXPLÍCITA DEL USUARIO]
  │
  ▼
implementer → quality ⇄ security ⇄ accessibility* ⇄ performance-auditor* → monitor
  (pasos 4-19 de feature/SKILL.md, sin cambios)
```

## Nota

Antes de empezar (Paso 1), confirma en qué rama está el usuario con `git branch --show-current`. Si está en `main` (o la rama por defecto), avísale explícitamente de que vas a trabajar directamente ahí ya que esta skill no crea rama — dale la opción de crear una manualmente antes de continuar si lo prefiere. No la crees tú por tu cuenta: eso es justamente lo que distingue a `/refactor` de `/feature`.
