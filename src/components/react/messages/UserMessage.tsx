import { memo, useRef } from 'react';
import type { Message } from '../../../lib/db';
import { MessageAvatar } from './MessageAvatar';
import { MessageMeta, formatTime } from './MessageMeta';
import { AttachmentCard } from './AttachmentCard';
import { parseFileMessage } from '../utils/parse-file-message';
import { useReuseInInput } from './hooks/useReuseInInput';

interface Props {
  message: Message;
}

function UserMessageImpl({ message }: Props) {
  const time = formatTime(message.createdAt);
  const { displayContent, attachmentData } = parseFileMessage(message.content);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { onMouseDown, onClick } = useReuseInInput(bubbleRef, displayContent);

  return (
    <div className="message-user">
      <MessageAvatar role="user" />
      <div className="msg-content flex flex-col items-end">
        <MessageMeta name="Tu" time={time} />
        <div className="message-user-attachment-container">
          {attachmentData && (
            <AttachmentCard name={attachmentData.name} type={attachmentData.type} />
          )}
          {displayContent && (
            <div className="user-bubble-wrapper">
              <div ref={bubbleRef} className="bubble user-bubble">
                <p>{displayContent}</p>
              </div>
              <button
                type="button"
                className="reuse-btn"
                title="Usar en el input"
                aria-label="Usar este mensaje en el input"
                onMouseDown={onMouseDown}
                onClick={onClick}
              >
                <span className="material-symbols-outlined" aria-hidden="true">content_paste_go</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// message es referencialmente estable mientras no cambie de contenido
// (ver nota en MessageBubble.tsx), por lo que la comparación shallow
// por defecto de memo evita re-ejecutar useReuseInInput/parseFileMessage.
export const UserMessage = memo(UserMessageImpl);
