// src/components/react/SuggestionChips.tsx

import { useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { $activeChatId, $isStreaming, $selectedModel, $selectedProvider, $selectedGroqModel } from '../../stores/chat-store';
import { WIDGET_URI_MAP } from '../../lib/api/tools';
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
  const selectedModel = useStore($selectedModel);

  const handleClick = useCallback(
    async (text: string) => {
      if (!activeChatId || isStreaming) return;

      const provider = $selectedProvider.get();
      const groqModel = $selectedGroqModel.get();

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
        let rafPending = false;

        let detectedWidgetUri: string | undefined;
        for await (const event of streamChat(history, selectedModel || undefined, provider, groqModel)) {
          if (event.type === 'widget') {
            detectedWidgetUri = event.uri;
          } else {
            fullContent += event.content;
            if (!rafPending) {
              rafPending = true;
              requestAnimationFrame(() => {
                updateStreaming(fullContent);
                rafPending = false;
              });
            }
          }
        }
        // Flush final: garantiza que el atom refleja el contenido completo
        // antes de que finishStreaming procese el mensaje
        updateStreaming(fullContent);
        const ALLOWED_WIDGET_URIS = new Set(Object.values(WIDGET_URI_MAP));
        const safeUri = detectedWidgetUri && ALLOWED_WIDGET_URIS.has(detectedWidgetUri)
          ? detectedWidgetUri
          : undefined;
        const botMessage = await addMessage(activeChatId, 'assistant', fullContent.trimEnd(), safeUri);
        finishStreaming(botMessage);

        // Refrescar lista de chats
        const chats = await getAllChats();
        setChats(chats);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        setBotError(`No se pudo obtener respuesta: ${errorMsg}`);
      }
    },
    [activeChatId, isStreaming, selectedModel]
  );

  return (
    <div className="chips">
      {suggestions.map((s) => (
        <button key={s.text} className="chip" onClick={() => handleClick(s.text)}>
          <span className="material-symbols-outlined" aria-hidden="true">{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
