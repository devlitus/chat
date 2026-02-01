# Caso de Uso: Chat con Asistente IA

## Resumen

Aplicacion de chat con asistente IA que funciona sin autenticacion. El usuario abre la app y puede chatear inmediatamente. Los chats se persisten en IndexedDB, la sesion del usuario en localStorage, y las respuestas del LLM se obtienen via groq-sdk con streaming.

## Contexto

Actualmente la UI esta completa con 19 componentes Astro pero todo es estatico/hardcoded. No hay JavaScript del lado del cliente, no hay persistencia, y no hay integracion con ningun LLM. Se necesita darle vida a la aplicacion conectando la UI con datos reales.

---

## Caso de Uso Principal: Chatear con el Asistente IA

### Actores

- **Usuario**: Persona que abre la app en el navegador. No requiere cuenta ni login.

### Precondiciones

- La app esta desplegada y accesible.
- La variable `GROQ_API_KEY` esta configurada en el servidor.

### Flujo Principal

1. El usuario abre la app por primera vez.
2. El sistema genera un `userId` (UUID) y un perfil por defecto, lo guarda en localStorage.
3. Se crea un chat inicial vacio en IndexedDB.
4. El area de mensajes muestra un estado vacio con sugerencias (SuggestionChips).
5. El usuario escribe un mensaje en el textarea y presiona enviar (boton o Enter).
6. El mensaje del usuario se guarda en IndexedDB y se renderiza en el MessageArea.
7. Se envia una peticion POST al endpoint `/api/chat` del servidor Astro con el historial de mensajes del chat actual.
8. El servidor usa groq-sdk para enviar los mensajes al modelo LLM con streaming habilitado.
9. El servidor retorna un stream (ReadableStream) al cliente.
10. El cliente lee el stream token por token y renderiza la respuesta progresivamente en un MessageBot.
11. Al completar el stream, el mensaje completo del bot se guarda en IndexedDB.
12. Si es el primer mensaje del chat, se genera un titulo automatico (primeros ~50 caracteres del mensaje del usuario) y se actualiza en el sidebar.

### Postcondiciones

- El mensaje del usuario y la respuesta del bot estan persistidos en IndexedDB.
- El chat aparece en el historial del sidebar.

---

## Flujos Alternos

### FA1: Crear Nuevo Chat

1. El usuario hace clic en el boton "New Chat" (NewChatButton).
2. Se crea un nuevo registro de chat en IndexedDB con titulo "Nuevo chat".
3. El area de mensajes se limpia y muestra el estado vacio con sugerencias.
4. El nuevo chat aparece como activo en el sidebar.
5. El chat anterior permanece en el historial.

### FA2: Cambiar de Chat

1. El usuario hace clic en un ChatHistoryItem del sidebar.
2. Se carga el chat seleccionado desde IndexedDB con todos sus mensajes.
3. El MessageArea se renderiza con los mensajes del chat seleccionado.
4. El ChatHeader se actualiza con el titulo del chat.
5. El ChatHistoryItem seleccionado se marca como activo.

### FA3: Buscar en Historial

1. El usuario escribe en el SearchInput del sidebar.
2. Se filtran los chats en IndexedDB cuyo titulo contenga el texto buscado.
3. El ChatHistoryList se actualiza mostrando solo los resultados.
4. Si no hay resultados, se muestra un mensaje "Sin resultados".

### FA4: Enviar Mensaje con Sugerencia

1. El usuario hace clic en un SuggestionChip.
2. El texto de la sugerencia se inserta como mensaje del usuario.
3. Se sigue el flujo principal desde el paso 6.

### FA5: Error en la Respuesta del LLM

1. Durante el paso 8-9 del flujo principal, la API de Groq retorna un error.
2. Se muestra un MessageBot con un mensaje de error estilizado.
3. Se ofrece un boton "Reintentar" debajo del mensaje de error.
4. El mensaje de error NO se persiste en IndexedDB.

### FA6: Visita Recurrente

1. El usuario abre la app habiendo visitado antes.
2. Se lee el perfil de localStorage (ya existe el userId).
3. Se carga el ultimo chat activo desde IndexedDB.
4. El sidebar muestra todo el historial de chats agrupado por fecha.

### FA7: Eliminar Chat

1. El usuario hace clic derecho (o boton de opciones) en un ChatHistoryItem.
2. Se muestra opcion "Eliminar".
3. Al confirmar, se elimina el chat y sus mensajes de IndexedDB.
4. Si era el chat activo, se navega al chat mas reciente o al estado vacio.

---

## Modelo de Datos

### localStorage: Sesion del Usuario

```typescript
interface UserSession {
  userId: string;          // UUID v4 generado en primera visita
  displayName: string;     // "Usuario" (por defecto)
  avatarUrl: string;       // URL del avatar por defecto
  createdAt: string;       // ISO 8601
  lastActiveChatId: string | null; // ID del ultimo chat abierto
}
```

**Clave en localStorage**: `chat-app-user`

### IndexedDB: Base de Datos de Chats

**Nombre de la base de datos**: `chat-app-db`
**Version**: 1

#### Object Store: `chats`

```typescript
interface Chat {
  id: string;              // UUID v4
  title: string;           // Titulo del chat (auto-generado o editado)
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601 (se actualiza con cada mensaje)
  messageCount: number;    // Contador de mensajes
}
```

- **keyPath**: `id`
- **Indices**: `updatedAt` (para ordenar por reciente), `title` (para busqueda)

#### Object Store: `messages`

```typescript
interface Message {
  id: string;              // UUID v4
  chatId: string;          // FK al chat
  role: 'user' | 'assistant';
  content: string;         // Texto del mensaje (markdown para bot)
  createdAt: string;       // ISO 8601
}
```

- **keyPath**: `id`
- **Indices**: `chatId` (para obtener mensajes de un chat), `createdAt` (para ordenar)

---

## Diagrama de Flujo de Interaccion

```text
Usuario abre la app
        |
        v
  Existe sesion en localStorage?
   /              \
  NO              SI
  |                |
  v                v
Crear userId    Leer userId
y perfil        y perfil
  |                |
  v                v
Guardar en      Cargar ultimo chat
localStorage    desde IndexedDB
  |                |
  v                v
Crear chat      Renderizar mensajes
vacio           del chat
  |                |
  +-------+--------+
          |
          v
  Mostrar UI completa
          |
          v
  Usuario escribe mensaje
          |
          v
  Guardar mensaje en IndexedDB
          |
          v
  POST /api/chat (historial)
          |
          v
  Servidor usa groq-sdk
  con streaming
          |
          v
  Cliente lee stream y
  renderiza token por token
          |
          v
  Stream completo: guardar
  respuesta en IndexedDB
          |
          v
  Actualizar titulo del chat
  (si es primer mensaje)
```

---

## Consideraciones Tecnicas

### Arquitectura: API Routes de Astro + JavaScript del Cliente

La app necesita dos capas de JavaScript que actualmente no existen:

1. **Servidor (API Route)**: Un endpoint `src/pages/api/chat.ts` que recibe el historial de mensajes y usa groq-sdk para obtener la respuesta del LLM. La API key de Groq se mantiene segura en el servidor.

2. **Cliente (Scripts en `<script>`)**: JavaScript del lado del cliente para manejar la interactividad, la persistencia en IndexedDB/localStorage, y la comunicacion con el endpoint.

### Por que API Routes y no client-side directo

- La `GROQ_API_KEY` **no debe exponerse al cliente**. Debe permanecer en el servidor.
- Astro soporta API routes (endpoints) en `src/pages/api/` que corren en el servidor.
- Se necesita habilitar SSR (output: 'server' o 'hybrid') en `astro.config.mjs` para que los endpoints funcionen en produccion.

### Streaming

- El endpoint del servidor usa `Groq.chat.completions.create({ stream: true })`.
- El endpoint retorna un `Response` con un `ReadableStream` y header `Content-Type: text/event-stream`.
- El cliente usa `fetch()` + `response.body.getReader()` para leer tokens incrementalmente.
- Cada chunk se parsea y se appenda al contenido del MessageBot en tiempo real.

### IndexedDB en el Cliente

- Usar la libreria `idb` (wrapper Promise sobre IndexedDB) para simplificar el codigo. Peso: ~1.2KB gzipped.
- Alternativa: usar IndexedDB nativo con Promises manuales para cero dependencias.
- Las operaciones CRUD se encapsulan en un modulo `src/lib/db.ts`.

### JavaScript del Cliente en Astro

Astro es un sitio estatico por defecto. Para agregar interactividad:

- Usar tags `<script>` en componentes Astro. Estos se ejecutan en el cliente.
- **No se necesita React/Svelte/Vue**. Vanilla JS con DOM APIs es suficiente para esta app.
- Los scripts en `<script>` de Astro se procesan y bundlean automaticamente.
- Se puede usar TypeScript directamente en los `<script>` tags.

### Configuracion de Astro para API Routes

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'hybrid',          // Paginas estaticas por defecto, endpoints dinamicos
  adapter: node({ mode: 'standalone' }),
});
```

- `output: 'hybrid'` permite que las paginas sigan siendo estaticas pero los endpoints en `api/` sean dinamicos.
- Se necesita instalar `@astrojs/node` como adaptador.

### Renderizado de Markdown en Respuestas del Bot

- Las respuestas del LLM vienen en Markdown.
- Usar `marked` (libreria ligera) para parsear Markdown a HTML en el cliente.
- Aplicar estilos CSS al HTML generado dentro del bubble del MessageBot.
- El componente CodeBlock ya existe; integrar `highlight.js` o `prism` para syntax highlighting dentro de bloques de codigo del markdown.

### Estructura de Archivos Nuevos

```text
src/
  lib/
    db.ts              # Wrapper de IndexedDB (CRUD de chats y mensajes)
    session.ts         # Manejo de sesion en localStorage
    groq-client.ts     # Logica del cliente para comunicarse con /api/chat
    markdown.ts        # Parser de markdown para respuestas del bot
  pages/
    api/
      chat.ts          # Endpoint POST que usa groq-sdk con streaming
```

### Archivos Existentes a Modificar

| Componente | Cambio |
|---|---|
| `astro.config.mjs` | Agregar output hybrid y adapter node |
| `ChatInput.astro` | Agregar `<script>` para capturar envio, llamar al endpoint, auto-resize del textarea |
| `MessageArea.astro` | Agregar `<script>` para renderizar mensajes dinamicamente desde IndexedDB, scroll automatico |
| `ChatHistoryList.astro` | Agregar `<script>` para cargar y renderizar lista de chats desde IndexedDB |
| `ChatHistoryItem.astro` | Agregar `<script>` para manejar click y cambio de chat |
| `NewChatButton.astro` | Agregar `<script>` para crear nuevo chat en IndexedDB |
| `SearchInput.astro` | Agregar `<script>` para filtrar chats por titulo |
| `SuggestionChips.astro` | Agregar `<script>` para insertar sugerencia como mensaje |
| `ChatHeader.astro` | Agregar `<script>` para actualizar titulo dinamicamente, remover boton "Sign In" |
| `UserProfile.astro` | Agregar `<script>` para mostrar nombre del usuario desde localStorage |
| `Sidebar.astro` | Posible toggle de visibilidad en mobile |

---

## Dependencias Nuevas

| Paquete | Proposito | Tipo |
|---|---|---|
| `@astrojs/node` | Adaptador para API routes en produccion | dependencies |
| `idb` | Wrapper Promise para IndexedDB | dependencies (opcional, se puede usar nativo) |
| `marked` | Parseo de Markdown a HTML | dependencies |
| `uuid` | Generacion de UUIDs (o usar `crypto.randomUUID()`) | ninguna (API nativa) |

---

## Conexion con Componentes Existentes

### ChatInput --> API --> MessageArea

```text
[ChatInput]
    |  Usuario escribe y presiona enviar
    |  <script> captura el evento
    v
[src/lib/db.ts]
    |  Guarda mensaje del usuario en IndexedDB
    v
[MessageArea]
    |  <script> escucha evento custom 'new-message'
    |  Crea DOM del MessageUser dinamicamente
    v
[src/lib/groq-client.ts]
    |  fetch POST a /api/chat con historial
    v
[src/pages/api/chat.ts]
    |  groq-sdk streaming
    v
[MessageArea]
    |  Lee stream, crea MessageBot, appenda tokens
    |  Al terminar: guarda en IndexedDB via db.ts
    v
[ChatHistoryList]
    |  Escucha evento 'chat-updated'
    |  Actualiza titulo y orden del sidebar
```

### Comunicacion entre Componentes

Al no usar un framework reactivo, la comunicacion se hace con:

- **Custom Events** en `document`: `new-message`, `chat-updated`, `chat-selected`, `chat-created`.
- **Un modulo de estado compartido** en `src/lib/state.ts` que mantiene el `currentChatId` y expone metodos.

---

## Plan de Implementacion

### Fase 1: Infraestructura

1. Instalar `@astrojs/node` y configurar `astro.config.mjs` con `output: 'hybrid'`.
2. Crear `src/lib/db.ts` con el schema de IndexedDB y funciones CRUD.
3. Crear `src/lib/session.ts` con la logica de localStorage.
4. Crear `src/lib/state.ts` con el estado compartido y sistema de eventos.

### Fase 2: API del Servidor

1. Crear `src/pages/api/chat.ts` con el endpoint POST que usa groq-sdk con streaming.
2. Validar el request (mensajes no vacios, limite de tokens).
3. Retornar ReadableStream con formato SSE.

### Fase 3: Interactividad del Cliente

1. Agregar `<script>` a `ChatInput.astro`: capturar envio, auto-resize, estados de loading.
2. Agregar `<script>` a `MessageArea.astro`: renderizar mensajes, leer stream, scroll automatico.
3. Instalar `marked` y crear `src/lib/markdown.ts` para renderizar respuestas del bot.

### Fase 4: Persistencia y Navegacion

1. Agregar `<script>` a `NewChatButton.astro`, `ChatHistoryList.astro`, `ChatHistoryItem.astro`.
2. Agregar `<script>` a `SearchInput.astro` para busqueda.
3. Agregar `<script>` a `UserProfile.astro` y `ChatHeader.astro`.
4. Implementar inicializacion de la app (primera visita vs recurrente).

### Fase 5: Pulido

1. Estados vacios y de carga (skeleton, spinner en el bot mientras piensa).
2. Manejo de errores (red, API, limites de Groq).
3. Responsive: toggle del sidebar en mobile.
4. Agrupacion de chats por fecha en el sidebar (Hoy, Ayer, Ultimos 7 dias, etc).

---

## Alternativas Consideradas

### 1. Framework reactivo (React/Svelte) como Astro Islands

**Descartado**: La complejidad de la UI no lo justifica. Son formularios, listas y texto. Vanilla JS con Custom Events es mas ligero y no introduce dependencias pesadas. Ademas, toda la pagina necesitaria interactividad, lo que anula el beneficio de islands parciales.

### 2. groq-sdk directamente en el cliente

**Descartado**: Exponer la API key de Groq en el cliente es un riesgo de seguridad critico. Se requiere un endpoint del servidor como proxy.

### 3. localStorage en lugar de IndexedDB

**Descartado**: localStorage tiene limite de ~5MB y es sincrono/bloqueante. Los chats con muchos mensajes podrian superar el limite facilmente. IndexedDB soporta almacenamiento significativamente mayor y es asincrono.

### 4. SSR completo (output: 'server')

**Descartado**: Solo se necesita SSR para el endpoint `/api/chat`. El modo `hybrid` permite mantener las paginas como estaticas (mejor rendimiento) y solo dinamizar lo necesario.

### 5. WebSockets en lugar de SSE/fetch streaming

**Descartado**: Complejidad innecesaria. La comunicacion es request-response (el usuario envia, el bot responde). No hay mensajes bidireccionales simultaneos. fetch + ReadableStream es mas simple y suficiente.
