// src/components/react/MessageArea.tsx

import { useEffect, useRef } from 'react';
import { useChatState } from './ChatContext';
import { MessageBubble } from './MessageBubble';
import { SuggestionChips } from './SuggestionChips';
import { renderMarkdown } from '../../lib/markdown';

export function MessageArea() {
  const { messages, isStreaming, streamingContent, botError, initialized } = useChatState();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al fondo cuando cambian los mensajes o el streaming
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, streamingContent, botError]);

  if (!initialized) {
    return <div className="message-area" />;
  }

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="message-area" ref={containerRef}>
      {isEmpty && (
        <div className="empty-state">
          <div className="empty-icon">
            <span className="material-symbols-outlined">chat_bubble_outline</span>
          </div>
          <h3>Inicia una conversacion</h3>
          <p>Escribe un mensaje o selecciona una sugerencia</p>
          <SuggestionChips />
        </div>
      )}

      {!isEmpty && (
        <div className="messages-container">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isStreaming && (
            <div className="message-bot">
              <div className="avatar bot-avatar">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div className="msg-content">
                <div className="meta">
                  <span className="msg-name">Chat AI</span>
                  <span className="msg-time">
                    {new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="bubble bot-bubble">
                  {streamingContent ? (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                  ) : (
                    <span className="typing-indicator">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {botError && (
            <div className="message-bot">
              <div className="avatar bot-avatar">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div className="msg-content">
                <div className="meta">
                  <span className="msg-name">Chat AI</span>
                </div>
                <div className="bubble bot-bubble error-bubble">
                  <p>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '4px' }}
                    >
                      error
                    </span>
                    {botError}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="spacer" />
    </div>
  );
}
