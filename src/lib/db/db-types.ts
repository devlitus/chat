export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  uiResourceUri?: string;
  createdAt: string;
}
