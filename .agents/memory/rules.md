# Memoria y Reglas de Proyecto (AI Memory)

Este archivo actúa como el "cerebro a largo plazo" de los agentes (Leo, Cloe y Max). 
Antes de proponer una solución o escribir código, **TODOS LOS AGENTES DEBEN LEER ESTE ARCHIVO**.

Si un agente (especialmente Max, el QA) descubre un error recurrente, una preferencia del usuario, o un nuevo patrón arquitectónico que funcionó bien, **debe añadirlo a esta lista** para que los demás agentes no vuelvan a cometer el mismo error en el futuro.

## 🧠 Lecciones Aprendidas y Reglas Activas:

* **Regla 1 (Ejemplo):** Siempre usar componentes de imagen del framework en lugar de tags `<img>` crudos.
* **Regla 2 (Ejemplo):** El color primario de la marca es `bg-blue-600`, no usar otros tonos de azul para botones principales.
* **🚀 Regla Aprendida (Agente Fixer):** Nunca importes imágenes en los archivos `.astro` (ej. `import img from '../assets/...'`) sin verificar usando `list_dir` que la imagen realmente existe en disco. Si falta una imagen, usa un fallback seguro o pídele permiso al usuario para generarla con la herramienta `generate_image`, ya que Astro fallará el Build por `[ImageNotFound]` si la ruta no resuelve.
* **📖 Principio de Conocimiento Verificado (Anti-Alucinaciones):** Cualquier agente (Leo, Cloe, Max, Félix, Ada, Cipher) tiene ESTRICTAMENTE PROHIBIDO implementar código basado en su memoria interna cuando se trate de APIs de frameworks (Astro, React, Vitest, Playwright, Tailwind, etc.) o librerías externas. **Acción Obligatoria:** ANTES de escribir el plan o el código, el agente DEBE usar herramientas de búsqueda (`search_web`), leer URLs oficiales (`read_url_content`) o usar herramientas nativas (ej. el servidor MCP `Astro docs`) para obtener la versión MÁS RECIENTE de la documentación. El agente debe mencionar brevemente en su respuesta qué documentación ha consultado.
* *(Los agentes añadirán nuevas reglas aquí a medida que trabajen y se equivoquen)*
