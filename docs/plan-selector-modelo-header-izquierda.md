# Plan: Mover el selector de modelos local al badge de `chat-header-left`

## Resumen

Reemplazar el `<span className="badge">` estático que hoy muestra el
nombre del modelo local (esquina superior izquierda del header, junto
al título del chat) por el componente `ModelSelector` ya existente
(dropdown funcional contra `GET /api/models`). El `ModelSelector` que
hoy vive duplicado en `chat-header-right` se retira de ahí para no
tener dos selectores del mismo modelo visibles a la vez. `GroqModelSelector`
no se toca: sigue en `chat-header-right` y solo se renderiza cuando
`provider === 'groq'`.

Es un cambio puramente de **reubicación de JSX + un ajuste de estado
de carga + CSS de encaje visual** dentro de un único archivo
(`ChatHeader.tsx`) y sus estilos asociados. No se crean componentes,
stores ni hooks nuevos.

## Contexto

`src/components/react/ChatHeader.tsx` define hoy tres componentes
internos (`ProviderSelector`, `GroqModelSelector`, `ModelSelector`) y
el componente exportado `ChatHeader`. En el render actual de
`ChatHeader` (líneas 220-243):

- `chat-header-left` (línea 222-228): título del chat (`h2`) + un
  `<span className="badge">{headerModelName}</span>` **estático**
  (línea 227), donde `headerModelName` (líneas 216-218) es un `useMemo`-less
  cálculo inline que ya distingue `provider === 'groq'` vs local.
- `chat-header-right` (línea 229-241): botón de favoritos,
  `<ProviderSelector />`, y `{provider === 'groq' ? <GroqModelSelector /> : <ModelSelector />}`
  (línea 240) — aquí es donde hoy vive el dropdown funcional para el
  proveedor local.

El usuario pidió explícitamente que el badge estático de la izquierda
se convierta en ese mismo dropdown, y que ya no quede duplicado en la
derecha. `GroqModelSelector` se mantiene intacto en su sitio actual.

`ModelSelector` (líneas 137-201) ya resuelve todo el comportamiento
necesario: `fetch('/api/models')` en `useEffect`, persistencia en
`localStorage['selectedModel']`, mutación directa de `$selectedModel`
(sin action en `chat-actions.ts`, siguiendo el patrón existente), y
markup/ARIA (`aria-haspopup="listbox"`, `aria-expanded`,
`role="listbox"`, `role="option"`, `aria-selected`) ya correcto. Este
componente **no se mueve de archivo ni se re-implementa**; solo cambia
dónde se referencia en el JSX de `ChatHeader`, y se ajusta su
comportamiento cuando `models.length === 0` (ver más abajo).

## Diseño propuesto

### Archivos nuevos a crear

Ninguno.

### Archivos existentes a modificar

#### 1. `src/components/react/ChatHeader.tsx`

**A. Cuerpo de `ChatHeader()` (líneas 203-244) — reestructurar el JSX**

Eliminar las variables que ya no se necesitan y restructurar
`chat-header-left` / `chat-header-right`:

- Eliminar `const selectedModel = useStore($selectedModel);` (línea
  206) — deja de usarse en `ChatHeader`; `ModelSelector` ya lee
  `$selectedModel` internamente vía su propio `useStore`, no hace
  falta duplicarlo aquí.
- Eliminar el cálculo `headerModelName` (líneas 216-218) — se
  sustituye por JSX condicional inline (ver abajo). Mantener
  `selectedGroqModel` (línea 208, ya presente vía `useStore($selectedGroqModel)`)
  porque sigue haciendo falta para el badge estático de Groq.
- `chat-header-left`: sustituir el `<span className="badge">{headerModelName}</span>`
  (línea 227) por:
  - Si `provider === 'groq'` → `<span className="badge">{selectedGroqModel || 'Groq'}</span>`
    (texto estático, mismo comportamiento visual que antes para este
    caso — ver justificación en "Consideraciones técnicas").
  - Si `provider !== 'groq'` (local) → `<ModelSelector />`.
- `chat-header-right`: sustituir la línea 240
  `{provider === 'groq' ? <GroqModelSelector /> : <ModelSelector />}`
  por `{provider === 'groq' && <GroqModelSelector />}` — se elimina la
  rama `<ModelSelector />` de aquí; ya no hay dropdown local en la
  derecha.

Resultado del `return` (referencia de estructura, no diff literal):

```
<header className="chat-header">
  <div className="chat-header-left">
    <h2>
      <span className="material-symbols-outlined star-icon">auto_awesome</span>
      <span className="chat-title-text">{title}</span>
    </h2>
    {provider === 'groq'
      ? <span className="badge">{selectedGroqModel || 'Groq'}</span>
      : <ModelSelector />}
  </div>
  <div className="chat-header-right">
    <button className="fav-btn" ...>...</button>
    <ProviderSelector />
    {provider === 'groq' && <GroqModelSelector />}
  </div>
</header>
```

Nota: se añade la clase `chat-title-text` al `<span>{title}</span>`
del `h2` (antes sin clase) para poder aplicarle truncado por CSS sin
afectar al `<span className="material-symbols-outlined star-icon">`
hermano (ver sección CSS).

`ProviderSelector`, `GroqModelSelector`, `ModelSelector` y
`modelDisplayName` (líneas 8-201) **no cambian de posición en el
archivo** — siguen siendo funciones internas del módulo, definidas
antes de `ChatHeader`. Solo cambia dónde se invocan dentro del JSX de
`ChatHeader`.

**B. `ModelSelector` (líneas 137-201) — comportamiento cuando `models.length === 0`**

Hoy (línea 161): `if (models.length === 0) return null;`. Al vivir en
`chat-header-right` esto era invisible (dejaba hueco entre botones sin
romper el layout). Al reemplazar el badge de la izquierda, un `return null`
mientras se resuelve el `fetch('/api/models')` deja el hueco donde
antes SIEMPRE había texto visible de forma síncrona
(`headerModelName` se calculaba desde el átomo sin esperar red).
Cambios necesarios:

1. Eliminar el `return null` temprano (línea 161).
2. Cambiar el fallback de `displayName` (línea 163) de `'—'` a
   `'gemma4'`, para igualar el valor por defecto que ya mostraba el
   badge estático (`headerModelName` local, línea 218) antes de este
   cambio: `const displayName = selectedModel ? modelDisplayName(selectedModel) : 'gemma4';`.
3. Añadir un flag `const loading = models.length === 0;` y usarlo
   para:
   - Deshabilitar la apertura del dropdown mientras carga:
     `onClick={() => !loading && setOpen((v) => !v)}`.
   - `aria-disabled={loading}` en el `<button className="model-btn">`.
   - Renderizar el `<ul className="model-dropdown">` solo si
     `open && !loading` (evita abrir una lista vacía si el usuario
     hace click justo antes de que resuelva el fetch).

Con esto, el botón siempre es visible desde el primer render (mismo
comportamiento síncrono que el badge anterior), y solo se vuelve
interactivo una vez que `/api/models` responde con al menos un
modelo. No se introduce spinner ni nueva dependencia — es una
extensión mínima del estado que el componente ya tiene.

#### 2. `src/styles/chat-header.css`

- `.chat-header-left` (línea 17-21): añadir `min-width: 0;` y
  `overflow: hidden;` para permitir que el título se trunque en vez
  de empujar/aplastar el selector cuando el nombre del chat es largo
  (hoy el badge era corto y fijo, así que este problema no existía;
  con el `model-btn` — potencialmente más ancho, con icono + nombre +
  chevron — sí puede aparecer en viewports estrechos).
- `.chat-header h2` (línea 23-31): añadir `min-width: 0;` y
  `overflow: hidden;` (mismo motivo — permitir que el hijo truncable
  se encoja).
- Nueva regla `.chat-title-text` (el `<span>` del título dentro del
  `h2`, ver punto 1.A):
  ```css
  .chat-title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  ```
- `.badge` (línea 37-45): sin cambios — se sigue usando tal cual para
  el caso Groq.

#### 3. `src/styles/model-selector.css`

- `.model-selector` (línea 55-57): añadir `flex-shrink: 0;` para que,
  dentro de `chat-header-left` (contenedor ahora encogible), el
  selector conserve su ancho natural y sea el título (`.chat-title-text`)
  el que se trunque, nunca el selector.
- `.model-dropdown` (línea 101-116): hoy usa `right: 0;` (línea 104),
  correcto cuando el botón está pegado al borde derecho del header
  (`chat-header-right`). Al vivir ahora cerca del borde **izquierdo**
  de la pantalla, un dropdown que se abre hacia la izquierda
  (`right: 0` desde un botón angosto) puede desbordar el viewport en
  pantallas estrechas. Añadir una regla contextual, sin tocar el
  comportamiento del `GroqModelSelector` (que sigue en
  `chat-header-right` con `right: 0` por defecto):
  ```css
  .chat-header-left .model-dropdown {
    left: 0;
    right: auto;
  }
  ```
- `.model-name` (línea 86-94): añadir, con el mismo scope contextual
  para no afectar a `GroqModelSelector` en la derecha:
  ```css
  .chat-header-left .model-name {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  ```
  Justificación: los ids de LM Studio pueden generar nombres largos
  tras `modelDisplayName()` (p. ej. `Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf`).
  Sin este límite, el botón podría crecer lo suficiente como para
  competir por espacio con el título incluso con el truncado del
  punto anterior.

### Estructura de componentes (sin componentes nuevos)

```
ChatHeader.tsx
 ├─ ProviderSelector     (sin cambios — chat-header-right)
 ├─ GroqModelSelector    (sin cambios de lógica — solo se renderiza
 │                         cuando provider === 'groq', en chat-header-right)
 └─ ModelSelector        (sin cambios de archivo/posición en el módulo;
                           SÍ cambia: (a) dónde se invoca — ahora en
                           chat-header-left cuando provider !== 'groq' —
                           y (b) ya no retorna null con models.length === 0)
```

### Flujo de datos (sin cambios respecto al `ModelSelector` actual)

```
1. ChatHeader monta ModelSelector dentro de chat-header-left
   (solo si provider !== 'groq')
2. ModelSelector.useEffect() → localStorage.getItem('selectedModel')
   → $selectedModel.set(saved) si existe (síncrono, primer render)
3. fetch('/api/models') → { models: string[] }
4. setModels(list); si no hay modelo válido persistido, autoselecciona
   (list.includes('gemma4') ? 'gemma4' : list[0]) → $selectedModel.set() + localStorage
5. Mientras list.length === 0: botón visible, deshabilitado, texto
   'gemma4' o el último modelo persistido — no null.
6. Usuario abre dropdown (solo si !loading) → selecciona modelo →
   $selectedModel.set(m) + localStorage.setItem(...)
7. useSendMessage.ts lee $selectedModel.get() sin cambios (fuera de alcance)
```

## Consideraciones técnicas

- **Rendimiento**: sin impacto — mismo número de requests
  (`GET /api/models` se sigue disparando una sola vez por montaje del
  componente; solo cambia su posición en el árbol, no su ciclo de
  vida). No se añade polling ni refetch.
- **Accesibilidad**:
  - Se preservan `aria-haspopup="listbox"`, `aria-expanded`,
    `role="listbox"`, `role="option"`, `aria-selected` ya presentes en
    `ModelSelector` — no se tocan.
  - Se añade `aria-disabled={loading}` en el `model-btn` mientras
    `models.length === 0`, comunicando el estado no interactivo a
    lectores de pantalla (mejora respecto al estado actual, que ni
    siquiera renderizaba el botón).
  - Truncar el título con `text-overflow: ellipsis` es solo visual;
    el texto completo sigue presente en el DOM (`<span className="chat-title-text">{title}</span>`),
    por lo que un lector de pantalla sigue anunciando el título
    completo. No hace falta `title="..."` adicional, pero es una
    mejora opcional no bloqueante si se quiere un tooltip nativo en
    hover para usuarios de mouse con títulos largos.
  - Nota no bloqueante (fuera de alcance de este cambio, ya existía
    antes): en viewports `< 640px`, `.model-name` se oculta
    (`display: none` heredado de la regla existente) y el botón queda
    solo con icono + chevron, sin `aria-label` propio que indique
    "selector de modelo" a un lector de pantalla en ese estado. Se
    documenta como mejora futura, no se corrige aquí para no ampliar
    el diff más allá de lo pedido.
- **SEO**: no aplica (UI de chat autenticada, sin indexación).
- **Layout/responsive**: los cambios en `chat-header.css` /
  `model-selector.css` (min-width: 0, truncado, flex-shrink, max-width
  del nombre) están acotados a evitar que el header se rompa cuando
  coinciden un título de chat largo + un id de modelo largo en
  viewports estrechos. El breakpoint existente `@media (min-width: 640px)`
  para `.model-name` / `.fav-text` / `.provider-name` no se modifica.

## Dependencias

Ninguna dependencia nueva.

## Plan de implementación

1. En `src/components/react/ChatHeader.tsx`, dentro de `ModelSelector`
   (líneas 137-201): quitar el `return null` de la línea 161, cambiar
   el fallback de `displayName` de `'—'` a `'gemma4'`, añadir
   `const loading = models.length === 0;`, aplicar `loading` al
   `onClick` del botón, a `aria-disabled`, y a la condición de render
   del `<ul className="model-dropdown">`.
2. En el mismo archivo, dentro de `ChatHeader()` (líneas 203-244):
   quitar `const selectedModel = useStore($selectedModel);` y el
   bloque `headerModelName`; añadir la clase `chat-title-text` al
   `<span>{title}</span>` del `h2`; reemplazar el `<span className="badge">`
   estático de `chat-header-left` por el condicional
   `provider === 'groq' ? <span className="badge">{selectedGroqModel || 'Groq'}</span> : <ModelSelector />`;
   cambiar `chat-header-right` para que renderice
   `{provider === 'groq' && <GroqModelSelector />}` en vez del
   ternario actual.
3. En `src/styles/chat-header.css`: añadir `min-width: 0; overflow: hidden;`
   a `.chat-header-left` y a `.chat-header h2`; añadir la nueva regla
   `.chat-title-text` con truncado por ellipsis.
4. En `src/styles/model-selector.css`: añadir `flex-shrink: 0;` a
   `.model-selector`; añadir las reglas contextuales
   `.chat-header-left .model-dropdown { left: 0; right: auto; }` y
   `.chat-header-left .model-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }`.
5. Verificación manual: alternar `provider` entre `local` y `groq` y
   confirmar que (a) nunca hay dos selectores/dropdowns visibles a la
   vez, (b) el badge Groq muestra texto estático correcto, (c) el
   dropdown local abre hacia la izquierda sin desbordar el viewport en
   una ventana angosta (~360px), (d) con un título de chat largo el
   título se trunca y el selector conserva su ancho e interactividad,
   (e) el estado `loading` (recién montado, antes de que resuelva
   `/api/models`) muestra el botón con `gemma4` (o el último modelo
   persistido) sin abrir dropdown al click.
6. `pnpm test` — no hay tests unitarios que cubran `ChatHeader.tsx`
   hoy (revisar `src/components/react/` en busca de `*.test.tsx` antes
   de dar por hecho que no aplica); si no existen, no se espera
   romper nada.
7. Pipeline QA estándar del proyecto: como se modifican
   `src/components/react/ChatHeader.tsx` (React) y `src/styles/*.css`,
   corresponde `quality → security → accessibility → performance → monitor`
   según la tabla de ejecución selectiva de `CLAUDE.md` (mezcla de
   componente + CSS).

## Alternativas consideradas

- **Extraer `ModelSelector` a su propio archivo** (p. ej.
  `src/components/react/ModelSelector.tsx`) antes de moverlo. Descartada:
  el encargo pide explícitamente no introducir nuevas abstracciones
  más allá de lo estrictamente necesario; mover solo el JSX dentro del
  mismo archivo logra el objetivo con un diff mínimo y sin tocar
  imports en otros componentes.
- **Mostrar el badge estático de Groq también como un mini-dropdown**
  (duplicando `GroqModelSelector` en la izquierda). Descartada por el
  propio encargo del usuario: `GroqModelSelector` se mantiene tal cual
  en `chat-header-right`; la izquierda para el caso Groq es solo texto,
  igual que el comportamiento actual.
- **Ocultar completamente el badge/selector cuando `provider === 'groq'`**
  (dejar el hueco vacío en vez de un badge estático). Descartada:
  rompe la simetría visual del header (el título quedaría solo,
  saltando de posición según el proveedor) y pierde información que
  hoy sí se muestra (nombre del modelo Groq activo).
- **Mantener `return null` en `ModelSelector` cuando `models.length === 0`**
  y aceptar el hueco visual transitorio. Descartada: al pasar a ser el
  único elemento junto al título (antes convivía con más elementos en
  la derecha), el hueco es mucho más visible y regresivo frente al
  comportamiento síncrono anterior (el badge estático siempre mostraba
  texto de inmediato).
- **Detectar overflow con JS (ResizeObserver) para truncar el título
  dinámicamente**. Descartada por complejidad innecesaria — CSS puro
  (`text-overflow: ellipsis` + `min-width: 0` en la cadena de flex
  containers) resuelve el mismo problema sin JavaScript adicional,
  alineado con la prioridad del proyecto de soluciones simples/estáticas.
