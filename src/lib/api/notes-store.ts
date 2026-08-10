// src/lib/api/notes-store.ts
// Notas persistentes del agente, guardadas en un archivo JSON en el servidor
// (AGENT_NOTES_FILE, por defecto ./data/notes.json). Las notas son de la app,
// no por usuario: el chat es anónimo y el API no recibe userId (instancia
// local single-user). En serverless (Vercel) el filesystem es efímero.
//
// Igual que file-tools.ts, los fallos se devuelven como strings "Error: ...".

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

const MAX_NOTES = 100;
const MAX_NOTE_CHARS = 32 * 1024;
const PREVIEW_CHARS = 80;

function notesFilePath(): string {
  return path.resolve(process.cwd(), process.env.AGENT_NOTES_FILE ?? import.meta.env.AGENT_NOTES_FILE ?? './data/notes.json');
}

async function readAll(): Promise<Note[]> {
  try {
    const raw = await fs.readFile(notesFilePath(), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n): n is Note =>
        n != null && typeof n === 'object' &&
        typeof (n as Note).id === 'string' &&
        typeof (n as Note).title === 'string' &&
        typeof (n as Note).content === 'string',
    );
  } catch {
    // Archivo inexistente o corrupto: empezar de cero.
    return [];
  }
}

async function writeAll(notes: Note[]): Promise<void> {
  const file = notesFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(notes, null, 2), 'utf-8');
  await fs.rename(tmp, file);
}

function findNote(notes: Note[], idOrTitle: string): Note | undefined {
  const needle = idOrTitle.toLowerCase();
  return notes.find(n => n.id === idOrTitle) ?? notes.find(n => n.title.toLowerCase() === needle);
}

export async function listNotes(): Promise<string> {
  const notes = await readAll();
  if (notes.length === 0) return 'No hay notas guardadas.';
  const lines = notes.map(n => {
    const preview = n.content.length > PREVIEW_CHARS ? `${n.content.slice(0, PREVIEW_CHARS)}…` : n.content;
    return `- [${n.id}] ${n.title} (actualizada ${n.updatedAt}): ${preview}`;
  });
  return `Notas guardadas (${notes.length}):\n${lines.join('\n')}`;
}

export async function getNote(args: Record<string, unknown>): Promise<string> {
  const idOrTitle = String(args.idOrTitle ?? '');
  if (!idOrTitle) return 'Error: idOrTitle es requerido.';
  const notes = await readAll();
  const note = findNote(notes, idOrTitle);
  if (!note) return `Error: no se encontró ninguna nota con id o título "${idOrTitle}".`;
  return `# ${note.title}\n(actualizada ${note.updatedAt}, id: ${note.id})\n\n${note.content}`;
}

export async function saveNote(args: Record<string, unknown>): Promise<string> {
  const title = String(args.title ?? '').trim();
  const content = String(args.content ?? '');
  if (!title) return 'Error: title es requerido.';
  if (!content) return 'Error: content es requerido.';
  if (content.length > MAX_NOTE_CHARS) {
    return `Error: la nota supera el límite de ${MAX_NOTE_CHARS} caracteres.`;
  }

  const notes = await readAll();
  const existing = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
  if (!existing && notes.length >= MAX_NOTES) {
    return `Error: se alcanzó el límite de ${MAX_NOTES} notas. Borra alguna antes de crear más.`;
  }

  const now = new Date().toISOString();
  if (existing) {
    existing.content = content;
    existing.updatedAt = now;
  } else {
    notes.push({ id: crypto.randomUUID(), title, content, updatedAt: now });
  }

  try {
    await writeAll(notes);
  } catch (e) {
    return `Error al guardar la nota: ${e instanceof Error ? e.message : 'unknown'}`;
  }
  return existing
    ? `Nota "${title}" actualizada correctamente.`
    : `Nota "${title}" guardada correctamente.`;
}

export async function deleteNote(args: Record<string, unknown>): Promise<string> {
  const idOrTitle = String(args.idOrTitle ?? '');
  if (!idOrTitle) return 'Error: idOrTitle es requerido.';
  const notes = await readAll();
  const note = findNote(notes, idOrTitle);
  if (!note) return `Error: no se encontró ninguna nota con id o título "${idOrTitle}".`;

  try {
    await writeAll(notes.filter(n => n.id !== note.id));
  } catch (e) {
    return `Error al borrar la nota: ${e instanceof Error ? e.message : 'unknown'}`;
  }
  return `Nota "${note.title}" borrada correctamente.`;
}
