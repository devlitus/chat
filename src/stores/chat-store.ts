// src/stores/chat-store.ts

import { atom } from 'nanostores';
import type { Chat, Message } from '../lib/db';
import type { UserSession } from '../lib/session';

export const $initialized = atom<boolean>(false);
export const $session = atom<UserSession | null>(null);
export const $chats = atom<Chat[]>([]);
export const $activeChatId = atom<string | null>(null);
export const $messages = atom<Message[]>([]);
export const $isStreaming = atom<boolean>(false);
export const $streamingContent = atom<string>('');
export const $botError = atom<string | null>(null);
export const $searchQuery = atom<string>('');
