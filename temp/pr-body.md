### 📝 Descripción
Esta PR refactoriza por completo el flujo de adjuntos de la aplicación. Pasa de un enfoque puramente simulado a una carga funcional que almacena la información temporalmente, mejora la interfaz visual y hace que los widgets (Chart) respondan inteligente y dinámicamente a los comandos del chat.

### 🚀 Cambios Principales

#### 1. Backend e Infraestructura Local (`/api`)
- **Nuevo Endpoint `/api/upload`**: Gestiona peticiones `multipart/form-data` para procesar archivos (`.csv`, `.xlsx`, `.xls`, `.pdf`) y guardarlos de manera segura en el directorio nativo `temp/`.
- **Limpieza Automática (Garbage Collection)**: El proceso de subida inspecciona el directorio y **purga automáticamente** cualquier fichero que tenga más de 60 minutos de vida, protegiendo el almacenamiento.
- **Nuevo Endpoint `/api/read-temp`**: Permite recuperar de forma asíncrona un bloque de registros del documento subido para inyectarlo al LLM solo en el momento en el que el usuario lo solicite.

#### 2. Lógica del Chat Diferido (`ChatInput.tsx`)
- **Estado Pendiente (`pendingFile`)**: Subir un fichero ya no lanza automáticamente un globo simulado. El fichero queda "acoplado" a la caja de texto.
- **Inyección de Contexto Oculto**: Al enviar el mensaje, si el modelo detecta que el usuario quiere datos (intención de "cálculo" o "gráfica"), el sistema hace una petición a `read-temp` y añade los registros al Contexto del Sistema.
- **Renderizado Dirigido**: Se fuerza estructuralmente al LLM a que genere sus sentencias terminando con `<chart-data>` para desplegar la UI interactiva.

#### 3. UX y Aspectos Visuales (`Layout.astro`, `MessageBubble.tsx`)
- **File Chips Nativos (CSS Puro)**: Cápsulas nativas para archivos flotantes sobre el input.
- **Attachments Ocultos en Burbujas**: Meta-texto extraído en el Frontend, renderizando a cambio pequeñas Cards minimalistas integradas con el look general.
