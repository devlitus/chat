// vitest.setup.ts

import { beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

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
  localStorage.clear();

  // Limpiar todas las bases de datos IndexedDB
  if (typeof indexedDB !== 'undefined') {
    // happy-dom provee un mock básico de indexedDB
    // Si da problemas, se puede usar fake-indexeddb en el futuro
  }

  // Limpiar todos los mocks de vitest
  vi.clearAllMocks();
});
