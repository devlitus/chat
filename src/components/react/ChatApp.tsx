// src/components/react/ChatApp.tsx

import { useEffect } from 'react';
import { ChatProvider, useChatDispatch } from './ChatContext';
import { getOrCreateSession, updateSession } from '../../lib/session';
import { getAllChats, createChat, getChat, getMessagesByChatId } from '../../lib/db';
import { Sidebar } from './Sidebar';
import { MainArea } from './MainArea';

function ChatAppInner() {
  const dispatch = useChatDispatch();

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

      dispatch({
        type: 'INIT',
        session,
        chats,
        activeChatId: chatId,
        messages,
      });
    }

    init();
  }, [dispatch]);

  return (
    <div className="chat-layout">
      <Sidebar />
      <MainArea />
    </div>
  );
}

export default function ChatApp() {
  return (
    <ChatProvider>
      <ChatAppInner />
    </ChatProvider>
  );
}
