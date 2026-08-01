# Skill: Conventional Commits — Formato Estándar de Commits

**Objetivo**: Todos los agentes del equipo Antigravity deben seguir este formato al hacer commits. Es lectura obligatoria antes de cualquier `git commit`.

---

## Formato

```
<tipo>(<alcance>): <descripción>

[cuerpo opcional]

[footer(s) opcional(es)]
```

### Reglas estrictas

1. **Tipo** obligatorio, en minúsculas, uno de los tipos permitidos.
2. **Alcance** opcional pero recomendado, en minúsculas, entre paréntesis (ej. `auth`, `ui`, `api`).
3. **Dos puntos** y un espacio después del alcance (o del tipo si no hay alcance).
4. **Descripción** en minúsculas, en imperativo presente ("añade", NO "añadido" ni "añadiendo").
5. **Sin punto final** en la descripción.
6. **Máximo 72 caracteres** en la línea de título (tipo + alcance + descripción).
7. **Línea en blanco** entre título y cuerpo (si hay cuerpo).
8. **Cuerpo** en párrafos, explicando el qué y por qué (no el cómo).
9. **Footer** para breaking changes (`BREAKING CHANGE:`) o issues (`Refs: #123`).

---

## Tipos permitidos

| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad (MINOR en semver) |
| `fix` | Corrección de bug (PATCH en semver) |
| `docs` | Solo cambios en documentación |
| `style` | Formato, punto y coma, espacios (no cambia lógica) |
| `refactor` | Refactorización sin cambios funcionales ni fixes |
| `perf` | Mejora de rendimiento |
| `test` | Añadir o corregir tests |
| `chore` | Tareas de mantenimiento, deps, config |
| `ci` | CI/CD pipelines, GitHub Actions |
| `build` | Sistema de build, webpack, vite, etc. |
| `security` | Fix de seguridad, actualización por CVE |
| `revert` | Revertir un commit anterior |

---

## Alcances comunes del proyecto

| Alcance | Área |
|---------|------|
| `agents` | Sistema multi-agente |
| `ui` | Componentes visuales |
| `api` | Endpoints y lógica de servidor |
| `chat` | Funcionalidad del chat |
| `db` | Base de datos y persistencia |
| `auth` | Autenticación y sesiones |
| `mcp` | Integración MCP |
| `build` | Configuración de build |
| `deps` | Dependencias |
| `memory` | Archivos de memoria (.agents/memory/) |
| `skills` | Skills del sistema (.agents/skills/) |

---

## Ejemplos

### ✅ Correctos

```
feat(chat): añade streaming de respuestas con groq-sdk
```

```
fix(ui): corrige desbordamiento de texto en mensajes largos

El contenedor del chat no aplicaba word-break en móviles,
causando que mensajes sin espacios rompieran el layout.
Se añade `break-words` de Tailwind al componente MessageBubble.
```

```
refactor(db): migra consultas a prepared statements

BREAKING CHANGE: La interfaz Database.query() ahora requiere
un segundo parámetro con los valores bindeados.
```

```
security(deps): actualiza dompurify a v3.3.2 por CVE-2025-0001
```

```
chore(agents): renombra orquestador a nexus y añade colores a subagentes
```

### ❌ Incorrectos

```
feat: añadido streaming.           ← punto final, no imperativo
Fix chat overflow                   ← mayúscula inicial, sin dos puntos
feat(chat): streaming              ← muy vago, no describe el cambio
arregla el bug del scroll           ← sin tipo
```

---

## Para los agentes

- **Cloe**: Eres la principal responsable de hacer commits. Sigue este formato sin excepción.
- **Félix**: Al arreglar bugs, usa `fix(<alcance>):`.
- **Ada**: Al refactorizar, usa `refactor(<alcance>):` o `perf(<alcance>):`.
- **Cipher**: Al parchear seguridad, usa `security(<alcance>):` o `fix(<alcance>):`.
- **Max, Leo, Nexus**: Si modifican archivos de configuración/memoria, usen `chore(<alcance>):` o `docs(<alcance>):`.

---

## Validación automática

Este proyecto usa **commitlint** con un hook pre-commit para validar cada mensaje. Si tu commit no sigue este formato, será **rechazado automáticamente** por Git.

**No intentes saltarte el hook.** Si tu mensaje es rechazado, corrígelo y vuelve a commitear.
