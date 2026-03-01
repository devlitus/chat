# Plan de Arquitectura: Astro Islands para Chat AI

## Resumen

Analisis de los 14 componentes React activos en `src/components/react/` para determinar cuales pueden migrarse a componentes Astro estaticos y cuales deben permanecer como React islands interactivos. Incluye identificacion de codigo muerto en `src/components/*.astro`.

## Contexto

Actualmente **toda la UI** se renderiza como un unico arbol React montado con `client:load` en `ChatLayout.astro`. Esto significa que el navegador descarga, parsea y ejecuta React + todo el arbol de componentes antes de mostrar cualquier contenido. Para una aplicacion de chat donde la interactividad es el nucleo, esto es parcialmente justificado, pero hay componentes puramente presentacionales que podrian renderizarse como HTML estatico desde Astro.

### Problema principal

```
index.astro -> Layout.astro -> ChatLayout.astro -> ChatApp.tsx (client:load)
                                                      |
                                                      +-- ChatProvider (Context)
                                                           |
                                                           +-- TODO el arbol React
```

Un unico `client:load` hidrata **14 componentes React** cuando solo ~8 necesitan interactividad real.

## Inventario de componentes activos

### Componentes React en `src/components/react/`

| # | Componente | Archivo |
|---|-----------|---------|
| 1 | ChatApp | `react/ChatApp.tsx` |
| 2 | ChatContext | `react/ChatContext.tsx` |
| 3 | Sidebar | `react/Sidebar.tsx` |
| 4 | SidebarHeader | `react/SidebarHeader.tsx` |
| 5 | NewChatButton | `react/NewChatButton.tsx` |
| 6 | SearchInput | `react/SearchInput.tsx` |
| 7 | ChatHistoryList | `react/ChatHistoryList.tsx` |
| 8 | UserProfile | `react/UserProfile.tsx` |
| 9 | MainArea | `react/MainArea.tsx` |
| 10 | ChatHeader | `react/ChatHeader.tsx` |
| 11 | MessageArea | `react/MessageArea.tsx` |
| 12 | MessageBubble | `react/MessageBubble.tsx` |
| 13 | ChatInput | `react/ChatInput.tsx` |
| 14 | SuggestionChips | `react/SuggestionChips.tsx` |

### Componentes MCP (islands independientes en iframes)

| # | Componente | Archivo |
|---|-----------|---------|
| 15 | McpClientApp | `mcp/McpClientApp.tsx` |
| 16 | WeatherApp | `mcp/WeatherApp.tsx` |
| 17 | CryptoApp | `mcp/CryptoApp.tsx` |

Los componentes MCP ya estan aislados en sus propias paginas (iframes). No forman parte del arbol principal y no se analizan para migracion.

### Codigo muerto en `src/components/*.astro`

| Archivo | Estado |
|---------|--------|
| `SidebarHeader.astro` | MUERTO - reemplazado por `react/SidebarHeader.tsx` |
| `NewChatButton.astro` | MUERTO - reemplazado por `react/NewChatButton.tsx` |
| `SearchInput.astro` | MUERTO - reemplazado por `react/SearchInput.tsx` |
| `ChatHistoryGroup.astro` | MUERTO - reemplazado por logica en `react/ChatHistoryList.tsx` |
| `ChatHistoryItem.astro` | MUERTO - reemplazado por logica en `react/ChatHistoryList.tsx` |
| `ChatHistoryList.astro` | MUERTO - reemplazado por `react/ChatHistoryList.tsx` |
| `UserProfile.astro` | MUERTO - reemplazado por `react/UserProfile.tsx` |
| `Sidebar.astro` | MUERTO - reemplazado por `react/Sidebar.tsx` |
| `DateDivider.astro` | MUERTO - no tiene equivalente React, funcionalidad eliminada |
| `MessageBot.astro` | MUERTO - reemplazado por `react/MessageBubble.tsx` |
| `MessageUser.astro` | MUERTO - reemplazado por `react/MessageBubble.tsx` |
| `CodeBlock.astro` | MUERTO - reemplazado por markdown rendering en `lib/markdown.ts` |
| `MessageActions.astro` | MUERTO - funcionalidad movida a `react/MessageBubble.tsx` |
| `SuggestionChips.astro` | MUERTO - reemplazado por `react/SuggestionChips.tsx` |
| `MessageArea.astro` | MUERTO - reemplazado por `react/MessageArea.tsx` |
| `ChatInput.astro` | MUERTO - reemplazado por `react/ChatInput.tsx` |
| `ChatHeader.astro` | MUERTO - reemplazado por `react/ChatHeader.tsx` |

**Solo `ChatLayout.astro` esta activo** -- es el punto de montaje del island React.

## Tabla de clasificacion

| Componente | useState | useContext | useEffect/useCallback | Props dinamicas | Clasificacion | Directiva |
|-----------|----------|------------|----------------------|----------------|---------------|-----------|
| **ChatApp** | No (usa useReducer via Context) | SI (ChatProvider + useChatDispatch) | SI (init con IndexedDB) | No | **React island** | `client:load` |
| **ChatContext** | useReducer | Es el provider | No | No | **React (infraestructura)** | N/A (embebido) |
| **Sidebar** | No | No | No | No | **Candidato a Astro** | -- |
| **SidebarHeader** | No | No | No | No | **Candidato a Astro** | -- |
| **NewChatButton** | No | SI (useChatDispatch) | SI (useCallback) | No | **React island** | `client:load` |
| **SearchInput** | No (usa useRef) | SI (useChatDispatch) | SI (useCallback, debounce) | No | **React island** | `client:load` |
| **ChatHistoryList** | SI (confirmingId) | SI (useChatState + Dispatch) | SI (useCallback, useMemo) | No | **React island** | `client:load` |
| **UserProfile** | No | SI (useChatState) | No | No | **React island** | `client:idle` |
| **MainArea** | No | No | No | No | **Candidato a Astro** | -- |
| **ChatHeader** | No | SI (useChatState) | No (useMemo no cuenta como efecto) | No | **React island** | `client:load` |
| **MessageArea** | No | SI (useChatState) | SI (auto-scroll, useRef) | No | **React island** | `client:load` |
| **MessageBubble** | No | No | SI (copy handler, MCP postMessage) | SI (message prop) | **React** (hijo de MessageArea) | N/A (embebido) |
| **ChatInput** | SI (text) | SI (useChatState + Dispatch) | SI (auto-resize, streaming) | No | **React island** | `client:load` |
| **SuggestionChips** | No | SI (useChatState + Dispatch) | SI (useCallback, streaming) | No | **React island** | `client:load` |

### Resumen de clasificacion

| Clasificacion | Cantidad | Componentes |
|--------------|----------|-------------|
| Candidato a Astro puro | 3 | Sidebar, SidebarHeader, MainArea |
| React island `client:load` | 8 | ChatApp, NewChatButton, SearchInput, ChatHistoryList, ChatHeader, MessageArea, ChatInput, SuggestionChips |
| React island `client:idle` | 1 | UserProfile |
| React infraestructura | 1 | ChatContext |
| React embebido (hijo) | 1 | MessageBubble |

## El problema del ChatContext compartido

### Analisis critico

El `ChatContext` es el **factor bloqueante principal** para la separacion en islands. Actualmente:

```
ChatProvider (useReducer con 12 acciones)
    |
    +-- useChatState() consumido por: ChatHistoryList, UserProfile, ChatHeader,
    |                                  MessageArea, ChatInput, SuggestionChips
    |
    +-- useChatDispatch() consumido por: ChatApp, NewChatButton, SearchInput,
                                          ChatHistoryList, ChatInput, SuggestionChips
```

**9 de 14 componentes** dependen del ChatContext. React Context **no puede cruzar boundaries de islands** -- cada island con `client:load` crea su propia instancia del Provider.

Esto significa que si separamos `NewChatButton` como un island independiente y `ChatHistoryList` como otro island, **no comparten estado**. El dispatch de `NewChatButton` no actualizaria la lista de `ChatHistoryList`.

### Opciones para estado compartido entre islands

| Opcion | Complejidad | Viabilidad |
|--------|------------|------------|
| **A) Mantener arbol unico React** | Baja | Alta -- es lo que ya existe |
| **B) Nanostores** (store externo) | Media | Alta -- libreria oficial recomendada por Astro |
| **C) Custom Events + IndexedDB** | Media-alta | Media -- propenso a race conditions |
| **D) Signals (Preact Signals o Solid)** | Alta | Baja -- cambiaria el framework |

## Diseno propuesto

### Fase 1: Limpieza de codigo muerto (sin riesgo)

Eliminar los 17 archivos `.astro` muertos en `src/components/`. Esto no afecta funcionalidad.

**Archivos a eliminar:**
- `src/components/SidebarHeader.astro`
- `src/components/NewChatButton.astro`
- `src/components/SearchInput.astro`
- `src/components/ChatHistoryGroup.astro`
- `src/components/ChatHistoryItem.astro`
- `src/components/ChatHistoryList.astro`
- `src/components/UserProfile.astro`
- `src/components/Sidebar.astro`
- `src/components/DateDivider.astro`
- `src/components/MessageBot.astro`
- `src/components/MessageUser.astro`
- `src/components/CodeBlock.astro`
- `src/components/MessageActions.astro`
- `src/components/SuggestionChips.astro`
- `src/components/MessageArea.astro`
- `src/components/ChatInput.astro`
- `src/components/ChatHeader.astro`

### Fase 2: Extraer shell estatico con Astro (beneficio moderado)

Convertir `Sidebar` y `MainArea` (componentes contenedores sin logica) en layout Astro, manteniendo los hijos como React islands.

**Arquitectura propuesta:**

```
index.astro
  |
  +-- Layout.astro (shell HTML, <head>, CSS global)
       |
       +-- ChatShell.astro (nuevo, reemplaza ChatLayout.astro)
            |
            +-- <aside class="sidebar">              [HTML estatico]
            |    |
            |    +-- SidebarHeader.astro (nuevo)      [HTML estatico]
            |    +-- <NewChatButton client:load />     [React island]
            |    +-- <SearchInput client:load />        [React island]
            |    +-- <ChatHistoryList client:load />    [React island]
            |    +-- <UserProfile client:idle />        [React island]
            |
            +-- <main class="main-area">               [HTML estatico]
                 |
                 +-- <ChatHeader client:load />          [React island]
                 +-- <MessageArea client:load />         [React island]
                 +-- <ChatInput client:load />           [React island]
```

**PROBLEMA:** Esta arquitectura rompe el ChatContext. Los islands no comparten estado.

### Fase 2b: Migracion a Nanostores (requerido para Fase 2)

Reemplazar `ChatContext` (React Context + useReducer) por **Nanostores**, la solucion oficial recomendada por Astro para estado compartido entre islands.

**Dependencia nueva:** `nanostores` + `@nanostores/react`

**Archivos nuevos a crear:**
- `src/stores/chat-store.ts` -- estado global con `atom()` y `map()`
- `src/stores/chat-actions.ts` -- acciones que modifican el store (reemplaza el reducer)

**Archivos a modificar:**
- Todos los componentes que usan `useChatState()` / `useChatDispatch()` -> usar `useStore()` de `@nanostores/react`
- `src/components/react/ChatApp.tsx` -> eliminar `ChatProvider`, mantener solo init
- `src/components/react/ChatContext.tsx` -> eliminar completamente

**Mapeo de migracion:**

```
// ANTES (ChatContext)
const { chats, activeChatId } = useChatState();
const dispatch = useChatDispatch();
dispatch({ type: 'SET_ACTIVE_CHAT', chatId, messages });

// DESPUES (Nanostores)
import { useStore } from '@nanostores/react';
import { $chats, $activeChatId } from '../../stores/chat-store';
import { setActiveChat } from '../../stores/chat-actions';

const chats = useStore($chats);
const activeChatId = useStore($activeChatId);
await setActiveChat(chatId);
```

**Estructura del store:**

```typescript
// src/stores/chat-store.ts
import { atom, map } from 'nanostores';
import type { Chat, Message } from '../lib/db';
import type { UserSession } from '../lib/session';

export const $initialized = atom(false);
export const $session = atom<UserSession | null>(null);
export const $chats = atom<Chat[]>([]);
export const $activeChatId = atom<string | null>(null);
export const $messages = atom<Message[]>([]);
export const $isStreaming = atom(false);
export const $streamingContent = atom('');
export const $botError = atom<string | null>(null);
export const $searchQuery = atom('');
```

### Fase 3: Convertir SidebarHeader a Astro puro

`SidebarHeader` es 100% presentacional: no tiene estado, contexto, ni efectos. Renderiza HTML estatico con un icono y un titulo.

**Archivo nuevo:** `src/components/SidebarHeader.astro` (reescrito, no el muerto)

```astro
---
// src/components/SidebarHeader.astro
---
<div class="sidebar-header">
  <div class="brand">
    <div class="brand-icon">
      <span class="material-symbols-outlined">smart_toy</span>
    </div>
    <h1>Chat AI</h1>
  </div>
  <button class="menu-btn" title="Toggle menu">
    <span class="material-symbols-outlined">menu_open</span>
  </button>
</div>
```

**Nota:** El boton "Toggle menu" actualmente no tiene handler (`onClick` no definido). Si se implementa toggle del sidebar en el futuro, este componente necesitaria volver a ser un React island o usar un `<script>` inline de Astro.

## Diagrama ASCII: Arquitectura actual vs propuesta

### Arquitectura ACTUAL (un unico arbol React)

```
index.astro
  +-- Layout.astro
       +-- ChatLayout.astro
            +-- [ChatApp client:load]  <-- UNICO ISLAND, todo React debajo
                 +-- ChatProvider
                      +-- ChatAppInner
                           +-- Sidebar
                           |    +-- SidebarHeader     (React, sin logica)
                           |    +-- NewChatButton     (React, con dispatch)
                           |    +-- SearchInput       (React, con dispatch)
                           |    +-- ChatHistoryList   (React, con state+dispatch)
                           |    +-- UserProfile       (React, con state)
                           +-- MainArea
                                +-- ChatHeader        (React, con state)
                                +-- MessageArea       (React, con state+effects)
                                |    +-- MessageBubble (React, con effects)
                                |    +-- SuggestionChips (React, con state+dispatch)
                                +-- ChatInput         (React, con state+dispatch)
```

### Arquitectura PROPUESTA (islands con Nanostores)

```
index.astro
  +-- Layout.astro
       +-- ChatShell.astro                             [Astro - HTML estatico]
            +-- <aside class="sidebar">                [Astro - HTML estatico]
            |    +-- SidebarHeader.astro                [Astro - HTML estatico, 0 JS]
            |    +-- [NewChatButton client:load]        [React island ~1KB]
            |    +-- [SearchInput client:load]          [React island ~1KB]
            |    +-- [ChatHistoryList client:load]      [React island ~3KB]
            |    +-- [UserProfile client:idle]          [React island ~0.5KB, lazy]
            |
            +-- <main class="main-area">               [Astro - HTML estatico]
            |    +-- [ChatHeader client:load]           [React island ~1KB]
            |    +-- [MessageArea client:load]          [React island ~5KB]
            |    |    +-- MessageBubble                 [React - hijo interno]
            |    |    +-- SuggestionChips               [React - hijo interno]
            |    +-- [ChatInput client:load]            [React island ~3KB]
            |
            +-- [ChatInitializer client:load]           [React island ~1KB, invisible]
                 (ejecuta init de session/IndexedDB y llena los nanostores)

Stores compartidos (sin framework):
  src/stores/chat-store.ts     -- atoms de nanostores
  src/stores/chat-actions.ts   -- funciones que mutan los atoms
```

## Consideraciones tecnicas

### Rendimiento

| Metrica | Actual | Propuesto | Mejora estimada |
|---------|--------|-----------|-----------------|
| JS bundle inicial | ~45KB (React + todo el arbol) | ~35KB (React + islands + nanostores) | ~22% menos |
| Componentes hidratados en carga | 14 | 8 (3 Astro estaticos, 1 idle, 2 embebidos) | -43% hidrataciones |
| Time to First Paint | Bloqueado por JS | HTML estatico inmediato para shell | Mejora de LCP |
| UserProfile hydration | Inmediata | Diferida (client:idle) | FID mejorado |

**Nota realista:** La mejora en bundle size sera modesta (~10KB) porque React ya se carga una vez y se comparte. El beneficio principal es en **tiempo de hidratacion** y **First Contentful Paint** al renderizar el shell como HTML estatico.

### SEO

No aplica significativamente. Esta es una aplicacion de chat privada, no un sitio de contenido indexable. El contenido de los mensajes vive en IndexedDB del navegador.

### Accesibilidad

- Los componentes Astro estaticos deben mantener los mismos atributos ARIA que los React actuales
- `role="log"` y `aria-live="polite"` en MessageArea se mantienen (React island)
- `aria-label` en SearchInput se mantiene (React island)
- Los botones del SidebarHeader.astro necesitan `aria-label` si el menu toggle se implementa

## Dependencias nuevas

| Paquete | Version | Proposito | Tamano |
|---------|---------|-----------|--------|
| `nanostores` | ^0.11 | Store reactivo agnositico de framework | ~1KB gzip |
| `@nanostores/react` | ^0.8 | Hook `useStore()` para React | ~0.3KB gzip |

## Plan de implementacion

### Paso 1: Eliminar codigo muerto (5 min, sin riesgo)
- Eliminar los 17 archivos `.astro` muertos listados en Fase 1
- Verificar que `pnpm build` sigue pasando
- Verificar que ningun archivo importa los componentes eliminados

### Paso 2: Instalar nanostores (2 min)
```bash
pnpm add nanostores @nanostores/react
```

### Paso 3: Crear stores (30 min)
- Crear `src/stores/chat-store.ts` con atoms para cada propiedad del estado
- Crear `src/stores/chat-actions.ts` con funciones que replican las 12 acciones del reducer
- Escribir tests unitarios para las acciones del store

### Paso 4: Migrar componentes de Context a Nanostores (1-2h)
Orden de migracion (de menor a mayor dependencia):
1. `UserProfile` -- solo lee `session` (mas simple)
2. `ChatHeader` -- solo lee `chats` y `activeChatId`
3. `SearchInput` -- solo escribe `searchQuery`
4. `NewChatButton` -- escribe `chats` y `activeChatId`
5. `ChatHistoryList` -- lee y escribe multiples atoms
6. `MessageArea` -- lee `messages`, `isStreaming`, etc.
7. `SuggestionChips` -- lee y escribe (streaming)
8. `ChatInput` -- lee y escribe (streaming, es el mas complejo)

Para cada componente:
- Reemplazar `useChatState()` por `useStore($atom)` individuales
- Reemplazar `dispatch({ type: 'X', ... })` por llamadas a funciones de `chat-actions.ts`
- Eliminar import de `ChatContext`

### Paso 5: Eliminar ChatContext y ChatProvider (15 min)
- Eliminar `ChatContext.tsx`
- Crear `ChatInitializer.tsx` -- componente invisible que ejecuta la logica de init de `ChatApp.tsx`
- Eliminar `ChatApp.tsx`

### Paso 6: Reestructurar el layout (30 min)
- Crear `ChatShell.astro` que renderiza el HTML estatico del sidebar y main area
- Crear `SidebarHeader.astro` (version nueva, Astro puro)
- Montar cada island React con su directiva correspondiente
- Montar `ChatInitializer` con `client:load`

### Paso 7: Verificacion (30 min)
- Ejecutar `pnpm build` -- debe compilar sin errores
- Ejecutar `pnpm test` -- todos los tests deben pasar
- Prueba manual: crear chat, enviar mensaje, streaming, buscar, eliminar chat
- Verificar que `UserProfile` se hidrata despues del idle (DevTools > Performance)

### Tiempo total estimado: 3-4 horas

## Alternativas consideradas

### A) Mantener el arbol unico React (status quo)

**Ventajas:**
- Cero esfuerzo de migracion
- Context funciona naturalmente
- Complejidad minima

**Desventajas:**
- Todo el JS se carga y ejecuta antes de pintar
- No aprovecha Astro islands en absoluto
- El shell estatico (sidebar header, layout) se renderiza en JS innecesariamente

**Veredicto:** Viable pero desaprovecha Astro. Si la app es exclusivamente un chat interactivo, esta opcion es pragmaticamente aceptable.

### B) Dos islands grandes (Sidebar + MainArea)

Separar en solo 2 islands: `<Sidebar client:load />` y `<MainArea client:load />`, cada uno con su propio `ChatProvider`.

**Ventajas:**
- Menos granular, menos complejidad que la propuesta completa
- Solo 2 puntos de hidratacion

**Desventajas:**
- Dos instancias de ChatProvider = **estado duplicado y desincronizado**
- Requiere nanostores de todas formas para sincronizar
- No gana casi nada vs el arbol unico

**Veredicto:** Descartada. La complejidad de sincronizar 2 Providers no justifica la separacion.

### C) Islands granulares SIN nanostores (Custom Events)

Usar `window.dispatchEvent(new CustomEvent(...))` para comunicar islands.

**Ventajas:**
- Sin dependencias adicionales
- Patron nativo del navegador

**Desventajas:**
- Propenso a race conditions (evento emitido antes de que el island se hidrate)
- Requiere serializar/deserializar estado manualmente
- Debugging dificil sin DevTools dedicados
- No reactivo -- cada island necesita `addEventListener` + `setState` manual

**Veredicto:** Descartada. Demasiado fragil para un estado tan complejo como el del chat.

### D) Migrar a Preact (menor bundle)

Reemplazar React por Preact con `@astrojs/preact` para reducir bundle size.

**Ventajas:**
- Preact es ~3KB vs ~40KB de React
- API compatible (preact/compat)
- Signals nativas como alternativa a nanostores

**Desventajas:**
- Riesgo de incompatibilidades con librerias React existentes
- Esfuerzo de migracion mayor
- Los componentes MCP usan React directamente

**Veredicto:** Fuera de scope para este plan. Podria evaluarse como optimizacion futura independiente.

## Recomendacion final

**Para un proyecto de chat interactivo donde el 64% de los componentes requieren estado reactivo del cliente, la opcion mas pragmatica es una combinacion:**

1. **Ejecutar Fase 1 inmediatamente** -- eliminar codigo muerto (0 riesgo, beneficio en mantenibilidad)
2. **Evaluar si Fase 2-6 vale la pena** segun las metricas reales del proyecto:
   - Si el LCP actual es aceptable (< 2.5s) y la app solo se usa en desktop con buena conexion -> mantener arbol unico React
   - Si se busca optimizar para mobile o conexiones lentas -> implementar la migracion completa a nanostores + islands granulares

La Fase 1 (limpieza) es un **quick win sin controversia**. Las Fases 2-6 son una inversion de 3-4 horas que produce una mejora real pero modesta en una app que es inherentemente interactiva.
