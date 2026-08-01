/**
 * Plugin: Commitlint Guard — Validación de Conventional Commits
 *
 * Define las reglas de Conventional Commits del proyecto Antigravity y las
 * aplica en dos capas:
 *
 * 1. **Intercepción en sesión** — `tool.execute.before` intercepta `git commit`
 *    ejecutado por cualquier agente y valida el mensaje antes de que llegue a git.
 *    Si no cumple, bloquea el comando y devuelve errores descriptivos.
 *
 * 2. **Inyección en contexto** — `experimental.chat.system.transform` inyecta
 *    un resumen de las reglas en el system prompt para que todos los agentes
 *    (Leo, Cloe, Félix, etc.) las conozcan sin necesidad de consultarlas.
 *
 * Reglas (consistentes con commitlint.config.js):
 * - Tipos permitidos: feat, fix, docs, style, refactor, perf, test, chore, ci, build, security, revert
 * - Subject mín. 10 caracteres
 * - Sin punto final en el subject
 * - Header máx. 72 caracteres
 * - Línea en blanco entre header y body
 * - Body máx. 100 caracteres por línea
 */

// ─── Constantes (mismas reglas que commitlint.config.js) ──────

export const COMMIT_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "chore",
  "ci",
  "build",
  "security",
  "revert",
] as const;

export type CommitType = (typeof COMMIT_TYPES)[number];

export const RULES = {
  types: COMMIT_TYPES as readonly string[],
  subjectMinLength: 10,
  headerMaxLength: 72,
  bodyMaxLineLength: 100,
} as const;

// ─── Validador ────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida un mensaje de commit contra las reglas de Conventional Commits.
 * Se usa tanto en el plugin (intercepción) como puede ser reutilizado
 * por otros plugins o scripts.
 */
export function validateCommitMessage(message: string): ValidationResult {
  const errors: string[] = [];
  const lines = message.split("\n");
  const header = lines[0];

  // ── Header: tipo(scope?): descripción ──
  const typeMatch = header.match(/^(\w+)(?:\([^)]*\))?!?:\s/);
  if (!typeMatch) {
    errors.push(
      `El mensaje no sigue el formato Conventional Commits. Usa: tipo(scope): descripción`
    );
  } else {
    const type = typeMatch[1];
    if (!RULES.types.includes(type)) {
      errors.push(
        `Tipo "${type}" no permitido. Tipos válidos: ${RULES.types.join(", ")}`
      );
    }

    // Validar subject (lo que va después de "tipo: ")
    const subject = header.substring(typeMatch[0].length);
    if (subject.length < RULES.subjectMinLength) {
      errors.push(
        `Descripción muy corta (${subject.length} chars). Mínimo ${RULES.subjectMinLength}.`
      );
    }

    // Sin punto final
    if (subject.endsWith(".")) {
      errors.push("La descripción no debe terminar con punto.");
    }

    // Validar header length
    if (header.length > RULES.headerMaxLength) {
      errors.push(
        `Header muy largo (${header.length} chars). Máximo ${RULES.headerMaxLength}.`
      );
    }
  }

  // ── Body: línea en blanco después del header ──
  if (lines.length > 1 && lines[1] !== "") {
    errors.push(
      "Debe haber una línea en blanco entre el header y el body."
    );
  }

  // ── Body: máximo 100 chars por línea ──
  for (let i = 2; i < lines.length; i++) {
    if (lines[i].length > RULES.bodyMaxLineLength) {
      errors.push(
        `Línea ${i + 1} del body muy larga (${lines[i].length} chars). Máximo ${RULES.bodyMaxLineLength}.`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extrae el mensaje de un comando `git commit -m "..."` o similares.
 * Soporta variantes como `git commit -m'mensaje'` y `git commit --message="..."`
 */
function extractCommitMessage(command: string): string | null {
  // git commit -m "mensaje"
  let match = command.match(/git\s+commit\s.*-m\s*"((?:[^"\\]|\\.)*)"/);
  if (match) return match[1];

  // git commit -m 'mensaje'
  match = command.match(/git\s+commit\s.*-m\s*'((?:[^'\\]|\\.)*)'/);
  if (match) return match[1];

  // git commit --message="mensaje"
  match = command.match(/git\s+commit\s.*--message\s*=\s*"((?:[^"\\]|\\.)*)"/);
  if (match) return match[1];

  // git commit --message='mensaje'
  match = command.match(/git\s+commit\s.*--message\s*=\s*'((?:[^'\\]|\\.)*)'/);
  if (match) return match[1];

  return null;
}

// ─── System prompt snippet ────────────────────────────────────

const COMMITLINT_PROMPT_SNIPPET = `
## Conventional Commits (obligatorio en este proyecto)

Cada commit DEBE seguir el formato **Conventional Commits**:

\`\`\`
tipo(scope): descripción breve

Cuerpo opcional con más detalles.
\`\`\`

**Tipos permitidos**: ${RULES.types.join(", ")}

**Reglas estrictas**:
- Descripción mín. ${RULES.subjectMinLength} caracteres
- Sin punto final en la descripción
- Header máx. ${RULES.headerMaxLength} caracteres
- Línea en blanco entre header y body
- Body máx. ${RULES.bodyMaxLineLength} caracteres por línea

**Ejemplos correctos**:
- \`feat(chat): agregar soporte para streaming de respuestas\`
- \`fix(auth): corregir validación de token expirado en middleware\`
- \`security(deps): actualizar dependencia groq-sdk a v0.37.0 por CVE-2026-1234\`
`.trim();

// ─── Plugin ───────────────────────────────────────────────────

export const CommitlintPlugin = async ({
  directory,
}: {
  directory: string;
}) => {
  return {
    /**
     * tool.execute.before: Intercepta `git commit` y valida el mensaje.
     *
     * Si el mensaje no cumple las reglas, se rechaza el comando
     * inyectando un error descriptivo en el output.
     */
    "tool.execute.before": async (input: any, output: any) => {
      // Solo interceptar comandos bash
      if (input.tool !== "bash") return;

      const cmd: string =
        output.args?.command || output.args?.cmd || "";
      if (!cmd.includes("git commit")) return;

      const message = extractCommitMessage(cmd);
      if (!message) {
        // No se pudo extraer el mensaje (p.ej. commit sin -m, editor interactivo)
        // No bloqueamos, dejamos que git maneje el flujo.
        return;
      }

      const result = validateCommitMessage(message);
      if (!result.valid) {
        const errorMsg =
          `\n❌ COMMITLINT: Commit rechazado — el mensaje no cumple las reglas:\n` +
          result.errors.map((e) => `  • ${e}`).join("\n") +
          `\n\nFormato requerido: tipo(scope): descripción` +
          `\nTipos válidos: ${RULES.types.join(", ")}` +
          `\nEjemplo: feat(chat): agregar soporte para streaming de respuestas\n`;

        // Bloquear el comando inyectando stderr + código de error
        // Mutamos output.args para que el comando falle con un mensaje claro.
        output.args.command = `echo ${JSON.stringify(errorMsg)} >&2 && exit 1`;
      }
    },

    /**
     * experimental.chat.system.transform: Inyecta las reglas de
     * Conventional Commits en el system prompt de todos los agentes.
     */
    "experimental.chat.system.transform": async (
      _input: any,
      output: any,
    ) => {
      if (typeof output.system === "string") {
        // Solo inyectar si no existe ya (evitar duplicados)
        if (!output.system.includes("Conventional Commits (obligatorio")) {
          output.system += `\n\n${COMMITLINT_PROMPT_SNIPPET}`;
        }
      } else if (Array.isArray(output.system)) {
        const alreadyInjected = output.system.some((m: any) =>
          typeof m === "string" &&
          m.includes("Conventional Commits (obligatorio"),
        );
        if (!alreadyInjected) {
          output.system.push({
            type: "text",
            text: COMMITLINT_PROMPT_SNIPPET,
          });
        }
      }
    },
  };
};
