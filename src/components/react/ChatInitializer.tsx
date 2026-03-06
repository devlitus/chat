// src/components/react/ChatInitializer.tsx
//
// Componente invisible (retorna null) que ejecuta la inicializacion de la app:
// carga la sesion, verifica/crea el chat activo en IndexedDB, y llena los stores
// con la accion initStore(). Equivale al useEffect de init de ChatAppInner.

import { useEffect } from 'react';
import { getOrCreateSession, updateSession } from '../../lib/session';
import { getAllChats, createChat, getChat, getMessagesByChatId } from '../../lib/db';
import { initStore } from '../../stores/chat-actions';

export function ChatInitializer() {
  useEffect(() => {
    async function init() {
      const session = getOrCreateSession();
      let chatId: string;

      if (session.lastActiveChatId) {
        const chat = await getChat(session.lastActiveChatId);
        if (chat) {
          chatId = chat.id;
        } else {
          const newChat = await createChat();
          chatId = newChat.id;
        }
      } else {
        const allChats = await getAllChats();
        if (allChats.length > 0) {
          chatId = allChats[0].id;
        } else {
          const newChat = await createChat();
          chatId = newChat.id;
        }
      }

      updateSession({ lastActiveChatId: chatId });

      const chats = await getAllChats();
      const messages = await getMessagesByChatId(chatId);

      initStore(session, chats, chatId, messages);
    }

    init().catch((err) => {
      console.error('[ChatInitializer] Error al inicializar la app:', err);
    });
  }, []);

  return null;
}
