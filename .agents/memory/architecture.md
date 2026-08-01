# Arquitectura del Proyecto — Chat App

## Versiones clave (actualizado 2026-08-01)

| Paquete | Versión |
|---------|---------|
| astro | ^7.1.6 |
| @astrojs/node | ^11.0.3 |
| @astrojs/react | ^6.0.2 |
| @astrojs/vercel | ^11.0.4 |
| react | ^19.2.4 |
| react-dom | ^19.2.4 |
| vitest | ^4.1.8 |
| pnpm | 11.0.9 |
| Node | >=22.12.0 |

## Stack

- Astro 7 con SSR (Node adapter + Vercel adapter)
- React 19 como framework UI (islands architecture)
- pnpm como gestor de paquetes
- Vitest 4 + happy-dom para testing

## Estructura

- `src/pages/` — Rutas basadas en archivos (`.astro`)
- `src/layouts/` — Wrappers HTML con `<slot />`
- `src/components/` — Astro (estáticos) + React (interactivos)
  - `src/components/react/` — React islands (`client:load`)
- `src/lib/` — Utilidades (db.ts, session.ts, markdown.ts, groq-client.ts)
- `.agents/memory/` — Sistema de memoria por dominios

## Configuración de Astro

```js
// astro.config.mjs
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
});
```

- Sin content collections (no usa `src/content/`)
- Sin remark/rehype plugins
- Sin experimental flags

## Lecciones aprendidas

- **Migración v5→v7**: Hacerla en 2 pasos (v5→v6, luego v6→v7) como recomienda la doc oficial
- `Astro.generator` fue deprecado en v6 y removido, reemplazar con string fijo
- El `compressHTML` por defecto cambió de `true` a `'jsx'` en v7
- El compilador Rust de v7 es más estricto con HTML inválido
- pnpm 11+ requiere `patchedDependencies` en `pnpm-workspace.yaml`, no en `package.json`

## Testing

- Entorno: happy-dom (última versión)
- Polyfill de localStorage necesario en vitest.setup.ts para Node 22+
- fake-indexeddb para IndexedDB en tests
