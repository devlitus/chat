import type { Message } from './db-types';
import { withStore, openDB } from './db-core';
import { getChat, updateChat } from './db-chats';

export async function addMessage(chatId: string, role: 'user' | 'assistant', content: string, uiResourceUri?: string): Promise<Message> {
  const now = new Date().toISOString();
  const message: Message = { id: crypto.randomUUID(), chatId, role, content, uiResourceUri, createdAt: now };
  await withStore('messages', 'readwrite', (store) => store.add(message));
  const chat = await getChat(chatId);
  if (chat) await updateChat(chatId, { updatedAt: now, messageCount: chat.messageCount + 1 });
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
  });
}
