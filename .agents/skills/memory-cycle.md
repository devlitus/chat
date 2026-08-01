# Skill: Memory Cycle — Protocolo de Memoria en 3 Capas

**Objetivo**: Proveer un protocolo determinista de lectura/escritura para el sistema de memoria de corto, medio y largo plazo. El ciclo de vida (init/promote/cleanup) está automatizado por un plugin de OpenCode. Los agentes solo necesitan **registrar** (`log`).

---

## 🔌 Plugin automático (NO depende del agente)

El plugin `.opencode/plugins/memory-cycle.ts` se ejecuta en el **runtime de OpenCode**, fuera del control del LLM. Garantiza que el ciclo de memoria sea 100% determinista:

| Evento OpenCode | Acción del plugin |
|-----------------|-------------------|
| `session.created` | **INIT**: si `session.md` > 24h → promueve entradas a `inbox.md` o `long-term/` → limpia `session.md` |
| `session.idle` | **PROMOTE + CLEANUP**: promueve lo que quede + elimina entradas > 14 días de `inbox.md` |
| `session.compacting` | **INYECTA**: copia el contenido de `session.md` al contexto de compactación para que sobreviva |

**El agente NUNCA necesita ejecutar `init`, `promote` ni `cleanup`.** Solo tiene que registrar.

---

## Las 3 capas

| Capa | Archivo | Ciclo de vida | Gestionado por |
|------|---------|---------------|----------------|
| Corto plazo | `session.md` | 24 horas | Plugin (init/clean) + Agentes (log) |
| Medio plazo | `inbox.md` | 1-2 semanas | Plugin (promote/cleanup) |
| Largo plazo | `long-term/*.md` | Todo el proyecto | Plugin (promote) + Agentes (lectura) |

---

## Lo ÚNICO que debe hacer el agente: `log`

**Quién**: Cualquier agente (Leo, Cloe, Max, Félix, Ada, Cipher, Nexus).
**Cuándo**: Al tomar una decisión, encontrar un error, o terminar una acción relevante.
**Cómo**: Escribir directamente en `.agents/memory/session.md` siguiendo el formato determinista.

### Formato determinista

Cada entrada DEBE seguir esta estructura exacta (el plugin la parsea para promover):

```markdown
## [YYYY-MM-DD HH:MM] @agente | tipo

**Feature**: feature/nombre-rama
**Estado**: en-progreso | completado | bloqueado
**Qué**: descripción de lo ocurrido (una frase)
**Por qué**: motivo o causa raíz (una frase)
**Archivos**: lista de archivos afectados
```

### Tipos válidos

| Tipo | Cuándo usarlo |
|------|--------------|
| `decisión` | Se tomó una decisión de diseño o arquitectura |
| `error` | Se encontró un error o bug |
| `fix` | Se aplicó una corrección |
| `wip` | Se avanzó en una feature (checkpoint) |
| `bloqueo` | La tarea está bloqueada por algo externo |
| `descubrimiento` | Se descubrió algo relevante (patrón, limitación) |

### Ejemplo

```markdown
## [2026-08-01 19:30] @leo | decisión

**Feature**: feature/galeria-fotos
**Estado**: en-progreso
**Qué**: Se elige Astro Image sobre <img> nativo para la galería
**Por qué**: Optimización automática de formatos y tamaños responsive
**Archivos**: src/components/Gallery.astro, src/pages/galeria.astro
```

---

## Cómo funciona la promoción automática

El plugin clasifica cada entrada de `session.md` al expirar (>24h):

| Si la entrada contiene... | El plugin la mueve a... |
|---------------------------|------------------------|
| `**Estado**: completado` | 🗑️ Descartada (git ya tiene el historial) |
| `**Estado**: en-progreso` o `bloqueado` | 📋 `inbox.md > ## Features en progreso` |
| `error` o `bug` sin `fix` | 📋 `inbox.md > ## Bugs pendientes` |
| Palabras de UI/CSS + lección/error | 🏛️ `long-term/ui_and_styling.md` |
| Palabras de rendimiento + lección/error | 🏛️ `long-term/performance.md` |
| Palabras de seguridad + lección/error | 🏛️ `long-term/security.md` |
| Resto sin clasificar | 📋 `inbox.md > ## Por revisar` |

---

## Lectura de memoria (al iniciar)

`session.md` se carga automáticamente vía `instructions` en `opencode.json`. Al iniciar una tarea, el agente ya tiene el contexto de la sesión anterior.

Además, cada agente lee bajo demanda su archivo de largo plazo específico:
- Leo, Nexus → `long-term/ui_and_styling.md`, `long-term/performance.md`
- Cloe → `long-term/ui_and_styling.md`
- Max → `long-term/ui_and_styling.md`, `long-term/performance.md`
- Ada → `long-term/performance.md`
- Cipher → `long-term/security.md`

---

## Flujo visual

```
┌─────────────────────────────────────────────────────────┐
│                    RUNTIME (PLUGIN)                      │
│                                                         │
│  session.created ──► INIT: promote + cleanup session.md │
│  session.idle    ──► PROMOTE + CLEANUP inbox.md         │
│  session.compacting ─► INJECT session.md                │
│                                                         │
│  ⚡ 100% determinista, NUNCA se olvida                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    LLM (AGENTES)                         │
│                                                         │
│  Al iniciar: session.md ya está cargado                 │
│  Durante:    solo hacen log (escriben en session.md)    │
│  Al leer:    long-term/ bajo demanda                    │
│                                                         │
│  🎯 Solo se preocupan de registrar, no de gestionar     │
└─────────────────────────────────────────────────────────┘
```

---

## 🚫 Reglas estrictas

1. **SOLO** escribir en `session.md` siguiendo el formato `## [timestamp] @agente | tipo`.
2. **NUNCA** escribir directamente en `inbox.md` o `long-term/` (el plugin lo hace).
3. **SIEMPRE** leer `long-term/` antes de empezar una tarea del dominio correspondiente.
4. **NO** preocuparse por `init`, `promote` o `cleanup` — el plugin lo gestiona.

---

## Responsabilidad por agente

| Agente | ¿Qué hace con la memoria? |
|--------|--------------------------|
| **Nexus** | Lee `session.md` (auto-cargado) + `long-term/`. Hace `log` de decisiones de enrutamiento. |
| **Leo** | Lee `long-term/`. Hace `log` de decisiones de arquitectura. |
| **Cloe** | Lee `long-term/ui_and_styling.md`. Hace `log` de wip y decisiones de implementación. |
| **Félix** | Hace `log` de `error` + `fix`. El plugin promueve la lección a `long-term/`. |
| **Ada** | Lee `long-term/performance.md`. Hace `log` de decisiones de refactor. |
| **Cipher** | Lee `long-term/security.md`. Hace `log` de vulnerabilidades y fixes. |
| **Max** | Lee `long-term/`. Hace `log` de hallazgos en QA. |
