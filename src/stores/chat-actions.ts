import { $initialized, $session, $chats, $activeChatId, $messages, $isStreaming, $streamingContent, $botError, $searchQuery, $researchProgress } from './chat-store';
import type { Chat, Message } from '../lib/db';
import type { UserSession } from '../lib/session';
import type { ResearchProgressEvent } from '../lib/api/research-tools';

export function initStore(session: UserSession, chats: Chat[], activeChatId: string, messages: Message[]): void {
  $session.set(session); $chats.set(chats); $activeChatId.set(activeChatId); $messages.set(messages); $initialized.set(true);
}

export function setChats(chats: Chat[]): void { $chats.set(chats); }

export function setActiveChat(chatId: string, messages: Message[]): void {
  $activeChatId.set(chatId); $messages.set(messages); $isStreaming.set(false); $streamingContent.set(''); $botError.set(null);
}

export function addUserMessage(message: Message): void { $messages.set([...$messages.get(), message]); }

export function startStreaming(): void { $isStreaming.set(true); $streamingContent.set(''); $botError.set(null); }

export function updateStreaming(content: string): void { $streamingContent.set(content); }

export function finishStreaming(message: Message): void {
  $isStreaming.set(false); $streamingContent.set(''); $messages.set([...$messages.get(), message]);
}

export function setBotError(error: string): void {
  $isStreaming.set(false); $streamingContent.set('');
  $botError.set(String(error).replace(/<[^>]*>/g, '').slice(0, 200));
}

export function clearBotError(): void { $botError.set(null); }

export function setSearchQuery(query: string): void { $searchQuery.set(query); }

export function updateChatInList(chat: Chat): void {
  const updated = $chats.get().map((c) => (c.id === chat.id ? chat : c)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  $chats.set(updated);
}

export function removeChatFromList(chatId: string): void { $chats.set($chats.get().filter((c) => c.id !== chatId)); }

export function setResearchProgress(event: ResearchProgressEvent): void { $researchProgress.set(event); }

export function clearResearchProgress(): void { $researchProgress.set(null); }
