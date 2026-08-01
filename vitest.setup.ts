// vitest.setup.ts

import { beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// ============================================================
// Polyfill de localStorage para Node 22+ (que lo tiene nativo deshabilitado)
// ============================================================

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      get length() { return store.size; },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
    },
    writable: true,
    configurable: true,
  });
}

// ============================================================
// Mocks globales para APIs del navegador
// ============================================================

// Mock de crypto.randomUUID (usado en db.ts y session.ts)
let uuidCounter = 0;
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => {
      uuidCounter++;
      return `mock-uuid-${uuidCounter.toString().padStart(3, '0')}`;
    },
  },
  writable: true,
  configurable: true,
});

// ============================================================
// Reset de mocks entre tests
// ============================================================

beforeEach(() => {
  // Resetear contador de UUIDs
  uuidCounter = 0;

  // Limpiar localStorage (happy-dom lo provee)
  // Nota: en Node 22+, localStorage es una API nativa que requiere --localstorage-file
  // Usamos globalThis para evitar conflicto con el polyfill nativo
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }

  // Limpiar todas las bases de datos IndexedDB
  if (typeof indexedDB !== 'undefined') {
    // happy-dom provee un mock básico de indexedDB
    // Si da problemas, se puede usar fake-indexeddb en el futuro
  }

  // Limpiar todos los mocks de vitest
  vi.clearAllMocks();
});
