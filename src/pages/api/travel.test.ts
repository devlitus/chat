// src/pages/api/travel.test.ts
// Regresión: /api/travel debe respetar el `provider` enviado por el cliente
// (Local -> LM Studio vía fetch, Groq -> Groq SDK) y NUNCA usar local de forma
// forzada cuando el cliente pide "groq".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const groqCreateMock = vi.fn().mockResolvedValue({
  choices: [{
    message: {
      content: JSON.stringify({
        suggestions: [
          { id: '1', title: 'A', description: 'Descripción A larga', estimatedCost: '$100-$200 USD', highlights: ['h1', 'h2', 'h3'] },
          { id: '2', title: 'B', description: 'Descripción B larga', estimatedCost: '$100-$200 USD', highlights: ['h1', 'h2', 'h3'] },
          { id: '3', title: 'C', description: 'Descripción C larga', estimatedCost: '$100-$200 USD', highlights: ['h1', 'h2', 'h3'] },
        ],
      }),
    },
  }],
});

vi.mock('groq-sdk', () => {
  return {
    default: class MockGroq {
      chat = {
        completions: {
          create: groqCreateMock,
        },
      };
    },
  };
});

import { POST } from './travel';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/travel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  destination: 'Kyoto',
  budget: 'Standard',
  days: 3,
  interests: 'cultura',
};

describe('api/travel.ts - selección de proveedor', () => {
  beforeEach(() => {
    groqCreateMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('provider "groq" debe llamar al SDK de Groq, no al LLM local', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await POST({ request: makeRequest({ ...validBody, provider: 'groq' }) } as any);

    expect(response.status).toBe(200);
    expect(groqCreateMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('provider "local" (o ausente) debe llamar al LLM local, no a Groq', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              suggestions: [
                { id: '1', title: 'A', description: 'Descripción A larga', estimatedCost: '$100-$200 USD', highlights: ['h1', 'h2', 'h3'] },
                { id: '2', title: 'B', description: 'Descripción B larga', estimatedCost: '$100-$200 USD', highlights: ['h1', 'h2', 'h3'] },
                { id: '3', title: 'C', description: 'Descripción C larga', estimatedCost: '$100-$200 USD', highlights: ['h1', 'h2', 'h3'] },
              ],
            }),
          },
        }],
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const response = await POST({ request: makeRequest({ ...validBody, provider: 'local' }) } as any);

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(groqCreateMock).not.toHaveBeenCalled();
  });

  it('sin campo "provider" en el body debe usar local por defecto (no Groq)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{}' } }] }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await POST({ request: makeRequest(validBody) } as any);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(groqCreateMock).not.toHaveBeenCalled();
  });
});
