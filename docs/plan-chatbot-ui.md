# Plan: UI del Chatbot

## Resumen

Implementar la interfaz visual completa de un chatbot con dark theme en Astro 5, replicando el diseno de referencia (`stitch_chatbot_interface/code.html`). Solo UI estatica, sin JavaScript del lado del cliente.

## Contexto

El proyecto Astro 5 actualmente tiene la plantilla por defecto (Welcome). Se necesita reemplazar con una interfaz de chatbot que incluye sidebar con historial, area de mensajes y campo de entrada. El diseno de referencia usa Tailwind pero este proyecto usa CSS scoped por componente.

## Paleta de colores (variables CSS)

| Token              | Valor     | Uso                          |
|--------------------|-----------|------------------------------|
| `--color-primary`  | `#2b8cee` | Botones, acentos, links      |
| `--color-bg`       | `#101922` | Fondo principal               |
| `--color-sidebar`  | `#111a22` | Fondo sidebar                 |
| `--color-border`   | `#233648` | Bordes                        |
| `--color-surface`  | `#1c2936` | Tarjetas, inputs, burbujas bot|
| `--color-surface-hover` | `#253646` | Hover en superficies     |
| `--color-text`     | `#ffffff` | Texto principal               |
| `--color-text-secondary` | `#94a3b8` | Texto secundario (slate-400) |
| `--color-text-muted` | `#64748b` | Texto apagado (slate-500)   |

## Tipografia

- **Fuente**: Inter (Google Fonts), weights 400, 500, 700, 800
- **Iconos**: Material Symbols Outlined (Google Fonts)

## Diseno propuesto

### Estructura de componentes

```text
src/
  layouts/
    Layout.astro            (modificar: agregar fuentes, variables CSS globales)
  pages/
    index.astro             (modificar: reemplazar Welcome por ChatLayout)
  components/
    ChatLayout.astro        (nuevo: contenedor flex con sidebar + main)
    Sidebar.astro           (nuevo: sidebar completo)
    SidebarHeader.astro     (nuevo: logo + boton menu)
    NewChatButton.astro     (nuevo: boton "New Chat")
    SearchInput.astro       (nuevo: campo busqueda historial)
    ChatHistoryList.astro   (nuevo: lista de chats agrupada por fecha)
    ChatHistoryItem.astro   (nuevo: item individual del historial)
    ChatHistoryGroup.astro  (nuevo: grupo con label de fecha)
    UserProfile.astro       (nuevo: footer sidebar con avatar y nombre)
    ChatHeader.astro        (nuevo: header del area principal)
    MessageArea.astro       (nuevo: contenedor scrollable de mensajes)
    MessageBot.astro        (nuevo: mensaje del bot con avatar)
    MessageUser.astro       (nuevo: mensaje del usuario con avatar)
    CodeBlock.astro         (nuevo: bloque de codigo con header y boton copy)
    MessageActions.astro    (nuevo: botones copy/refresh/thumbs en mensajes bot)
    SuggestionChips.astro   (nuevo: botones de sugerencia en mensajes bot)
    DateDivider.astro       (nuevo: separador de fecha centrado)
    ChatInput.astro         (nuevo: area de input con attach/mic/send)
```

### Archivos existentes a modificar

#### `src/layouts/Layout.astro`

- Agregar enlaces a Google Fonts (Inter + Material Symbols Outlined)
- Definir variables CSS custom en `:root`
- Agregar estilos globales: `box-sizing: border-box`, scrollbar custom, `font-family: 'Inter'`
- Configurar `body` con `overflow: hidden`, `height: 100vh`, color de fondo dark

#### `src/pages/index.astro`

- Reemplazar `<Welcome />` por `<ChatLayout />`
- Eliminar import de Welcome

### Archivos nuevos a crear

#### `src/components/ChatLayout.astro`

Contenedor principal con `display: flex` y `height: 100%`. Contiene `<Sidebar />` y `<main>` con `<ChatHeader />`, `<MessageArea />` y `<ChatInput />`.

#### `src/components/Sidebar.astro`

Aside de `width: 320px` con flex column. Contiene en orden:

- `<SidebarHeader />`
- `<NewChatButton />`
- `<SearchInput />`
- `<ChatHistoryList />`
- `<UserProfile />`

Estilos: fondo `--color-sidebar`, borde derecho `--color-border`.

#### `src/components/SidebarHeader.astro`

Flex row con:

- Icono `smart_toy` en cuadrado redondeado con fondo `primary/20`
- Texto "Chat AI" en bold
- Boton icono `menu_open`

#### `src/components/NewChatButton.astro`

Boton full-width con fondo `--color-primary`, texto blanco bold, icono `add`. Border-radius `8px`, height `40px`. Shadow con tono primary.

#### `src/components/SearchInput.astro`

Input con icono `search` a la izquierda. Fondo `--color-surface`, borde `--color-border`. Placeholder "Search history...". Focus: borde primary.

#### `src/components/ChatHistoryList.astro`

Contenedor scrollable (`flex: 1; overflow-y: auto`). Renderiza grupos con datos hardcoded:

- Grupo "Today": "React Component Design" (activo), "Debug Python Script"
- Grupo "Yesterday": "Marketing Copy Ideas", "Travel Itinerary Tokyo", "Gift Ideas for Mom"

Props para cada item: `title`, `active` (boolean).

#### `src/components/ChatHistoryGroup.astro`

Props: `label` (string). Renderiza un `<h3>` con estilo uppercase, text-xs, color muted.

#### `src/components/ChatHistoryItem.astro`

Props: `title` (string), `active` (boolean, default false).

- Si activo: fondo `#1f2e3d`, borde izquierdo primary, icono `chat_bubble`
- Si inactivo: fondo transparente, hover `white/5`, icono `chat_bubble_outline`

#### `src/components/UserProfile.astro`

Footer del sidebar con borde superior. Muestra:

- Avatar circular con gradiente purple-to-primary
- Nombre "Alex Doe", subtexto "Pro Plan"
- Icono `settings`

#### `src/components/ChatHeader.astro`

Header de 64px de alto. Flex between:

- Izquierda: icono `auto_awesome` (primary) + titulo "React Component Design" + badge "Model v4.0"
- Derecha: boton "Favorite Chats" con icono corazon + separador + boton "Sign In" primary

#### `src/components/DateDivider.astro`

Props: `text` (string). Pill centrada con fondo surface, texto muted, border sutil.

#### `src/components/MessageBot.astro`

Props: `name` (string), `time` (string). Slot para contenido.

Layout: flex row con gap. Avatar circular gradiente indigo-purple con icono `smart_toy`. Columna con nombre+hora y burbuja con fondo surface, bordes redondeados (esquina top-left recta).

#### `src/components/MessageUser.astro`

Props: `time` (string). Slot para contenido.

Layout: flex row-reverse. Avatar circular con imagen. Columna alineada a la derecha. Burbuja con fondo primary, esquina top-right recta.

#### `src/components/CodeBlock.astro`

Props: `filename` (string), `code` (string).

Contenedor con:

- Header: nombre archivo + boton "Copy" con icono
- Body: `<pre><code>` con fondo `--color-sidebar`, texto slate-300, overflow-x auto, font-mono

#### `src/components/MessageActions.astro`

Fila de botones iconos: `content_copy`, `refresh`, `thumb_up`, `thumb_down`. Color muted, hover blanco.

#### `src/components/SuggestionChips.astro`

Botones pill con icono + texto. Fondo sidebar, borde border-dark. Dos hardcoded: "Show Dropdown Code" y "Suggest Color Palettes".

#### `src/components/ChatInput.astro`

Contenedor sticky bottom. Contiene:

- Wrapper con fondo surface, borde, border-radius xl, focus-within borde primary
- Boton `attach_file` (izquierda)
- `<textarea>` con placeholder "Type a message..."
- Boton `mic` + boton `send` (primary, derecha)
- Texto disclaimer debajo: "AI can make mistakes..."

#### `src/components/MessageArea.astro`

Contenedor `flex: 1; overflow-y: auto; padding`. Contiene los mensajes hardcoded de la demo:

1. `<DateDivider text="Today, 10:23 AM" />`
2. `<MessageBot>` con saludo
3. `<MessageUser>` con peticion de componente dashboard
4. `<MessageBot>` con respuesta + CodeBlock + SuggestionChips + MessageActions

### Flujo de datos

No hay flujo de datos dinamico. Todo es contenido estatico hardcoded en los componentes. Los props se usan para reutilizabilidad y claridad, no para datos reales.

```text
Layout.astro
  └─ index.astro
       └─ ChatLayout.astro
            ├─ Sidebar.astro
            │    ├─ SidebarHeader.astro
            │    ├─ NewChatButton.astro
            │    ├─ SearchInput.astro
            │    ├─ ChatHistoryList.astro
            │    │    ├─ ChatHistoryGroup.astro (x2)
            │    │    └─ ChatHistoryItem.astro (x5)
            │    └─ UserProfile.astro
            └─ <main>
                 ├─ ChatHeader.astro
                 ├─ MessageArea.astro
                 │    ├─ DateDivider.astro
                 │    ├─ MessageBot.astro (x2)
                 │    │    ├─ CodeBlock.astro
                 │    │    ├─ SuggestionChips.astro
                 │    │    └─ MessageActions.astro
                 │    └─ MessageUser.astro (x1)
                 └─ ChatInput.astro
```

## Consideraciones tecnicas

### Rendimiento

- Sin JavaScript del cliente: todo es HTML/CSS estatico
- Google Fonts cargadas con `preconnect` para mejor rendimiento
- Material Symbols carga solo los weights necesarios
- Scrollbar custom solo via CSS (webkit)

### Accesibilidad

- Usar `<aside>` para sidebar, `<main>` para contenido, `<header>` para navegacion
- Atributos `title` en botones de solo icono
- Inputs con labels asociados (o `aria-label`)
- Contraste suficiente: texto blanco sobre fondos oscuros, primary sobre dark

### SEO

- No aplica significativamente (es una app de chat), pero mantener semantica HTML correcta
- `lang="es"` en el HTML
- Title descriptivo

### Responsive

- El diseno de referencia no es mobile-first. Para la primera version, implementar solo desktop (sidebar fija + main area)
- El textarea y area de mensajes se ajustan con `max-width: 768px` (3xl) centrado

## Dependencias

No se requieren paquetes nuevos. Solo recursos externos via CDN:

- Google Fonts Inter: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap`
- Material Symbols Outlined: `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap`

## Plan de implementacion

### Paso 1: Configurar Layout base

1. Modificar `src/layouts/Layout.astro`:
   - Agregar links a Google Fonts
   - Definir variables CSS custom en `:root`
   - Estilos globales (body, scrollbar, box-sizing, font-family)

### Paso 2: Crear estructura principal

1. Crear `src/components/ChatLayout.astro` (contenedor flex)
2. Modificar `src/pages/index.astro` (reemplazar Welcome por ChatLayout)

### Paso 3: Implementar Sidebar

1. Crear `src/components/SidebarHeader.astro`
2. Crear `src/components/NewChatButton.astro`
3. Crear `src/components/SearchInput.astro`
4. Crear `src/components/ChatHistoryGroup.astro`
5. Crear `src/components/ChatHistoryItem.astro`
6. Crear `src/components/ChatHistoryList.astro`
7. Crear `src/components/UserProfile.astro`
8. Crear `src/components/Sidebar.astro` (ensambla los anteriores)

### Paso 4: Implementar Header del chat

1. Crear `src/components/ChatHeader.astro`

### Paso 5: Implementar componentes de mensajes

1. Crear `src/components/DateDivider.astro`
2. Crear `src/components/MessageBot.astro`
3. Crear `src/components/MessageUser.astro`
4. Crear `src/components/CodeBlock.astro`
5. Crear `src/components/MessageActions.astro`
6. Crear `src/components/SuggestionChips.astro`

### Paso 6: Implementar area de mensajes

1. Crear `src/components/MessageArea.astro` (ensambla mensajes de demo)

### Paso 7: Implementar input

1. Crear `src/components/ChatInput.astro`

### Paso 8: Verificacion visual

1. Ejecutar `pnpm dev` y comparar con el screenshot de referencia
2. Ajustar espaciados, colores y detalles hasta coincidir

## Alternativas consideradas

### 1. Instalar Tailwind CSS

- **Descartada**: El proyecto explicitamente no usa framework CSS. Agregar Tailwind cambiaria las convenciones del proyecto. CSS scoped es suficiente para esta UI.

### 2. Un solo componente monolitico

- **Descartada**: Un archivo gigante seria dificil de mantener. La descomposicion en ~18 componentes sigue el patron Astro de componentes pequenos con estilos scoped.

### 3. CSS Modules o archivos CSS externos

- **Descartada**: Astro tiene soporte nativo para estilos scoped en `<style>`. No hay razon para agregar complejidad.

### 4. Descargar fuentes localmente

- **Descartada**: Para una UI estatica de demo, CDN de Google Fonts es mas simple. Si se necesita offline en el futuro, se pueden mover a `public/fonts/`.

### 5. Usar iconos SVG inline en vez de Material Symbols

- **Descartada**: Material Symbols simplifica mucho el desarrollo (solo se usa el nombre del icono). El peso extra de la fuente es aceptable para una aplicacion de chat.
