import { useCallback, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $chats, $activeChatId, $searchQuery } from '../../stores/chat-store';
import { setChats, setActiveChat, removeChatFromList } from '../../stores/chat-actions';
import { createChat, deleteChat, getAllChats, getMessagesByChatId } from '../../lib/db';
import { updateSession } from '../../lib/session';
import type { Chat } from '../../lib/db';

export function ChatHistoryList() {
  const chats = useStore($chats);
  const activeChatId = useStore($activeChatId);
  const searchQuery = useStore($searchQuery);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    if (!searchQuery) return chats;
    const lower = searchQuery.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(lower));
  }, [chats, searchQuery]);

  const groups = useMemo(() => {
    const map = new Map<string, Chat[]>();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const last7days = new Date(today.getTime() - 7 * 86400000);
    for (const chat of filteredChats) {
      const d = new Date(chat.updatedAt);
      const label = d >= today ? 'Hoy' : d >= yesterday ? 'Ayer' : d >= last7days ? 'Ultimos 7 dias' : 'Anteriores';
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(chat);
    }
    return map;
  }, [filteredChats]);

  const handleSelect = useCallback(async (chatId: string) => {
    if (chatId === activeChatId) return;
    updateSession({ lastActiveChatId: chatId });
    setActiveChat(chatId, await getMessagesByChatId(chatId));
  }, [activeChatId]);

  const handleDelete = useCallback(async (chatId: string) => {
    setConfirmingId(null);
    await deleteChat(chatId);
    removeChatFromList(chatId);
    if (chatId !== activeChatId) return;
    const remaining = await getAllChats();
    if (remaining.length > 0) {
      const id = remaining[0].id;
      updateSession({ lastActiveChatId: id });
      setActiveChat(id, await getMessagesByChatId(id));
    } else {
      const nc = await createChat();
      updateSession({ lastActiveChatId: nc.id });
      setChats(await getAllChats());
      setActiveChat(nc.id, []);
    }
  }, [activeChatId]);

  if (filteredChats.length === 0) return <div className="history-list"><div className="history-empty">{searchQuery ? 'Sin resultados' : 'No hay chats aun'}</div></div>;

  return (
    <div className="history-list">
      {Array.from(groups.entries()).map(([label, groupChats]) => (
        <div className="history-group" key={label}>
          <h3>{label}</h3>
          {groupChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isConfirming = confirmingId === chat.id;
            return (
              <div key={chat.id} className={`chat-item${isActive ? ' active' : ''}${isConfirming ? ' confirming' : ''}`}>
                <button className="chat-item-select" onClick={() => { setConfirmingId(null); handleSelect(chat.id); }}>
                  <span className="material-symbols-outlined chat-item-icon">{isActive ? 'chat_bubble' : 'chat_bubble_outline'}</span>
                  <div className="chat-item-content"><p>{chat.title}</p></div>
                </button>
                {isConfirming ? (
                  <div className="chat-delete-confirm">
                    <span className="chat-delete-label">Eliminar?</span>
                    <button className="chat-confirm-yes" onClick={() => handleDelete(chat.id)} title="Confirmar"><span className="material-symbols-outlined">check</span></button>
                    <button className="chat-confirm-no" onClick={() => setConfirmingId(null)} title="Cancelar"><span className="material-symbols-outlined">close</span></button>
                  </div>
                ) : (
                  <button className="chat-delete-btn" onClick={() => setConfirmingId(chat.id)} title="Eliminar chat"><span className="material-symbols-outlined">delete</span></button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
