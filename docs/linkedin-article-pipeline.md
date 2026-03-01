# Borrador: Artículo LinkedIn — Pipeline de Multi-Agentes

> **Nota de uso**: Este es el borrador del artículo. Está escrito en español.
> Para LinkedIn en inglés, traduce las secciones principales.
> Longitud recomendada para LinkedIn: 1.200–1.800 palabras.

---

## Título (elige uno)

- **"Construí un equipo de 5 IAs que revisa mi código automáticamente — y cambió mi forma de trabajar"**
- **"Por qué dejé de revisar manualmente la calidad, seguridad y accesibilidad de mi código"**
- **"5 agentes de IA trabajando en cadena: así automaticé el QA de software"**

---

## Hook (primeras 2 líneas — lo que LinkedIn muestra antes del "ver más")

Configuré 5 agentes de IA para que trabajen en cadena después de cada implementación: uno revisa calidad, otro audita seguridad, otro verifica accesibilidad — y si encuentran problemas críticos, llaman al agente implementador para que los corrija.

Aquí está exactamente cómo lo construí y cómo puedes replicarlo.

---

## Cuerpo del artículo

### El problema que tenía

Cuando trabajas solo o en un equipo pequeño, el code review sufre. No por falta de ganas — sino porque revisar calidad de código, auditar seguridad OWASP y verificar accesibilidad WCAG en cada PR requiere tiempo, conocimiento especializado y, siendo honestos, no siempre tienes los tres al mismo tiempo.

El resultado habitual: o haces un review superficial, o ralentizas el ritmo de desarrollo, o simplemente omites partes enteras (y la accesibilidad suele ser la primera víctima).

Yo buscaba otra solución.

---

### La arquitectura: 5 agentes en cadena

Construí un pipeline de multi-agentes usando **Claude Code** como orquestador. El flujo completo es este:

```
planner → implementer → quality → security → accessibility
```

Cada agente es un archivo Markdown con instrucciones específicas, herramientas permitidas y un modelo asignado. Se comunican entre sí a través de archivos de reporte compartidos.

**Los 5 agentes:**

**1. Planner** — El arquitecto. Analiza el codebase, investiga buenas prácticas y escribe un documento de diseño antes de tocar una sola línea de código. No puede editar código fuente.

**2. Implementer** — El desarrollador. Toma el plan y lo implementa. Conoce el stack (Astro 5, React, TypeScript) y las convenciones del proyecto.

**3. Quality** — El tech lead. Después de cada implementación ejecuta automáticamente:
- `tsc --noEmit` para errores de TypeScript
- `pnpm build` para errores de compilación
- `pnpm test --reporter=verbose` para tests fallidos
- `pnpm test:coverage` para cobertura bajo el 70%

Si el build falla, emite una señal de **fail-fast** y el pipeline se detiene ahí. No tiene sentido auditar seguridad de código que no compila.

**4. Security** — El auditor. Corre dos tipos de análisis:
- **Determinista**: `pnpm audit` para CVEs en dependencias + 8 patrones de `grep` (secretos hardcodeados, `dangerouslySetInnerHTML`, `eval()`, SSRF, cookies inseguras...)
- **LLM**: razonamiento sobre OWASP Top 10, flujos de autenticación, configuración insegura

Lo determinista no se equivoca. El LLM aporta contexto y detecta lo que los patrones no pueden.

**5. Accessibility** — El especialista WCAG. Verifica HTML semántico, ARIA, navegación por teclado, contraste de colores y live regions para lectores de pantalla. Al terminar, genera un **pipeline-summary.md** consolidado con el veredicto final: `PASS`, `NEEDS_FIX` o `FAIL`.

---

### El ciclo de corrección: el detalle que lo hace útil

Un pipeline que solo reporta problemas no resuelve nada. Por eso añadí un ciclo de corrección automático:

```
implementer → QA → [NEEDS_FIX] → implementer (fixes) → QA → STOP
```

Si el pipeline-summary emite `NEEDS_FIX`, el agente implementer vuelve a entrar, corrige solo los problemas críticos, y los agentes QA relevantes re-ejecutan. Máximo 2 iteraciones para evitar loops infinitos.

---

### Tres decisiones de diseño que importan

**1. Herramientas deterministas + LLM, no solo LLM**

Los LLMs pueden equivocarse. `pnpm audit` no. La jerarquía es clara: un CVE encontrado por `audit` es un hecho irrefutable. Un hallazgo del análisis LLM es una opinión fundamentada. El reporte separa ambas fuentes explícitamente.

**2. Memoria persistente por agente**

Cada agente de QA mantiene su propio archivo de memoria entre sesiones. Con el tiempo, aprende: qué patrones son falsos positivos en este proyecto, qué archivos tienen problemas recurrentes, qué convenciones son específicas de este codebase. La primera ejecución es genérica; la décima es experta en tu proyecto.

**3. Ejecución selectiva**

Si solo cambiaste CSS, el agente security no se ejecuta. Si solo modificaste documentación, ningún agente QA corre. Una tabla de clasificación en el CLAUDE.md determina qué agentes son relevantes para cada tipo de cambio. Esto ahorra tokens y tiempo en cambios triviales.

---

### Lo que cambió en mi workflow

Antes, el proceso era: implementar → revisar yo mismo → esperar recordar que debía revisar accesibilidad → (a veces no hacerlo).

Ahora: implementar → pipeline automático → leer el `pipeline-summary.md` → ver el veredicto → actuar solo si hay críticos.

El cambio real no es que los agentes sean perfectos — no lo son. El cambio es que **el nivel mínimo de calidad subió**. Los problemas evidentes ya no llegan a revisión manual. Mi tiempo de revisión se concentra en lo que los agentes no pueden ver: lógica de negocio, experiencia de usuario, decisiones de arquitectura.

---

### Cómo replicarlo en tu proyecto

El sistema completo son 8 archivos:
- 5 archivos de agentes (`.claude/agents/`)
- 3 archivos de memoria inicial (`.claude/memory/`)
- Actualizaciones al `.gitignore` y `CLAUDE.md`

El stack que usé es Astro 5 + TypeScript, pero los agentes de security y accessibility son prácticamente agnósticos al framework. Solo el agente quality necesita adaptarse a tus comandos de build y test.

La guía técnica completa de replicación está en el repositorio: `docs/pipeline-replication-guide.md`.

---

### Lo que mejoraría a continuación

- **Performance tests**: agregar un agente que mida Lighthouse scores y Web Vitals
- **Visual regression**: comparar screenshots entre commits
- **Agente de documentación**: que detecte funciones públicas sin JSDoc y las documente automáticamente

---

### Conclusión

La inteligencia artificial no reemplaza el criterio técnico. Pero sí puede encargarse de las verificaciones repetibles, consistentes y aburridas — liberando tu atención para las decisiones que realmente requieren pensamiento humano.

Un equipo de 5 agentes trabajando en cadena no es magia. Es configuración, instrucciones claras y la combinación correcta de herramientas deterministas con razonamiento LLM.

Si construyes algo parecido o tienes preguntas sobre la implementación, cuéntame en los comentarios.

---

## Hashtags sugeridos

```
#InteligenciaArtificial #DesarrolloSoftware #DevTools #ClaudeAI #Automatización
#CalidadDeCodigo #Seguridad #Accesibilidad #AIAgents #SoftwareEngineering
```

## Imagen de portada sugerida

Diagrama del pipeline con las 5 cajitas en cadena y flechas entre ellas, sobre fondo oscuro. Puedes generarlo con cualquier herramienta de diagramas (Excalidraw, Mermaid, Figma).

```
┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌──────────┐    ┌───────────────┐
│ Planner │───▶│ Implementer │───▶│ Quality │───▶│ Security │───▶│ Accessibility │
└─────────┘    └─────────────┘    └─────────┘    └──────────┘    └───────────────┘
     📋               💻               🔍              🔒               ♿
  Diseña          Implementa       TypeScript      pnpm audit       WCAG 2.1
                                   Build           grep patterns    ARIA
                                   Tests           OWASP LLM        Semántica
```
