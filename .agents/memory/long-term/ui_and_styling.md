# Memoria de Largo Plazo — UI y Estilizado

> **Ciclo de vida**: Todo el proyecto.
> **Formato**: `## [YYYY-MM-DD] @agente | lección | regla | patrón`

---

## Reglas activas

<!-- Reglas de estilo que todos los agentes deben cumplir -->

## Lecciones aprendidas

<!-- Errores recurrentes de UI/estilizado y cómo evitarlos -->

### [2026-08-02] Widget detection: usar raíz más corta para keywords (@felix)

**Error**: Crypto widget no se renderizaba con "criptos" porque la keyword era `'criptomoneda'` (singular, larga).
**Fix**: Cambiar a `'cripto'` (raíz más corta) para cubrir "cripto", "criptos", "criptomoneda", "criptomonedas" por substring match.
**Regla**: Las keywords de `detectWidgetFromKeywords()` deben usar la forma más corta posible de cada raíz léxica (ej: `'cripto'` en vez de `'criptomoneda'`, `'lluv'` en vez de `'lluvia'` o `'lloviendo'`) para maximizar cobertura de variantes y coloquialismos.

### [2026-08-02] System prompt: incluir ejemplos coloquiales para tool calling (@felix)

**Error**: El modelo `openai/gpt-oss-20b` con `reasoning_effort: 'low'` no siempre invoca `show_widget` cuando el usuario usa términos coloquiales.
**Fix**: El system prompt de `show_widget` ahora incluye ejemplos concretos como "criptos", "criptomonedas" y enfatiza "Llama SIEMPRE".
**Regla**: Las descripciones de tool calling en el system prompt deben incluir sinónimos coloquiales en español para guiar al LLM, especialmente cuando el modelo tiene baja fidelidad de tool calling.

## Patrones establecidos

<!-- Patrones de diseño visual confirmados como estándar del proyecto -->

