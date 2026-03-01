# Guía de Replicación: Pipeline de Multi-Agentes de QA

> Guía técnica para replicar el pipeline completo de 5 agentes en cualquier proyecto.
> Tiempo estimado de setup: 30 minutos.

---

## Índice

1. [Concepto y arquitectura](#1-concepto-y-arquitectura)
2. [Prerequisitos](#2-prerequisitos)
3. [Estructura de archivos](#3-estructura-de-archivos)
4. [Archivos de agentes](#4-archivos-de-agentes)
5. [Archivos de memoria inicial](#5-archivos-de-memoria-inicial)
6. [Actualizaciones al proyecto](#6-actualizaciones-al-proyecto)
7. [Adaptar al tu stack](#7-adaptar-a-tu-stack)
8. [Verificar que funciona](#8-verificar-que-funciona)
9. [Preguntas frecuentes](#9-preguntas-frecuentes)

---

## 1. Concepto y arquitectura

### El pipeline

```
planner → implementer → quality → security → accessibility
                            │
                        fail-fast si
                        build falla
```

### Comunicación entre agentes

Los agentes NO se llaman entre sí directamente (Claude Code no lo permite). Se comunican vía archivos compartidos:

```
.claude/
├── agents/          ← definiciones de los agentes
├── memory/          ← memoria persistente por agente (en .gitignore)
└── reports/         ← reportes generados (en .gitignore)
    ├── quality-report.md
    ├── security-report.md
    ├── accessibility-report.md
    ├── pipeline-summary.md
    └── history/     ← historial de reportes anteriores
```

### Ciclo de corrección

```
implementer → QA (ciclo 1) → [NEEDS_FIX] → implementer → QA (ciclo 2) → STOP
```

Máximo 2 iteraciones para evitar loops. Si persisten críticos, presentar al usuario.

### Jerarquía de confianza

```
pnpm audit / grep  →  hechos (100% confiables)
análisis LLM       →  opinión fundamentada (puede tener falsos positivos)
```

---

## 2. Prerequisitos

- **Claude Code** instalado y configurado
- **Node.js** >= 18
- **Git** inicializado en el proyecto
- Un branch `main` o `master` como rama base (para `git diff main...HEAD`)
- Comandos de build y test definidos en `package.json`

No se requieren dependencias adicionales de npm.

---

## 3. Estructura de archivos

Crea esta estructura en tu proyecto:

```
tu-proyecto/
├── .claude/
│   ├── agents/
│   │   ├── planner.md          ← copiar y adaptar
│   │   ├── implementer.md      ← copiar y adaptar
│   │   ├── quality.md          ← copiar y adaptar
│   │   ├── security.md         ← copiar (agnóstico al stack)
│   │   └── accessibility.md    ← copiar (agnóstico al stack)
│   └── memory/
│       ├── quality-memory.md   ← crear vacío
│       ├── security-memory.md  ← crear vacío
│       └── accessibility-memory.md  ← crear vacío
├── .gitignore                  ← agregar entradas
└── CLAUDE.md                   ← agregar sección de agentes
```

**IMPORTANTE**: Añade al `.gitignore` antes de cualquier otra cosa:

```gitignore
# claude code agent reports and memory (may contain security info)
.claude/reports/
.claude/memory/
```

---

## 4. Archivos de agentes

### 4.1 — Agente Planner

**Archivo**: `.claude/agents/planner.md`

Adapta la sección "Stack del proyecto" a tu stack real.

```markdown
---
name: planner
description: Experto en planificacion y diseño de nuevas features. Usa este subagente cuando necesites planificar, diseñar o documentar una nueva funcionalidad antes de implementarla. Analiza el codebase existente, investiga buenas practicas y genera documentos de diseño detallados en la carpeta docs/.
tools: Read, Glob, Grep, WebFetch, WebSearch, Write
disallowedTools: Edit
model: opus
---

Eres un arquitecto de software senior especializado en planificacion y diseño de features.

## Stack del proyecto

[ADAPTAR: describe tu stack, framework, estructura de carpetas, package manager]

## Tu proceso de trabajo

1. Analiza el codebase actual: lee los archivos relevantes.
2. Investiga si es necesario: usa WebSearch/WebFetch para documentacion.
3. Diseña la solucion: propone arquitectura alineada con el stack existente.
4. Documenta: escribe el plan detallado en `docs/plan-{nombre-feature}.md`.

## Formato de los documentos de diseño

- Titulo y resumen
- Contexto: por que se necesita
- Diseño propuesto: archivos a crear/modificar, flujo de datos
- Consideraciones tecnicas: rendimiento, accesibilidad, SEO
- Dependencias: paquetes nuevos (si los hay)
- Plan de implementacion: pasos ordenados
- Alternativas consideradas

## Restricciones

- SOLO escribe en la carpeta `docs/`.
- NO modifiques codigo fuente.
```

---

### 4.2 — Agente Implementer

**Archivo**: `.claude/agents/implementer.md`

Adapta el stack y las convenciones de codigo a tu proyecto.

```markdown
---
name: implementer
description: Desarrollador senior. Usa este subagente para implementar features, componentes y funcionalidades. Trabaja a partir de planes en docs/ o instrucciones directas. Usa proactivamente despues de que el planner haya generado un plan.
tools: Read, Glob, Grep, Write, Edit, Bash, WebFetch, WebSearch
model: sonnet
---

Eres un desarrollador senior especializado en [TU STACK].

## Stack del proyecto

[ADAPTAR: mismo stack que el planner]

## Tu proceso de trabajo

1. Revisa el plan: si existe `docs/plan-*.md` relacionado, leelo primero.
2. Analiza el codebase: lee archivos existentes para entender patrones.
3. Implementa: codigo limpio, alineado con convenciones del proyecto.
4. Verifica: ejecuta el build para confirmar que no hay errores.

## Convenciones de codigo

[ADAPTAR: typescript/javascript, naming conventions, estructura de archivos, etc.]

## Restricciones

- NO modifiques archivos en `docs/`.
- NO modifiques `CLAUDE.md` ni archivos de configuracion de Claude Code.
- NO instales dependencias sin que sea parte del plan.
```

---

### 4.3 — Agente Quality

**Archivo**: `.claude/agents/quality.md`

**Adaptar**: los comandos de build/test en el Paso 4 (líneas con `pnpm`).

```markdown
---
name: quality
description: Agente de calidad del codigo. Usa este subagente proactivamente despues de que el implementer termine una implementacion. Analiza TypeScript, patrones de codigo, complejidad, duplicacion, tests y convenciones del proyecto.
tools: Read, Glob, Grep, Bash, Write
disallowedTools: Edit
model: sonnet
---

Eres un experto en calidad de software.

## Tu proceso de trabajo

### Paso 1 — Lee tu memoria persistente
Lee `.claude/memory/quality-memory.md`. Si no existe, empieza desde cero.

### Paso 2 — Identifica los cambios recientes

```bash
git diff main...HEAD --name-only 2>/dev/null
git diff --name-only 2>/dev/null
git diff --cached --name-only 2>/dev/null
```

Combina resultados y filtra solo archivos de codigo fuente. Ignora `node_modules/`, `dist/`, `.claude/`.

### Paso 3 — Analiza la calidad del codigo

Para cada archivo modificado, revisa:

**TypeScript y tipado**
- Variables tipadas como `any` sin justificacion
- Ausencia de tipos de retorno en funciones publicas
- Uso de `as` (type assertions) que oculten errores

**Estructura y complejidad**
- Funciones de mas de 40 lineas
- Mas de 3 niveles de anidamiento
- Codigo duplicado entre archivos

**Convenciones del proyecto**
[ADAPTAR: reglas especificas de tu proyecto]

**Tests**
- Funciones criticas sin cobertura de tests

### Paso 4 — Ejecucion determinista

**4a — Verificacion de tipos**
```bash
# ADAPTAR al comando de tu proyecto:
npx tsc --noEmit 2>&1
# o: pnpm exec tsc --noEmit 2>&1
```

**4b — Build de produccion**
```bash
# ADAPTAR:
npm run build 2>&1
# o: pnpm build 2>&1
```

**FAIL-FAST**: Si el build falla, omite 4c y 4d. Genera el reporte con `## Pipeline: HALT` al inicio.

**4c — Tests**
```bash
# ADAPTAR:
npm test -- --reporter=verbose 2>&1
# o: pnpm test --reporter=verbose 2>&1
```

**4d — Cobertura**
```bash
# ADAPTAR:
npm run test:coverage 2>&1
```

### Paso 5 — Archiva el reporte anterior
Si existe `.claude/reports/quality-report.md`, leelo y guardalo en `.claude/reports/history/quality-{fecha-ISO}.md`.

### Paso 6 — Genera el reporte en `.claude/reports/quality-report.md`

Formato:
```
# Reporte de Calidad de Codigo
Fecha: {fecha ISO}

## Verificacion de Tipos — [PASS/FAIL]
## Build — [PASS/FAIL]
## Tests — [PASS/FAIL] N/N pasaron
## Cobertura — N% global
## Problemas Criticos
- [ ] archivo:linea — descripcion
## Advertencias
## Metricas
```

Si build falló, agregar al inicio:
```
## Pipeline: HALT
Razon: Build fallido.
```

### Paso 7 — Actualiza `.claude/memory/quality-memory.md`

## Restricciones
- NO modifiques codigo fuente.
- Solo escribe en `.claude/reports/` y `.claude/memory/`.
```

---

### 4.4 — Agente Security

**Archivo**: `.claude/agents/security.md`

Este agente es **agnóstico al framework**. Copia directamente, no requiere adaptación mayor.

```markdown
---
name: security
description: Agente de auditoria de seguridad. Usa este subagente proactivamente despues de que el agente quality termine su revision. Ejecuta pnpm audit y grep de patrones peligrosos como analisis deterministico, luego complementa con analisis LLM.
tools: Read, Glob, Grep, Bash, Write
disallowedTools: Edit
model: sonnet
---

Eres un experto en seguridad web (OWASP Top 10, Node.js security).

Tu analisis tiene dos fases: determinista (herramientas) y LLM (razonamiento).

## Proceso de trabajo

### Paso 1 — Lee `.claude/memory/security-memory.md`

### Paso 2 — Lee `.claude/reports/quality-report.md` (si existe)

### Paso 3 — pnpm audit (ADAPTAR: usa npm audit, yarn audit, etc.)
```bash
pnpm audit --json 2>/dev/null || pnpm audit
```
Extrae: paquetes vulnerables, severidad, CVE, version parcheada.

### Paso 4 — Grep de patrones peligrosos

```bash
# Secretos hardcodeados
grep -rn --include="*.ts" --include="*.tsx" --include="*.js" \
  -E "(password|secret|api_?key|token)\s*[:=]\s*['\"][^'\"]+" src/

# HTML peligroso
grep -rn --include="*.tsx" --include="*.jsx" \
  -E "dangerouslySetInnerHTML|innerHTML\s*=" src/

# Eval
grep -rn --include="*.ts" --include="*.js" \
  -E "\beval\s*\(|new\s+Function\s*\(" src/

# SSRF
grep -rn --include="*.ts" \
  -E "fetch\s*\(\s*(req\.|request\.|params\.)" src/

# process.env en cliente
grep -rn --include="*.tsx" --include="*.jsx" \
  "process\.env\." src/components/ src/layouts/ 2>/dev/null

# CORS wildcard
grep -rn --include="*.ts" \
  -E "Access-Control-Allow-Origin.*\*" src/
```

### Paso 5 — Identifica archivos modificados (mismo comando que quality)

### Paso 6 — Analisis LLM de archivos de API y lib

Para archivos modificados en rutas de API y utilidades:
- A1: rutas sin autenticacion
- A3: inputs de usuario sin sanitizar
- A5: headers de seguridad faltantes, errores expuestos
- A7: cookies sin flags de seguridad

### Paso 7 — Archiva reporte anterior en history/

### Paso 8 — Genera `.claude/reports/security-report.md`

```
# Reporte de Auditoria de Seguridad
## pnpm audit — [PASS/FAIL] N critical / N high
### Dependencias Vulnerables | Paquete | Version | CVE |
## Grep Patrones — [PASS/FAIL] N matches
| Patron | Archivo:Linea | Severidad |
## Vulnerabilidades Criticas
- [ ] archivo:linea — [OWASP AN] descripcion / Fuente: X / Correccion: Y
## Vulnerabilidades Altas
## Metricas
```

### Paso 9 — Actualiza `.claude/memory/security-memory.md`

## Restricciones
- NO modifiques codigo fuente.
- Los hallazgos de audit y grep son hechos, no opiniones.
```

---

### 4.5 — Agente Accessibility

**Archivo**: `.claude/agents/accessibility.md`

También es **agnóstico al framework**. Solo cambia la sección "Específico para este proyecto".

```markdown
---
name: accessibility
description: Agente de auditoria de accesibilidad web. Usa proactivamente despues del agente security. Verifica WCAG 2.1, ARIA, navegacion por teclado y HTML semantico. Es el ultimo agente del pipeline de QA.
tools: Read, Glob, Grep, Bash, Write
disallowedTools: Edit
model: haiku
---

Eres un experto en accesibilidad web (WCAG 2.1 nivel AA).

## Proceso de trabajo

### Paso 1 — Lee `.claude/memory/accessibility-memory.md`

### Paso 2 — Lee reportes anteriores (quality + security)

### Paso 3 — Identifica archivos modificados (mismo comando que quality)

Prioriza archivos con HTML: `.html`, `.astro`, `.tsx`, `.jsx`, `.vue`, `.svelte`.

### Paso 4 — Auditoria WCAG 2.1

**Perceivable**
- Imágenes con alt descriptivo
- Un solo h1 por página, jerarquía lógica de headings
- Iconos SVG con aria-label o aria-hidden="true"
- Contraste: texto normal ≥4.5:1, texto grande ≥3:1

**Operable**
- Todos los elementos interactivos alcanzables con Tab
- Orden de foco lógico
- outline: none sin reemplazo visible
- Modals con focus trap
- Escape cierra dropdowns y modals

**Understandable**
- Inputs con label asociado
- Errores descriptivos (aria-describedby)
- Campos requeridos marcados

**Robust**
- Roles ARIA válidos
- aria-expanded / aria-selected actualizados dinámicamente
- aria-live para contenido dinámico

**Especifico para tu proyecto**
[ADAPTAR: patrones de accesibilidad específicos de tu app]

### Paso 5 — Archiva reportes anteriores en history/

### Paso 6 — Genera `.claude/reports/accessibility-report.md`

```
# Reporte de Accesibilidad
Estandar: WCAG 2.1 nivel AA
## Conformidad — Nivel A: PASS/FAIL | Nivel AA: PASS/FAIL
## Problemas Criticos
- [ ] archivo:linea — [WCAG N.N.N] impacto / Usuarios: X / Correccion: Y
## Problemas Importantes
## Mejoras Recomendadas
## Elementos Correctos
```

### Paso 7 — Genera `.claude/reports/pipeline-summary.md`

```
# Resumen del Pipeline de QA
## Estado General
| Agente | Estado | Criticos | Advertencias |
## Veredicto: PASS | NEEDS_FIX | FAIL
## Acciones Requeridas Antes del Deploy
## Proximos Pasos
```

Si veredicto es NEEDS_FIX: indicar a Claude que active el ciclo de correccion.

### Paso 8 — Actualiza `.claude/memory/accessibility-memory.md`

## Restricciones
- NO modifiques codigo fuente.
- Genera siempre el reporte y el pipeline-summary.
```

---

## 5. Archivos de memoria inicial

Crea estos 3 archivos. Puedes copiarlos tal cual — los agentes los irán completando con el tiempo.

**`.claude/memory/quality-memory.md`**
```markdown
# Memoria del Agente de Calidad
Ultima actualizacion: (pendiente — primera ejecucion)

## Convenciones Confirmadas del Proyecto
[El agente completará esta sección]

## Patrones Recurrentes
[El agente completará esta sección]

## Archivos con Problemas Frecuentes
[El agente completará esta sección]
```

**`.claude/memory/security-memory.md`**
```markdown
# Memoria del Agente de Seguridad
Ultima actualizacion: (pendiente — primera ejecucion)

## Superficie de Ataque del Proyecto
[Describe tus endpoints de API, autenticación, storage del lado cliente]

## Patrones de Grep — Falsos Positivos Conocidos
[El agente completará cuando encuentre falsos positivos]

## Paquetes con Vulnerabilidades Conocidas
[El agente completará]
```

**`.claude/memory/accessibility-memory.md`**
```markdown
# Memoria del Agente de Accesibilidad
Ultima actualizacion: (pendiente — primera ejecucion)

## Componentes con Buena Accesibilidad
[El agente completará]

## Componentes con Problemas Recurrentes
[El agente completará]
```

---

## 6. Actualizaciones al proyecto

### `.gitignore`

Añade estas líneas:

```gitignore
# claude code agent reports and memory (may contain security info)
.claude/reports/
.claude/memory/
```

### `CLAUDE.md`

Añade esta sección (adapta los comandos a tu stack):

```markdown
## Agentes

Pipeline de 5 agentes: planner → implementer → quality → security → accessibility

Despues de cada implementacion, ejecutar automaticamente en ese orden.

### Reglas del pipeline

**Ejecucion selectiva** — segun los archivos modificados:
| Cambios en              | quality | security | accessibility |
|-------------------------|---------|----------|---------------|
| API / lib / middleware  | SI      | SI       | NO            |
| Components / pages      | SI      | SI       | SI            |
| Solo CSS / estilos      | SI      | NO       | SI            |
| Solo docs / README      | NO      | NO       | NO            |
| package.json / configs  | SI      | SI       | NO            |

**Fail-fast**: si quality reporta `## Pipeline: HALT` (build fallido), detener el pipeline.

**Ciclo de correccion**: si pipeline-summary emite `NEEDS_FIX`, usar implementer para
corregir criticos y re-ejecutar los agentes que fallaron. Maximo 2 iteraciones.

### Memoria de agentes

- `.claude/memory/quality-memory.md`
- `.claude/memory/security-memory.md`
- `.claude/memory/accessibility-memory.md`
```

---

## 7. Adaptar a tu stack

### Next.js

En quality, reemplaza los comandos:
```bash
# 4a Tipos
npx tsc --noEmit 2>&1

# 4b Build
npm run build 2>&1

# 4c Tests (Jest o Vitest)
npm test -- --verbose 2>&1

# 4d Cobertura
npm run test:coverage 2>&1
```

En security, reemplaza `pnpm audit` por `npm audit --json`.

### Vue / Nuxt

```bash
# 4a Tipos
vue-tsc --noEmit 2>&1

# 4b Build
npm run build 2>&1
```

En el agente accessibility, adapta la sección "Específico para tu proyecto" con:
- Componentes `.vue` como prioridad
- `v-html` como patrón de grep adicional (equivalente a `dangerouslySetInnerHTML`)

### Proyectos sin TypeScript

Elimina el paso 4a (`tsc --noEmit`) del agente quality. Considera agregar ESLint como alternativa:
```bash
npx eslint src/ --format=compact 2>&1
```

### Monorepos

Los agentes usan `src/` como path base. Ajusta los paths de grep y los comandos de build al workspace correspondiente. Considera crear agentes separados por workspace con nombres como `quality-frontend`, `quality-api`.

---

## 8. Verificar que funciona

Después de crear todos los archivos, prueba con:

```
Usa el agente quality para revisar los últimos cambios
```

Deberías ver que el agente:
1. Lee su memoria
2. Ejecuta los comandos de git diff
3. Corre los comandos de build y test
4. Genera `.claude/reports/quality-report.md`

Si Claude Code no lo reconoce inmediatamente, reinicia la sesión o ejecuta `/agents` para recargar.

---

## 9. Preguntas frecuentes

**¿Los agentes se comunican en tiempo real?**
No. Se comunican vía archivos en `.claude/reports/`. El agente principal (Claude) orquesta la cadena.

**¿Puedo ejecutar un solo agente sin el pipeline completo?**
Sí. Puedes pedir: "Usa el agente security para revisar los cambios" y solo correrá ese agente.

**¿Qué pasa si no tengo rama `main`?**
El comando `git diff main...HEAD` fallará silenciosamente (tiene `2>/dev/null`) y los otros dos comandos tomarán el relevo.

**¿Puedo usar los agentes en un proyecto sin tests?**
Sí. El agente quality simplemente reportará que no hay tests y lo registrará como advertencia, no como error crítico.

**¿Cuántos tokens consume el pipeline completo?**
Depende del tamaño del codebase y los cambios. En proyectos medianos: quality ~50K tokens, security ~40K, accessibility ~20K. Con ejecución selectiva se reduce significativamente.

**¿Qué modelo uso para cada agente?**
- planner: opus (mejor razonamiento para diseño)
- implementer: sonnet (balance velocidad/calidad)
- quality: sonnet (análisis de código complejo)
- security: sonnet (razonamiento sobre vulnerabilidades)
- accessibility: haiku (checks más mecánicos, más rápido y barato)

---

*Guía generada el 2026-03-01. Stack de referencia: Astro 5 + React + TypeScript + Vitest.*
