import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { APIRoute } from 'astro';

// Usar el directorio temporal nativo del sistema (Vercel permite escribir en /tmp)
const TEMP_DIR = path.join(os.tmpdir(), 'chat_temp');

async function cleanOldFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    for (const f of files) {
      if (f.startsWith('.')) continue;
      const filepath = path.join(TEMP_DIR, f);
      const stats = await fs.stat(filepath);
      // Older than 1 hour (3600000 ms)
      if (now - stats.mtimeMs > 3600000) {
        await fs.unlink(filepath).catch(() => {});
      }
    }
  } catch (e) {
    // Ignore errors if dir doesn't exist yet
  }
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});
    await cleanOldFiles();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ error: 'Invalid file upload' }), { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sanitize filename to prevent directory traversal
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const uniqueName = Date.now() + '_' + safeName;
    const savePath = path.join(TEMP_DIR, uniqueName);

    await fs.writeFile(savePath, buffer);

    return new Response(JSON.stringify({ success: true, filename: uniqueName }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
