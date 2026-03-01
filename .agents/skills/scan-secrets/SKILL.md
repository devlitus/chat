---
description: Herramienta de escaneo de secretos (Regex) para el Agente Cipher
---

# Skill: Scan Secrets (Buscador de Credenciales)

**Propósito**: Esta skill te proporciona patrones Regex probados en la industria para buscar credenciales hardcodeadas en código fuente.

**Cómo usarla (Agente Cipher)**: 
Copia estos patrones y pásalos como argumento `Query` a tu herramienta `grep_search` asegurándote de usar `IsRegex: true`. Hazlo componente por componente o buscando por todo el directorio `src/`.

### Patrones Críticos para `grep_search`:

1. **Tokens de GitHub**:
   `gh[p|o|u|s|r]_[a-zA-Z0-9]{36}`
2. **Claves de AWS**:
   `(AKIA|A3T|AGPA|AIDA|ARO|AIP|ANP|ANV)[A-Z0-9]{16}`
3. **Claves OpenAI**:
   `sk-[a-zA-Z0-9]{48}`
4. **General Passwords/Secrets (Búsqueda heurística)**:
   `(?i)(password|secret|pwd|passphrase|token|key|api_key)['"\s]*[:=]['"\s]*[a-zA-Z0-9\-_]{8,}`

**Regla Anti-Falsos-Positivos**: Si `grep_search` encuentra coincidencias en archivos bajo `.agents/`, `.git/`, `.env.example`, omítelas. Solo bloquea el pase a producción si estas llaves están vivas dentro de la carpeta `src/`.
