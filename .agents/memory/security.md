# Memoria de Ciberseguridad (Agente Cipher)

## Lecciones Aprendidas y Reglas Activas (DevSecOps)

> **Regla Base Permanente**: Ningún Agente (ni Cloe ni Leo) tiene permitido escribir variables de entorno sensibles (API Keys, JWT Secrets, DB Passwords) directamente en archivos `.astro`, `.ts`, o `.js`. Siempre deben requerir un archivo `.env` o el uso de `import.meta.env`.

*(Añadir aquí reglas sobre vulnerabilidades descubiertas en el proyecto, librerías baneadas por CVEs, o excepciones de falsos positivos en el escáner de secretos)*
