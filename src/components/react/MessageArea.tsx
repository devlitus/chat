import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $messages, $isStreaming, $streamingContent, $botError, $initialized, $researchMode } from '../../stores/chat-store';
import { MessageBubble } from './MessageBubble';
import { SuggestionChips } from './SuggestionChips';
import { ResearchProgress } from './research/ResearchProgress';

function StreamingIndicator() {
  return (
    <div className="message-bot">
      <div className="avatar bot-avatar"><span className="material-symbols-outlined">smart_toy</span></div>
      <div className="msg-content">
        <div className="meta"><span className="msg-name">Chat AI</span><span className="msg-time">{new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div className="bubble bot-bubble">
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', fontStyle: 'italic', minWidth: '110px', minHeight: '24px' }}>
            <svg aria-hidden="true" style={{ height: '20px', width: '20px', color: '#06b6d4', animation: 'local-spin 1s linear infinite', flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="sr-only">El asistente está procesando</span><span aria-hidden="true">Pensando...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBubble({ error }: { error: string }) {
  return (
    <div className="message-bot">
      <div className="avatar bot-avatar"><span className="material-symbols-outlined">smart_toy</span></div>
      <div className="msg-content">
        <div className="meta"><span className="msg-name">Chat AI</span></div>
        <div className="bubble bot-bubble error-bubble" role="alert">
          <p><span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '4px' }}>error</span>{error}</p>
        </div>
      </div>
    </div>
  );
}

export function MessageArea() {
  const messages = useStore($messages);
  const isStreaming = useStore($isStreaming);
  const streamingContent = useStore($streamingContent);
  const botError = useStore($botError);
  const initialized = useStore($initialized);
  const researchMode = useStore($researchMode);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, [messages, streamingContent, botError]);

  if (!initialized) return <div className="message-area" />;

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="message-area" ref={containerRef}>
      {isEmpty && <div className="empty-state"><div className="empty-icon"><span className="material-symbols-outlined">chat_bubble_outline</span></div><h3>Inicia una conversacion</h3><p>Escribe un mensaje o selecciona una sugerencia</p><SuggestionChips /></div>}
      {!isEmpty && (
        <div className="messages-container" role="log" aria-live="polite" aria-label="Conversación">
          {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
          {isStreaming && (researchMode ? <ResearchProgress /> : <StreamingIndicator />)}
          {botError && <ErrorBubble error={botError} />}
        </div>
      )}
      <div className="spacer" />
    </div>
  );
}
