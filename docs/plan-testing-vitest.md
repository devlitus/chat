# Plan de Testing con Vitest - Chat AI (MVP)

## Resumen

Plan pragmático para agregar Vitest y tests imprescindibles al proyecto de chat. Prioriza testear lógica crítica (funciones puras) sobre componentes UI. Configuración mínima y rápida, ideal para MVP.

---

## Índice

1. [Dependencias a Instalar](#1-dependencias-a-instalar)
2. [Archivos de Configuración](#2-archivos-de-configuración)
3. [Actualizar tsconfig.json](#3-actualizar-tsconfigjson)
4. [Scripts de package.json](#4-scripts-de-packagejson)
5. [Estructura de Tests](#5-estructura-de-tests)
6. [Tests a Crear](#6-tests-a-crear)
7. [Orden de Implementación](#7-orden-de-implementación)
8. [Comandos de Testing](#8-comandos-de-testing)

---

## 1. Dependencias a Instalar

### 1.1 Comando de instalación

```bash
pnpm add -D vitest happy-dom @vitest/ui
```

### 1.2 Justificación de las dependencias

| Paquete | Propósito | Alternativa descartada |
|---|---|---|
| `vitest` | Test runner compatible con Vite/Astro | Jest (más lento, requiere configuración compleja) |
| `happy-dom` | Entorno DOM ligero para tests | jsdom (más pesado, más lento) |
| `@vitest/ui` | Interfaz visual opcional para desarrollo | - |

**Nota**: NO se instala React Testing Library porque NO testeamos componentes React en el MVP.

---

## 2. Archivos de Configuración

### 2.1 `vitest.config.ts`

Crear en la raíz del proyecto.

```typescript
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
```

**Decisiones clave**:
- `environment: 'happy-dom'` porque es 2-3x más rápido que jsdom y suficiente para localStorage/IndexedDB
- `setupFiles: ['./vitest.setup.ts']` para mocks globales de APIs del navegador
- `include: ['src/**/*.test.ts']` para tests co-localizados (junto al código fuente)
- Naming estándar: `*.test.ts` (no `*.spec.ts`) por convención del ecosistema Vite

---

### 2.2 `vitest.setup.ts`

Crear en la raíz del proyecto. Proporciona mocks y helpers globales.

```typescript
// vitest.setup.ts

import { beforeEach, vi } from 'vitest';

// ============================================================
// Mocks globales para APIs del navegador
// ============================================================

// Mock de crypto.randomUUID (usado en db.ts y session.ts)
let uuidCounter = 0;
global.crypto = {
  randomUUID: () => {
    uuidCounter++;
    return `mock-uuid-${uuidCounter.toString().padStart(3, '0')}`;
  },
} as Crypto;

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
```

**Decisiones clave**:
- Mock determinista de `crypto.randomUUID()` para tests predecibles
- `beforeEach` limpia estado entre tests (evita contaminación)
- happy-dom provee localStorage/indexedDB básicos (suficiente para MVP)
- Si IndexedDB da problemas, agregar `fake-indexeddb` después (no ahora)

---

### 2.3 `src/lib/test-helpers.ts` (Opcional, crear si es necesario)

Helpers reutilizables para tests de IndexedDB.

```typescript
// src/lib/test-helpers.ts

import type { Chat, Message } from './db';

/**
 * Espera a que una base de datos IndexedDB esté lista
 */
export async function waitForDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Elimina una base de datos IndexedDB (útil para tests)
 */
export async function deleteDB(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Crea un chat de prueba con valores predefinidos
 */
export function createMockChat(overrides?: Partial<Chat>): Chat {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'Test Chat',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    ...overrides,
  };
}

/**
 * Crea un mensaje de prueba con valores predefinidos
 */
export function createMockMessage(
  chatId: string,
  overrides?: Partial<Message>
): Message {
  return {
    id: crypto.randomUUID(),
    chatId,
    role: 'user',
    content: 'Test message',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```

**Decisiones clave**:
- Helpers para simplificar creación de datos de prueba
- Funciones para limpiar/resetear IndexedDB entre tests
- Solo se crea si los tests se vuelven repetitivos (principio DRY)

---

## 3. Actualizar tsconfig.json

Modificar el archivo existente para agregar tipos de Vitest.

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [
    ".astro/types.d.ts",
    "**/*"
  ],
  "exclude": [
    "dist"
  ],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "types": ["vitest/globals"]
  }
}
```

**Cambios**:
- Agregar `"types": ["vitest/globals"]` para tener `describe`, `it`, `expect` sin importar

**Nota**: Si aparece conflicto de tipos, quitar `vitest/globals` e importar explícitamente en cada test:
```typescript
import { describe, it, expect } from 'vitest';
```

---

## 4. Scripts de package.json

Agregar scripts de testing al archivo existente.

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Nuevos scripts**:
- `pnpm test` - Ejecuta todos los tests una vez (CI/CD)
- `pnpm test:watch` - Modo watch para desarrollo (re-ejecuta al guardar)
- `pnpm test:ui` - Abre interfaz visual en el navegador
- `pnpm test:coverage` - Genera reporte de cobertura (requiere configurar provider)

---

## 5. Estructura de Tests

### 5.1 Ubicación de tests

**Co-localizados** (junto al código que testean):

```
src/
  lib/
    db.ts
    db.test.ts           ← Tests de CRUD IndexedDB
    session.ts
    session.test.ts      ← Tests de sesión localStorage
    markdown.ts
    markdown.test.ts     ← Tests de renderizado Markdown
    groq-client.ts       ← NO testear (requiere mock de fetch)
    test-helpers.ts      ← Helpers reutilizables (crear si es necesario)
  pages/
    api/
      chat.ts
      chat.test.ts       ← Tests de validación API
```

**Ventajas de co-localización**:
- Tests junto al código facilita encontrarlos
- Refactors más fáciles (mover archivo = mover test)
- Estándar en proyectos Vite/Vitest

---

### 5.2 Naming y estructura de cada test

Patrón estándar:

```typescript
// src/lib/ejemplo.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { funcionATestear } from './ejemplo';

describe('nombreDelModulo', () => {
  beforeEach(() => {
    // Setup específico de este módulo
  });

  describe('nombreDeLaFuncion', () => {
    it('debe hacer X cuando Y', () => {
      // Arrange
      const input = ...;

      // Act
      const result = funcionATestear(input);

      // Assert
      expect(result).toBe(...);
    });

    it('debe lanzar error cuando condición inválida', () => {
      expect(() => funcionATestear(invalidInput)).toThrow();
    });
  });
});
```

**Convenciones**:
- 1 `describe` por módulo (nivel superior)
- 1 `describe` por función/característica
- Tests descriptivos en español (consistente con el código)
- Patrón AAA: Arrange, Act, Assert

---

## 6. Tests a Crear

### 6.1 `src/lib/db.test.ts` - Tests CRUD IndexedDB (PRIORIDAD ALTA)

**Funciones críticas a testear**:

```typescript
// src/lib/db.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createChat,
  getChat,
  getAllChats,
  updateChat,
  deleteChat,
  searchChats,
  addMessage,
  getMessagesByChatId,
  type Chat,
  type Message,
} from './db';

describe('db.ts - IndexedDB CRUD', () => {
  // Helper local para limpiar la DB entre tests
  beforeEach(async () => {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) {
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase(db.name!);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }
  });

  describe('createChat', () => {
    it('debe crear un chat con título por defecto', async () => {
      const chat = await createChat();

      expect(chat.id).toMatch(/^mock-uuid-\d+$/);
      expect(chat.title).toBe('Nuevo chat');
      expect(chat.messageCount).toBe(0);
      expect(chat.createdAt).toBeTruthy();
      expect(chat.updatedAt).toBe(chat.createdAt);
    });

    it('debe crear un chat con título personalizado', async () => {
      const chat = await createChat('Mi chat custom');

      expect(chat.title).toBe('Mi chat custom');
    });

    it('debe persistir el chat en IndexedDB', async () => {
      const chat = await createChat('Persistente');
      const retrieved = await getChat(chat.id);

      expect(retrieved).toEqual(chat);
    });
  });

  describe('getChat', () => {
    it('debe retornar undefined si el chat no existe', async () => {
      const result = await getChat('id-inexistente');

      expect(result).toBeUndefined();
    });

    it('debe retornar el chat si existe', async () => {
      const created = await createChat('Test');
      const retrieved = await getChat(created.id);

      expect(retrieved).toEqual(created);
    });
  });

  describe('getAllChats', () => {
    it('debe retornar array vacío si no hay chats', async () => {
      const chats = await getAllChats();

      expect(chats).toEqual([]);
    });

    it('debe retornar todos los chats ordenados por updatedAt desc', async () => {
      const chat1 = await createChat('Primero');

      // Pequeña espera para garantizar timestamp diferente
      await new Promise(resolve => setTimeout(resolve, 10));

      const chat2 = await createChat('Segundo');

      const chats = await getAllChats();

      expect(chats).toHaveLength(2);
      expect(chats[0].id).toBe(chat2.id); // Más reciente primero
      expect(chats[1].id).toBe(chat1.id);
    });
  });

  describe('updateChat', () => {
    it('debe actualizar el título de un chat', async () => {
      const chat = await createChat('Original');
      const updated = await updateChat(chat.id, { title: 'Actualizado' });

      expect(updated.title).toBe('Actualizado');
      expect(updated.id).toBe(chat.id);
      expect(updated.createdAt).toBe(chat.createdAt);
    });

    it('debe actualizar messageCount', async () => {
      const chat = await createChat();
      const updated = await updateChat(chat.id, { messageCount: 5 });

      expect(updated.messageCount).toBe(5);
    });

    it('debe lanzar error si el chat no existe', async () => {
      await expect(
        updateChat('id-inexistente', { title: 'Test' })
      ).rejects.toThrow('Chat id-inexistente not found');
    });
  });

  describe('deleteChat', () => {
    it('debe eliminar un chat sin mensajes', async () => {
      const chat = await createChat();

      await deleteChat(chat.id);

      const retrieved = await getChat(chat.id);
      expect(retrieved).toBeUndefined();
    });

    it('debe eliminar un chat y sus mensajes asociados', async () => {
      const chat = await createChat();
      await addMessage(chat.id, 'user', 'Mensaje 1');
      await addMessage(chat.id, 'assistant', 'Respuesta 1');

      await deleteChat(chat.id);

      const messages = await getMessagesByChatId(chat.id);
      expect(messages).toHaveLength(0);
    });
  });

  describe('searchChats', () => {
    it('debe retornar todos los chats si query está vacío', async () => {
      await createChat('Chat A');
      await createChat('Chat B');

      const results = await searchChats('');

      expect(results).toHaveLength(2);
    });

    it('debe filtrar chats por título (case insensitive)', async () => {
      await createChat('JavaScript Tutorial');
      await createChat('Python Basics');
      await createChat('JavaScript Advanced');

      const results = await searchChats('javascript');

      expect(results).toHaveLength(2);
      expect(results.every(c => c.title.toLowerCase().includes('javascript'))).toBe(true);
    });

    it('debe retornar array vacío si no hay coincidencias', async () => {
      await createChat('Chat A');

      const results = await searchChats('xyz');

      expect(results).toEqual([]);
    });
  });

  describe('addMessage', () => {
    it('debe agregar un mensaje de usuario', async () => {
      const chat = await createChat();
      const message = await addMessage(chat.id, 'user', 'Hola');

      expect(message.chatId).toBe(chat.id);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hola');
      expect(message.id).toMatch(/^mock-uuid-\d+$/);
      expect(message.createdAt).toBeTruthy();
    });

    it('debe incrementar messageCount del chat', async () => {
      const chat = await createChat();

      await addMessage(chat.id, 'user', 'Msg 1');

      const updated = await getChat(chat.id);
      expect(updated?.messageCount).toBe(1);
    });

    it('debe actualizar updatedAt del chat', async () => {
      const chat = await createChat();
      const originalUpdatedAt = chat.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      await addMessage(chat.id, 'assistant', 'Respuesta');

      const updated = await getChat(chat.id);
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('getMessagesByChatId', () => {
    it('debe retornar array vacío si no hay mensajes', async () => {
      const chat = await createChat();
      const messages = await getMessagesByChatId(chat.id);

      expect(messages).toEqual([]);
    });

    it('debe retornar mensajes ordenados por createdAt asc', async () => {
      const chat = await createChat();

      const msg1 = await addMessage(chat.id, 'user', 'Primero');
      await new Promise(resolve => setTimeout(resolve, 10));
      const msg2 = await addMessage(chat.id, 'assistant', 'Segundo');

      const messages = await getMessagesByChatId(chat.id);

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe(msg1.id);
      expect(messages[1].id).toBe(msg2.id);
    });

    it('debe filtrar mensajes por chatId', async () => {
      const chat1 = await createChat();
      const chat2 = await createChat();

      await addMessage(chat1.id, 'user', 'Chat 1');
      await addMessage(chat2.id, 'user', 'Chat 2');

      const messages = await getMessagesByChatId(chat1.id);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Chat 1');
    });
  });
});
```

**Total de tests**: ~18 casos de prueba

**Cobertura esperada**:
- ✅ CRUD completo de Chats
- ✅ CRUD de Messages
- ✅ Búsqueda y filtrado
- ✅ Relaciones chat-mensajes
- ✅ Manejo de errores

---

### 6.2 `src/lib/session.test.ts` - Tests de sesión localStorage (PRIORIDAD ALTA)

```typescript
// src/lib/session.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSession,
  createSession,
  updateSession,
  getOrCreateSession,
  type UserSession,
} from './session';

describe('session.ts - localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getSession', () => {
    it('debe retornar null si no hay sesión', () => {
      const session = getSession();

      expect(session).toBeNull();
    });

    it('debe retornar la sesión si existe', () => {
      const mockSession: UserSession = {
        userId: 'user-123',
        displayName: 'Test User',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
        lastActiveChatId: null,
      };

      localStorage.setItem('chat-app-user', JSON.stringify(mockSession));

      const session = getSession();

      expect(session).toEqual(mockSession);
    });

    it('debe retornar null si el JSON está corrupto', () => {
      localStorage.setItem('chat-app-user', 'invalid-json{');

      const session = getSession();

      expect(session).toBeNull();
    });
  });

  describe('createSession', () => {
    it('debe crear una nueva sesión con valores por defecto', () => {
      const session = createSession();

      expect(session.userId).toMatch(/^mock-uuid-\d+$/);
      expect(session.displayName).toBe('Usuario');
      expect(session.avatarUrl).toBe('');
      expect(session.lastActiveChatId).toBeNull();
      expect(session.createdAt).toBeTruthy();
    });

    it('debe persistir la sesión en localStorage', () => {
      const session = createSession();

      const stored = localStorage.getItem('chat-app-user');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual(session);
    });
  });

  describe('updateSession', () => {
    it('debe actualizar campos de la sesión', () => {
      createSession();

      const updated = updateSession({
        displayName: 'Nuevo Nombre',
        lastActiveChatId: 'chat-123',
      });

      expect(updated.displayName).toBe('Nuevo Nombre');
      expect(updated.lastActiveChatId).toBe('chat-123');
    });

    it('debe mantener campos no modificados', () => {
      const original = createSession();

      const updated = updateSession({ displayName: 'Updated' });

      expect(updated.userId).toBe(original.userId);
      expect(updated.createdAt).toBe(original.createdAt);
    });

    it('debe lanzar error si no hay sesión', () => {
      expect(() => updateSession({ displayName: 'Test' })).toThrow(
        'No session found'
      );
    });

    it('debe persistir los cambios en localStorage', () => {
      createSession();
      updateSession({ displayName: 'Updated' });

      const stored = localStorage.getItem('chat-app-user');
      const parsed = JSON.parse(stored!);

      expect(parsed.displayName).toBe('Updated');
    });
  });

  describe('getOrCreateSession', () => {
    it('debe retornar sesión existente si ya existe', () => {
      const existing = createSession();

      const session = getOrCreateSession();

      expect(session).toEqual(existing);
    });

    it('debe crear nueva sesión si no existe', () => {
      const session = getOrCreateSession();

      expect(session).toBeTruthy();
      expect(session.userId).toMatch(/^mock-uuid-\d+$/);
    });
  });
});
```

**Total de tests**: ~11 casos de prueba

**Cobertura esperada**:
- ✅ Lectura/escritura localStorage
- ✅ Creación y actualización de sesión
- ✅ Manejo de JSON corrupto
- ✅ Validación de errores

---

### 6.3 `src/lib/markdown.test.ts` - Tests de renderizado Markdown (PRIORIDAD MEDIA)

```typescript
// src/lib/markdown.test.ts

import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderStreamingMarkdown } from './markdown';

describe('markdown.ts - Renderizado', () => {
  describe('renderMarkdown', () => {
    it('debe convertir texto plano a HTML', () => {
      const result = renderMarkdown('Hola mundo');

      expect(result).toContain('Hola mundo');
      expect(result).toContain('<p>');
    });

    it('debe renderizar negritas con **', () => {
      const result = renderMarkdown('Texto **negrita** normal');

      expect(result).toContain('<strong>negrita</strong>');
    });

    it('debe renderizar cursivas con *', () => {
      const result = renderMarkdown('Texto *cursiva* normal');

      expect(result).toContain('<em>cursiva</em>');
    });

    it('debe renderizar enlaces', () => {
      const result = renderMarkdown('[Link](https://example.com)');

      expect(result).toContain('<a href="https://example.com">Link</a>');
    });

    it('debe renderizar código inline con backticks', () => {
      const result = renderMarkdown('Usar `const x = 10;` en JS');

      expect(result).toContain('<code>const x = 10;</code>');
    });

    it('debe renderizar bloques de código con triple backticks', () => {
      const markdown = '```javascript\nconst x = 10;\n```';
      const result = renderMarkdown(markdown);

      expect(result).toContain('<pre>');
      expect(result).toContain('<code');
      expect(result).toContain('const x = 10;');
    });

    it('debe respetar saltos de línea (breaks: true)', () => {
      const result = renderMarkdown('Línea 1\nLínea 2');

      // Con breaks: true, \n se convierte en <br>
      expect(result).toContain('<br>');
    });

    it('debe soportar listas con -', () => {
      const markdown = '- Item 1\n- Item 2';
      const result = renderMarkdown(markdown);

      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
    });

    it('debe escapar HTML peligroso', () => {
      const result = renderMarkdown('<script>alert("xss")</script>');

      // marked por defecto NO escapa HTML (sanitize: false)
      // Si esto falla, agregar sanitización explícita
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('renderStreamingMarkdown', () => {
    it('debe renderizar contenido parcial correctamente', () => {
      const partial = 'Esto es un **texto par';
      const result = renderStreamingMarkdown(partial);

      // Debe manejar markdown incompleto sin errores
      expect(result).toBeTruthy();
    });

    it('debe ser idéntico a renderMarkdown', () => {
      const content = 'Texto **completo**';

      const result1 = renderMarkdown(content);
      const result2 = renderStreamingMarkdown(content);

      expect(result1).toBe(result2);
    });
  });
});
```

**Total de tests**: ~11 casos de prueba

**Cobertura esperada**:
- ✅ Sintaxis Markdown básica
- ✅ GFM (GitHub Flavored Markdown)
- ✅ Code blocks
- ✅ Seguridad (XSS)
- ✅ Streaming (contenido parcial)

---

### 6.4 `src/pages/api/chat.test.ts` - Tests de validación API (PRIORIDAD MEDIA)

```typescript
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
      expect(body.error).toBe('Messages array is required');
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
      expect(body.error).toBe('Invalid message format');
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
```

**Total de tests**: ~7 casos de prueba

**Cobertura esperada**:
- ✅ Validación de request body
- ✅ Validación de formato de mensajes
- ✅ Validación de roles
- ✅ Headers de respuesta correctos
- ❌ NO testear integración con Groq (requiere API key real o mocks complejos)

---

## 7. Orden de Implementación

### Paso 1: Setup básico

1. Instalar dependencias: `pnpm add -D vitest happy-dom @vitest/ui`
2. Crear `vitest.config.ts`
3. Crear `vitest.setup.ts`
4. Actualizar `tsconfig.json`
5. Actualizar `package.json` (scripts)

**Verificación**: Ejecutar `pnpm test` (debe decir "No test files found")

---

### Paso 2: Tests de sesión (más simple, sin dependencias)

1. Crear `src/lib/session.test.ts`
2. Ejecutar `pnpm test:watch`
3. Verificar que todos los tests pasen

**Criterio de éxito**: 11/11 tests verdes

---

### Paso 3: Tests de markdown (función pura, simple)

1. Crear `src/lib/markdown.test.ts`
2. Ejecutar tests
3. Ajustar si `marked` necesita configuración adicional

**Criterio de éxito**: 11/11 tests verdes

---

### Paso 4: Tests de base de datos (más complejo, IndexedDB)

1. Crear `src/lib/db.test.ts`
2. Ejecutar tests
3. Si happy-dom no soporta bien IndexedDB, agregar `fake-indexeddb`:
   ```bash
   pnpm add -D fake-indexeddb
   ```
   Y actualizar `vitest.setup.ts`:
   ```typescript
   import 'fake-indexeddb/auto';
   ```

**Criterio de éxito**: 18/18 tests verdes

---

### Paso 5: Tests de API (requiere mocks)

1. Crear `src/pages/api/chat.test.ts`
2. Configurar mocks de Groq SDK
3. Ajustar si hay problemas con Request/Response de Node vs Web API

**Criterio de éxito**: 7/7 tests verdes

---

### Paso 6: Helpers (opcional, si hay repetición)

1. Crear `src/lib/test-helpers.ts` solo si los tests son muy repetitivos
2. Refactorizar tests existentes para usar helpers

---

### Paso 7: Verificación final

1. Ejecutar `pnpm test` (todos los tests)
2. Ejecutar `pnpm test:ui` (verificar interfaz visual)
3. Verificar coverage básico (opcional):
   ```bash
   pnpm test:coverage
   ```

**Meta de cobertura (MVP)**:
- `src/lib/db.ts`: >90%
- `src/lib/session.ts`: 100%
- `src/lib/markdown.ts`: >80%
- `src/pages/api/chat.ts`: >60% (solo validación, no integración)

---

## 8. Comandos de Testing

### Desarrollo diario

```bash
# Modo watch (re-ejecuta al guardar)
pnpm test:watch

# Ejecutar tests una vez
pnpm test

# Interfaz visual en navegador
pnpm test:ui
```

### CI/CD (futuro)

```bash
# En pipeline de GitHub Actions / GitLab CI
pnpm test --run --reporter=verbose

# Con coverage
pnpm test:coverage
```

### Debugging

```bash
# Ejecutar un archivo específico
pnpm vitest run src/lib/db.test.ts

# Ejecutar tests que coincidan con patrón
pnpm vitest run -t "createChat"

# Modo debug (para usar con debugger de VS Code)
pnpm vitest --inspect-brk --no-coverage
```

---

## Archivos NO Testeados (Justificación)

### `src/lib/groq-client.ts`

**Por qué NO testear**:
- Requiere mock complejo de `fetch` con streaming
- Depende de formato SSE (Server-Sent Events)
- Difícil testear async generators sin integración real
- Bajo valor en MVP (la validación está en API endpoint)

**Alternativa**: Testear manualmente durante desarrollo

---

### Componentes React (`src/components/react/`)

**Por qué NO testear en MVP**:
- Requiere React Testing Library + configuración adicional
- Requiere mocks de Context, hooks, etc.
- Los componentes son mayormente presentacionales
- La lógica crítica está en `src/lib/` (ya testeada)

**Futuro**: Agregar en Fase 2 si el proyecto crece

---

## Estructura Final de Archivos

```
chat/
├── vitest.config.ts          ← Configuración Vitest
├── vitest.setup.ts           ← Setup global (mocks, beforeEach)
├── package.json              ← Scripts de test agregados
├── tsconfig.json             ← types: ["vitest/globals"]
├── src/
│   ├── lib/
│   │   ├── db.ts
│   │   ├── db.test.ts        ← 18 tests (CRUD completo)
│   │   ├── session.ts
│   │   ├── session.test.ts   ← 11 tests (localStorage)
│   │   ├── markdown.ts
│   │   ├── markdown.test.ts  ← 11 tests (renderizado)
│   │   ├── groq-client.ts    ← NO testear (MVP)
│   │   └── test-helpers.ts   ← Opcional (crear si es necesario)
│   └── pages/
│       └── api/
│           ├── chat.ts
│           └── chat.test.ts  ← 7 tests (validación)
└── docs/
    └── plan-testing-vitest.md ← Este archivo
```

**Total de tests**: 47 casos de prueba

**Tiempo estimado de ejecución**: <500ms (con happy-dom)

---

## Consideraciones Técnicas

### happy-dom vs jsdom

| Característica | happy-dom | jsdom |
|---|---|---|
| Velocidad | 2-3x más rápido | Más lento |
| IndexedDB | Mock básico | Requiere fake-indexeddb |
| localStorage | ✅ Nativo | ✅ Nativo |
| Bundle size | ~2MB | ~8MB |
| Compatibilidad | 95% APIs Web | 99% APIs Web |

**Decisión**: happy-dom es suficiente para MVP. Si hay problemas con IndexedDB, agregar `fake-indexeddb`.

---

### Mocking de APIs del navegador

**crypto.randomUUID()**:
- Mock determinista en `vitest.setup.ts`
- UUIDs predecibles: `mock-uuid-001`, `mock-uuid-002`, etc.
- Reseteo entre tests con `beforeEach`

**localStorage**:
- Provisto por happy-dom
- Reseteo automático en `vitest.setup.ts`

**IndexedDB**:
- Mock básico de happy-dom
- Si falla, agregar `fake-indexeddb` (implementación completa)

---

### Tests co-localizados vs carpeta tests/

**Co-localizados** (elegido):
- ✅ Fácil encontrar tests
- ✅ Refactors más simples
- ✅ Estándar en Vite/Vitest

**Carpeta tests/** (descartado):
- ❌ Estructura duplicada
- ❌ Dificulta refactors
- ❌ No es estándar en Vitest

---

### Naming: *.test.ts vs *.spec.ts

**Decisión**: `*.test.ts`

**Razón**:
- Estándar en ecosistema Vite/Vitest
- Más corto
- Consistencia con documentación oficial

---

## Alternativas Consideradas

### 1. Jest en lugar de Vitest

**Descartado**:
- Requiere configuración compleja con Astro
- Más lento (no usa Vite)
- Menos integración con tooling moderno

---

### 2. Testear componentes React con React Testing Library

**Descartado para MVP**:
- Requiere `@testing-library/react` + `@testing-library/jest-dom`
- Requiere mocks de Context, router, etc.
- Los componentes son mayormente presentacionales
- La lógica crítica ya está testeada en `src/lib/`

**Futuro**: Considerar en Fase 2 si crece la complejidad

---

### 3. Usar fake-indexeddb desde el inicio

**Descartado**:
- happy-dom tiene mock básico suficiente
- Agregar solo si es necesario (principio YAGNI)
- Reduce dependencias iniciales

---

### 4. E2E tests con Playwright

**Descartado para MVP**:
- Overhead de configuración alto
- Tests más lentos
- El MVP se enfoca en lógica, no flujos completos

**Futuro**: Agregar E2E cuando haya features estables

---

## Métricas de Éxito

### Cobertura mínima (MVP)

```
File                     | % Stmts | % Branch | % Funcs | % Lines
-------------------------|---------|----------|---------|--------
src/lib/db.ts            |   >90   |    >85   |   100   |   >90
src/lib/session.ts       |   100   |    100   |   100   |   100
src/lib/markdown.ts      |   >80   |    >70   |   100   |   >80
src/pages/api/chat.ts    |   >60   |    >50   |    >70  |   >60
```

### Performance

- ✅ Suite completa: <500ms
- ✅ Test individual más lento: <100ms
- ✅ Watch mode: re-ejecución <200ms

### Mantenibilidad

- ✅ Tests descriptivos en español
- ✅ Setup/teardown consistente
- ✅ Sin duplicación de código
- ✅ Fácil agregar nuevos tests

---

## Próximos Pasos (Fase 2)

1. **Agregar tests de componentes React**:
   - Instalar `@testing-library/react`
   - Testear componentes críticos (ChatInput, MessageArea)

2. **E2E tests**:
   - Instalar Playwright
   - Testear flujos completos (crear chat, enviar mensaje, etc.)

3. **Mocks avanzados**:
   - Testear `groq-client.ts` con mock de fetch
   - Testear manejo de errores de red

4. **CI/CD**:
   - Agregar GitHub Actions workflow
   - Ejecutar tests en PR
   - Generar reportes de coverage

---

## Referencias

- [Vitest Documentation](https://vitest.dev/)
- [happy-dom GitHub](https://github.com/capricorn86/happy-dom)
- [Astro Testing Guide](https://docs.astro.build/en/guides/testing/)
- [marked Documentation](https://marked.js.org/)

---

## Resumen Ejecutivo

Este plan agrega testing pragmático al proyecto de chat con:

✅ **47 tests** para lógica crítica (funciones puras)
✅ **Vitest + happy-dom** (rápido, simple)
✅ **Tests co-localizados** (fácil mantenimiento)
✅ **Sin overhead** (NO testear UI en MVP)
✅ **Configuración mínima** (~100 líneas de config)

**Tiempo de implementación estimado**: 4-6 horas

**Valor entregado**:
- Confianza en CRUD de IndexedDB
- Prevención de regresiones en sesión/markdown
- Validación robusta del API endpoint
- Base sólida para escalar testing en el futuro
