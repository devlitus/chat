import { memo } from 'react';
import type { Message } from '../../lib/db';
import { UserMessage } from './messages/UserMessage';
import { BotMessage } from './messages/BotMessage';

interface Props {
  message: Message;
}

function MessageBubbleImpl({ message }: Props) {
  return message.role === 'user'
    ? <UserMessage message={message} />
    : <BotMessage message={message} />;
}

// Los objetos Message son inmutables una vez añadidos a $messages
// (chat-actions.ts nunca muta un Message existente, solo reemplaza el
// array con [...anteriores, nuevo]), por lo que la comparación superficial
// por defecto de memo es suficiente: si `message` mantiene la misma
// referencia, se salta el re-render.
export const MessageBubble = memo(MessageBubbleImpl);
