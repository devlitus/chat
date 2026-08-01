# Skill: Memory Cycle — Protocolo de Memoria en 3 Capas

**Objetivo**: Proveer un protocolo determinista de lectura/escritura para el sistema de memoria de corto, medio y largo plazo. Todos los agentes deben usar este skill para interactuar con la memoria.

---

## Las 3 capas

| Capa | Archivo | Ciclo de vida | Contiene |
|------|---------|---------------|----------|
| Corto plazo | `session.md` | 24 horas | Tarea actual, decisiones del día |
| Medio plazo | `inbox.md` | 1-2 semanas | Features sin terminar, bugs, revisiones |
| Largo plazo | `long-term/*.md` | Todo el proyecto | Reglas, lecciones, patrones confirmados |

---

## Protocolo: Inicio de Sesión (`init`)

**Quién**: Nexus, al inicio de cada sesión.
**Qué hace**:

1. Leer `.agents/memory/session.md`
2. Si el archivo no existe, crearlo con el template vacío.
3. Si el `**Timestamp inicio**` tiene más de 24 horas, vaciar el `## Registro de sesión` y actualizar el timestamp.
4. Leer `.agents/memory/inbox.md` para conocer tareas pendientes.
5. Leer `.agents/memory/long-term/` para cargar reglas permanentes.

**Formato de session.md tras init**:
```markdown
# Memoria de Corto Plazo — Sesión Actual
...
## Estado actual

**Rama**: feature/nombre-rama
**Feature en progreso**: descripción breve
**Último agente activo**: @nexus
**Timestamp inicio**: 2026-08-01 19:00

## Registro de sesión

```

---

## Protocolo: Registro durante la sesión (`log`)

**Quién**: Cualquier agente (Leo, Cloe, Max, Félix, Ada, Cipher, Nexus).
**Cuándo**: Al tomar una decisión, encontrar un error, o terminar una acción relevante.

**Formato determinista** — cada entrada DEBE seguir esta estructura exacta:

```markdown
## [YYYY-MM-DD HH:MM] @agente | tipo

**Feature**: feature/nombre-rama
**Estado**: en-progreso | completado | bloqueado
**Qué**: descripción de lo ocurrido (una frase)
**Por qué**: motivo o causa raíz (una frase)
**Archivos**: lista de archivos afectados
```

**Tipos válidos**:
| Tipo | Cuándo usarlo |
|------|--------------|
| `decisión` | Se tomó una decisión de diseño o arquitectura |
| `error` | Se encontró un error o bug |
| `fix` | Se aplicó una corrección |
| `wip` | Se avanzó en una feature (checkpoint) |
| `bloqueo` | La tarea está bloqueada por algo externo |
| `descubrimiento` | Se descubrió algo relevante (patrón, limitación) |

**Ejemplo**:
```markdown
## [2026-08-01 19:30] @leo | decisión

**Feature**: feature/galeria-fotos
**Estado**: en-progreso
**Qué**: Se elige Astro Image sobre <img> nativo para la galería
**Por qué**: Optimización automática de formatos y tamaños responsive
**Archivos**: src/components/Gallery.astro, src/pages/galeria.astro
```

---

## Protocolo: Cierre de Sesión (`promote`)

**Quién**: Nexus, al finalizar una sesión o feature.
**Qué hace**:

1. Leer todas las entradas en `session.md > ## Registro de sesión`.
2. Clasificar cada entrada:

| Si la entrada es... | Acción |
|---------------------|--------|
| Feature terminada (`Estado: completado`) | No mover (git ya tiene el historial) |
| Feature sin terminar (`Estado: en-progreso` o `bloqueado`) | Copiar a `inbox.md > ## Features en progreso` |
| Error encontrado sin resolver (`tipo: error`, sin `fix` posterior) | Copiar a `inbox.md > ## Bugs pendientes` |
| Decisión relevante a largo plazo | Copiar a `inbox.md > ## Por revisar` |
| Lección permanente (error recurrente, patrón confirmado) | **Promover directamente** a `long-term/<dominio>.md` |

3. Al promover a `long-term/`, añadir la entrada en la sección correspondiente:
   - Errores de UI/CSS → `long-term/ui_and_styling.md > ## Lecciones aprendidas`
   - Cuellos de botella → `long-term/performance.md > ## Lecciones aprendidas`
   - Vulnerabilidades → `long-term/security.md > ## Lecciones aprendidas`

4. Limpiar `session.md`: vaciar `## Registro de sesión` y actualizar timestamp.

---

## Protocolo: Limpieza Periódica (`cleanup`)

**Quién**: Nexus, semanalmente o cuando se detecte acumulación.
**Qué hace**:

1. Leer `inbox.md`.
2. Para cada entrada con timestamp > 14 días:
   - Si no ha sido revisada ni promovida → **eliminar**.
   - Si fue promovida a `long-term/` → **eliminar de inbox**.
3. Para entradas en `## Por revisar` > 7 días sin acción → preguntar al usuario si descartar.

---

## 🚫 Reglas estrictas

1. **NUNCA** escribir en `long-term/` sin pasar por el protocolo `promote`.
2. **NUNCA** escribir en `session.md` sin seguir el formato determinista (`## [timestamp] @agente | tipo`).
3. **SIEMPRE** usar `memory-cycle log` para registrar, no escritura directa.
4. **SIEMPRE** leer `session.md` e `inbox.md` al iniciar (Nexus lo hace automáticamente).

---

## Flujo visual

```
INICIO SESIÓN                    DURANTE SESIÓN                  FIN SESIÓN
─────────────                    ──────────────                  ──────────
Nexus: init                      Agentes: log                   Nexus: promote
     │                                │                              │
     ├─ lee session.md               ├─ @leo | decisión             ├─ feature completada → descartar
     ├─ crea/limpia si >24h          ├─ @cloe | wip                 ├─ feature WIP → inbox.md
     ├─ lee inbox.md                 ├─ @felix | error              ├─ bug pendiente → inbox.md
     └─ lee long-term/               └─ @felix | fix                ├─ lección → long-term/
                                                                   └─ limpia session.md
```

---

## Responsabilidad por agente

| Agente | Operaciones que usa |
|--------|-------------------|
| **Nexus** | `init`, `promote`, `cleanup` |
| **Leo** | `log` (decisiones de arquitectura) |
| **Cloe** | `log` (wip, decisiones de implementación) |
| **Félix** | `log` (error, fix, descubrimiento) |
| **Ada** | `log` (decisión de refactor, descubrimiento) |
| **Cipher** | `log` (vulnerabilidad, fix de seguridad) |
| **Max** | `log` (error encontrado en QA, descubrimiento) |
