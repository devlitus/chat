import { memo, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Message } from '../../../lib/db';
import { renderMarkdown } from '../../../lib/markdown';
import { MessageAvatar } from '../messages/MessageAvatar';
import { MessageMeta, formatTime } from '../messages/MessageMeta';
import { WidgetFrame } from '../widgets/WidgetFrame';

interface Props {
  message: Message;
}

function BotMessageImpl({ message }: Props) {
  const time = formatTime(message.createdAt);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const renderedHtml = useMemo(() => renderMarkdown(message.content), [message.content]);

  const handleCopy = useCallback((e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest('.copy-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const code = decodeURIComponent(btn.dataset.code ?? '');
    navigator.clipboard.writeText(code).then(() => {
      const icon = btn.querySelector('.material-symbols-outlined')!;
      const prev = icon.textContent;
      icon.textContent = 'check';
      btn.style.color = '#3fb950';
      setTimeout(() => { icon.textContent = prev; btn.style.color = ''; }, 1500);
    });
  }, []);

  useEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    el.addEventListener('click', handleCopy);
    return () => el.removeEventListener('click', handleCopy);
  }, [handleCopy]);

  if (message.uiResourceUri) {
    return (
      <div className="message-bot">
        <MessageAvatar role="assistant" />
        <div className="msg-content">
          <MessageMeta name="Chat AI" time={time} />
          <WidgetFrame uiResourceUri={message.uiResourceUri} message={message} />
        </div>
      </div>
    );
  }

  return (
    <div className="message-bot">
      <MessageAvatar role="assistant" />
      <div className="msg-content">
        <MessageMeta name="Chat AI" time={time} />
        <div ref={bubbleRef} className="bubble bot-bubble" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      </div>
    </div>
  );
}

// message es referencialmente estable mientras no cambie de contenido
// (ver nota en MessageBubble.tsx), por lo que la comparación shallow
// por defecto de memo evita recomputar renderMarkdown/handleCopy.
export const BotMessage = memo(BotMessageImpl);
