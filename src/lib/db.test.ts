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
  resetDBConnection,
  type Chat,
  type Message,
} from './db';

describe('db.ts - IndexedDB CRUD', () => {
  // Limpiar singleton y DB entre tests para evitar estado compartido
  beforeEach(async () => {
    // Resetear el singleton antes de eliminar la DB (evita usar instancia stale)
    resetDBConnection();
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
