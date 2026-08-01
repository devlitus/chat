# Métricas de Agentes — Schema v1

## runs.json

Histórico de ejecuciones. Máximo 30 entradas. Cada entrada representa una sesión de un agente.

```typescript
interface MetricsRun {
  id: string;                    // "2026-08-01T19:30:00Z-leo"
  date: string;                  // "2026-08-01"
  agent: string;                 // "leo" | "cloe" | "max" | "felix" | "ada" | "cipher" | "nexus"
  branch: string;                // "feature/nombre" | "main"
  task_type: string;             // "feature" | "fix" | "refactor" | "security" | "chore" | "main" | "other"
  status: "PASS" | "FAIL" | "WARN";
  timestamp_start: string;       // ISO 8601
  timestamp_end: string;         // ISO 8601
  duration_ms: number;           // Duración en milisegundos
  git: {
    commit_start: string;        // Hash al inicio de la sesión
    commit_end: string;          // Hash al final de la sesión
    files_changed: string[];     // Archivos modificados
    insertions: number;          // Líneas agregadas
    deletions: number;           // Líneas eliminadas
    has_diff: boolean;           // ¿Hubo cambios?
  };
  session_logs: {
    entries_total: number;
    errors: number;
    decisions: number;
    fixes: number;
    wips: number;
    bloqueos: number;
    descubrimientos: number;
  };
  fingerprints: string[];        // Lista de fingerprints generados en este run
}
```

## patterns.json

Patrones detectados automáticamente con sistema de confianza.

```typescript
interface Pattern {
  fingerprint: string;           // "agente:archivo:slug"
  agent: string;                 // Agente que generó el patrón
  file: string | null;           // Archivo afectado (null = global)
  domain: string;                // "quality" | "performance" | "security" | "hotspot" | "productivity"
  description: string;           // Descripción humana
  category: "patron-recurrente" | "error-sistemico" | "mejora-oportunidad" | "regresion" | "hotspot";
  first_seen: string;            // Fecha primera detección
  last_seen: string;             // Fecha última detección
  consecutive_runs: number;      // Runs consecutivos con este patrón
  total_occurrences: number;     // Total de ocurrencias históricas
  status: "activo" | "resuelto";
  confidence: "BAJA" | "MEDIA" | "ALTA" | "RESUELTA";
}
```

### Algoritmo de confianza

| Runs consecutivos | Confianza | Acción |
|---|---|---|
| 0 | RESUELTA | Se limpia el patrón |
| 1 | BAJA | Registro pasivo |
| 2 | MEDIA | Monitoreo, aparece en tuning-proposals |
| ≥3 | ALTA | Propuesta en tuning-proposals con acción sugerida |

## tuning-proposals.md

Propuestas de ajuste generadas automáticamente para patrones de confianza ALTA.
Formato markdown con secciones: [PENDIENTE] para activas, [APLICADA] para resueltas.

## queue/

- `inbox/` — Métricas crudas pendientes de procesar (JSON)
- `archive/` — Métricas ya procesadas y agregadas a runs.json
- `.current-state.json` — Estado interno del plugin entre session.created y session.idle
