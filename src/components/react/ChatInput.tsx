// src/components/react/ChatInput.tsx

import { useState, useRef, useCallback, useEffect } from 'react';
import { useChatState, useChatDispatch } from './ChatContext';
import { addMessage, getMessagesByChatId, getChat, updateChat, getAllChats } from '../../lib/db';
import { streamChat } from '../../lib/groq-client';

export function ChatInput() {
  const { activeChatId, isStreaming } = useChatState();
  const dispatch = useChatDispatch();
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
      dispatch({ type: 'ADD_USER_MESSAGE', message: userMessage });

      // 2. Generar titulo si es primer mensaje
      const chat = await getChat(activeChatId);
      if (chat && chat.messageCount <= 1) {
        const title = trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
        const updated = await updateChat(activeChatId, { title });
        dispatch({ type: 'UPDATE_CHAT_IN_LIST', chat: updated });
      }

      // 3. Obtener historial
      const allMessages = await getMessagesByChatId(activeChatId);
      const history = allMessages.map((m) => ({ role: m.role, content: m.content }));

      // 4. Streaming + detección de widget por marcador del modelo
      dispatch({ type: 'START_STREAMING' });

      let fullContent = '';
      for await (const token of streamChat(history)) {
        fullContent += token;
        dispatch({ type: 'UPDATE_STREAMING', content: fullContent });
      }

      // 5. Extraer marcador de widget si el modelo lo incluyó
      const WIDGET_RE = /\[WIDGET:(weather|time|crypto)\]/i;
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
      dispatch({ type: 'FINISH_STREAMING', message: botMessage });

      // 6. Refrescar lista de chats
      const chats = await getAllChats();
      dispatch({ type: 'SET_CHATS', chats });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      dispatch({
        type: 'SET_BOT_ERROR',
        error: `No se pudo obtener respuesta: ${errorMsg}`,
      });
    }

    // Focus de vuelta al textarea
    textareaRef.current?.focus();
  }, [text, activeChatId, isStreaming, dispatch]);

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
        <button className="icon-btn" title="Attach file">
          <span className="material-symbols-outlined">attach_file</span>
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
          <button className="icon-btn" title="Use Microphone">
            <span className="material-symbols-outlined">mic</span>
          </button>
          <button
            className="send-btn"
            title="Send message"
            onClick={sendMessage}
            disabled={isStreaming || !text.trim()}
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
      <p className="disclaimer">AI can make mistakes. Please review generated code.</p>
    </div>
  );
}
