// src/components/react/MainArea.tsx

import { ChatHeader } from './ChatHeader';
import { MessageArea } from './MessageArea';
import { ChatInput } from './ChatInput';

export function MainArea() {
  return (
    <main className="main-area">
      <ChatHeader />
      <MessageArea />
      <ChatInput />
    </main>
  );
}
