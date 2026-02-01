// src/components/react/ChatHistoryList.tsx

import { useCallback, useMemo } from 'react';
import { useChatState, useChatDispatch } from './ChatContext';
import { deleteChat, getAllChats, getMessagesByChatId, searchChats } from '../../lib/db';
import { updateSession } from '../../lib/session';
import type { Chat } from '../../lib/db';

function groupChatsByDate(chats: Chat[]): Map<string, Chat[]> {
  const groups = new Map<string, Chat[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7days = new Date(today.getTime() - 7 * 86400000);

  for (const chat of chats) {
    const chatDate = new Date(chat.updatedAt);
    let label: string;
    if (chatDate >= today) {
      label = 'Hoy';
    } else if (chatDate >= yesterday) {
      label = 'Ayer';
    } else if (chatDate >= last7days) {
      label = 'Ultimos 7 dias';
    } else {
      label = 'Anteriores';
    }
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(chat);
  }
  return groups;
}

export function ChatHistoryList() {
  const { chats, activeChatId, searchQuery } = useChatState();
  const dispatch = useChatDispatch();

  const filteredChats = useMemo(() => {
    if (!searchQuery) return chats;
    const lower = searchQuery.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(lower));
  }, [chats, searchQuery]);

  const groups = useMemo(() => groupChatsByDate(filteredChats), [filteredChats]);

  const handleSelectChat = useCallback(
    async (chatId: string) => {
      if (chatId === activeChatId) return;
      updateSession({ lastActiveChatId: chatId });
      const messages = await getMessagesByChatId(chatId);
      dispatch({ type: 'SET_ACTIVE_CHAT', chatId, messages });
    },
    [activeChatId, dispatch]
  );

  const handleDeleteChat = useCallback(
    async (chatId: string, e: React.MouseEvent) => {
      e.preventDefault();
      if (!confirm('Eliminar este chat?')) return;

      await deleteChat(chatId);
      dispatch({ type: 'REMOVE_CHAT_FROM_LIST', chatId });

      if (chatId === activeChatId) {
        const remaining = await getAllChats();
        if (remaining.length > 0) {
          const newActiveId = remaining[0].id;
          updateSession({ lastActiveChatId: newActiveId });
          const messages = await getMessagesByChatId(newActiveId);
          dispatch({ type: 'SET_ACTIVE_CHAT', chatId: newActiveId, messages });
        } else {
          // Crear un chat nuevo si no quedan
          const { createChat } = await import('../../lib/db');
          const newChat = await createChat();
          updateSession({ lastActiveChatId: newChat.id });
          const allChats = await getAllChats();
          dispatch({ type: 'SET_CHATS', chats: allChats });
          dispatch({ type: 'SET_ACTIVE_CHAT', chatId: newChat.id, messages: [] });
        }
      }
    },
    [activeChatId, dispatch]
  );

  if (filteredChats.length === 0) {
    return (
      <div className="history-list">
        <div className="history-empty">
          {searchQuery ? 'Sin resultados' : 'No hay chats aun'}
        </div>
      </div>
    );
  }

  return (
    <div className="history-list">
      {Array.from(groups.entries()).map(([label, groupChats]) => (
        <div className="history-group" key={label}>
          <h3>{label}</h3>
          {groupChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const icon = isActive ? 'chat_bubble' : 'chat_bubble_outline';
            return (
              <button
                key={chat.id}
                className={`chat-item${isActive ? ' active' : ''}`}
                onClick={() => handleSelectChat(chat.id)}
                onContextMenu={(e) => handleDeleteChat(chat.id, e)}
              >
                <span className="material-symbols-outlined chat-item-icon">{icon}</span>
                <div className="chat-item-content">
                  <p>{chat.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
