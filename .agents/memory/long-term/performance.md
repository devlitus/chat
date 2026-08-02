# Memoria de Largo Plazo — Rendimiento

> **Ciclo de vida**: Todo el proyecto.
> **Formato**: `## [YYYY-MM-DD] @agente | lección | regla | optimización`

---

## Reglas activas

- **Handler monolítico → funciones SRP**: Todo handler POST/GET de más de 80 líneas debe dividirse en funciones con una sola responsabilidad (search, fetch, assemble, call). El handler queda como orquestador de < 50 líneas.
- **Números mágicos → constantes nombradas**: Todo número mágico (timeouts, límites, temperaturas, tokens, índices) debe definirse como `const` al inicio del módulo con nombre descriptivo en `UPPER_SNAKE_CASE`.
- **Lógica duplicada → función pura**: Si un mismo patrón de código aparece en 2+ lugares (ej: extracción de `{...}`), se extrae a función pura sin efectos secundarios.

## Lecciones aprendidas

<!-- Cuellos de botella descubiertos y cómo se resolvieron -->

## Optimizaciones aplicadas

<!-- Mejoras de rendimiento implementadas y su impacto -->

