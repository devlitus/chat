// src/stores/chat-store.ts

import { atom } from 'nanostores';
import type { Chat, Message } from '../lib/db';
import type { UserSession } from '../lib/session';
import type { ResearchProgressEvent } from '../lib/api/research-tools';

export const $initialized = atom<boolean>(false);
export const $session = atom<UserSession | null>(null);
export const $chats = atom<Chat[]>([]);
export const $activeChatId = atom<string | null>(null);
export const $messages = atom<Message[]>([]);
export const $isStreaming = atom<boolean>(false);
export const $streamingContent = atom<string>('');
export const $botError = atom<string | null>(null);
export const $searchQuery = atom<string>('');
export const $selectedModel = atom<string>('');
export const $selectedProvider = atom<'ollama' | 'groq'>('ollama');
export const $selectedGroqModel = atom<string>('llama-3.3-70b-versatile');
export const $researchMode = atom<boolean>(false);
export const $researchProgress = atom<ResearchProgressEvent | null>(null);
