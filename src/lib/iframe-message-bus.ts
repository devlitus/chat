// src/lib/iframe-message-bus.ts
//
// Singleton de message bus para comunicacion host <-> iframes de widgets MCP.
// Mantiene un unico window.addEventListener('message') activo en lugar de
// N listeners (uno por cada MessageBubble con widget activo).
//
// Complejidad de dispatch: O(1) via Map.get() en lugar de O(w) con w listeners.

type IframeMessageHandler = (data: unknown) => void;

// Map de contentWindow del iframe -> handler registrado por el MessageBubble
const _handlers = new Map<Window, IframeMessageHandler>();

// Flag para evitar registrar el listener global mas de una vez
let _globalListenerRegistered = false;

function ensureGlobalListener(): void {
  if (_globalListenerRegistered) return;
  _globalListenerRegistered = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
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
 *
 * El listener global de window se crea la primera vez que se llama esta funcion
 * y persiste durante toda la vida del tab (no se elimina al desregistrar handlers).
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
