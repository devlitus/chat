// src/lib/api/tools.test.ts

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { executeTool } from './tools';

describe('tools - web_search (depende de Tavily)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('devuelve un mensaje claro si TAVILY_API_KEY no esta configurado', async () => {
    vi.stubEnv('TAVILY_API_KEY', '');
    const result = await executeTool('web_search', { query: 'test' });
    expect(result).toContain('Error: TAVILY_API_KEY no está configurado.');
  });

  // Regresion: mismo bug que en research-tools.ts/webSearchDeep - el fetch a
  // Tavily no estaba envuelto en try/catch, por lo que un fallo de red hacia
  // Tavily escapaba de executeTool() como una excepcion sin manejar en vez de
  // devolver un string descriptivo.
  it('no lanza excepcion cuando Tavily falla por red; devuelve mensaje descriptivo', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'fake-key');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    const result = await executeTool('web_search', { query: 'test' });
    expect(result).toContain('Error en búsqueda web: fetch failed');
  });
});


describe('tools - archivos del workspace', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-workspace-'));
    vi.stubEnv('AGENT_WORKSPACE_DIR', tmpDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('write_file + read_file hacen roundtrip', async () => {
    const write = await executeTool('write_file', { path: 'hola.txt', content: 'hola mundo' });
    expect(write).toContain('hola.txt');
    expect(write).not.toContain('Error');

    const read = await executeTool('read_file', { path: 'hola.txt' });
    expect(read).toContain('hola mundo');
  });

  it('write_file con append anexa al contenido existente', async () => {
    await executeTool('write_file', { path: 'log.txt', content: 'linea1\n' });
    await executeTool('write_file', { path: 'log.txt', content: 'linea2\n', append: true });

    const read = await executeTool('read_file', { path: 'log.txt' });
    expect(read).toContain('linea1');
    expect(read).toContain('linea2');
  });

  it('write_file crea directorios intermedios', async () => {
    const result = await executeTool('write_file', { path: 'docs/notas/idea.md', content: 'idea' });
    expect(result).not.toContain('Error');
    const content = await fs.readFile(path.join(tmpDir, 'docs/notas/idea.md'), 'utf-8');
    expect(content).toBe('idea');
  });

  it('rechaza path traversal fuera del sandbox', async () => {
    const result = await executeTool('read_file', { path: '../../etc/passwd' });
    expect(result).toContain('fuera del workspace');

    const write = await executeTool('write_file', { path: '../escape.txt', content: 'x' });
    expect(write).toContain('fuera del workspace');
  });

  it('read_file de archivo inexistente devuelve error claro', async () => {
    const result = await executeTool('read_file', { path: 'no-existe.txt' });
    expect(result).toContain('Error: no existe el archivo');
  });

  it('read_file rechaza binarios', async () => {
    await fs.writeFile(path.join(tmpDir, 'bin.dat'), Buffer.from([0x89, 0x00, 0x50]));
    const result = await executeTool('read_file', { path: 'bin.dat' });
    expect(result).toContain('binario');
  });

  it('list_files muestra los archivos creados', async () => {
    await executeTool('write_file', { path: 'a.txt', content: 'a' });
    await executeTool('write_file', { path: 'sub/b.txt', content: 'b' });

    const result = await executeTool('list_files', {});
    expect(result).toContain('a.txt');
    expect(result).toContain('sub/');
    expect(result).toContain('sub/b.txt');
  });
});

describe('tools - notas persistentes', () => {
  let tmpDir: string;
  let notesFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-notes-'));
    notesFile = path.join(tmpDir, 'notes.json');
    vi.stubEnv('AGENT_NOTES_FILE', notesFile);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('save_note crea una nota y read_note la devuelve', async () => {
    const save = await executeTool('save_note', { title: 'color favorito', content: 'azul' });
    expect(save).toContain('guardada correctamente');

    const read = await executeTool('read_note', { idOrTitle: 'color favorito' });
    expect(read).toContain('azul');
  });

  it('save_note actualiza una nota existente con el mismo titulo (upsert)', async () => {
    await executeTool('save_note', { title: 'color favorito', content: 'azul' });
    const update = await executeTool('save_note', { title: 'Color Favorito', content: 'verde' });
    expect(update).toContain('actualizada correctamente');

    const list = await executeTool('list_notes', {});
    expect(list).toContain('(1)');

    const read = await executeTool('read_note', { idOrTitle: 'color favorito' });
    expect(read).toContain('verde');
    expect(read).not.toContain('azul');
  });

  it('list_notes sin notas devuelve mensaje de vacio', async () => {
    const result = await executeTool('list_notes', {});
    expect(result).toContain('No hay notas guardadas');
  });

  it('delete_note borra la nota', async () => {
    await executeTool('save_note', { title: 'temporal', content: 'borrame' });
    const del = await executeTool('delete_note', { idOrTitle: 'temporal' });
    expect(del).toContain('borrada correctamente');

    const list = await executeTool('list_notes', {});
    expect(list).toContain('No hay notas guardadas');
  });

  it('read_note y delete_note de nota inexistente devuelven error claro', async () => {
    expect(await executeTool('read_note', { idOrTitle: 'nada' })).toContain('Error: no se encontró');
    expect(await executeTool('delete_note', { idOrTitle: 'nada' })).toContain('Error: no se encontró');
  });

  it('rechaza notas que superan el limite de tamano', async () => {
    const result = await executeTool('save_note', { title: 'grande', content: 'x'.repeat(33 * 1024) });
    expect(result).toContain('Error: la nota supera el límite');
  });
});
