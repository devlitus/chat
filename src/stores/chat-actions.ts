// src/stores/chat-actions.ts
//
// Reemplaza el reducer de ChatContext. Cada funcion muta los atoms del store
// y mantiene la misma logica de negocio que las 12 acciones originales.

import {
  $initialized,
  $session,
  $chats,
  $activeChatId,
  $messages,
  $isStreaming,
  $streamingContent,
  $botError,
  $searchQuery,
} from './chat-store';
import type { Chat, Message } from '../lib/db';
import type { UserSession } from '../lib/session';

// ============================================================
// INIT — equivale al case 'INIT' del reducer
// ============================================================
export function initStore(
  session: UserSession,
  chats: Chat[],
  activeChatId: string,
  messages: Message[]
): void {
  $session.set(session);
  $chats.set(chats);
  $activeChatId.set(activeChatId);
  $messages.set(messages);
  $initialized.set(true);
}

// ============================================================
// SET_CHATS — equivale al case 'SET_CHATS'
// ============================================================
export function setChats(chats: Chat[]): void {
  $chats.set(chats);
}

// ============================================================
// SET_ACTIVE_CHAT — equivale al case 'SET_ACTIVE_CHAT'
// Resetea streaming y error al cambiar de chat.
// ============================================================
export function setActiveChat(chatId: string, messages: Message[]): void {
  $activeChatId.set(chatId);
  $messages.set(messages);
  $isStreaming.set(false);
  $streamingContent.set('');
  $botError.set(null);
}

// ============================================================
// ADD_USER_MESSAGE — equivale al case 'ADD_USER_MESSAGE'
// ============================================================
export function addUserMessage(message: Message): void {
  $messages.set([...$messages.get(), message]);
}

// ============================================================
// START_STREAMING — equivale al case 'START_STREAMING'
// ============================================================
export function startStreaming(): void {
  $isStreaming.set(true);
  $streamingContent.set('');
  $botError.set(null);
}

// ============================================================
// UPDATE_STREAMING — equivale al case 'UPDATE_STREAMING'
// ============================================================
export function updateStreaming(content: string): void {
  $streamingContent.set(content);
}

// ============================================================
// FINISH_STREAMING — equivale al case 'FINISH_STREAMING'
// ============================================================
export function finishStreaming(message: Message): void {
  $isStreaming.set(false);
  $streamingContent.set('');
  $messages.set([...$messages.get(), message]);
}

// ============================================================
// SET_BOT_ERROR — equivale al case 'SET_BOT_ERROR'
// ============================================================
export function setBotError(error: string): void {
  $isStreaming.set(false);
  $streamingContent.set('');
  // Truncar a 200 chars y eliminar posibles tags HTML
  const safeError = String(error).replace(/<[^>]*>/g, '').slice(0, 200);
  $botError.set(safeError);
}

// ============================================================
// CLEAR_BOT_ERROR — equivale al case 'CLEAR_BOT_ERROR'
// ============================================================
export function clearBotError(): void {
  $botError.set(null);
}

// ============================================================
// SET_SEARCH_QUERY — equivale al case 'SET_SEARCH_QUERY'
// ============================================================
export function setSearchQuery(query: string): void {
  $searchQuery.set(query);
}

// ============================================================
// UPDATE_CHAT_IN_LIST — equivale al case 'UPDATE_CHAT_IN_LIST'
// Reemplaza el chat en la lista y reordena por updatedAt desc.
// ============================================================
export function updateChatInList(chat: Chat): void {
  const updated = $chats
    .get()
    .map((c) => (c.id === chat.id ? chat : c))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  $chats.set(updated);
}

// ============================================================
// REMOVE_CHAT_FROM_LIST — equivale al case 'REMOVE_CHAT_FROM_LIST'
// ============================================================
export function removeChatFromList(chatId: string): void {
  $chats.set($chats.get().filter((c) => c.id !== chatId));
}
