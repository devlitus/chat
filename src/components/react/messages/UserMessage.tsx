import type { Message } from '../../../lib/db';
import { MessageAvatar } from './MessageAvatar';
import { MessageMeta, formatTime } from './MessageMeta';
import { AttachmentCard } from './AttachmentCard';
import { parseFileMessage } from '../utils/parse-file-message';

interface Props {
  message: Message;
}

export function UserMessage({ message }: Props) {
  const time = formatTime(message.createdAt);
  const { displayContent, attachmentData } = parseFileMessage(message.content);

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
            <div className="bubble user-bubble">
              <p>{displayContent}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
