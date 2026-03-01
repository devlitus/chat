// src/components/react/ChatHeader.tsx

import { useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { $chats, $activeChatId } from '../../stores/chat-store';

export function ChatHeader() {
  const chats = useStore($chats);
  const activeChatId = useStore($activeChatId);

  const title = useMemo(() => {
    const chat = chats.find((c) => c.id === activeChatId);
    return chat?.title ?? 'Nuevo chat';
  }, [chats, activeChatId]);

  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <h2>
          <span className="material-symbols-outlined star-icon">auto_awesome</span>
          <span>{title}</span>
        </h2>
        <span className="badge">Model v4.0</span>
      </div>
      <div className="chat-header-right">
        <button
          className="fav-btn"
          aria-label="Favoritos"
          aria-pressed={false}
          onClick={() => {}} // TODO: implementar favoritos
        >
          <span className="material-symbols-outlined heart-icon" aria-hidden="true">favorite</span>
          <span className="fav-text">Favorite Chats</span>
        </button>
      </div>
    </header>
  );
}
