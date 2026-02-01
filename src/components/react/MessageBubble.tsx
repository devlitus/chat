// src/components/react/MessageBubble.tsx

import { useMemo } from 'react';
import type { Message } from '../../lib/db';
import { renderMarkdown } from '../../lib/markdown';

interface Props {
  message: Message;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message }: Props) {
  const time = formatTime(message.createdAt);

  const renderedHtml = useMemo(() => {
    if (message.role === 'assistant') {
      return renderMarkdown(message.content);
    }
    return null;
  }, [message.content, message.role]);

  if (message.role === 'user') {
    return (
      <div className="message-user">
        <div className="avatar user-avatar">
          <span className="material-symbols-outlined">person</span>
        </div>
        <div className="msg-content">
          <div className="meta">
            <span className="msg-time">{time}</span>
            <span className="msg-name">Tu</span>
          </div>
          <div className="bubble user-bubble">
            <p>{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-bot">
      <div className="avatar bot-avatar">
        <span className="material-symbols-outlined">smart_toy</span>
      </div>
      <div className="msg-content">
        <div className="meta">
          <span className="msg-name">Chat AI</span>
          <span className="msg-time">{time}</span>
        </div>
        <div
          className="bubble bot-bubble"
          dangerouslySetInnerHTML={{ __html: renderedHtml! }}
        />
      </div>
    </div>
  );
}
