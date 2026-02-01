// src/components/react/NewChatButton.tsx

import { useCallback } from 'react';
import { useChatDispatch } from './ChatContext';
import { createChat, getAllChats, getMessagesByChatId } from '../../lib/db';
import { updateSession } from '../../lib/session';

export function NewChatButton() {
  const dispatch = useChatDispatch();

  const handleClick = useCallback(async () => {
    const chat = await createChat();
    updateSession({ lastActiveChatId: chat.id });
    const chats = await getAllChats();
    const messages = await getMessagesByChatId(chat.id);

    dispatch({ type: 'SET_CHATS', chats });
    dispatch({ type: 'SET_ACTIVE_CHAT', chatId: chat.id, messages });
  }, [dispatch]);

  return (
    <div className="new-chat-wrapper">
      <button className="new-chat-btn" onClick={handleClick}>
        <span className="material-symbols-outlined">add</span>
        <span>New Chat</span>
      </button>
    </div>
  );
}
