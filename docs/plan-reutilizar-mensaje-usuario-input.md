---
Rama: feature/seleccion-texto-burbuja-usuario
Fecha: 2026-08-02
Agente: planner
---

# Plan: Reutilizar texto de las burbujas de usuario en el input de chat

## Problema

Se auditó el codebase (`src/styles/reset.css`, `message-bubbles.css`,
`message-area.css`, `UserMessage.tsx`) y **no existe ningún bloqueo a la
selección nativa de texto**: no hay `user-select: none`, `pointer-events:
none` ni `contentEditable={false}` sobre las burbujas de usuario. Es decir,
seleccionar texto con el ratón/touch y copiarlo con `Ctrl+C` / gesto táctil
ya funciona hoy sin cambios, y `reset.css` incluso define un estilo
`::selection` personalizado (línea 44-46).

Lo que el codebase **no ofrece** es una forma explícita y de un solo clic de
reutilizar ese texto en el input — el usuario tiene que hacer 3-4 pasos
manuales (seleccionar, copiar, enfocar el input, pegar), lo cual es
especialmente incómodo en móvil, donde arrastrar los "handles" de selección
es poco preciso. Además ya existe en el proyecto un patrón equivalente para
el lado del bot: el botón `.copy-btn` de los bloques de código en
`BotMessage.tsx` / `markdown.ts` / `code-blocks.css`, que copia al
portapapeles con un ícono y feedback visual (check verde). Esta feature
extiende esa misma filosofía UX al lado del usuario, pero en vez de copiar
al portapapeles, inserta directamente en el `ChatInput` (que es el caso de
uso real: "editar/reenviar" un mensaje previo, patrón común en apps de chat
tipo ChatGPT).

Esto es coherente con la arquitectura de islands + Nanostores del proyecto:
`MessageArea` (donde vive `UserMessage`) y `ChatInput` son dos islands React
independientes (`client:load` separados en `ChatShell.astro`, líneas 34-35)
que **no comparten árbol de React** — solo pueden comunicarse a través de
los atoms de `src/stores/chat-store.ts`, igual que ya ocurre con
`$isStreaming`, `$botError`, etc.

## Objetivo

Permitir que el usuario seleccione texto de sus propios mensajes (burbujas
`user-bubble`) y lo traslade al textarea de `ChatInput` con una sola acción,
en vez de depender exclusivamente del flujo manual de "seleccionar → Ctrl+C
→ clic en el input → Ctrl+V". La feature añade un botón de acción por
mensaje de usuario ("Usar en el input") que inserta en el textarea el
fragmento seleccionado (si existe) o el mensaje completo, respetando la
posición del cursor y sin bloquear la selección nativa del navegador.

## Solución Técnica

### Flujo de datos

```
UserMessage (island MessageArea)
  1. Usuario selecciona texto (nativo, sin JS) dentro de .user-bubble
     — o no selecciona nada, y usa el mensaje completo.
  2. Clic en el botón "Usar en el input" (visible on hover/focus).
  3. onClick: lee window.getSelection(); si el rango pertenece a esta
     burbuja (bubbleRef.current.contains(anchorNode)) usa ese texto,
     si no, usa displayContent completo.
  4. requestInsertIntoInput(text) → $pendingInputText.set(text)

$pendingInputText (nanostore atom, chat-store.ts)
        |
        v
ChatInput (island independiente)
  5. useEffect detecta $pendingInputText !== null
  6. Inserta el texto en la posición del cursor del textarea
     (selectionStart/selectionEnd de la ref real del <textarea>)
  7. Enfoca el textarea y recoloca el cursor tras el texto insertado
  8. clearPendingInputText() → $pendingInputText.set(null)
```

No se añade ningún endpoint de servidor ni se toca `src/lib/api/`: es una
feature 100% cliente entre dos islands ya hidratadas.

### Archivos nuevos a crear

- `src/components/react/messages/hooks/useReuseInInput.ts`
  Hook que encapsula: cálculo del texto a reutilizar (selección parcial vs
  mensaje completo), el truco `onMouseDown` con `preventDefault()` para no
  perder la selección del navegador antes del `click`, y la llamada a
  `requestInsertIntoInput`. Se aísla en un hook para no ensuciar
  `UserMessage.tsx` y para poder testear la lógica de "selección dentro de
  esta burbuja vs. fuera" de forma unitaria con Vitest + happy-dom.

  ```ts
  // Firma propuesta
  export function useReuseInInput(
    bubbleRef: RefObject<HTMLDivElement | null>,
    fullText: string
  ): { onMouseDown: (e: React.MouseEvent) => void; onClick: () => void };
  ```

- `src/components/react/messages/hooks/useReuseInInput.test.ts`
  Test unitario: selección dentro de la burbuja usa el substring; sin
  selección (o selección fuera de la burbuja) usa `fullText`; llama a
  `requestInsertIntoInput` con el argumento correcto (mockeando el módulo
  `chat-actions`).

### Archivos existentes a modificar

- `src/stores/chat-store.ts`
  Añadir el atom `export const $pendingInputText = atom<string | null>(null);`
  junto al resto de atoms (siguiendo el mismo estilo de una línea por atom).

- `src/stores/chat-actions.ts`
  Añadir dos funciones siguiendo el estilo existente (una línea, sin
  clases):
  ```ts
  export function requestInsertIntoInput(text: string): void { $pendingInputText.set(text); }
  export function clearPendingInputText(): void { $pendingInputText.set(null); }
  ```

- `src/components/react/messages/UserMessage.tsx`
  - Añadir un `bubbleRef` sobre el `<div className="bubble user-bubble">`.
  - Renderizar el botón de acción (solo si `displayContent` no está vacío;
    si el mensaje es solo un adjunto sin texto, no tiene sentido ofrecer
    "reutilizar" nada) usando el hook `useReuseInInput`.
  - Estructura aproximada:
    ```tsx
    {displayContent && (
      <div className="user-bubble-wrapper">
        <div ref={bubbleRef} className="bubble user-bubble">
          <p>{displayContent}</p>
        </div>
        <button
          type="button"
          className="reuse-btn"
          title="Usar en el input"
          aria-label="Usar este mensaje en el input"
          onMouseDown={onMouseDown}
          onClick={onClick}
        >
          <span className="material-symbols-outlined" aria-hidden="true">content_paste_go</span>
        </button>
      </div>
    )}
    ```

- `src/components/react/input/MessageTextarea.tsx`
  Convertir a `forwardRef<HTMLTextAreaElement, Props>` para exponer el nodo
  DOM real del `<textarea>` a `ChatInput`, manteniendo `useAutoResize` sobre
  un ref interno y sincronizándolo al ref externo con `useImperativeHandle`.
  Es el único cambio "estructural" del plan; sin él, `ChatInput` no puede
  leer `selectionStart`/`selectionEnd` para insertar el texto en la
  posición correcta del cursor ni recolocar el foco tras la inserción.

- `src/components/react/ChatInput.tsx`
  - Crear `const textareaRef = useRef<HTMLTextAreaElement>(null);` y
    pasarlo a `<MessageTextarea ref={textareaRef} ... />`.
  - Suscribirse a `$pendingInputText` con `useStore`.
  - `useEffect` que, cuando el valor no es `null`: calcula el nuevo `text`
    insertando en `selectionStart`/`selectionEnd` (o al final si el
    textarea nunca tuvo foco), llama `setText(next)`, restaura el foco y la
    posición del cursor tras el re-render (via `requestAnimationFrame`), y
    finalmente llama `clearPendingInputText()`.

- `src/styles/message-bubbles.css`
  Añadir estilos para `.user-bubble-wrapper` (contenedor relativo) y
  `.reuse-btn`, reutilizando la paleta ya usada por `.copy-btn` en
  `code-blocks.css` (mismo tamaño de ícono, mismo tipo de transición) pero
  adaptado a la posición del botón junto a la burbuja del usuario (a la
  izquierda de la burbuja, ya que el layout de `.message-user` está en
  `row-reverse`). Reglas clave:
  - Oculto por defecto vía `opacity: 0` (no `display: none` ni
    `visibility: hidden`, para no sacarlo del orden de tabulación).
  - Visible con `.message-user:hover .reuse-btn` y con `.reuse-btn:focus-visible`
    (accesibilidad por teclado, ver más abajo).
  - Tamaño mínimo de área táctil ~32px con padding, contraste AA sobre el
    fondo oscuro del layout.

### Estructura de componentes (resumen)

```
UserMessage
 ├─ MessageAvatar
 ├─ MessageMeta
 └─ user-bubble-wrapper
     ├─ AttachmentCard (si aplica)
     ├─ .bubble.user-bubble (ref) — selección nativa, sin cambios
     └─ button.reuse-btn — usa useReuseInInput()

ChatInput
 ├─ PendingFileChip
 └─ MessageTextarea (forwardRef) — recibe textareaRef desde ChatInput
```

### Detalle técnico: preservar la selección al hacer clic

Por defecto, al hacer `mousedown` sobre un botón fuera del rango
seleccionado, el navegador colapsa la selección de texto antes de disparar
`click`. Se debe llamar `e.preventDefault()` en el handler `onMouseDown` del
botón (sin afectar al `onClick`, que sigue disparándose con normalidad) para
leer `window.getSelection()` intacta dentro del `onClick`. Esto se documenta
explícitamente porque es la parte más sutil de la implementación y su
ausencia rompería silenciosamente el caso de "usar solo lo seleccionado".

### Consideraciones de accesibilidad

- El botón siempre debe estar en el DOM y ser enfocable por teclado
  (Tab), revelado visualmente con `opacity`/`:focus-visible`, nunca con
  `display: none` (que lo sacaría del flujo de tabulación).
- `aria-label` descriptivo y distinto de "Copiar" (para no confundir con
  el `.copy-btn` de bloques de código del lado bot).
- Tamaño de objetivo táctil ≥ 24×24px (idealmente 32-40px) por WCAG 2.5.8.
- No se depende de `title` como único medio de descubrimiento (funciona
  igual sin hover, vía foco de teclado o lectores de pantalla).
- El contenedor de mensajes ya usa `role="log" aria-live="polite"`
  (`MessageArea.tsx` línea 61); como los mensajes de usuario no cambian
  tras insertarse (solo se lee su contenido, no se modifica el DOM del
  log), no hay riesgo de anuncios repetidos por el live region al pulsar
  el botón.

### Consideraciones de rendimiento

Cambio mínimo — un atom adicional que normalmente vale `null`, dos
funciones puras en `chat-actions.ts`, un botón extra por mensaje de usuario
(renderizado condicional, sin listeners globales de `selectionchange` ni de
`mousemove`, a diferencia de un enfoque con tooltip flotante que siguiera la
selección — deliberadamente descartado, ver más abajo). No afecta a SSR ni
a Core Web Vitals: todo ocurre dentro de islands ya hidratadas con
`client:load`.

### SEO

No aplica — la app es una SPA de chat autenticada por sesión, sin contenido
indexable relevante en estas vistas.

### Seguridad

No se introduce nuevo `dangerouslySetInnerHTML` ni se toca contenido
proveniente del modelo (esto solo mueve texto que el propio usuario
escribió de vuelta a su propio input). `parseFileMessage` ya se usa para
excluir el payload interno de adjuntos (`[Archivo subido a temp id: ...]`)
del `displayContent`, así que ese metadato interno nunca se reintroduce en
el input.

### Multi-selección entre burbujas

Si el usuario arrastra una selección que abarca varias burbujas (usuario +
bot, o dos mensajes de usuario), el botón de cada burbuja solo considera el
fragmento de selección contenido en su propio `bubbleRef`; si la selección
no toca esa burbuja en absoluto, hace fallback al mensaje completo. Es una
limitación intencional y documentada, no un bug: cubrir selecciones
cross-burbuja añadiría complejidad (habría que decidir qué botón mostrar,
en qué burbuja) para un caso de uso marginal.

### Dependencias

Ninguna. Se usan únicamente APIs nativas del navegador (`window.getSelection`,
`Selection.toString()`, `Node.contains`, `HTMLTextAreaElement.selectionStart/
selectionEnd/setSelectionRange`) y las herramientas ya presentes en el
proyecto (React `forwardRef`/`useImperativeHandle`, Nanostores, Material
Symbols ya cargados para el resto de iconos de la UI).

### Alternativas consideradas

- **Tooltip flotante que sigue la selección** (patrón "selection popover"
  tipo Notion/Medium, posicionado con `getBoundingClientRect()` del rango
  seleccionado y escuchando `selectionchange` globalmente). Se descartó por
  mayor complejidad de posicionamiento (recalcular en scroll/resize,
  manejar selecciones multilínea, z-index sobre el iframe de widgets) para
  un beneficio marginal frente a un botón fijo por mensaje, que además es
  más accesible por teclado sin trabajo adicional (un tooltip que solo
  aparece con `mouseup` no es alcanzable por teclado sin una alternativa
  redundante). Prioriza simplicidad según las restricciones del proyecto.

- **Copiar al portapapeles en vez de insertar directamente en el input**
  (replicar tal cual el patrón `.copy-btn` de `BotMessage.tsx`, dejando que
  el usuario haga `Ctrl+V` manualmente). Se descartó porque no resuelve el
  problema planteado ("pegar en el input"): seguiría requiriendo un paso
  manual adicional. Se mantiene como alternativa de fallback: si
  `navigator.clipboard` no estuviera disponible (contexto no seguro/HTTP),
  se podría degradar a copiar al portapapeles con un toast — pero no es
  necesario aquí porque la inserción vía Nanostores no depende de la
  Clipboard API en absoluto, así que no hay tal limitación.

- **Reemplazar siempre el contenido completo del input** (en vez de
  insertar en la posición del cursor) — más simple de implementar (no
  requeriría el cambio de `MessageTextarea` a `forwardRef`) y calca el
  patrón "editar y reenviar" de ChatGPT. Se descartó como comportamiento
  *por defecto* porque no es fiel a la semántica de "pegar" que pidió el
  usuario (pegar no borra lo que ya había en el campo) y porque perdería
  cualquier borrador que el usuario ya estuviera escribiendo. El costo
  extra de `forwardRef` es pequeño y se limita a un solo archivo.

- **No hacer nada / considerar la feature ya resuelta**, dado que la
  selección + copia + pegado nativos ya funcionan sin cambios de código
  (confirmado en la auditoría de CSS). Se descartó porque el enunciado
  pide explícitamente una capacidad de "pegar en el input" como algo que
  "el usuario debe poder hacer", lo que en el contexto de esta app de chat
  se interpreta como una acción de un clic, coherente con el patrón UX que
  ya existe para copiar código del bot.

## Plan

1. `src/stores/chat-store.ts`: añadir el atom `$pendingInputText`.
2. `src/stores/chat-actions.ts`: añadir `requestInsertIntoInput` y
   `clearPendingInputText`.
3. `src/components/react/messages/hooks/useReuseInInput.ts`: implementar el
   hook (lectura de selección + fallback a `fullText` + llamada a la
   acción) y su test unitario (`useReuseInInput.test.ts`).
4. `src/components/react/input/MessageTextarea.tsx`: migrar a
   `forwardRef` + `useImperativeHandle`, sin cambiar su comportamiento de
   auto-resize existente.
5. `src/components/react/ChatInput.tsx`: crear `textareaRef`, pasarlo a
   `MessageTextarea`, añadir el `useEffect` de inserción con reposición de
   cursor y foco, y la suscripción a `$pendingInputText`.
6. `src/components/react/messages/UserMessage.tsx`: envolver la burbuja en
   `.user-bubble-wrapper`, añadir `bubbleRef` y el botón `.reuse-btn`
   condicionado a `displayContent` no vacío.
7. `src/styles/message-bubbles.css`: añadir estilos de
   `.user-bubble-wrapper` y `.reuse-btn` (oculto/visible por hover y
   `:focus-visible`, tamaño de objetivo táctil, contraste).
8. `pnpm test` para validar que no rompe nada existente (`db`, `session`,
   `markdown`, `groq-client`, `chat.ts`) y que pasa el nuevo test de
   `useReuseInInput`.
9. Verificación manual: seleccionar texto parcial dentro de una burbuja de
   usuario y confirmar que solo ese fragmento se inserta; sin selección,
   confirmar que se inserta el mensaje completo en la posición del cursor;
   probar con `Tab` (sin ratón) que el botón es alcanzable y operable con
   `Enter`/`Space`; probar en un mensaje que solo tiene adjunto (sin texto)
   que el botón no se renderiza.
10. Ejecutar el pipeline QA correspondiente (`quality`, `security`,
    `accessibility`, `performance-auditor` si aplica, `monitor`) según la
    tabla de "Ejecución selectiva" de `CLAUDE.md`, dado que los cambios
    tocan `src/components/` — se ejecutan los cinco gates.

## Criterios de Aceptación

1. Al seleccionar un fragmento de texto dentro de una `.user-bubble` y
   pulsar el botón "Usar en el input", solo ese fragmento se inserta en el
   textarea de `ChatInput` (no el mensaje completo).
2. Sin selección activa (o con la selección fuera de esa burbuja), pulsar
   el botón inserta el mensaje completo (`displayContent`) en la posición
   actual del cursor del textarea.
3. La inserción respeta el contenido previo del textarea: no lo sobrescribe,
   se inyecta en `selectionStart`/`selectionEnd` (o al final si el textarea
   nunca tuvo foco).
4. Tras la inserción, el textarea queda enfocado y el cursor se recoloca
   justo después del texto insertado.
5. El botón es alcanzable con `Tab` y operable con `Enter`/`Espacio`, con
   `aria-label` distinto del `.copy-btn` de bloques de código, y nunca se
   elimina del flujo de tabulación (visibilidad vía `opacity`, no
   `display: none`).
6. El área táctil del botón es ≥ 24×24px (idealmente 32-40px) y su
   contraste cumple AA sobre el fondo oscuro del layout.
7. El botón no se renderiza cuando el mensaje de usuario no tiene texto
   (solo adjunto), evitando una acción sin efecto.
8. Al hacer clic en el botón, la selección de texto del navegador no se
   colapsa antes de leerse (verificado por el `preventDefault()` en
   `onMouseDown`).
9. El metadato interno de adjuntos (`[Archivo subido a temp id: ...]`)
   nunca se reintroduce en el input, incluso si el mensaje original
   contenía un adjunto.
10. No se añaden listeners globales de `selectionchange` ni `mousemove`, ni
    se modifica el comportamiento de auto-resize existente de
    `MessageTextarea`.
11. El resto de la suite de tests (`db`, `session`, `markdown`,
    `groq-client`, `chat.ts`) sigue en verde tras el cambio.

## Test

### Tests unitarios (Vitest + happy-dom)

- `src/components/react/messages/hooks/useReuseInInput.test.ts` (nuevo):
  - Selección dentro de la burbuja → usa el substring seleccionado.
  - Sin selección o selección fuera de la burbuja → usa `fullText`
    (fallback al mensaje completo).
  - Verifica que `requestInsertIntoInput` (mockeando `chat-actions`) se
    invoca con el argumento correcto en cada caso.
  - Verifica que `onMouseDown` llama a `preventDefault()`.

- Ejecutar `pnpm test` completo para confirmar que no hay regresiones en
  los tests existentes (`db`, `session`, `markdown`, `groq-client`,
  `chat.ts`) y que el nuevo test pasa.

### Verificación manual

- Seleccionar texto parcial dentro de una burbuja de usuario y confirmar
  que solo ese fragmento se inserta en el input.
- Sin seleccionar nada, confirmar que se inserta el mensaje completo en la
  posición actual del cursor (probar con el textarea vacío y con contenido
  previo, insertando en medio del texto).
- Navegar con `Tab` (sin ratón) hasta el botón y confirmar que es
  alcanzable, visible por `:focus-visible` y operable con `Enter`/`Space`.
- Probar en un mensaje que solo tiene adjunto (sin texto) que el botón no
  se renderiza.
- Probar una selección que abarca dos burbujas (usuario + bot) y confirmar
  el fallback al mensaje completo de la burbuja pulsada.
- Confirmar visualmente el contraste y el tamaño del área táctil del botón
  en modo claro/oscuro si aplica.

### Pipeline QA (según `CLAUDE.md`, tabla "Ejecución selectiva")

Los cambios tocan `src/components/`, por lo que se ejecutan los cinco
gates en orden: `quality` → `security` → `accessibility` →
`performance-auditor` → `monitor`, con ciclo de corrección
`implementer → QA → implementer (fixes) → QA` (máx. 2 iteraciones) si algún
gate reporta hallazgos críticos.
