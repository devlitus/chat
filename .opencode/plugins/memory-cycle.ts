/**
 * Plugin: Memory Cycle — Ciclo de Memoria Determinista en 3 Capas
 *
 * Este plugin se ejecuta en el runtime de OpenCode, NO en el LLM.
 * Garantiza que el ciclo de memoria (init → log → promote → cleanup)
 * sea 100% determinista, sin depender de que el agente "recuerde".
 *
 * Eventos:
 * - session.created  → init: limpia session.md si >24h, promueve entradas
 * - session.idle     → promote + cleanup de seguridad
 * - session.compacting → inyecta session.md para que sobreviva
 *
 * Estructura de archivos:
 *   .agents/memory/session.md              ← corto plazo (24h)
 *   .agents/memory/inbox.md                ← medio plazo (1-2 sem)
 *   .agents/memory/long-term/*.md          ← largo plazo (todo el proyecto)
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ─── Constantes ───────────────────────────────────────────────

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;
const SESSION_MAX_AGE = MS_PER_DAY;      // session.md: 24 horas
const INBOX_MAX_AGE = MS_PER_DAY * 14;   // inbox.md: 14 días

// ─── Utilidades ───────────────────────────────────────────────

function getMemoryDir(directory: string) {
  return join(directory, ".agents", "memory");
}

function getLongTermDir(directory: string) {
  return join(getMemoryDir(directory), "long-term");
}

function getSessionPath(directory: string) {
  return join(getMemoryDir(directory), "session.md");
}

function getInboxPath(directory: string) {
  return join(getMemoryDir(directory), "inbox.md");
}

/** Asegura que la carpeta long-term/ existe */
function ensureLongTerm(directory: string) {
  const dir = getLongTermDir(directory);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Parsea entradas del formato:
 * ## [YYYY-MM-DD HH:MM] @agente | tipo
 *
 * Retorna array de entradas con su texto completo y timestamp
 */
function parseEntries(content: string): Array<{ timestamp: Date; text: string }> {
  const entries: Array<{ timestamp: Date; text: string }> = [];
  const regex = /^## \[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]\s.*(?:\n(?!## \[).*)*/gm;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const ts = new Date(match[1] + ":00"); // añadir segundos para ISO
    if (!isNaN(ts.getTime())) {
      entries.push({ timestamp: ts, text: match[0].trim() });
    }
  }

  return entries;
}

/**
 * Extrae el header (todo antes de "## Registro de sesión") de session.md
 */
function getSessionHeader(content: string): string {
  const idx = content.indexOf("## Registro de sesión");
  if (idx === -1) return content;
  return content.substring(0, idx + "## Registro de sesión".length);
}

/**
 * Actualiza el timestamp en el header de session.md
 */
function updateSessionTimestamp(header: string): string {
  const now = new Date().toISOString().replace("T", " ").substring(0, 16);
  return header.replace(
    /\*\*Timestamp inicio\*\*:.*/,
    `**Timestamp inicio**: ${now}`
  );
}

/** Determina el dominio long-term basado en palabras clave de la entrada */
function classifyEntry(entry: string): string | null {
  const lower = entry.toLowerCase();
  if (/css|tailwind|estilo|ui|responsive|layout|visual|color|fuente|z-index|accesibilidad|aria/.test(lower)) {
    return "ui_and_styling.md";
  }
  if (/rendimiento|performance|lento|cuello|botella|slow|big o|cache|memo|lazy/.test(lower)) {
    return "performance.md";
  }
  if (/seguridad|vulnerabilidad|cve|token|secreto|xss|inyección|owasp|sanitiz/.test(lower)) {
    return "security.md";
  }
  return null;
}

// ─── Operaciones del ciclo de memoria ─────────────────────────

/**
 * INIT: Se ejecuta en session.created
 * - Si session.md tiene >24h, promueve entradas y limpia
 */
function init(directory: string): string[] {
  const logs: string[] = [];
  const sessionPath = getSessionPath(directory);
  const inboxPath = getInboxPath(directory);
  ensureLongTerm(directory);

  if (!existsSync(sessionPath)) {
    logs.push("[memory-cycle] session.md no existe, se creará cuando el agente lo necesite");
    return logs;
  }

  const stats = statSync(sessionPath);
  const age = Date.now() - stats.mtimeMs;

  if (age < SESSION_MAX_AGE) {
    logs.push(`[memory-cycle] session.md vigente (${Math.round(age / MS_PER_HOUR)}h), no se limpia`);
    return logs;
  }

  logs.push(`[memory-cycle] session.md expirado (${Math.round(age / MS_PER_HOUR)}h), promoviendo entradas...`);

  const content = readFileSync(sessionPath, "utf-8");
  const header = getSessionHeader(content);
  const entries = parseEntries(content);

  if (entries.length === 0) {
    // No hay entradas, solo limpiar
    const newHeader = updateSessionTimestamp(header);
    writeFileSync(sessionPath, newHeader + "\n\n<!-- Los agentes añaden entradas aquí usando memory-cycle log -->\n", "utf-8");
    logs.push("[memory-cycle] Sin entradas que promover. session.md limpiado.");
    return logs;
  }

  for (const entry of entries) {
    const lower = entry.text.toLowerCase();

    // ¿Feature completada? → descartar
    if (/\*\*estado\*\*:\s*completado/i.test(entry.text)) {
      logs.push(`  ↳ Descartada (completada): ${entry.text.substring(0, 80)}...`);
      continue;
    }

    // ¿Lección permanente? → long-term/
    const domain = classifyEntry(entry.text);
    if (domain && (lower.includes("lección") || lower.includes("error") || lower.includes("descubrimiento"))) {
      const longTermPath = join(getLongTermDir(directory), domain);
      let ltContent = existsSync(longTermPath) ? readFileSync(longTermPath, "utf-8") : "";
      ltContent += `\n\n${entry.text}\n`;
      writeFileSync(longTermPath, ltContent, "utf-8");
      logs.push(`  ↳ Promovida a long-term/${domain}: ${entry.text.substring(0, 80)}...`);
      continue;
    }

    // ¿WIP o pendiente? → inbox.md
    let inboxContent = existsSync(inboxPath) ? readFileSync(inboxPath, "utf-8") : "";
    const section = lower.includes("error") || lower.includes("bug") ? "Bugs pendientes" : "Features en progreso";
    const sectionMarker = `## ${section}`;

    if (inboxContent.includes(sectionMarker)) {
      inboxContent = inboxContent.replace(sectionMarker, `${sectionMarker}\n\n${entry.text}\n`);
    } else {
      inboxContent += `\n\n${sectionMarker}\n\n${entry.text}\n`;
    }
    writeFileSync(inboxPath, inboxContent, "utf-8");
    logs.push(`  ↳ Movida a inbox.md > ${section}: ${entry.text.substring(0, 80)}...`);
  }

  // Limpiar session.md
  const newHeader = updateSessionTimestamp(header);
  writeFileSync(sessionPath, newHeader + "\n\n<!-- Los agentes añaden entradas aquí usando memory-cycle log -->\n", "utf-8");
  logs.push(`[memory-cycle] ${entries.length} entradas procesadas. session.md limpiado.`);

  return logs;
}

/**
 * CLEANUP: Elimina entradas caducadas de inbox.md (>14 días)
 */
function cleanup(directory: string): string[] {
  const logs: string[] = [];
  const inboxPath = getInboxPath(directory);

  if (!existsSync(inboxPath)) {
    return logs;
  }

  const content = readFileSync(inboxPath, "utf-8");
  const entries = parseEntries(content);

  if (entries.length === 0) {
    return logs;
  }

  const now = Date.now();
  const expired = entries.filter(e => (now - e.timestamp.getTime()) > INBOX_MAX_AGE);

  if (expired.length === 0) {
    return logs;
  }

  // Eliminar entradas expiradas del contenido
  let newContent = content;
  for (const exp of expired) {
    newContent = newContent.replace(exp.text, "");
  }

  // Limpiar líneas vacías múltiples
  newContent = newContent.replace(/\n{3,}/g, "\n\n").trim();

  writeFileSync(inboxPath, newContent + "\n", "utf-8");
  logs.push(`[memory-cycle] ${expired.length} entradas caducadas eliminadas de inbox.md`);

  return logs;
}

// ─── Plugin ───────────────────────────────────────────────────

export const MemoryCyclePlugin = async ({ directory }: { directory: string }) => {
  const log = (msgs: string[]) => {
    for (const msg of msgs) {
      console.log(msg);
    }
  };

  return {
    /**
     * session.created: INIT automático
     * Se dispara cuando OpenCode crea una nueva sesión.
     * Promueve entradas caducadas de session.md y lo limpia.
     */
    "session.created": async () => {
      try {
        const logs = init(directory);
        log(logs);
      } catch (err) {
        console.error("[memory-cycle] Error en session.created:", err);
      }
    },

    /**
     * session.idle: PROMOTE + CLEANUP de seguridad
     * Se dispara cuando el agente termina su turno.
     * Redundancia: promueve lo que quede y limpia inbox.md.
     */
    "session.idle": async () => {
      try {
        // Promote de seguridad (por si session.created no lo hizo)
        const promoteLogs = init(directory);
        log(promoteLogs);

        // Cleanup de inbox.md
        const cleanupLogs = cleanup(directory);
        log(cleanupLogs);
      } catch (err) {
        console.error("[memory-cycle] Error en session.idle:", err);
      }
    },

    /**
     * experimental.session.compacting: Inyecta session.md en compactación
     * Cuando OpenCode compacta la sesión (pérdida de contexto),
     * inyectamos session.md para que la memoria sobreviva.
     */
    "experimental.session.compacting": async (input: any, output: any) => {
      try {
        const sessionPath = getSessionPath(directory);
        if (existsSync(sessionPath)) {
          const content = readFileSync(sessionPath, "utf-8");
          const header = getSessionHeader(content);
          const entries = parseEntries(content);

          if (entries.length > 0) {
            output.context.push(
              `## 🧠 Memoria de sesión (preservada de compactación)\n\n` +
              `**Estado actual**:\n${header.split("## Registro")[0].trim()}\n\n` +
              `**Registro**:\n${entries.map(e => e.text).join("\n\n")}\n`
            );
          }
        }
      } catch (err) {
        console.error("[memory-cycle] Error en session.compacting:", err);
      }
    },
  };
};
