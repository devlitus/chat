# Propuestas de Ajuste de Agentes

*Última actualización: 2026-06-07*
*El orquestador aplica propuestas [PENDIENTE] de confianza ALTA al inicio del siguiente pipeline, con git commit de checkpoint previo.*

---

## Propuestas Pendientes (ALTA confianza)

## [PENDIENTE] quality-memory.md — resolver tipos GroqMessage SDK
**Fingerprint**: `quality:src/lib/api/chat-stream.ts:ts-type-compatibility`
**Confianza**: ALTA (5 runs consecutivos desde 2026-05-16)
**Archivo objetivo**: `.claude/memory/quality-memory.md`
**Sección sugerida**: `## Patrones de problemas recurrentes`
**Acción**: ACTUALIZAR
**Descripción**: Los errores TS2769/TS2339/TS7006 en chat-stream.ts persisten 5 ciclos sin resolución. Aunque el fix multimodal de 2026-06-07 resolvió el tipo content para ChatRequestBody, la incompatibilidad fundamental entre GroqMessage[] local y ChatCompletionMessageParam[] del SDK persiste. Actualizar la memoria con enfoque: crear wrapper de tipos seguro o discriminadores por `role` para que GroqMessage sea compatible con tipos del SDK groq-sdk. Proponer: crear `src/lib/types/groq-adapter.ts` con funciones type-safe de conversión.
---
## [PENDIENTE] quality-memory.md — documenta estabilidad BUILD+TESTS
**Fingerprint**: `quality:global:build-tests-stability`
**Confianza**: ALTA (4 runs consecutivos desde 2026-05-16)
**Archivo objetivo**: `.claude/memory/quality-memory.md`
**Sección sugerida**: `## Historial de builds`
**Acción**: ACTUALIZAR
**Descripción**: Patrón positivo confirmado: 4 builds consecutivos PASS con 49/49 tests. Sistema mantiene estabilidad a pesar de cambios frecuentes en tipos y streaming. Actualizar memoria: pipeline QA ha mantenido 100% test pass rate y build éxito en últimos 4 ciclos, indicador de robustez del sistema de validación. Mantener esta métrica visible para auditorias y decisiones futuras.
---

## Propuestas Pendientes (BAJA/MEDIA confianza)

### [PENDIENTE] pattern-001: Resolver errores TS preexistentes en chat-stream.ts (confianza MEDIA)

**Ocurrencias**: 2 runs consecutivos (run-001, run-002)
**Archivos afectados**: `src/lib/api/chat-stream.ts` líneas 205, 222, 227

**Acción**: Añadir a `debugger-memory.md` nota sobre los 3 errores TS activos:
- `TS2769` — GroqMessage[] no asignable a ChatCompletionMessageParam[] (requiere wrapper type o type guard por `role`)
- `TS2339` — Property `choices` inexistente en Stream<ChatCompletionChunk>
- `TS7006` — Parámetro `tc` implícitamente `any`

Estos errores no bloquean el build pero acumulan deuda. Si aparecen en un tercer run se promoverá a ALTA.

---

### [PENDIENTE] pattern-002: Timeout en streaming async (confianza MEDIA)

**Ocurrencias**: 1 run (run-001)
**Alcance**: Aplicar a próximo run si se añaden más operaciones de streaming.

**Acción**: En `src/lib/api/chat-stream.ts` y cualquier nueva función de streaming a Ollama/Groq:
- Usar `AbortController` con timeout de 30s
- Capturar `AbortError` y retornar error amigable al usuario
- Documentar timeout en JSDoc

---

### [PENDIENTE] pattern-005: Checklist de migración de módulos en debugger-memory.md (confianza BAJA)

**Ocurrencias**: 1 run (run-002)
**Contexto**: La eliminación de `widget-detector.ts` omitió el fallback por keywords → bug en producción.

**Acción**: Añadir a `debugger-memory.md` checklist para refactors que eliminan módulos:
- Listar todos los exports del módulo a eliminar
- Verificar cada export: ¿está migrado? ¿tiene fallback? ¿hay tests?
- Revisar consumidores que dependían del comportamiento fallback (no solo del import)

---

## Propuestas Aplicadas

*Ninguna aplicada todavía.*

---

## Observaciones

- **pattern-003** (URI validation): CERRADO — M-NEW-01 resuelto en run-002 vía triple barrera (detectWidgetFromKeywords + ALLOWED_WIDGET_URIS + ALLOWED_UI_PATHS).
- **pattern-004** (Build+tests stability): Métrica positiva sostenida (4/4 runs PASS 49/49). Mantener.
- **pattern-006** (Parallel tool calls short-circuit): Bug UX secundario documentado. Monitorear si genera reportes de usuario.
- **2026-06-07 run (image-processing)**: Agregó 13 nuevos fingerprints (6 quality, 4 security, 3 accessibility). Necesita 2 runs más para promoción a MEDIA (fingerprints) y 3 para ALTA. Priorizar patrones ALTA existentes primero.
