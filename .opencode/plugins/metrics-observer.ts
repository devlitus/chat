/**
 * Plugin: Metrics Observer — Observabilidad Determinista de Agentes
 *
 * Se ejecuta en el runtime de OpenCode, NO en el LLM.
 * Captura métricas 100% deterministas sin depender de que el agente "recuerde".
 *
 * Eventos:
 * - session.created  → snapshot del estado inicial (git, agente, timestamp)
 * - session.idle     → diff vs snapshot, escribe métricas, agrega fingerprints
 *
 * Estructura de archivos:
 *   .agents/metrics/runs.json              ← histórico de ejecuciones (máx 30)
 *   .agents/metrics/patterns.json          ← fingerprints detectados
 *   .agents/metrics/tuning-proposals.md    ← propuestas para confianza ALTA
 *   .agents/metrics/queue/inbox/           ← métricas crudas pendientes
 *   .agents/metrics/queue/archive/         ← métricas ya procesadas
 *   .agents/metrics/queue/.current-state.json ← estado entre created→idle
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

// ─── Constantes ─────────────────────────────────────────────────

const MAX_RUNS = 30;
const CONFIDENCE_ALTA = 3;
const CONFIDENCE_MEDIA = 2;
const MS_PER_HOUR = 1000 * 60 * 60;
const ANOMALY_DURATION_FACTOR = 3; // >3x media → anomalía

// ─── Tipos ──────────────────────────────────────────────────────

interface SessionState {
  agent: string;
  branch: string;
  commit: string;
  timestamp_start: string;
  files_snapshot: string[];
}

interface MetricsRun {
  id: string;
  date: string;
  agent: string;
  branch: string;
  task_type: string;
  status: "PASS" | "FAIL" | "WARN";
  timestamp_start: string;
  timestamp_end: string;
  duration_ms: number;
  git: {
    commit_start: string;
    commit_end: string;
    files_changed: string[];
    insertions: number;
    deletions: number;
    has_diff: boolean;
  };
  session_logs: {
    entries_total: number;
    errors: number;
    decisions: number;
    fixes: number;
    wips: number;
    bloqueos: number;
    descubrimientos: number;
  };
  fingerprints: string[];
}

interface Pattern {
  fingerprint: string;
  agent: string;
  file: string | null;
  domain: string;
  description: string;
  category: "patron-recurrente" | "error-sistemico" | "mejora-oportunidad" | "regresion" | "hotspot";
  first_seen: string;
  last_seen: string;
  consecutive_runs: number;
  total_occurrences: number;
  status: "activo" | "resuelto";
  confidence: "BAJA" | "MEDIA" | "ALTA" | "RESUELTA";
}

interface RunsData {
  runs: MetricsRun[];
}

interface PatternsData {
  patterns: Pattern[];
}

// ─── Rutas ──────────────────────────────────────────────────────

function getMetricsDir(directory: string) {
  return join(directory, ".agents", "metrics");
}

function getQueueInbox(directory: string) {
  return join(getMetricsDir(directory), "queue", "inbox");
}

function getQueueArchive(directory: string) {
  return join(getMetricsDir(directory), "queue", "archive");
}

function getStatePath(directory: string) {
  return join(getMetricsDir(directory), "queue", ".current-state.json");
}

function getRunsPath(directory: string) {
  return join(getMetricsDir(directory), "runs.json");
}

function getPatternsPath(directory: string) {
  return join(getMetricsDir(directory), "patterns.json");
}

function getTuningPath(directory: string) {
  return join(getMetricsDir(directory), "tuning-proposals.md");
}

function getSessionPath(directory: string) {
  return join(directory, ".agents", "memory", "session.md");
}

function ensureDirs(directory: string) {
  for (const dir of [getMetricsDir(directory), getQueueInbox(directory), getQueueArchive(directory)]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// ─── Detección de agente ────────────────────────────────────────

function detectAgent(directory: string): string {
  const sessionPath = getSessionPath(directory);
  if (!existsSync(sessionPath)) return "unknown";

  const content = readFileSync(sessionPath, "utf-8");
  const match = content.match(/\*\*Último agente activo\*\*:\s*@?(\w+)/i);
  return match ? match[1].toLowerCase() : "unknown";
}

// ─── Git ────────────────────────────────────────────────────────

function git(command: string, directory: string): string {
  try {
    return execSync(`git ${command}`, {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
  } catch {
    return "";
  }
}

function getBranch(directory: string): string {
  return git("rev-parse --abbrev-ref HEAD", directory) || "unknown";
}

function getCommit(directory: string): string {
  return git("rev-parse HEAD", directory) || "";
}

function getFilesSnapshot(directory: string): string[] {
  const output = git("ls-files", directory);
  return output ? output.split("\n").filter(Boolean) : [];
}

// ─── Tipo de tarea ──────────────────────────────────────────────

function detectTaskType(branch: string): string {
  if (branch.startsWith("feature/")) return "feature";
  if (branch.startsWith("fix/")) return "fix";
  if (branch.startsWith("refactor/")) return "refactor";
  if (branch.startsWith("security/")) return "security";
  if (branch.startsWith("chore/")) return "chore";
  if (branch === "main" || branch === "master") return "main";
  return "other";
}

// ─── Parseo de session.md ───────────────────────────────────────

interface SessionLogSummary {
  entries_total: number;
  errors: number;
  decisions: number;
  fixes: number;
  wips: number;
  bloqueos: number;
  descubrimientos: number;
}

function parseSessionLogs(directory: string): SessionLogSummary {
  const sessionPath = getSessionPath(directory);
  if (!existsSync(sessionPath)) {
    return { entries_total: 0, errors: 0, decisions: 0, fixes: 0, wips: 0, bloqueos: 0, descubrimientos: 0 };
  }

  const content = readFileSync(sessionPath, "utf-8");
  const entries = content.match(/^## \[[\d-]+\s[\d:]+\]\s@?\w+\s\|\s(\w+)/gm);

  const summary: SessionLogSummary = {
    entries_total: entries ? entries.length : 0,
    errors: 0,
    decisions: 0,
    fixes: 0,
    wips: 0,
    bloqueos: 0,
    descubrimientos: 0,
  };

  if (entries) {
    for (const entry of entries) {
      const tipo = entry.split("|")[1]?.trim().toLowerCase() || "";
      if (tipo === "error") summary.errors++;
      if (tipo === "decisión" || tipo === "decision") summary.decisions++;
      if (tipo === "fix") summary.fixes++;
      if (tipo === "wip") summary.wips++;
      if (tipo === "bloqueo") summary.bloqueos++;
      if (tipo === "descubrimiento") summary.descubrimientos++;
    }
  }

  return summary;
}

// ─── Extracción de fingerprints ─────────────────────────────────

function extractFingerprints(run: MetricsRun, directory: string): string[] {
  const fps: string[] = [];
  const agent = run.agent;
  const date = run.date;

  // Fingerprint por cada archivo modificado (hotspot tracking)
  for (const file of run.git.files_changed) {
    fps.push(`${agent}:${file}:file-modified`);
  }

  // Fingerprint si no hubo cambios (sesión sin output)
  if (!run.git.has_diff) {
    fps.push(`${agent}:global:sesion-sin-cambios`);
  }

  // Fingerprints de errores desde session.md
  const sessionPath = getSessionPath(directory);
  if (existsSync(sessionPath)) {
    const content = readFileSync(sessionPath, "utf-8");
    const errorEntries = content.match(/^## \[[\d-]+\s[\d:]+\]\s@?\w+\s\|\s*error.*(?:\n(?!## \[).*)*/gim);
    if (errorEntries) {
      for (const entry of errorEntries) {
        // Intentar extraer archivo del error
        const fileMatch = entry.match(/\*\*Archivos\*\*:\s*(.+)/i);
        const archivo = fileMatch ? fileMatch[1].trim() : "global";
        const slug = entry
          .replace(/^## \[[\d-]+\s[\d:]+\]\s@?\w+\s\|\s*error\s*/i, "")
          .split("\n")[0]
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9áéíóúñ\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 60);

        const archivoSlug = archivo.replace(/\//g, "-").replace(/\./g, "-");
        fps.push(`${agent}:${archivoSlug}:error-${slug || "desconocido"}`);
      }
    }
  }

  // Fingerprint si hay errores detectados
  if (run.session_logs.errors > 0) {
    fps.push(`${agent}:global:sesion-con-errores`);
  }

  // Fingerprint por duración anómala (se evalúa en agregación)
  fps.push(`${agent}:global:duration-${run.duration_ms}`);

  return [...new Set(fps)]; // deduplicar
}

// ─── Agregación: runs.json ──────────────────────────────────────

function loadRuns(directory: string): RunsData {
  const path = getRunsPath(directory);
  if (!existsSync(path)) return { runs: [] };
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { runs: [] };
  }
}

function saveRuns(directory: string, data: RunsData) {
  writeFileSync(getRunsPath(directory), JSON.stringify(data, null, 2), "utf-8");
}

function appendRun(directory: string, run: MetricsRun) {
  const data = loadRuns(directory);
  data.runs.push(run);
  // Trim a máximo 30
  if (data.runs.length > MAX_RUNS) {
    data.runs = data.runs.slice(-MAX_RUNS);
  }
  saveRuns(directory, data);
}

// ─── Agregación: patterns.json ──────────────────────────────────

function loadPatterns(directory: string): PatternsData {
  const path = getPatternsPath(directory);
  if (!existsSync(path)) return { patterns: [] };
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { patterns: [] };
  }
}

function savePatterns(directory: string, data: PatternsData) {
  writeFileSync(getPatternsPath(directory), JSON.stringify(data, null, 2), "utf-8");
}

function slugifyDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 60);
}

function getDomainFromFingerprint(fp: string): string {
  if (fp.includes(":error-")) return "quality";
  if (fp.includes(":sesion-sin-cambios")) return "productivity";
  if (fp.includes(":sesion-con-errores")) return "quality";
  if (fp.includes(":file-modified")) return "hotspot";
  if (fp.includes(":duration-")) return "performance";
  return "general";
}

function updatePatterns(directory: string, run: MetricsRun, currentFingerprints: string[]) {
  const data = loadPatterns(directory);
  const today = run.date;

  // Marcar todos como "no vistos" primero
  const fpsSet = new Set(currentFingerprints);

  // Actualizar existentes
  for (const pattern of data.patterns) {
    if (fpsSet.has(pattern.fingerprint)) {
      pattern.consecutive_runs += 1;
      pattern.total_occurrences += 1;
      pattern.last_seen = today;
      pattern.status = "activo";
      // Recalcular confianza
      if (pattern.consecutive_runs >= CONFIDENCE_ALTA) pattern.confidence = "ALTA";
      else if (pattern.consecutive_runs >= CONFIDENCE_MEDIA) pattern.confidence = "MEDIA";
      else pattern.confidence = "BAJA";
      fpsSet.delete(pattern.fingerprint);
    } else {
      // No visto en este run
      if (pattern.status === "activo") {
        pattern.consecutive_runs = 0;
        pattern.status = "resuelto";
        pattern.confidence = "RESUELTA";
        pattern.last_seen = today;
      }
    }
  }

  // Crear nuevos para fingerprints no vistos
  for (const fp of fpsSet) {
    const parts = fp.split(":");
    const agent = parts[0] || run.agent;
    const archivo = parts.length > 2 && parts[1] !== "global" ? parts[1] : null;
    const domain = getDomainFromFingerprint(fp);

    // No crear pattern para métricas normales (file-modified, duration aislado)
    if (fp.includes(":file-modified") || fp.includes(":duration-")) continue;

    data.patterns.push({
      fingerprint: fp,
      agent,
      file: archivo,
      domain,
      description: fp.replace(/:/g, " — ").replace(/-/g, " "),
      category: fp.includes(":error-") ? "patron-recurrente" : "mejora-oportunidad",
      first_seen: today,
      last_seen: today,
      consecutive_runs: 1,
      total_occurrences: 1,
      status: "activo",
      confidence: "BAJA",
    });
  }

  // Limpiar patterns resueltos antiguos (>10 runs inactivos)
  data.patterns = data.patterns.filter(p => {
    if (p.status === "resuelto" && p.consecutive_runs === 0) {
      // Mantener resueltos recientes, eliminar antiguos
      const daysSinceLast = (new Date(today).getTime() - new Date(p.last_seen).getTime()) / 86400000;
      return daysSinceLast < 30;
    }
    return true;
  });

  savePatterns(directory, data);
}

// ─── Agregación: tuning-proposals.md ────────────────────────────

function updateTuningProposals(directory: string) {
  const patterns = loadPatterns(directory);
  const altaPatterns = patterns.patterns.filter(p => p.confidence === "ALTA" && p.status === "activo");

  const tuningPath = getTuningPath(directory);
  const today = new Date().toISOString().split("T")[0];

  let content = `# Propuestas de Ajuste de Agentes

*Última actualización: ${today}*
*Generado automáticamente por el plugin metrics-observer. Ningún LLM involucrado.*

---

`;

  if (altaPatterns.length === 0) {
    content += `## Sin patrones de confianza ALTA

No hay patrones con 3+ runs consecutivos activos. El sistema está estable.

`;
  } else {
    content += `## 🔴 Patrones de Confianza ALTA (≥3 runs consecutivos)

`;

    for (const p of altaPatterns) {
      content += `## [PENDIENTE] ${p.agent} — ${p.description.substring(0, 60)}
**Fingerprint**: \`${p.fingerprint}\`
**Confianza**: ALTA (${p.consecutive_runs} runs consecutivos desde ${p.first_seen})
**Dominio**: ${p.domain}
**Archivo afectado**: ${p.file || "global"}
**Categoría**: ${p.category}
**Acción sugerida**: Revisar \`.agents/memory/long-term/\` y \`.opencode/agents/${p.agent}.md\` para verificar si este patrón requiere un ajuste en las instrucciones del agente.
---
`;
    }
  }

  // Sección de patrones en observación (MEDIA)
  const mediaPatterns = patterns.patterns.filter(p => p.confidence === "MEDIA" && p.status === "activo");
  if (mediaPatterns.length > 0) {
    content += `\n## 🟡 Patrones en Observación (MEDIA, 2 runs consecutivos)\n\n`;
    for (const p of mediaPatterns) {
      content += `- \`${p.fingerprint}\` — ${p.description.substring(0, 80)}\n`;
    }
  }

  // Resumen de resueltos
  const resueltos = patterns.patterns.filter(p => p.status === "resuelto");
  if (resueltos.length > 0) {
    content += `\n## ✅ Patrones Resueltos (${resueltos.length})\n\n`;
    content += `${resueltos.length} patrones se resolvieron en ejecuciones anteriores.\n\n`;
  }

  writeFileSync(tuningPath, content, "utf-8");
}

// ─── Operaciones del plugin ─────────────────────────────────────

function snapshot(directory: string): string[] {
  const logs: string[] = [];
  ensureDirs(directory);

  const agent = detectAgent(directory);
  const branch = getBranch(directory);
  const commit = getCommit(directory);
  const filesSnapshot = getFilesSnapshot(directory);
  const now = new Date().toISOString();

  const state: SessionState = {
    agent,
    branch,
    commit,
    timestamp_start: now,
    files_snapshot: filesSnapshot,
  };

  writeFileSync(getStatePath(directory), JSON.stringify(state, null, 2), "utf-8");

  logs.push(`[metrics-observer] Snapshot creado: agente=${agent}, rama=${branch}, commit=${commit.substring(0, 7)}`);
  return logs;
}

function computeAndAggregate(directory: string): string[] {
  const logs: string[] = [];
  ensureDirs(directory);

  // Leer estado del snapshot
  const statePath = getStatePath(directory);
  if (!existsSync(statePath)) {
    logs.push("[metrics-observer] No hay snapshot previo, saltando métricas");
    return logs;
  }

  let state: SessionState;
  try {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    logs.push("[metrics-observer] Estado corrupto, saltando métricas");
    return logs;
  }

  // Validar antigüedad del snapshot (máx 24h)
  const startTime = new Date(state.timestamp_start).getTime();
  if (Date.now() - startTime > 24 * MS_PER_HOUR) {
    logs.push("[metrics-observer] Snapshot demasiado antiguo (>24h), descartando");
    try { execSync(`rm "${statePath}"`, { cwd: directory }); } catch { /* ok */ }
    return logs;
  }

  const now = new Date();
  const timestamp_end = now.toISOString();
  const duration_ms = now.getTime() - startTime;

  // Git diff
  const commitEnd = getCommit(directory);
  let filesChanged: string[] = [];
  let insertions = 0;
  let deletions = 0;

  if (state.commit && commitEnd && state.commit !== commitEnd) {
    const diffName = git(`diff --name-only ${state.commit} ${commitEnd}`, directory);
    filesChanged = diffName ? diffName.split("\n").filter(Boolean) : [];

    const numstat = git(`diff --numstat ${state.commit} ${commitEnd}`, directory);
    if (numstat) {
      for (const line of numstat.split("\n")) {
        const parts = line.split("\t");
        insertions += parseInt(parts[0]) || 0;
        deletions += parseInt(parts[1]) || 0;
      }
    }
  }

  // También revisar archivos unstaged
  const unstaged = git("diff --name-only", directory);
  if (unstaged) {
    const unstagedFiles = unstaged.split("\n").filter(Boolean);
    for (const f of unstagedFiles) {
      if (!filesChanged.includes(f)) filesChanged.push(f);
    }
  }

  const sessionLogs = parseSessionLogs(directory);

  // Construir run
  const runId = `${timestamp_end.replace("T", "T").substring(0, 19)}-${state.agent}`;
  const run: MetricsRun = {
    id: runId,
    date: timestamp_end.split("T")[0],
    agent: state.agent,
    branch: state.branch,
    task_type: detectTaskType(state.branch),
    status: sessionLogs.errors > 0 ? "WARN" : "PASS",
    timestamp_start: state.timestamp_start,
    timestamp_end,
    duration_ms,
    git: {
      commit_start: state.commit,
      commit_end: commitEnd,
      files_changed: filesChanged,
      insertions,
      deletions,
      has_diff: filesChanged.length > 0 || insertions > 0 || deletions > 0,
    },
    session_logs: sessionLogs,
    fingerprints: [],
  };

  // Extraer fingerprints y completar el run
  run.fingerprints = extractFingerprints(run, directory);

  // Escribir a queue inbox
  const queueFile = join(getQueueInbox(directory), `${timestamp_end.replace(/[:.]/g, "")}-${state.agent}.json`);
  writeFileSync(queueFile, JSON.stringify(run, null, 2), "utf-8");
  logs.push(`[metrics-observer] Métricas crudas → ${queueFile}`);

  // Agregar a runs.json
  appendRun(directory, run);
  logs.push(`[metrics-observer] Run ${runId} agregado a runs.json (total: ${loadRuns(directory).runs.length})`);

  // Actualizar patterns
  updatePatterns(directory, run, run.fingerprints);
  logs.push(`[metrics-observer] Patterns actualizados (${loadPatterns(directory).patterns.length} patrones)`);

  // Actualizar tuning proposals
  updateTuningProposals(directory);
  logs.push(`[metrics-observer] Tuning proposals actualizados`);

  // Archivar el queue file procesado
  const archiveFile = join(getQueueArchive(directory), `${timestamp_end.replace(/[:.]/g, "")}-${state.agent}.json`);
  try {
    renameSync(queueFile, archiveFile);
  } catch {
    // Si falla el rename, el archivo ya estaba en inbox (no es crítico)
  }

  // Limpiar estado
  try { execSync(`rm "${statePath}"`, { cwd: directory }); } catch { /* ok */ }

  // Inyectar anomalías en session.md si aplica
  injectAnomalies(directory, run, logs);

  return logs;
}

// ─── Inyección de anomalías en session.md ───────────────────────

function injectAnomalies(directory: string, run: MetricsRun, logs: string[]) {
  // Solo inyectar si hay anomalías detectables
  const anomalies: string[] = [];

  // Anomalía: sesión sin cambios en archivos
  if (!run.git.has_diff && run.agent !== "nexus") {
    anomalies.push(`⚠️ \`${run.agent}\`: sesión sin cambios en archivos (${run.duration_ms}ms)`);
  }

  // Anomalía: errores detectados
  if (run.session_logs.errors > 0) {
    anomalies.push(`⚠️ \`${run.agent}\`: ${run.session_logs.errors} error(es) registrados en session.md`);
  }

  // Anomalía: duración anormalmente larga (>5min)
  if (run.duration_ms > 300000) {
    const minutos = Math.round(run.duration_ms / 60000);
    anomalies.push(`⚠️ \`${run.agent}\`: sesión anormalmente larga (${minutos}min)`);
  }

  if (anomalies.length === 0) return;

  // Leer session.md
  const sessionPath = getSessionPath(directory);
  if (!existsSync(sessionPath)) return;

  let content = readFileSync(sessionPath, "utf-8");

  // Verificar si ya tiene una sección de anomalías
  const anomaliaSection = "## ⚠️ Anomalías detectadas (plugin)";
  if (content.includes(anomaliaSection)) {
    // Actualizar sección existente
    content = content.replace(
      new RegExp(`${anomaliaSection}[\\s\\S]*?(?=\\n## |$)`),
      `${anomaliaSection}\n\n${anomalies.join("\n")}\n`
    );
  } else {
    // Insertar después de "## Estado actual"
    const estadoIdx = content.indexOf("## Registro de sesión");
    if (estadoIdx > 0) {
      content = content.substring(0, estadoIdx) +
        `${anomaliaSection}\n\n${anomalies.join("\n")}\n\n` +
        content.substring(estadoIdx);
    } else {
      content += `\n\n${anomaliaSection}\n\n${anomalies.join("\n")}\n`;
    }
  }

  writeFileSync(sessionPath, content, "utf-8");
  logs.push(`[metrics-observer] ${anomalies.length} anomalía(s) inyectada(s) en session.md`);
}

// ─── Plugin ─────────────────────────────────────────────────────

export const MetricsObserverPlugin = async ({ directory }: { directory: string }) => {
  const log = (msgs: string[]) => {
    for (const msg of msgs) {
      console.log(msg);
    }
  };

  return {
    /**
     * session.created: Snapshot del estado inicial
     */
    "session.created": async () => {
      try {
        const logs = snapshot(directory);
        log(logs);
      } catch (err) {
        console.error("[metrics-observer] Error en session.created:", err);
      }
    },

    /**
     * session.idle: Computar métricas, agregar, detectar patrones
     */
    "session.idle": async () => {
      try {
        const logs = computeAndAggregate(directory);
        log(logs);
      } catch (err) {
        console.error("[metrics-observer] Error en session.idle:", err);
      }
    },
  };
};
