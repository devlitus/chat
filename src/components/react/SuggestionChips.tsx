// src/components/react/SuggestionChips.tsx

import { useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { $activeChatId, $isStreaming } from '../../stores/chat-store';
import {
  addUserMessage,
  updateChatInList,
  startStreaming,
  updateStreaming,
  finishStreaming,
  setBotError,
  setChats,
} from '../../stores/chat-actions';
import { addMessage, getMessagesByChatId, getChat, updateChat, getAllChats } from '../../lib/db';
import { streamChat } from '../../lib/groq-client';

const suggestions = [
  { icon: 'code', label: 'Async/Await en JS', text: 'Explicame como funciona async/await en JavaScript' },
  { icon: 'speed', label: 'Optimizar rendimiento web', text: 'Dame ideas para mejorar el rendimiento de mi aplicacion web' },
  { icon: 'database', label: 'Disenar DB para blog', text: 'Ayudame a disenar una base de datos para un blog' },
];

export function SuggestionChips() {
  const activeChatId = useStore($activeChatId);
  const isStreaming = useStore($isStreaming);

  const handleClick = useCallback(
    async (text: string) => {
      if (!activeChatId || isStreaming) return;

      // Reutilizar la misma logica de envio que ChatInput
      const userMessage = await addMessage(activeChatId, 'user', text);
      addUserMessage(userMessage);

      // Generar titulo si es primer mensaje
      const chat = await getChat(activeChatId);
      if (chat && chat.messageCount <= 1) {
        const title = text.length > 50 ? text.substring(0, 50) + '...' : text;
        const updated = await updateChat(activeChatId, { title });
        updateChatInList(updated);
      }

      // Obtener historial
      const allMessages = await getMessagesByChatId(activeChatId);
      const history = allMessages.map((m) => ({ role: m.role, content: m.content }));

      // Streaming
      startStreaming();
      try {
        let fullContent = '';
        for await (const token of streamChat(history)) {
          fullContent += token;
          updateStreaming(fullContent);
        }
        const botMessage = await addMessage(activeChatId, 'assistant', fullContent);
        finishStreaming(botMessage);

        // Refrescar lista de chats
        const chats = await getAllChats();
        setChats(chats);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        setBotError(`No se pudo obtener respuesta: ${errorMsg}`);
      }
    },
    [activeChatId, isStreaming]
  );

  return (
    <div className="chips">
      {suggestions.map((s) => (
        <button key={s.text} className="chip" onClick={() => handleClick(s.text)}>
          <span className="material-symbols-outlined">{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
