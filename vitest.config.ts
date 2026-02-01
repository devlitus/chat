// vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Entorno DOM para tests que usan localStorage/IndexedDB
    environment: 'happy-dom',

    // Archivos de setup global
    setupFiles: ['./vitest.setup.ts'],

    // Patrón de archivos test
    include: ['src/**/*.test.ts'],

    // Excluir directorios innecesarios
    exclude: ['node_modules', 'dist', '.astro'],

    // Coverage (opcional, para futuro)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/**/*.test.ts',
        'vitest.config.ts',
        'vitest.setup.ts',
      ],
    },

    // Timeouts razonables
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
