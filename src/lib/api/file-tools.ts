// src/lib/api/file-tools.ts
// Herramientas de archivos para el agente del chat, confinadas a un directorio
// sandbox (AGENT_WORKSPACE_DIR, por defecto ./workspace). Todas las funciones
// devuelven strings con prefijo "Error: " en caso de fallo para que el modelo
// pueda recuperarse, siguiendo el patrón de tools.ts.
//
// Limitación conocida: en despliegues serverless (Vercel) el filesystem es
// efímero y el contenido no persiste entre invocaciones. Pensado para el
// adapter Node (uso local / servidor propio).

import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_READ_BYTES = 64 * 1024;
const MAX_WRITE_CHARS = 256 * 1024;
const MAX_LIST_ENTRIES = 200;
const MAX_LIST_DEPTH = 3;

// Leído en cada llamada (no cacheado al importar) para que los tests puedan
// redefinirlo con vi.stubEnv.
function workspaceRoot(): string {
  return path.resolve(process.cwd(), process.env.AGENT_WORKSPACE_DIR ?? import.meta.env.AGENT_WORKSPACE_DIR ?? './workspace');
}

function resolveSafePath(relPath: string): string | { error: string } {
  if (!relPath || relPath.includes('\0')) {
    return { error: 'Error: path es requerido y no puede contener bytes nulos.' };
  }
  const root = workspaceRoot();
  const resolved = path.resolve(root, relPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return { error: `Error: la ruta "${relPath}" está fuera del workspace permitido.` };
  }
  return resolved;
}

export async function listFiles(args: Record<string, unknown>): Promise<string> {
  const subdir = args.subdir != null ? String(args.subdir) : '.';
  const resolved = resolveSafePath(subdir);
  if (typeof resolved !== 'string') return resolved.error;

  const root = workspaceRoot();
  await fs.mkdir(root, { recursive: true });

  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    return `Error: no existe "${subdir}" en el workspace.`;
  }
  if (!stat.isDirectory()) return `Error: "${subdir}" no es un directorio.`;

  const entries: string[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > MAX_LIST_DEPTH || entries.length >= MAX_LIST_ENTRIES) return;
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (entries.length >= MAX_LIST_ENTRIES) return;
      if (item.name.startsWith('.')) continue;
      const full = path.join(dir, item.name);
      const rel = path.relative(root, full);
      if (item.isDirectory()) {
        entries.push(`${rel}/`);
        await walk(full, depth + 1);
      } else if (item.isFile()) {
        const s = await fs.stat(full);
        entries.push(`${rel} (${s.size} bytes, modificado ${s.mtime.toISOString()})`);
      }
    }
  };

  try {
    await walk(resolved, subdir === '.' ? 1 : 2);
  } catch (e) {
    return `Error al listar archivos: ${e instanceof Error ? e.message : 'unknown'}`;
  }

  if (entries.length === 0) return 'El workspace está vacío.';
  const truncated = entries.length >= MAX_LIST_ENTRIES ? '\n[listado truncado]' : '';
  return `Archivos en el workspace (${subdir}):\n${entries.map(e => `- ${e}`).join('\n')}${truncated}`;
}

export async function readFile(args: Record<string, unknown>): Promise<string> {
  const relPath = String(args.path ?? '');
  const resolved = resolveSafePath(relPath);
  if (typeof resolved !== 'string') return resolved.error;

  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    return `Error: no existe el archivo "${relPath}".`;
  }
  if (!stat.isFile()) return `Error: "${relPath}" no es un archivo regular.`;
  if (stat.size > MAX_READ_BYTES) {
    return `Error: "${relPath}" ocupa ${stat.size} bytes y supera el límite de ${MAX_READ_BYTES} bytes por lectura.`;
  }

  const buffer = await fs.readFile(resolved);
  if (buffer.includes(0)) {
    return `Error: "${relPath}" parece un archivo binario; solo se pueden leer archivos de texto.`;
  }
  return buffer.toString('utf-8');
}

export async function writeFile(args: Record<string, unknown>): Promise<string> {
  const relPath = String(args.path ?? '');
  const content = String(args.content ?? '');
  const append = args.append === true;

  const resolved = resolveSafePath(relPath);
  if (typeof resolved !== 'string') return resolved.error;
  if (!content) return 'Error: content es requerido.';
  if (content.length > MAX_WRITE_CHARS) {
    return `Error: el contenido supera el límite de ${MAX_WRITE_CHARS} caracteres.`;
  }

  try {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    if (append) {
      await fs.appendFile(resolved, content, 'utf-8');
    } else {
      await fs.writeFile(resolved, content, 'utf-8');
    }
  } catch (e) {
    return `Error al escribir el archivo: ${e instanceof Error ? e.message : 'unknown'}`;
  }

  const bytes = Buffer.byteLength(content, 'utf-8');
  return `Archivo "${relPath}" ${append ? 'actualizado (anexado)' : 'escrito'} correctamente (${bytes} bytes).`;
}
