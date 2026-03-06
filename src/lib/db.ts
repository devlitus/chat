// src/lib/db.ts

// ============================================================
// Interfaces
// ============================================================

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  uiResourceUri?: string; // Almacenará la URI visual del servidor MCP
  createdAt: string;
}

// ============================================================
// Constantes
// ============================================================

const DB_NAME = 'chat-app-db';
const DB_VERSION = 1;

// ============================================================
// Singleton de conexion IDB
// ============================================================

// Instancia de conexion reutilizable durante la vida del tab
let _dbInstance: IDBDatabase | null = null;
// Promesa en vuelo para evitar llamadas concurrentes a indexedDB.open()
let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  // Si ya hay conexion abierta y funcional, devolverla directamente (O(1))
  if (_dbInstance) return Promise.resolve(_dbInstance);

  // Si ya hay una apertura en curso, reusar la misma promesa (evita doble open)
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('chats')) {
        const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
        chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        chatStore.createIndex('title', 'title', { unique: false });
      }

      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('chatId', 'chatId', { unique: false });
        msgStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      _dbInstance = request.result;
      _dbPromise = null;

      // Limpiar cache si la conexion se cierra externamente
      // (e.g. error interno del browser, garbage collection agresivo)
      _dbInstance.onclose = () => {
        _dbInstance = null;
      };

      // Manejar solicitud de cierre por cambio de version en otra pestana
      _dbInstance.onversionchange = () => {
        _dbInstance?.close();
        _dbInstance = null;
      };

      resolve(_dbInstance);
    };

    request.onerror = () => {
      _dbPromise = null;
      reject(request.error);
    };
  });

  return _dbPromise;
}

/**
 * Resetea el singleton de conexion IDB.
 * USO EXCLUSIVO EN TESTS — no llamar en produccion.
 */
export function resetDBConnection(): void {
  if (_dbInstance) {
    _dbInstance.onclose = null;
    _dbInstance.onversionchange = null;
    _dbInstance.close();
  }
  _dbInstance = null;
  _dbPromise = null;
}

// Helper generico para transacciones
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // La conexion permanece abierta durante la vida del tab (patron recomendado por MDN/W3C)
  });
}

// ============================================================
// CRUD de Chats
// ============================================================

export async function createChat(title: string = 'Nuevo chat'): Promise<Chat> {
  const now = new Date().toISOString();
  const chat: Chat = {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
  await withStore('chats', 'readwrite', (store) => store.add(chat));
  return chat;
}

export async function getChat(id: string): Promise<Chat | undefined> {
  return withStore('chats', 'readonly', (store) => store.get(id));
}

export async function getAllChats(): Promise<Chat[]> {
  const chats = await withStore<Chat[]>('chats', 'readonly', (store) => store.getAll());
  return chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function updateChat(id: string, updates: Partial<Pick<Chat, 'title' | 'updatedAt' | 'messageCount'>>): Promise<Chat> {
  const chat = await getChat(id);
  if (!chat) throw new Error(`Chat ${id} not found`);
  const updated = { ...chat, ...updates };
  await withStore('chats', 'readwrite', (store) => store.put(updated));
  return updated;
}

export async function deleteChat(id: string): Promise<void> {
  const messages = await getMessagesByChatId(id);
  const db = await openDB();
  const tx = db.transaction(['chats', 'messages'], 'readwrite');
  tx.objectStore('chats').delete(id);
  for (const msg of messages) {
    tx.objectStore('messages').delete(msg.id);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    // La conexion permanece abierta durante la vida del tab
  });
}

export async function searchChats(query: string): Promise<Chat[]> {
  const all = await getAllChats();
  const lower = query.toLowerCase();
  return all.filter((c) => c.title.toLowerCase().includes(lower));
}

// ============================================================
// CRUD de Messages
// ============================================================

export async function addMessage(chatId: string, role: 'user' | 'assistant', content: string, uiResourceUri?: string): Promise<Message> {
  const now = new Date().toISOString();
  const message: Message = {
    id: crypto.randomUUID(),
    chatId,
    role,
    content,
    uiResourceUri,
    createdAt: now,
  };
  await withStore('messages', 'readwrite', (store) => store.add(message));
  const chat = await getChat(chatId);
  if (chat) {
    await updateChat(chatId, {
      updatedAt: now,
      messageCount: chat.messageCount + 1,
    });
  }
  return message;
}

export async function getMessagesByChatId(chatId: string): Promise<Message[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('chatId');
    const request = index.getAll(chatId);
    request.onsuccess = () => {
      const msgs = request.result as Message[];
      resolve(msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    };
    request.onerror = () => reject(request.error);
    // La conexion permanece abierta durante la vida del tab
  });
}
