const DB_NAME = 'chat-app-db';
const DB_VERSION = 1;

let _dbInstance: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_dbInstance) return Promise.resolve(_dbInstance);
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
      _dbInstance.onclose = () => { _dbInstance = null; };
      _dbInstance.onversionchange = () => { _dbInstance?.close(); _dbInstance = null; };
      resolve(_dbInstance);
    };
    request.onerror = () => { _dbPromise = null; reject(request.error); };
  });
  return _dbPromise;
}

export function resetDBConnection(): void {
  if (_dbInstance) { _dbInstance.onclose = null; _dbInstance.onversionchange = null; _dbInstance.close(); }
  _dbInstance = null;
  _dbPromise = null;
}

export async function withStore<T>(storeName: string, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
