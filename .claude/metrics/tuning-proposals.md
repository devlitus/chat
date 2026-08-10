# Propuestas de Ajuste de Agentes

*Última actualización: 2026-08-02T15:57:04Z*
*El orquestador aplica propuestas [PENDIENTE] de confianza ALTA al inicio del siguiente pipeline, con git commit de checkpoint previo.*

---

## Propuestas Pendientes (ALTA confianza)

(Sin propuestas activas con confianza ALTA. Los 3 patrones BAJA del run feature anterior (2026-08-02T05:53:10Z) no se repitieron en el run bugfix, pasando a estado "resuelto". El run feature de la feature "reutilizar/pegar texto de burbujas de usuario" (2026-08-02T15:57:04Z) completó sin introducir fingerprints nuevos.)

---

## [APLICADA] quality-memory.md — resolver tipos GroqMessage SDK
**Fingerprint**: `quality:src/lib/api/chat-stream.ts:ts-type-compatibility`
**Confianza**: ALTA (5 runs consecutivos desde 2026-05-16, **resuelto en 2026-08-02**)
**Archivo objetivo**: `.claude/memory/quality-memory.md`
**Sección sugerida**: `## Patrones de problemas recurrentes`
**Acción**: ACTUALIZAR
**Descripción**: Los errores TS2769/TS2339/TS7006 en chat-stream.ts persisten 5 ciclos sin resolución. Aunque el fix multimodal de 2026-06-07 resolvió el tipo content para ChatRequestBody, la incompatibilidad fundamental entre GroqMessage[] local y ChatCompletionMessageParam[] del SDK persiste. Actualizar la memoria con enfoque: crear wrapper de tipos seguro o discriminadores por `role` para que GroqMessage sea compatible con tipos del SDK groq-sdk. Proponer: crear `src/lib/types/groq-adapter.ts` con funciones type-safe de conversión.

---

## [APLICADA] quality-memory.md — documenta estabilidad BUILD+TESTS
**Fingerprint**: `quality:global:build-tests-stability`
**Confianza**: ALTA (4 runs consecutivos desde 2026-05-16, **resuelto en 2026-08-02**)
**Archivo objetivo**: `.claude/memory/quality-memory.md`
**Sección sugerida**: `## Historial de builds`
**Acción**: ACTUALIZAR
**Descripción**: Patrón positivo confirmado: 4 builds consecutivos PASS con 49/49 tests. Sistema mantiene estabilidad a pesar de cambios frecuentes en tipos y streaming. Actualizar memoria: pipeline QA ha mantenido 100% test pass rate y build éxito en últimos 4 ciclos, indicador de robustez del sistema de validación. Mantener esta métrica visible para auditorias y decisiones futuras. **Estado**: Patrón no detectado en 2026-08-02; no requiere acción adicional.

---

## Propuestas Pendientes (BAJA/MEDIA confianza)

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

- **quality-memory.md — resolver tipos GroqMessage SDK** — Aplicada 2026-06-07. Documentado patrón groq-adapter.ts y resolución de TS2769/TS2339/TS7006. Patrón resuelto 2026-08-02 (no aparece en run actual).
- **quality-memory.md — documenta estabilidad BUILD+TESTS** — Aplicada 2026-06-07. Baseline de robustez: 4 runs consecutivos 49/49 tests PASS. Patrón resuelto 2026-08-02.

---

## Observaciones

- **pattern-003** (URI validation): CERRADO — M-NEW-01 resuelto en run-002 vía triple barrera (detectWidgetFromKeywords + ALLOWED_WIDGET_URIS + ALLOWED_UI_PATHS).
- **pattern-004** (Build+tests stability): Patrón resuelto. No fue detectado en 2026-08-02. Indica que los cambios de layout del ModelSelector no introdujeron regresiones de estabilidad.
- **pattern-006** (Parallel tool calls short-circuit): Bug UX secundario documentado. Monitorear si genera reportes de usuario.
- **2026-06-07 run (image-processing)**: Agregó 13 nuevos fingerprints (6 quality, 4 security, 3 accessibility). Necesita 2 runs más para promoción a MEDIA (fingerprints) y 3 para ALTA. Priorizar patrones ALTA existentes primero.
- **2026-08-02 run (bugfix auto-scroll)**: Registrado sin fingerprints nuevos. Los 3 patrones BAJA del run feature anterior pasaron a "resuelto" (no reaparecieron en archivos no modificados). Indica que el fix de auto-scroll y aria-hidden en MessageArea/MessageAvatar no introdujo problemas de calidad/seguridad/accesibilidad nuevos. Sistema de QA estable.
- **2026-08-02 run (feature reutilizar texto)**: Pipeline completo PASS. Feature ligera sin problemas críticos introducidos. Todas las advertencias de quality son puntuales del código nuevo (side-effect en updater, aserciones innecesarias, dependencia coverage faltante). Performance detectó hallazgo importante preexistente (re-render completo del historial sin React.memo) pero no causado por esta feature. Accesibilidad PASS con 2 mejoras recomendadas opcionales (tamaño táctil, verificación manual de contraste). No se generaron fingerprints — patrón esperado para features PASS sin regresiones.
