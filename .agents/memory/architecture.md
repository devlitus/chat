# Memoria de Arquitectura (Agentes Leo y Ada)

## Lecciones Aprendidas y Reglas Activas
*(Añadir aquí reglas sobre patrones de diseño, estructura de carpetas, y decisiones core de Astro/Next.js)*

**🛑 Regla Estricta (Gestor de Paquetes - Package Manager)**: Es **CRÍTICO** respetar el gestor de paquetes inicial del proyecto. Si existe un `pnpm-lock.yaml`, TODOS los comandos (instalar, build, run) DEBEN ejecutarse con `pnpm`. Si existe un `package-lock.json`, DEBE usarse `npm`. JAMÁS mezclar gestores (ej. no correr `npm install` en un proyecto `pnpm`) ya que rompe las dependencias y la integración continua (CI/CD).

**🚀 Regla Aprendida (Vercel Build en Windows con pnpm)**: Al ejecutar el build con el adaptador `@astrojs/vercel`, `pnpm` intentará crear enlaces simbólicos (symlinks) a las dependencias en `.vercel/output/functions`. Esto fallará en Windows (`EPERM: operation not permitted`) a menos que Windows Developer Mode esté activado. Alternativa: Usar npm en lugar de pnpm o habilitar Developer Mode.
