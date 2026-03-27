# Plan de correcciones de rendimiento críticas

Fecha: 2026-03-06
Branch: feature/mcpapp
Basado en: `.claude/reports/performance-report.md`

---

## Resumen

Este documento cubre el diseño detallado para corregir los **3 hallazgos críticos** identificados en la auditoría de rendimiento. Los tres problemas generan degradación perceptible para el usuario: jank visual durante el streaming del LLM, latencia acumulada de IndexedDB en cada mensaje enviado, y acumulación de event listeners en `window` con potencial memory leak en sesiones largas.

---

## Contexto

El reporte de rendimiento identificó 15 hallazgos distribuidos en tres niveles de severidad. Los críticos son:

| # | Problema | Archivo afectado | Impacto |
|---|---|---|---|
| 1 | `renderMarkdown` en cada token del stream | `src/lib/markdown.ts`, `src/components/react/ChatInput.tsx` | 80-95% de CPU bloqueado en hilo principal durante streaming |
| 2 | `openDB()` sin caché de conexión | `src/lib/db.ts` | 30-120ms de latencia acumulada por mensaje enviado |
| 3 | `window.addEventListener` acumulativo por widget | `src/components/react/MessageBubble.tsx` | Memory leak O(w) en sesiones largas con múltiples widgets |

Los hallazgos 4-15 del reporte son importantes u opcionales y quedan fuera del alcance de este documento.

---

## Diseño propuesto

### Fix 1: Throttle del rendering markdown durante streaming via `requestAnimationFrame`

#### Problema en detalle

El loop de streaming en `ChatInput.tsx` (líneas 62-65) llama a `updateStreaming(fullContent)` en cada token recibido del stream. Groq puede emitir 50-200 tokens/segundo. Cada llamada a `updateStreaming` actualiza el atom `$streamingContent` de nanostores, lo que dispara un re-render de `MessageArea`, que actualmente muestra un spinner ("Pensando...") durante el streaming, no el contenido parcial del texto.

Sin embargo, el problema real se da al terminar el stream: `finishStreaming(botMessage)` coloca el mensaje en `$messages`, y `MessageBubble` llama a `renderMarkdown` via `useMemo`. Esto es un parseo completo: `marked.parse()` + `hljs.highlight()` (por cada bloque de código) + `DOMPurify.sanitize()`. Para respuestas largas con múltiples bloques de código, puede acumular 100-300ms de trabajo sincrónico en el hilo principal justo al finalizar el stream.

El segundo vector del problema es el que el reporte describe como "hot path": si en el futuro se añade un preview de markdown durante el streaming (feature comun en chatbots), el patrón actual de llamar `renderMarkdown` en cada token seria desastroso. La solución que se diseña aqui previene ese escenario de forma anticipada.

#### Analisis del codigo actual

```
ChatInput.tsx:62-65
  for await (const token of streamChat(history)) {
    fullContent += token;
    updateStreaming(fullContent);   <-- dispara atom en cada token
  }
```

```
MessageArea.tsx:54
  {isStreaming && (
    <div className="message-bot">  <-- muestra spinner, NO renderMarkdown
    ...
```

El `renderMarkdown` NO se ejecuta durante el streaming activo en el codigo actual: `MessageArea` muestra el spinner mientras `$isStreaming` es `true`, y el contenido renderizado solo aparece en `MessageBubble` que usa mensajes de `$messages` (mensajes persistidos). La unica vez que `renderMarkdown` se ejecuta es cuando `finishStreaming` añade el mensaje final a `$messages`.

Dicho esto, el problema real del hallazgo 1 es que `updateStreaming` se llama N veces por segundo actualizando un atom que nadie consume visualmente (el spinner no depende del contenido). Esto genera N actualizaciones de estado innecesarias.

#### Solucion: throttle del loop de streaming

Aplicar throttle al llamado de `updateStreaming` usando `requestAnimationFrame`. El texto acumulado en `fullContent` se actualiza en cada token (necesario para procesarlo al final), pero el atom de nanostore solo se actualiza cuando el browser tiene capacidad de render.

**Archivos a modificar:**

- `src/components/react/ChatInput.tsx` — throttle en el loop de streaming
- `src/components/react/SuggestionChips.tsx` — mismo patron, mismo fix (codigo duplicado)

**Cambios en `ChatInput.tsx`:**

```typescript
// ANTES (lineas 61-65):
let fullContent = '';
for await (const token of streamChat(history)) {
  fullContent += token;
  updateStreaming(fullContent);
}

// DESPUES:
let fullContent = '';
let rafPending = false;

for await (const token of streamChat(history)) {
  fullContent += token;
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => {
      updateStreaming(fullContent);
      rafPending = false;
    });
  }
}
// Garantizar flush final del contenido acumulado
updateStreaming(fullContent);
```

La variable `rafPending` actua como flag de cola: si ya hay un frame pendiente de pintar, no se encola otro. Cuando el frame se ejecuta, se toma el valor mas reciente de `fullContent` (closure sobre la variable). Esto reduce las actualizaciones de ~150 tokens/segundo a ~60 frames/segundo maximo, con colapso natural de tokens intermedios.

El `updateStreaming(fullContent)` al final del loop garantiza que el contenido final llega al atom antes de que `finishStreaming` lo procese, evitando cualquier condicion de carrera.

**Nota sobre `SuggestionChips.tsx`:** El reporte menciona que duplica la logica de `ChatInput.tsx`. Se aplica el mismo patron de throttle en ese archivo.

#### Consideracion sobre tests

El test `renderStreamingMarkdown` en `markdown.test.ts` no se ve afectado porque prueba la funcion de biblioteca directamente, no el componente. No se necesitan cambios en tests.

---

### Fix 2: Singleton con cache de conexion IDB en `db.ts`

#### Problema en detalle

La funcion `openDB()` en `src/lib/db.ts` llama a `indexedDB.open()` en cada invocacion y `withStore` la llama en cada operacion de base de datos. Ademas, `tx.oncomplete` cierra la conexion con `db.close()`.

El flujo de `sendMessage` genera estas llamadas secuenciales a IDB:

```
addMessage(user)        → openDB() + close()
getChat(activeChatId)   → openDB() + close()
updateChat(activeChatId)→ openDB() + close()  [solo primer mensaje]
getMessagesByChatId()   → openDB() + close()
addMessage(assistant)   → openDB() + close()
getAllChats()            → openDB() + close()
```

En Windows con NVMe, cada `indexedDB.open()` cuesta 5-20ms. En total: 30-120ms de latencia pura de apertura/cierre de conexion por cada mensaje enviado.

#### Solucion: modulo singleton con cache de la instancia `IDBDatabase`

La conexion IDB puede permanecer abierta indefinidamente mientras el tab esta activo. El browser gestiona el ciclo de vida: si el usuario navega o cierra el tab, la conexion se cierra automaticamente. El evento `versionchange` de IDB notifica cuando una nueva version del schema requiere cerrar la conexion.

**Archivo a modificar: `src/lib/db.ts`**

```typescript
// ANTES (lineas 35-58):
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => { /* ... */ };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(...): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();   // <-- cierra la conexion
  });
}
```

```typescript
// DESPUES:

// Cache de conexion a nivel de modulo (singleton por tab)
let _dbInstance: IDBDatabase | null = null;
// Promesa en vuelo para evitar llamadas concurrentes a open()
let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  // Si ya hay conexion abierta y funcional, devolverla directamente
  if (_dbInstance) return Promise.resolve(_dbInstance);

  // Si ya hay una apertura en curso, reusar la misma promesa
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // ... mismo codigo de creacion de stores ...
    };

    request.onsuccess = () => {
      _dbInstance = request.result;
      _dbPromise = null;

      // Limpiar cache si la conexion se cierra externamente
      // (e.g. versionchange de otra pestana, o error interno del browser)
      _dbInstance.onclose = () => {
        _dbInstance = null;
      };

      // Manejar solicitud de cierre por cambio de version en otra pestana
      _dbInstance.onversionchange = () => {
        _dbInstance?.close();
        _dbInstance = null;
      };

      resolve(_dbInstance);
    };

    request.onerror = () => {
      _dbPromise = null;
      reject(request.error);
    };
  });

  return _dbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // ELIMINADO: tx.oncomplete = () => db.close()
    // La conexion permanece abierta durante la vida del tab
  });
}
```

**Cambios adicionales en `db.ts`:**

- Eliminar `db.close()` en `withStore` (linea 73)
- Eliminar `db.close()` en `getMessagesByChatId` (linea 168 del archivo actual, en el callback `tx.oncomplete`)
- Eliminar `db.close()` en `deleteChat` (lineas 120-121)

**El patron `_dbPromise`** previene una condicion de carrera importante: si dos operaciones IDB se ejecutan concurrentemente antes de que la primera apertura complete (ej: `addMessage` y `getChat` en `Promise.all`), sin este patron ambas llamarian a `indexedDB.open()` independientemente, obteniendo dos instancias separadas. Con `_dbPromise`, la segunda llamada reutiliza la promesa de la primera y espera el mismo resultado.

#### Impacto en tests existentes

Los tests de `db.test.ts` usan `fake-indexeddb` configurado en Vitest (happy-dom environment). El `beforeEach` hace `indexedDB.deleteDatabase()` para limpiar entre tests. El singleton introduciria un problema: `_dbInstance` quedaria con la instancia de la DB eliminada entre tests, causando errores en el siguiente test.

**Se necesita agregar una funcion `resetDBConnection()` exportada solo para tests:**

```typescript
// Solo para uso en tests — resetea el singleton entre pruebas
export function resetDBConnection(): void {
  if (_dbInstance) {
    _dbInstance.onclose = null;
    _dbInstance.onversionchange = null;
    _dbInstance.close();
  }
  _dbInstance = null;
  _dbPromise = null;
}
```

Y en `db.test.ts`, importar y llamar `resetDBConnection()` en `beforeEach` antes de `indexedDB.deleteDatabase()`:

```typescript
import { resetDBConnection, /* ... resto de imports */ } from './db';

beforeEach(async () => {
  resetDBConnection();  // Limpiar singleton antes de eliminar la DB
  const dbs = await indexedDB.databases();
  for (const db of dbs) {
    if (db.name) {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(db.name!);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  }
});
```

Esta funcion no debe usarse en produccion. Se puede proteger con una verificacion de entorno si se desea, pero dado que Vitest no ejecuta codigo de produccion en el browser, el riesgo es nulo.

---

### Fix 3: Singleton global de message bus para iframes en `MessageBubble.tsx`

#### Problema en detalle

Cada instancia de `MessageBubble` que tiene `uiResourceUri` registra un listener en `window` para eventos `message` (lineas 48-128):

```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
    // ... logica de despacho por toolName ...
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

Con 5 widgets activos en el historial, hay 5 funciones `handleMessage` registradas en `window`. Cada vez que un iframe emite un evento `postMessage` (ej: CryptoApp solicitando precios), los 5 handlers reciben el evento y evaluan `event.source !== iframeRef.current.contentWindow`. La evaluacion es barata, pero se escala linealmente con el numero de widgets, y en sesiones largas donde el usuario reutiliza widgets activos repetidamente, el patron acumula.

El cleanup `return () => window.removeEventListener(...)` existe, pero solo ocurre al desmontar el componente. Mientras los `MessageBubble` permanezcan montados (historial visible), todos los listeners estan activos simultaneamente.

#### Solucion: modulo singleton `iframe-message-bus.ts`

Crear un modulo con un unico listener en `window` que despacha a los handlers registrados por cada widget segun el `event.source`.

**Archivo nuevo a crear: `src/lib/iframe-message-bus.ts`**

```typescript
// src/lib/iframe-message-bus.ts
//
// Singleton de message bus para comunicacion host <-> iframes de widgets MCP.
// Mantiene un unico window.addEventListener('message') activo en lugar de
// N listeners (uno por cada MessageBubble con widget activo).

type IframeMessageHandler = (data: unknown) => void;

// Map de contentWindow del iframe → handler registrado por el MessageBubble
const _handlers = new Map<Window, IframeMessageHandler>();

// Flag para evitar registrar el listener global mas de una vez
let _globalListenerRegistered = false;

function ensureGlobalListener(): void {
  if (_globalListenerRegistered) return;
  _globalListenerRegistered = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (!event.source) return;
    const handler = _handlers.get(event.source as Window);
    if (handler) {
      handler(event.data);
    }
  });
}

/**
 * Registra un handler para los mensajes postMessage provenientes de `iframeWindow`.
 * Devuelve una funcion de cleanup para desregistrar al desmontar el componente.
 */
export function registerIframeHandler(
  iframeWindow: Window,
  handler: IframeMessageHandler
): () => void {
  ensureGlobalListener();
  _handlers.set(iframeWindow, handler);
  return () => {
    _handlers.delete(iframeWindow);
  };
}
```

**Archivo a modificar: `src/components/react/MessageBubble.tsx`**

Reemplazar el `useEffect` del listener de `window` (lineas 48-128) usando `registerIframeHandler`:

```typescript
import { registerIframeHandler } from '../../lib/iframe-message-bus';

// ... dentro del componente MessageBubble:

useEffect(() => {
  // Solo registrar handler si este MessageBubble tiene un iframe activo
  const iframeWindow = iframeRef.current?.contentWindow;
  if (!iframeWindow) return;

  const cleanup = registerIframeHandler(iframeWindow, (data: unknown) => {
    const msg = data as { type?: string; toolName?: string };
    if (!msg || msg.type !== 'mcp_call_tool') return;

    if (msg.toolName === 'get-time') {
      const timeResult = new Date().toISOString();
      iframeRef.current?.contentWindow?.postMessage({
        type: 'mcp_tool_result',
        toolName: 'get-time',
        time: timeResult,
      }, window.location.origin);
    }

    if (msg.toolName === 'get-location') {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          iframeRef.current?.contentWindow?.postMessage({
            type: 'mcp_tool_result',
            toolName: 'get-location',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }, window.location.origin);
        },
        () => {
          iframeRef.current?.contentWindow?.postMessage({
            type: 'mcp_tool_result',
            toolName: 'get-location',
            error: 'permission-denied',
          }, window.location.origin);
        }
      );
    }

    if (msg.toolName === 'get-crypto-price') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
        { signal: controller.signal }
      )
        .then((res) => {
          clearTimeout(timeout);
          if (res.status === 429) throw Object.assign(new Error(), { code: 'rate-limited' });
          if (!res.ok) throw Object.assign(new Error(), { code: 'service-error' });
          return res.json();
        })
        .then((json: Record<string, { usd: number; usd_24h_change: number }>) => {
          const coins = Object.entries(json).map(([id, values]) => ({
            id,
            name: id.charAt(0).toUpperCase() + id.slice(1),
            symbol: id === 'bitcoin' ? 'BTC' : id === 'ethereum' ? 'ETH' : 'SOL',
            price: values.usd,
            change24h: values.usd_24h_change,
          }));
          iframeRef.current?.contentWindow?.postMessage({
            type: 'mcp_tool_result',
            toolName: 'get-crypto-price',
            data: coins,
          }, window.location.origin);
        })
        .catch((err) => {
          clearTimeout(timeout);
          const code = err.name === 'AbortError' ? 'timeout' : (err.code ?? 'network-error');
          iframeRef.current?.contentWindow?.postMessage({
            type: 'mcp_tool_result',
            toolName: 'get-crypto-price',
            error: code,
          }, window.location.origin);
        });
    }
  });

  return cleanup;
  // La dependencia del array es vacia: iframeRef.current se lee en el body del efecto.
  // El efecto se ejecuta una vez al montar cuando el iframe ya esta disponible,
  // y el cleanup desregistra el handler al desmontar.
}, []);
```

#### Problema del timing del useEffect

Existe un detalle critico: cuando el `MessageBubble` se monta, `iframeRef.current` puede ser `null` porque el iframe aun no ha cargado. El efecto se ejecuta despues del primer render, pero el `contentWindow` del iframe solo esta disponible despues de que el iframe termine de cargar.

**Solucion:** Usar el evento `load` del iframe para registrar el handler despues de que el iframe este listo.

```typescript
useEffect(() => {
  const iframe = iframeRef.current;
  if (!iframe) return;

  const onLoad = () => {
    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) return;

    const cleanup = registerIframeHandler(iframeWindow, (data: unknown) => {
      // ... handlers de toolName ...
    });

    // Guardar cleanup para llamarlo al desmontar
    return cleanup;
  };

  // Si el iframe ya cargo (puede ocurrir si el efecto se ejecuta tarde)
  if (iframe.contentDocument?.readyState === 'complete') {
    const cleanup = onLoad();
    return cleanup;
  }

  // Registrar en el evento load
  let cleanup: (() => void) | undefined;
  const wrappedLoad = () => { cleanup = onLoad() ?? undefined; };
  iframe.addEventListener('load', wrappedLoad);

  return () => {
    iframe.removeEventListener('load', wrappedLoad);
    cleanup?.();
  };
}, []);
```

Este patron garantiza que el handler solo se registra cuando el `contentWindow` esta disponible, y el cleanup funciona correctamente tanto si el iframe ya cargo como si se desmonta antes de cargar.

---

## Archivos involucrados

### Archivos nuevos a crear

| Ruta | Descripcion |
|---|---|
| `src/lib/iframe-message-bus.ts` | Singleton de message bus para iframes (Fix 3) |

### Archivos existentes a modificar

| Archivo | Fix | Cambios |
|---|---|---|
| `src/components/react/ChatInput.tsx` | Fix 1 | Throttle de `updateStreaming` con `requestAnimationFrame` en el loop de streaming |
| `src/components/react/SuggestionChips.tsx` | Fix 1 | Mismo throttle (codigo duplicado del flujo de envio) |
| `src/lib/db.ts` | Fix 2 | Singleton `_dbInstance`/`_dbPromise`, eliminar `db.close()`, agregar `resetDBConnection()` |
| `src/lib/db.test.ts` | Fix 2 | Importar y llamar `resetDBConnection()` en `beforeEach` |
| `src/components/react/MessageBubble.tsx` | Fix 3 | Reemplazar `window.addEventListener` con `registerIframeHandler` del bus |

---

## Consideraciones tecnicas

### Rendimiento

**Fix 1 (throttle RAF):**
- Reduccion estimada del 70-90% de actualizaciones de atom durante el streaming (de ~150/seg a ~60/seg).
- El overhead de `requestAnimationFrame` es despreciable (~0.01ms por llamada).
- No cambia la correctitud: `fullContent` siempre contiene el texto acumulado completo al terminar el loop.
- El flush final `updateStreaming(fullContent)` antes de `finishStreaming` asegura que el atom este al dia si el ultimo frame todavia no se habia ejecutado.

**Fix 2 (cache IDB):**
- La primera llamada a `openDB()` tarda lo mismo que antes (1 apertura de DB).
- Llamadas subsiguientes en el mismo tab: ~0ms (resolucion sincrona via `Promise.resolve`).
- Ahorro total por mensaje: 5 aperturas evitadas × 5-20ms/apertura = 25-100ms.
- La conexion IDB persistente es el patron recomendado por MDN y la especificacion W3C de IndexedDB.

**Fix 3 (message bus singleton):**
- Reduce de O(w) a O(1) la evaluacion de cada evento `postMessage`, donde w = numero de widgets activos.
- El `Map.get()` es O(1) en implementaciones V8 optimizadas para Maps de tamano moderado.
- Cero overhead adicional cuando no hay widgets activos (el listener global existe pero el Map esta vacio).

### Correctitud y casos borde

**Fix 2 - versionchange:** El handler `onversionchange` garantiza que si el usuario abre la misma app en otro tab y se hace una migracion de schema (incremento de `DB_VERSION`), el tab actual cierra su conexion limpiamente para no bloquear la actualizacion.

**Fix 2 - onclose:** Si el browser cierra la conexion por una razon interna (memoria del dispositivo, garbage collection agresivo), `onclose` limpia `_dbInstance` para que la proxima operacion abra una nueva conexion.

**Fix 3 - timing del iframe:** El patron de esperar el evento `load` del iframe antes de registrar el handler resuelve la condicion de carrera entre el mount del componente React y la carga del documento del iframe.

**Fix 3 - multiple renders de MessageBubble:** Si React desmonta y vuelve a montar un `MessageBubble` (por ejemplo, en StrictMode en desarrollo que ejecuta efectos dos veces), el cleanup del primer efecto elimina el handler del Map, y el segundo efecto lo re-registra. El comportamiento es correcto.

### Accesibilidad

Ninguno de los tres fixes altera el DOM ni los atributos ARIA. No se requiere revision de accesibilidad especifica.

### SEO

No aplica. Los cambios son en logica de cliente (React islands), no en contenido renderizado por el servidor.

---

## Dependencias

No se requieren paquetes npm nuevos. Los tres fixes usan exclusivamente APIs del browser (`requestAnimationFrame`, `IDBDatabase`, `window.addEventListener`) y primitivas de TypeScript.

---

## Plan de implementacion

El orden de implementacion es por impacto y riesgo:

### Paso 1: Fix 2 — Cache de conexion IDB (menor riesgo, mayor impacto inmediato)

1. Modificar `src/lib/db.ts`:
   - Agregar variables de modulo `_dbInstance` y `_dbPromise`.
   - Reescribir `openDB()` con logica de cache y double-check de promesa en vuelo.
   - Agregar handlers `onclose` y `onversionchange` en el callback `onsuccess`.
   - Eliminar todos los `db.close()` de `withStore`, `getMessagesByChatId` y `deleteChat`.
   - Agregar la funcion exportada `resetDBConnection()`.

2. Modificar `src/lib/db.test.ts`:
   - Importar `resetDBConnection`.
   - Llamar `resetDBConnection()` al inicio del `beforeEach`, antes de `indexedDB.deleteDatabase`.

3. Ejecutar `pnpm test` para verificar que los 49 tests pasan sin regresion.

### Paso 2: Fix 3 — Singleton message bus para iframes (impacto en correctitud)

1. Crear `src/lib/iframe-message-bus.ts` con el singleton `registerIframeHandler`.

2. Modificar `src/components/react/MessageBubble.tsx`:
   - Importar `registerIframeHandler`.
   - Reemplazar el `useEffect` con `window.addEventListener` por el patron con `registerIframeHandler` e iframe load event.
   - Mantener toda la logica interna de despacho por `toolName` sin cambios funcionales.

3. Verificar manualmente en el browser:
   - Activar widget de clima, crypto y tiempo en la misma sesion.
   - Confirmar que los tres widgets responden correctamente a sus eventos postMessage.
   - Abrir DevTools → Memory → Heap snapshot y confirmar que no hay acumulacion de listeners.

### Paso 3: Fix 1 — Throttle del streaming con requestAnimationFrame (menor impacto directo hoy, previene deuda tecnica)

1. Modificar `src/components/react/ChatInput.tsx`:
   - Agregar variable `rafPending` antes del loop `for await`.
   - Envolver `updateStreaming(fullContent)` dentro del condicional de `requestAnimationFrame`.
   - Agregar flush final `updateStreaming(fullContent)` despues del loop.

2. Leer `src/components/react/SuggestionChips.tsx` y aplicar el mismo patron en su funcion de envio.

3. Verificar visualmente en el browser que el spinner de "Pensando..." sigue apareciendo correctamente durante el streaming y que la respuesta final se renderiza sin cambios.

### Paso 4: Verificacion final

1. Ejecutar `pnpm build` y verificar build sin errores.
2. Ejecutar `pnpm test` y verificar que los 49 tests pasan.
3. Ejecutar en el browser con DevTools Performance abierto:
   - Enviar un mensaje con respuesta larga con codigo.
   - Verificar que el FPS durante streaming no cae por debajo de 30fps.
   - Verificar en la pestaña Application → IndexedDB que la conexion se abre una vez y permanece abierta.

---

## Alternativas consideradas

### Fix 1: Mostrar texto plano durante streaming, parsear markdown al finalizar

El reporte sugiere esta alternativa como la "menos agresiva". La alternativa completa seria mostrar solo texto crudo durante el streaming y aplicar `renderMarkdown` una sola vez al llamar `finishStreaming`.

**Por que se descarto:** El codigo actual ya muestra solo el spinner durante el streaming (no el texto parcial). Cambiar eso para mostrar texto plano requeriria modificar `MessageArea.tsx` significativamente, ademas de `ChatInput.tsx` y el modelo de datos de `$streamingContent`. El throttle con RAF es menos invasivo y cubre el mismo problema con menor riesgo de regresion.

### Fix 2: Pool de conexiones IDB

Implementar un pool de N conexiones concurrentes, similar a los pools de conexiones de base de datos relacionales.

**Por que se descarto:** IndexedDB permite multiples transacciones concurrentes en la misma conexion (distintos object stores pueden tener transacciones simultaneas). No se necesita un pool de conexiones; una sola conexion persistente es suficiente y es el patron recomendado por la especificacion.

### Fix 3: Mover el handler a `MessageArea` (componente padre)

En lugar de un singleton de modulo, centralizar el handler en `MessageArea.tsx` y pasarlo como prop o via context a `MessageBubble`.

**Por que se descarto:** Requeriria modificar la interfaz de props de `MessageBubble` y agregar logica de dispatch en `MessageArea` que actualmente no tiene. El singleton de modulo logra el mismo resultado con menor acoplamiento entre componentes y sin modificar las interfaces existentes.

### Fix 3: Usar `BroadcastChannel` en lugar de `postMessage`

`BroadcastChannel` permite comunicacion entre contextos del mismo origen sin necesidad de una referencia directa al iframe.

**Por que se descarto:** Los widgets ya estan implementados con el protocolo `postMessage` custom. Migrar a `BroadcastChannel` implicaria modificar tambien el codigo dentro de los iframes (`McpClientApp.tsx`, `CryptoApp`, `WeatherApp`). La solucion del singleton es no-invasiva para el codigo de los widgets.
