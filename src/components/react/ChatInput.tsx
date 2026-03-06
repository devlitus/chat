// src/components/react/ChatInput.tsx

import { useState, useRef, useCallback, useEffect } from 'react';
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

const WIDGET_RE = /\[WIDGET:(weather|time|crypto)\]/i;

export function ChatInput() {
  const activeChatId = useStore($activeChatId);
  const isStreaming = useStore($isStreaming);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [text]);

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !activeChatId || isStreaming) return;

    setText('');

    try {
      // 1. Guardar mensaje del usuario
      const userMessage = await addMessage(activeChatId, 'user', trimmed);
      addUserMessage(userMessage);

      // 2. Generar titulo si es primer mensaje
      const chat = await getChat(activeChatId);
      if (chat && chat.messageCount <= 1) {
        const title = trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
        const updated = await updateChat(activeChatId, { title });
        updateChatInList(updated);
      }

      // 3. Obtener historial
      const allMessages = await getMessagesByChatId(activeChatId);
      const history = allMessages.map((m) => ({ role: m.role, content: m.content }));

      // 4. Streaming + detección de widget por marcador del modelo
      startStreaming();

      let fullContent = '';
      let rafPending = false;

      for await (const token of streamChat(history)) {
        fullContent += token;
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(() => {
            updateStreaming(fullContent);
            rafPending = false;
          });
        }
      }
      // Flush final: garantiza que el atom refleja el contenido completo
      // antes de que finishStreaming procese el mensaje
      updateStreaming(fullContent);

      // 5. Extraer marcador de widget si el modelo lo incluyó
      const widgetMatch = fullContent.match(WIDGET_RE);
      const cleanContent = fullContent.replace(WIDGET_RE, '').trimEnd();

      const uriMap: Record<string, string> = {
        weather: 'ui://mcp-app-demo/weather-app',
        time: 'ui://mcp-app-demo/mcp-app',
        crypto: 'ui://mcp-app-demo/crypto-app',
      };

      let uiResourceUri: string | undefined;
      if (widgetMatch) {
        // Marcador explícito del modelo
        uiResourceUri = uriMap[widgetMatch[1].toLowerCase()];
      } else if (/widget/i.test(fullContent)) {
        // Fallback: el modelo mencionó "widget" pero no emitió el marcador exacto
        const lowerMsg = trimmed.toLowerCase();
        const isWeatherTopic =
          lowerMsg.includes('clima') || lowerMsg.includes('tiempo') ||
          lowerMsg.includes('lluv') || lowerMsg.includes('temperatura') ||
          lowerMsg.includes('weather') || lowerMsg.includes('pronóstico') ||
          lowerMsg.includes('pronostico') || lowerMsg.includes('rain') ||
          lowerMsg.includes('forecast');
        const isTimeTopic =
          lowerMsg.includes('hora') || lowerMsg.includes('time') || lowerMsg === '/mcp';
        const isCryptoTopic =
          lowerMsg.includes('crypto') || lowerMsg.includes('bitcoin') ||
          lowerMsg.includes('btc') || lowerMsg.includes('ethereum') ||
          lowerMsg.includes('eth') || lowerMsg.includes('solana') ||
          lowerMsg.includes('sol') || lowerMsg.includes('criptomoneda') ||
          (lowerMsg.includes('precio') && (lowerMsg.includes('moneda') || lowerMsg.includes('coin')));
        if (isWeatherTopic) uiResourceUri = uriMap.weather;
        else if (isTimeTopic) uiResourceUri = uriMap.time;
        else if (isCryptoTopic) uiResourceUri = uriMap.crypto;
      }

      const botMessage = await addMessage(activeChatId, 'assistant', cleanContent, uiResourceUri);
      finishStreaming(botMessage);

      // 6. Refrescar lista de chats
      const chats = await getAllChats();
      setChats(chats);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      setBotError(`No se pudo obtener respuesta: ${errorMsg}`);
    }

    // Focus de vuelta al textarea
    textareaRef.current?.focus();
  }, [text, activeChatId, isStreaming]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  return (
    <div className="chat-input-area">
      <div className="input-wrapper">
        <button className="icon-btn" title="Attach file" aria-label="Attach file">
          <span className="material-symbols-outlined" aria-hidden="true">attach_file</span>
        </button>
        <textarea
          ref={textareaRef}
          placeholder="Type a message..."
          rows={1}
          aria-label="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="right-buttons">
          <button className="icon-btn" title="Use Microphone" aria-label="Use Microphone">
            <span className="material-symbols-outlined" aria-hidden="true">mic</span>
          </button>
          <button
            className="send-btn"
            title="Send message"
            aria-label="Send message"
            onClick={sendMessage}
            disabled={isStreaming || !text.trim()}
          >
            <span className="material-symbols-outlined" aria-hidden="true">send</span>
          </button>
        </div>
      </div>
      <p className="disclaimer">AI can make mistakes. Please review generated code.</p>
    </div>
  );
}
