// src/components/react/SuggestionChips.tsx

import { useCallback } from 'react';
import { useChatState, useChatDispatch } from './ChatContext';
import { addMessage, getMessagesByChatId, getChat, updateChat, getAllChats } from '../../lib/db';
import { streamChat } from '../../lib/groq-client';

const suggestions = [
  { icon: 'code', label: 'Async/Await en JS', text: 'Explicame como funciona async/await en JavaScript' },
  { icon: 'speed', label: 'Optimizar rendimiento web', text: 'Dame ideas para mejorar el rendimiento de mi aplicacion web' },
  { icon: 'database', label: 'Disenar DB para blog', text: 'Ayudame a disenar una base de datos para un blog' },
];

export function SuggestionChips() {
  const { activeChatId, isStreaming } = useChatState();
  const dispatch = useChatDispatch();

  const handleClick = useCallback(
    async (text: string) => {
      if (!activeChatId || isStreaming) return;

      // Reutilizar la misma logica de envio que ChatInput
      const userMessage = await addMessage(activeChatId, 'user', text);
      dispatch({ type: 'ADD_USER_MESSAGE', message: userMessage });

      // Generar titulo si es primer mensaje
      const chat = await getChat(activeChatId);
      if (chat && chat.messageCount <= 1) {
        const title = text.length > 50 ? text.substring(0, 50) + '...' : text;
        const updated = await updateChat(activeChatId, { title });
        dispatch({ type: 'UPDATE_CHAT_IN_LIST', chat: updated });
      }

      // Obtener historial
      const allMessages = await getMessagesByChatId(activeChatId);
      const history = allMessages.map((m) => ({ role: m.role, content: m.content }));

      // Streaming
      dispatch({ type: 'START_STREAMING' });
      try {
        let fullContent = '';
        for await (const token of streamChat(history)) {
          fullContent += token;
          dispatch({ type: 'UPDATE_STREAMING', content: fullContent });
        }
        const botMessage = await addMessage(activeChatId, 'assistant', fullContent);
        dispatch({ type: 'FINISH_STREAMING', message: botMessage });

        // Refrescar lista de chats
        const chats = await getAllChats();
        dispatch({ type: 'SET_CHATS', chats });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        dispatch({ type: 'SET_BOT_ERROR', error: `No se pudo obtener respuesta: ${errorMsg}` });
      }
    },
    [activeChatId, isStreaming, dispatch]
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
