// src/components/react/NewChatButton.tsx

import { useCallback } from 'react';
import { createChat, getAllChats, getMessagesByChatId } from '../../lib/db';
import { updateSession } from '../../lib/session';
import { setChats, setActiveChat } from '../../stores/chat-actions';

export function NewChatButton() {
  const handleClick = useCallback(async () => {
    const chat = await createChat();
    updateSession({ lastActiveChatId: chat.id });
    const chats = await getAllChats();
    const messages = await getMessagesByChatId(chat.id);

    setChats(chats);
    setActiveChat(chat.id, messages);
  }, []);

  return (
    <div className="new-chat-wrapper">
      <button className="new-chat-btn" onClick={handleClick}>
        <span className="material-symbols-outlined">add</span>
        <span>New Chat</span>
      </button>
    </div>
  );
}
