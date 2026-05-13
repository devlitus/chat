import type { Chat } from './db-types';
import { withStore, openDB } from './db-core';
import { getMessagesByChatId } from './db-messages';

export async function createChat(title = 'Nuevo chat'): Promise<Chat> {
  const now = new Date().toISOString();
  const chat: Chat = { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now, messageCount: 0 };
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
  for (const msg of messages) tx.objectStore('messages').delete(msg.id);
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}

export async function searchChats(query: string): Promise<Chat[]> {
  const all = await getAllChats();
  const lower = query.toLowerCase();
  return all.filter((c) => c.title.toLowerCase().includes(lower));
}
