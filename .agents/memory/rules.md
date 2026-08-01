# Reglas Generales y Lecciones Aprendidas

Reglas transversales que todos los agentes deben cumplir. Este archivo es lectura obligatoria al iniciar cualquier tarea.

---

## 🌿 Feature Branches (Obligatorio)

**Nunca se commitea directamente en `main`.** Cada tarea va en su propia rama.

| Prefijo | Uso | Agente responsable |
|---------|-----|-------------------|
| `feature/` | Nuevas funcionalidades | Nexus, Leo |
| `fix/` | Corrección de bugs | Félix |
| `refactor/` | Refactorización | Ada |
| `security/` | Parches de seguridad | Cipher |
| `chore/` | Mantenimiento/config | Cualquiera |

### Flujo estándar

```bash
git checkout main
git pull
git checkout -b <prefijo>/<nombre-en-kebab-case>
# ... hacer commits atómicos ...
# Al terminar, merge a main
```

---

## 📝 Conventional Commits (Obligatorio)

Todos los commits deben seguir el formato definido en `.agents/skills/conventional-commits.md`. El hook `commit-msg` rechazará cualquier commit que no cumpla el estándar.

---

## 🧠 Memoria (Obligatorio)

- Antes de cualquier tarea, leer los archivos de memoria relevantes en `.agents/memory/`.
- Si se descubre un error recurrente, **actualizar el archivo de memoria correspondiente** para que el equipo no lo repita.

---

## Lecciones Aprendidas

> *(Añadir aquí reglas descubiertas por Félix, Max u otros agentes tras resolver bugs o detectar patrones problemáticos)*
