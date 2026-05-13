import type { Message } from '../../lib/db';
import { UserMessage } from './messages/UserMessage';
import { BotMessage } from './messages/BotMessage';

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  return message.role === 'user'
    ? <UserMessage message={message} />
    : <BotMessage message={message} />;
}
