// src/pages/api/chat.test.ts

import { describe, it, expect, vi } from 'vitest';
import { POST } from './chat';

// Mock de Groq SDK (no queremos hacer llamadas reales)
vi.mock('groq-sdk', () => {
  return {
    default: class MockGroq {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            async *[Symbol.asyncIterator]() {
              yield { choices: [{ delta: { content: 'Hola' } }] };
              yield { choices: [{ delta: { content: ' mundo' } }] };
            },
          }),
        },
      };
    },
  };
});

describe('api/chat.ts - Validación', () => {
  describe('POST', () => {
    it('debe retornar 400 si no hay messages', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST({ request } as any);

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('Messages array is required or has invalid format');
    });

    it('debe retornar 400 si messages está vacío', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });

      const response = await POST({ request } as any);

      expect(response.status).toBe(400);
    });

    it('debe retornar 400 si message tiene formato inválido', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'invalid', content: 'test' }],
        }),
      });

      const response = await POST({ request } as any);

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('Messages array is required or has invalid format');
    });

    it('debe retornar 400 si falta content', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user' }],
        }),
      });

      const response = await POST({ request } as any);

      expect(response.status).toBe(400);
    });

    it('debe retornar stream si el request es válido', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hola' }],
        }),
      });

      const response = await POST({ request } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('debe validar que role sea user o assistant', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Msg 1' },
            { role: 'system', content: 'Msg 2' }, // Inválido
          ],
        }),
      });

      const response = await POST({ request } as any);

      expect(response.status).toBe(400);
    });
  });
});
