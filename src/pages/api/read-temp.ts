import fs from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';

const TEMP_DIR = path.resolve('./temp');

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get('file');

    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return new Response(JSON.stringify({ error: 'Invalid filename' }), { status: 400 });
    }

    const filepath = path.join(TEMP_DIR, filename);
    const content = await fs.readFile(filepath, 'utf-8');

    return new Response(JSON.stringify({ content }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'File not found or unreadable' }), { status: 404 });
  }
};
