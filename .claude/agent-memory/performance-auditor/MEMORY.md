# Performance Auditor Memory

## Patrones de rendimiento críticos confirmados en este proyecto

### Hot Path del Streaming
- `renderMarkdown` (marked + hljs + DOMPurify) se llama en cada token durante el streaming
- Patrón en `ChatInput.tsx`: `updateStreaming(fullContent)` en cada iteración del for-await
- Fix recomendado: throttle con `requestAnimationFrame` o renderizar texto plano durante stream
- Ver hallazgo #1 en performance-report.md (2026-03-06)

### IndexedDB - Sin caché de conexión
- `openDB()` abre y cierra la conexión por cada operación individual
- 6 operaciones IDB secuenciales por mensaje enviado en `sendMessage()`
- Fix recomendado: singleton de conexión con `let _db: IDBDatabase | null = null`
- Ver hallazgo #2 en performance-report.md (2026-03-06)

### window.addEventListener acumulativo en MessageBubble
- Cada MessageBubble con widget registra su propio listener en `window` (no en iframe)
- Con historial largo + múltiples widgets, los listeners se acumulan
- Fix recomendado: singleton `iframe-message-bus.ts` con Map de handlers
- Ver hallazgo #3 en performance-report.md (2026-03-06)

### highlight.js importado completo
- `import hljs from 'highlight.js'` importa ~200 lenguajes (~400KB minificado)
- Debería usarse `highlight.js/lib/core` + lenguajes específicos
- Impacto: ~300KB de reducción en bundle del cliente

### Tailwind CDN en iframes de widgets
- mcp-app.astro, crypto-app.astro, weather-app.astro cargan CDN Tailwind (~700KB/iframe)
- Alternativa: compilar Tailwind a CSS estático con @astrojs/tailwind
- Fuerza `unsafe-inline` en script-src de la CSP

## Arquitectura de stores (nanostores - correcto)
- El proyecto usa nanostores (`$chats`, `$messages`, etc.) en lugar de React Context
- Esto elimina el problema clásico de re-renders masivos por Context
- ChatHeader suscrito a $chats completo cuando solo necesita el título activo (hallazgo #6)

## Operaciones IDB secuenciales vs paralelas
- `ChatInitializer`: `getChat()` + `getAllChats()` podrían paralelizarse con Promise.all
- `sendMessage()`: `getChat()` + `getMessagesByChatId()` son independientes → Promise.all
- `getAllChats()` post-streaming es redundante si `updateChatInList()` ya actualiza el store

## Patrones de performance por archivo
- `src/lib/markdown.ts` — No cachea parseos, se llama N veces durante streaming
- `src/lib/db.ts` — Sin pool de conexión IDB, abre/cierra por operación
- `src/components/react/MessageBubble.tsx` — Sin React.memo, event listeners en window
- `src/components/react/ChatInput.tsx` — Duplica lógica de SuggestionChips.tsx
- `src/pages/api/mcp.ts` — server.connect() por cada POST → posible memory leak

## Tamaños de bundle base (estimado, sin build real)
- highlight.js completo: ~400KB
- React + ReactDOM: ~140KB
- Tailwind CDN (externo, por iframe): ~700KB
- Total aproximado sin optimizar: >700KB en cliente principal

## Notas de arquitectura
- Islands en ChatShell.astro: mayoría con client:load (correcto para el chat)
- UserProfile usa client:idle correctamente (no crítico para TTI)
- Widgets MCP cargan en iframes con client:only="react" (correcto)
- updateChatInList hace sort con new Date() en cada comparación → usar localeCompare con ISO strings
