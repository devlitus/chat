# Plan de Implementacion Tecnico - Chat con Asistente IA (React)

## Resumen

Plan detallado para convertir la UI estatica actual en una aplicacion funcional de chat con IA. Usa un unico React island (`client:load`) que encapsula toda la interactividad del chat, reemplazando el enfoque anterior de vanilla JS con Custom Events y manipulacion DOM directa.

---

## Indice

1. [Dependencias e Infraestructura](#1-dependencias-e-infraestructura)
2. [Archivos Nuevos - Libreria (src/lib/)](#2-archivos-nuevos---libreria)
3. [Archivo Nuevo - API Endpoint](#3-archivo-nuevo---api-endpoint)
4. [Componentes React (src/components/react/)](#4-componentes-react)
5. [Modificaciones a Componentes Astro](#5-modificaciones-a-componentes-astro)
6. [Orden de Implementacion](#6-orden-de-implementacion)

---

## 1. Dependencias e Infraestructura

### 1.1 Instalar dependencias

```bash
pnpm add @astrojs/node marked
```

> `groq-sdk`, `react`, `react-dom`, `@astrojs/react`, `@types/react`, `@types/react-dom` ya estan instalados.

### 1.2 Modificar `astro.config.mjs`

```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  output: 'hybrid',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
});
```

### 1.3 Verificar `.env`

Debe existir `D:\work\chat\.env` con:

```text
GROQ_API_KEY=gsk_xxxxxxxxxxxx
```

---

## 2. Archivos Nuevos - Libreria

Las librerias en `src/lib/` son funciones puras de TypeScript que se ejecutan en el cliente. Se mantienen identicas al plan anterior porque no dependen del framework de UI.

### 2.1 `src/lib/db.ts` - IndexedDB CRUD

**Dependencias**: ninguna
**Usado por**: componentes React via hooks

```typescript
// src/lib/db.ts

// ============================================================
// Interfaces
// ============================================================

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
  createdAt: string;
}

// ============================================================
// Constantes
// ============================================================

const DB_NAME = 'chat-app-db';
const DB_VERSION = 1;

// ============================================================
// Inicializacion
// ============================================================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('chats')) {
        const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
        chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        chatStore.createIndex('title', 'title', { unique: false });
      }

      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('chatId', 'chatId', { unique: false });
        msgStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper generico para transacciones
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

// ============================================================
// CRUD de Chats
// ============================================================

export async function createChat(title: string = 'Nuevo chat'): Promise<Chat> {
  const now = new Date().toISOString();
  const chat: Chat = {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
  await withStore('chats', 'readwrite', (store) => store.add(chat));
  return chat;
}

export async function getChat(id: string): Promise<Chat | undefined> {
  return withStore('chats', 'readonly', (store) => store.get(id));
}

export async function getAllChats(): Promise<Chat[]> {
  const chats = await withStore<Chat[]>('chats', 'readonly', (store) => store.getAll());
  return chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function updateChat(id: string, updates: Partial<Pick<Chat, 'title' | 'updatedAt' | 'messageCount'>>): Promise<Chat> {
  const chat = await getChat(id);
  if (!chat) throw new Error(`Chat ${id} not found`);
  const updated = { ...chat, ...updates };
  await withStore('chats', 'readwrite', (store) => store.put(updated));
  return updated;
}

export async function deleteChat(id: string): Promise<void> {
  const messages = await getMessagesByChatId(id);
  const db = await openDB();
  const tx = db.transaction(['chats', 'messages'], 'readwrite');
  tx.objectStore('chats').delete(id);
  for (const msg of messages) {
    tx.objectStore('messages').delete(msg.id);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function searchChats(query: string): Promise<Chat[]> {
  const all = await getAllChats();
  const lower = query.toLowerCase();
  return all.filter((c) => c.title.toLowerCase().includes(lower));
}

// ============================================================
// CRUD de Messages
// ============================================================

export async function addMessage(chatId: string, role: 'user' | 'assistant', content: string): Promise<Message> {
  const now = new Date().toISOString();
  const message: Message = {
    id: crypto.randomUUID(),
    chatId,
    role,
    content,
    createdAt: now,
  };
  await withStore('messages', 'readwrite', (store) => store.add(message));
  const chat = await getChat(chatId);
  if (chat) {
    await updateChat(chatId, {
      updatedAt: now,
      messageCount: chat.messageCount + 1,
    });
  }
  return message;
}

export async function getMessagesByChatId(chatId: string): Promise<Message[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('chatId');
    const request = index.getAll(chatId);
    request.onsuccess = () => {
      const msgs = request.result as Message[];
      resolve(msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
```

---

### 2.2 `src/lib/session.ts` - Sesion en localStorage

**Dependencias**: ninguna

```typescript
// src/lib/session.ts

export interface UserSession {
  userId: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
  lastActiveChatId: string | null;
}

const STORAGE_KEY = 'chat-app-user';

export function getSession(): UserSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function createSession(): UserSession {
  const session: UserSession = {
    userId: crypto.randomUUID(),
    displayName: 'Usuario',
    avatarUrl: '',
    createdAt: new Date().toISOString(),
    lastActiveChatId: null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function updateSession(updates: Partial<UserSession>): UserSession {
  const current = getSession();
  if (!current) throw new Error('No session found');
  const updated = { ...current, ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function getOrCreateSession(): UserSession {
  return getSession() ?? createSession();
}
```

---

### 2.3 `src/lib/markdown.ts` - Renderizado de Markdown

**Dependencias**: `marked` (npm)

```typescript
// src/lib/markdown.ts

import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function renderMarkdown(content: string): string {
  const html = marked.parse(content) as string;
  return html;
}

export function renderStreamingMarkdown(accumulatedContent: string): string {
  return renderMarkdown(accumulatedContent);
}
```

---

### 2.4 `src/lib/groq-client.ts` - Cliente de streaming

**Dependencias**: ninguna (usa fetch nativo)

```typescript
// src/lib/groq-client.ts

export interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function* streamChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): AsyncGenerator<string, void, unknown> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages } satisfies ChatRequestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No readable stream');

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          // Linea parcial, ignorar
        }
      }
    }
  }
}
```

---

## 3. Archivo Nuevo - API Endpoint

### 3.1 `src/pages/api/chat.ts`

**Dependencias**: `groq-sdk` (ya instalado)
**Variable de entorno**: `GROQ_API_KEY`

```typescript
// src/pages/api/chat.ts

import type { APIRoute } from 'astro';
import Groq from 'groq-sdk';

export const prerender = false;

const groq = new Groq({
  apiKey: import.meta.env.GROQ_API_KEY,
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role)) {
        return new Response(JSON.stringify({ error: 'Invalid message format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente de IA util y amigable. Responde de forma clara y concisa. Puedes usar Markdown para formatear tus respuestas.',
        },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of chatCompletion) {
            const data = JSON.stringify(chunk);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

---

## 4. Componentes React

### Arquitectura: Un unico React island

Toda la interactividad del chat se encapsula en un **unico componente React raiz** (`ChatApp.tsx`) que se monta como island con `client:load` en el layout Astro. Esto permite:

- Usar React Context para estado compartido (en vez de Custom Events)
- Usar hooks (`useState`, `useEffect`, `useRef`, `useCallback`) en vez de manipulacion DOM
- Comunicacion natural entre componentes via props y context
- Un solo punto de hidratacion (mejor rendimiento que multiples islands)

### Estructura de archivos React

```text
src/components/react/
  ChatApp.tsx            -- Componente raiz (Provider + layout)
  ChatContext.tsx         -- Context + reducer para estado global
  Sidebar.tsx            -- Sidebar completo
  SidebarHeader.tsx      -- Logo y menu
  NewChatButton.tsx      -- Boton nuevo chat
  SearchInput.tsx        -- Input de busqueda
  ChatHistoryList.tsx    -- Lista de chats agrupados
  UserProfile.tsx        -- Perfil del usuario
  MainArea.tsx           -- Area principal (header + mensajes + input)
  ChatHeader.tsx         -- Header con titulo
  MessageArea.tsx        -- Area de mensajes con scroll
  MessageBubble.tsx      -- Bubble individual (user o bot)
  SuggestionChips.tsx    -- Chips de sugerencias
  ChatInput.tsx          -- Textarea + boton enviar
```

---

### 4.1 `src/components/react/ChatContext.tsx` - Estado global

```tsx
// src/components/react/ChatContext.tsx

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Chat, Message } from '../../lib/db';
import type { UserSession } from '../../lib/session';

// ============================================================
// Tipos del estado
// ============================================================

export interface ChatState {
  /** Sesion del usuario */
  session: UserSession | null;
  /** Lista de todos los chats, ordenados por updatedAt desc */
  chats: Chat[];
  /** ID del chat activo */
  activeChatId: string | null;
  /** Mensajes del chat activo */
  messages: Message[];
  /** Indica si el bot esta respondiendo (streaming) */
  isStreaming: boolean;
  /** Contenido parcial durante streaming */
  streamingContent: string;
  /** Error del bot (null si no hay error) */
  botError: string | null;
  /** Query de busqueda en el sidebar */
  searchQuery: string;
  /** Indica si la app termino de inicializarse */
  initialized: boolean;
}

// ============================================================
// Acciones
// ============================================================

export type ChatAction =
  | { type: 'INIT'; session: UserSession; chats: Chat[]; activeChatId: string; messages: Message[] }
  | { type: 'SET_CHATS'; chats: Chat[] }
  | { type: 'SET_ACTIVE_CHAT'; chatId: string; messages: Message[] }
  | { type: 'ADD_USER_MESSAGE'; message: Message }
  | { type: 'START_STREAMING' }
  | { type: 'UPDATE_STREAMING'; content: string }
  | { type: 'FINISH_STREAMING'; message: Message }
  | { type: 'SET_BOT_ERROR'; error: string }
  | { type: 'CLEAR_BOT_ERROR' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'UPDATE_CHAT_IN_LIST'; chat: Chat }
  | { type: 'REMOVE_CHAT_FROM_LIST'; chatId: string };

// ============================================================
// Estado inicial
// ============================================================

const initialState: ChatState = {
  session: null,
  chats: [],
  activeChatId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  botError: null,
  searchQuery: '',
  initialized: false,
};

// ============================================================
// Reducer
// ============================================================

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        session: action.session,
        chats: action.chats,
        activeChatId: action.activeChatId,
        messages: action.messages,
        initialized: true,
      };

    case 'SET_CHATS':
      return { ...state, chats: action.chats };

    case 'SET_ACTIVE_CHAT':
      return {
        ...state,
        activeChatId: action.chatId,
        messages: action.messages,
        isStreaming: false,
        streamingContent: '',
        botError: null,
      };

    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case 'START_STREAMING':
      return {
        ...state,
        isStreaming: true,
        streamingContent: '',
        botError: null,
      };

    case 'UPDATE_STREAMING':
      return {
        ...state,
        streamingContent: action.content,
      };

    case 'FINISH_STREAMING':
      return {
        ...state,
        isStreaming: false,
        streamingContent: '',
        messages: [...state.messages, action.message],
      };

    case 'SET_BOT_ERROR':
      return {
        ...state,
        isStreaming: false,
        streamingContent: '',
        botError: action.error,
      };

    case 'CLEAR_BOT_ERROR':
      return { ...state, botError: null };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

    case 'UPDATE_CHAT_IN_LIST':
      return {
        ...state,
        chats: state.chats
          .map((c) => (c.id === action.chat.id ? action.chat : c))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      };

    case 'REMOVE_CHAT_FROM_LIST':
      return {
        ...state,
        chats: state.chats.filter((c) => c.id !== action.chatId),
      };

    default:
      return state;
  }
}

// ============================================================
// Context
// ============================================================

const ChatStateContext = createContext<ChatState>(initialState);
const ChatDispatchContext = createContext<Dispatch<ChatAction>>(() => {});

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  return (
    <ChatStateContext.Provider value={state}>
      <ChatDispatchContext.Provider value={dispatch}>
        {children}
      </ChatDispatchContext.Provider>
    </ChatStateContext.Provider>
  );
}

export function useChatState(): ChatState {
  return useContext(ChatStateContext);
}

export function useChatDispatch(): Dispatch<ChatAction> {
  return useContext(ChatDispatchContext);
}
```

---

### 4.2 `src/components/react/ChatApp.tsx` - Componente raiz

```tsx
// src/components/react/ChatApp.tsx

import { useEffect } from 'react';
import { ChatProvider, useChatDispatch } from './ChatContext';
import { getOrCreateSession, updateSession } from '../../lib/session';
import { getAllChats, createChat, getChat, getMessagesByChatId } from '../../lib/db';
import { Sidebar } from './Sidebar';
import { MainArea } from './MainArea';

function ChatAppInner() {
  const dispatch = useChatDispatch();

  useEffect(() => {
    async function init() {
      const session = getOrCreateSession();
      let chatId: string;

      if (session.lastActiveChatId) {
        const chat = await getChat(session.lastActiveChatId);
        if (chat) {
          chatId = chat.id;
        } else {
          const newChat = await createChat();
          chatId = newChat.id;
        }
      } else {
        const allChats = await getAllChats();
        if (allChats.length > 0) {
          chatId = allChats[0].id;
        } else {
          const newChat = await createChat();
          chatId = newChat.id;
        }
      }

      updateSession({ lastActiveChatId: chatId });

      const chats = await getAllChats();
      const messages = await getMessagesByChatId(chatId);

      dispatch({
        type: 'INIT',
        session,
        chats,
        activeChatId: chatId,
        messages,
      });
    }

    init();
  }, [dispatch]);

  return (
    <div className="chat-layout">
      <Sidebar />
      <MainArea />
    </div>
  );
}

export default function ChatApp() {
  return (
    <ChatProvider>
      <ChatAppInner />
    </ChatProvider>
  );
}
```

---

### 4.3 `src/components/react/Sidebar.tsx`

```tsx
// src/components/react/Sidebar.tsx

import { SidebarHeader } from './SidebarHeader';
import { NewChatButton } from './NewChatButton';
import { SearchInput } from './SearchInput';
import { ChatHistoryList } from './ChatHistoryList';
import { UserProfile } from './UserProfile';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <SidebarHeader />
      <NewChatButton />
      <SearchInput />
      <ChatHistoryList />
      <UserProfile />
    </aside>
  );
}
```

---

### 4.4 `src/components/react/SidebarHeader.tsx`

```tsx
// src/components/react/SidebarHeader.tsx

export function SidebarHeader() {
  return (
    <div className="sidebar-header">
      <div className="brand">
        <div className="brand-icon">
          <span className="material-symbols-outlined">smart_toy</span>
        </div>
        <h1>Chat AI</h1>
      </div>
      <button className="menu-btn" title="Toggle menu">
        <span className="material-symbols-outlined">menu_open</span>
      </button>
    </div>
  );
}
```

---

### 4.5 `src/components/react/NewChatButton.tsx`

```tsx
// src/components/react/NewChatButton.tsx

import { useCallback } from 'react';
import { useChatDispatch } from './ChatContext';
import { createChat, getAllChats, getMessagesByChatId } from '../../lib/db';
import { updateSession } from '../../lib/session';

export function NewChatButton() {
  const dispatch = useChatDispatch();

  const handleClick = useCallback(async () => {
    const chat = await createChat();
    updateSession({ lastActiveChatId: chat.id });
    const chats = await getAllChats();
    const messages = await getMessagesByChatId(chat.id);

    dispatch({ type: 'SET_CHATS', chats });
    dispatch({ type: 'SET_ACTIVE_CHAT', chatId: chat.id, messages });
  }, [dispatch]);

  return (
    <div className="new-chat-wrapper">
      <button className="new-chat-btn" onClick={handleClick}>
        <span className="material-symbols-outlined">add</span>
        <span>New Chat</span>
      </button>
    </div>
  );
}
```

---

### 4.6 `src/components/react/SearchInput.tsx`

```tsx
// src/components/react/SearchInput.tsx

import { useCallback, useRef } from 'react';
import { useChatDispatch } from './ChatContext';

export function SearchInput() {
  const dispatch = useChatDispatch();
  const timerRef = useRef<number>(0);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      clearTimeout(timerRef.current);
      const value = e.target.value;
      timerRef.current = window.setTimeout(() => {
        dispatch({ type: 'SET_SEARCH_QUERY', query: value.trim() });
      }, 250);
    },
    [dispatch]
  );

  return (
    <div className="search-wrapper">
      <label className="search-label">
        <div className="search-container">
          <div className="search-icon">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            type="text"
            placeholder="Search history..."
            aria-label="Search chat history"
            onChange={handleInput}
          />
        </div>
      </label>
    </div>
  );
}
```

---

### 4.7 `src/components/react/ChatHistoryList.tsx`

```tsx
// src/components/react/ChatHistoryList.tsx

import { useCallback, useMemo } from 'react';
import { useChatState, useChatDispatch } from './ChatContext';
import { deleteChat, getAllChats, getMessagesByChatId, searchChats } from '../../lib/db';
import { updateSession } from '../../lib/session';
import type { Chat } from '../../lib/db';

function groupChatsByDate(chats: Chat[]): Map<string, Chat[]> {
  const groups = new Map<string, Chat[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7days = new Date(today.getTime() - 7 * 86400000);

  for (const chat of chats) {
    const chatDate = new Date(chat.updatedAt);
    let label: string;
    if (chatDate >= today) {
      label = 'Hoy';
    } else if (chatDate >= yesterday) {
      label = 'Ayer';
    } else if (chatDate >= last7days) {
      label = 'Ultimos 7 dias';
    } else {
      label = 'Anteriores';
    }
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(chat);
  }
  return groups;
}

export function ChatHistoryList() {
  const { chats, activeChatId, searchQuery } = useChatState();
  const dispatch = useChatDispatch();

  const filteredChats = useMemo(() => {
    if (!searchQuery) return chats;
    const lower = searchQuery.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(lower));
  }, [chats, searchQuery]);

  const groups = useMemo(() => groupChatsByDate(filteredChats), [filteredChats]);

  const handleSelectChat = useCallback(
    async (chatId: string) => {
      if (chatId === activeChatId) return;
      updateSession({ lastActiveChatId: chatId });
      const messages = await getMessagesByChatId(chatId);
      dispatch({ type: 'SET_ACTIVE_CHAT', chatId, messages });
    },
    [activeChatId, dispatch]
  );

  const handleDeleteChat = useCallback(
    async (chatId: string, e: React.MouseEvent) => {
      e.preventDefault();
      if (!confirm('Eliminar este chat?')) return;

      await deleteChat(chatId);
      dispatch({ type: 'REMOVE_CHAT_FROM_LIST', chatId });

      if (chatId === activeChatId) {
        const remaining = await getAllChats();
        if (remaining.length > 0) {
          const newActiveId = remaining[0].id;
          updateSession({ lastActiveChatId: newActiveId });
          const messages = await getMessagesByChatId(newActiveId);
          dispatch({ type: 'SET_ACTIVE_CHAT', chatId: newActiveId, messages });
        } else {
          // Crear un chat nuevo si no quedan
          const { createChat } = await import('../../lib/db');
          const newChat = await createChat();
          updateSession({ lastActiveChatId: newChat.id });
          const allChats = await getAllChats();
          dispatch({ type: 'SET_CHATS', chats: allChats });
          dispatch({ type: 'SET_ACTIVE_CHAT', chatId: newChat.id, messages: [] });
        }
      }
    },
    [activeChatId, dispatch]
  );

  if (filteredChats.length === 0) {
    return (
      <div className="history-list">
        <div className="history-empty">
          {searchQuery ? 'Sin resultados' : 'No hay chats aun'}
        </div>
      </div>
    );
  }

  return (
    <div className="history-list">
      {Array.from(groups.entries()).map(([label, groupChats]) => (
        <div className="history-group" key={label}>
          <h3>{label}</h3>
          {groupChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const icon = isActive ? 'chat_bubble' : 'chat_bubble_outline';
            return (
              <button
                key={chat.id}
                className={`chat-item${isActive ? ' active' : ''}`}
                onClick={() => handleSelectChat(chat.id)}
                onContextMenu={(e) => handleDeleteChat(chat.id, e)}
              >
                <span className="material-symbols-outlined chat-item-icon">{icon}</span>
                <div className="chat-item-content">
                  <p>{chat.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

---

### 4.8 `src/components/react/UserProfile.tsx`

```tsx
// src/components/react/UserProfile.tsx

import { useChatState } from './ChatContext';

export function UserProfile() {
  const { session } = useChatState();
  const displayName = session?.displayName ?? 'Usuario';

  return (
    <div className="user-profile">
      <button className="profile-btn">
        <div className="profile-avatar">
          <span
            className="material-symbols-outlined"
            style={{ color: 'var(--color-text-secondary)', fontSize: '20px' }}
          >
            person
          </span>
        </div>
        <div className="profile-info">
          <p className="profile-name">{displayName}</p>
          <p className="profile-plan">Free Plan</p>
        </div>
        <span className="material-symbols-outlined settings-icon">settings</span>
      </button>
    </div>
  );
}
```

---

### 4.9 `src/components/react/MainArea.tsx`

```tsx
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
```

---

### 4.10 `src/components/react/ChatHeader.tsx`

```tsx
// src/components/react/ChatHeader.tsx

import { useMemo } from 'react';
import { useChatState } from './ChatContext';

export function ChatHeader() {
  const { chats, activeChatId } = useChatState();

  const title = useMemo(() => {
    const chat = chats.find((c) => c.id === activeChatId);
    return chat?.title ?? 'Nuevo chat';
  }, [chats, activeChatId]);

  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <h2>
          <span className="material-symbols-outlined star-icon">auto_awesome</span>
          <span>{title}</span>
        </h2>
        <span className="badge">Model v4.0</span>
      </div>
      <div className="chat-header-right">
        <button className="fav-btn">
          <span className="material-symbols-outlined heart-icon">favorite</span>
          <span className="fav-text">Favorite Chats</span>
        </button>
      </div>
    </header>
  );
}
```

---

### 4.11 `src/components/react/MessageArea.tsx`

```tsx
// src/components/react/MessageArea.tsx

import { useEffect, useRef } from 'react';
import { useChatState } from './ChatContext';
import { MessageBubble } from './MessageBubble';
import { SuggestionChips } from './SuggestionChips';
import { renderMarkdown } from '../../lib/markdown';

export function MessageArea() {
  const { messages, isStreaming, streamingContent, botError, initialized } = useChatState();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al fondo cuando cambian los mensajes o el streaming
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, streamingContent, botError]);

  if (!initialized) {
    return <div className="message-area" />;
  }

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="message-area" ref={containerRef}>
      {isEmpty && (
        <div className="empty-state">
          <div className="empty-icon">
            <span className="material-symbols-outlined">chat_bubble_outline</span>
          </div>
          <h3>Inicia una conversacion</h3>
          <p>Escribe un mensaje o selecciona una sugerencia</p>
          <SuggestionChips />
        </div>
      )}

      {!isEmpty && (
        <div className="messages-container">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isStreaming && (
            <div className="message-bot">
              <div className="avatar bot-avatar">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div className="msg-content">
                <div className="meta">
                  <span className="msg-name">Chat AI</span>
                  <span className="msg-time">
                    {new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="bubble bot-bubble">
                  {streamingContent ? (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                  ) : (
                    <span className="typing-indicator">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {botError && (
            <div className="message-bot">
              <div className="avatar bot-avatar">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div className="msg-content">
                <div className="meta">
                  <span className="msg-name">Chat AI</span>
                </div>
                <div className="bubble bot-bubble error-bubble">
                  <p>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '4px' }}
                    >
                      error
                    </span>
                    {botError}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="spacer" />
    </div>
  );
}
```

---

### 4.12 `src/components/react/MessageBubble.tsx`

```tsx
// src/components/react/MessageBubble.tsx

import { useMemo } from 'react';
import type { Message } from '../../lib/db';
import { renderMarkdown } from '../../lib/markdown';

interface Props {
  message: Message;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message }: Props) {
  const time = formatTime(message.createdAt);

  const renderedHtml = useMemo(() => {
    if (message.role === 'assistant') {
      return renderMarkdown(message.content);
    }
    return null;
  }, [message.content, message.role]);

  if (message.role === 'user') {
    return (
      <div className="message-user">
        <div className="avatar user-avatar">
          <span className="material-symbols-outlined">person</span>
        </div>
        <div className="msg-content">
          <div className="meta">
            <span className="msg-time">{time}</span>
            <span className="msg-name">Tu</span>
          </div>
          <div className="bubble user-bubble">
            <p>{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-bot">
      <div className="avatar bot-avatar">
        <span className="material-symbols-outlined">smart_toy</span>
      </div>
      <div className="msg-content">
        <div className="meta">
          <span className="msg-name">Chat AI</span>
          <span className="msg-time">{time}</span>
        </div>
        <div
          className="bubble bot-bubble"
          dangerouslySetInnerHTML={{ __html: renderedHtml! }}
        />
      </div>
    </div>
  );
}
```

---

### 4.13 `src/components/react/SuggestionChips.tsx`

```tsx
// src/components/react/SuggestionChips.tsx

import { useCallback } from 'react';
import { useChatState, useChatDispatch } from './ChatContext';
import { addMessage, getMessagesByChatId, getChat, updateChat, getAllChats } from '../../lib/db';
import { streamChat } from '../../lib/groq-client';

const suggestions = [
  { icon: 'code', label: 'Async/Await en JS', text: 'Explicame como funciona async/await en JavaScript' },
  { icon: 'speed', label: 'Optimizar rendimiento web', text: 'Dame ideas para mejorar el rendimiento de mi aplicacion web' },
  { icon: 'database', label: 'Disenar DB para blog', text: 'Ayudame a disenar una base de datos para un blog' },
];

export function SuggestionChips() {
  const { activeChatId, isStreaming } = useChatState();
  const dispatch = useChatDispatch();

  const handleClick = useCallback(
    async (text: string) => {
      if (!activeChatId || isStreaming) return;

      // Reutilizar la misma logica de envio que ChatInput
      const userMessage = await addMessage(activeChatId, 'user', text);
      dispatch({ type: 'ADD_USER_MESSAGE', message: userMessage });

      // Generar titulo si es primer mensaje
      const chat = await getChat(activeChatId);
      if (chat && chat.messageCount <= 1) {
        const title = text.length > 50 ? text.substring(0, 50) + '...' : text;
        const updated = await updateChat(activeChatId, { title });
        dispatch({ type: 'UPDATE_CHAT_IN_LIST', chat: updated });
      }

      // Obtener historial
      const allMessages = await getMessagesByChatId(activeChatId);
      const history = allMessages.map((m) => ({ role: m.role, content: m.content }));

      // Streaming
      dispatch({ type: 'START_STREAMING' });
      try {
        let fullContent = '';
        for await (const token of streamChat(history)) {
          fullContent += token;
          dispatch({ type: 'UPDATE_STREAMING', content: fullContent });
        }
        const botMessage = await addMessage(activeChatId, 'assistant', fullContent);
        dispatch({ type: 'FINISH_STREAMING', message: botMessage });

        // Refrescar lista de chats
        const chats = await getAllChats();
        dispatch({ type: 'SET_CHATS', chats });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        dispatch({ type: 'SET_BOT_ERROR', error: `No se pudo obtener respuesta: ${errorMsg}` });
      }
    },
    [activeChatId, isStreaming, dispatch]
  );

  return (
    <div className="chips">
      {suggestions.map((s) => (
        <button key={s.text} className="chip" onClick={() => handleClick(s.text)}>
          <span className="material-symbols-outlined">{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
```

---

### 4.14 `src/components/react/ChatInput.tsx`

```tsx
// src/components/react/ChatInput.tsx

import { useState, useRef, useCallback, useEffect } from 'react';
import { useChatState, useChatDispatch } from './ChatContext';
import { addMessage, getMessagesByChatId, getChat, updateChat, getAllChats } from '../../lib/db';
import { streamChat } from '../../lib/groq-client';

export function ChatInput() {
  const { activeChatId, isStreaming } = useChatState();
  const dispatch = useChatDispatch();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [text]);

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !activeChatId || isStreaming) return;

    setText('');

    try {
      // 1. Guardar mensaje del usuario
      const userMessage = await addMessage(activeChatId, 'user', trimmed);
      dispatch({ type: 'ADD_USER_MESSAGE', message: userMessage });

      // 2. Generar titulo si es primer mensaje
      const chat = await getChat(activeChatId);
      if (chat && chat.messageCount <= 1) {
        const title = trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
        const updated = await updateChat(activeChatId, { title });
        dispatch({ type: 'UPDATE_CHAT_IN_LIST', chat: updated });
      }

      // 3. Obtener historial
      const allMessages = await getMessagesByChatId(activeChatId);
      const history = allMessages.map((m) => ({ role: m.role, content: m.content }));

      // 4. Streaming
      dispatch({ type: 'START_STREAMING' });

      let fullContent = '';
      for await (const token of streamChat(history)) {
        fullContent += token;
        dispatch({ type: 'UPDATE_STREAMING', content: fullContent });
      }

      // 5. Guardar respuesta
      const botMessage = await addMessage(activeChatId, 'assistant', fullContent);
      dispatch({ type: 'FINISH_STREAMING', message: botMessage });

      // 6. Refrescar lista de chats
      const chats = await getAllChats();
      dispatch({ type: 'SET_CHATS', chats });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      dispatch({
        type: 'SET_BOT_ERROR',
        error: `No se pudo obtener respuesta: ${errorMsg}`,
      });
    }

    // Focus de vuelta al textarea
    textareaRef.current?.focus();
  }, [text, activeChatId, isStreaming, dispatch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  return (
    <div className="chat-input-area">
      <div className="input-wrapper">
        <button className="icon-btn" title="Attach file">
          <span className="material-symbols-outlined">attach_file</span>
        </button>
        <textarea
          ref={textareaRef}
          placeholder="Type a message..."
          rows={1}
          aria-label="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="right-buttons">
          <button className="icon-btn" title="Use Microphone">
            <span className="material-symbols-outlined">mic</span>
          </button>
          <button
            className="send-btn"
            title="Send message"
            onClick={sendMessage}
            disabled={isStreaming || !text.trim()}
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
      <p className="disclaimer">AI can make mistakes. Please review generated code.</p>
    </div>
  );
}
```

---

## 5. Modificaciones a Componentes Astro

### 5.1 `src/components/ChatLayout.astro` - Reemplazar con React island

El ChatLayout ahora solo monta el React island. Todo el contenido interno lo maneja React.

```astro
---
import ChatApp from './react/ChatApp';
---
<ChatApp client:load />
```

> **NOTA**: No se necesita `<style>` aqui porque los estilos estan en `Layout.astro` como globales. El componente ChatApp se hidrata inmediatamente con `client:load`.

---

### 5.2 `src/layouts/Layout.astro` - Agregar estilos globales

Se agregan TODOS los estilos necesarios para los componentes React al final del bloque `<style is:global>` existente. Los componentes React usan `className` que mapea a estas clases CSS globales.

**Por que estilos globales y no CSS modules o styled-components**: Los componentes React se renderizan con `client:load` (sin SSR de estilos). Astro scoped styles no aplican a componentes de framework. CSS global es la opcion mas simple y consistente con el proyecto existente.

Agregar al final del `<style is:global>` existente:

```css
/* ============================================================
   Layout principal
   ============================================================ */

.chat-layout {
  display: flex;
  height: 100%;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: var(--color-bg);
}

/* ============================================================
   Sidebar
   ============================================================ */

.sidebar {
  width: 320px;
  background: var(--color-sidebar);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
}

.sidebar-header {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(43, 140, 238, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

.brand-icon .material-symbols-outlined {
  font-size: 24px;
}

.sidebar-header h1 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.025em;
}

.menu-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background-color 0.15s;
}

.menu-btn:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.05);
}

/* New Chat Button */

.new-chat-wrapper {
  padding: 0 16px 16px;
}

.new-chat-btn {
  display: flex;
  width: 100%;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 8px 16px rgba(43, 140, 238, 0.2);
  transition: background-color 0.15s;
}

.new-chat-btn:hover {
  background: rgba(43, 140, 238, 0.9);
}

.new-chat-btn .material-symbols-outlined {
  font-size: 20px;
}

/* Search Input */

.search-wrapper {
  padding: 0 16px 8px;
}

.search-label {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.search-container {
  display: flex;
  width: 100%;
  align-items: stretch;
  border-radius: 8px;
  height: 40px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition: border-color 0.15s;
}

.search-container:focus-within {
  border-color: var(--color-primary);
}

.search-icon {
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 12px;
}

.search-icon .material-symbols-outlined {
  font-size: 20px;
}

.search-container input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  color: var(--color-text);
  padding: 0 12px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  outline: none;
}

.search-container input::placeholder {
  color: var(--color-text-muted);
}

/* Chat History List */

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-empty {
  padding: 16px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

.history-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-group h3 {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 16px 4px;
  margin: 0;
}

.chat-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: 'Inter', sans-serif;
  transition: background-color 0.15s;
  color: inherit;
}

.chat-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.chat-item.active {
  background: #1f2e3d;
  border-color: rgba(35, 54, 72, 0.5);
  border-left: 4px solid var(--color-primary);
}

.chat-item-icon {
  font-size: 20px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.chat-item.active .chat-item-icon {
  color: var(--color-text-secondary);
}

.chat-item-content {
  flex: 1;
  overflow: hidden;
}

.chat-item-content p {
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item.active .chat-item-content p {
  color: var(--color-text);
  font-weight: 500;
}

/* User Profile */

.user-profile {
  padding: 16px;
  border-top: 1px solid var(--color-border);
  margin-top: auto;
}

.profile-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: 'Inter', sans-serif;
  transition: background-color 0.15s;
}

.profile-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.profile-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(to top right, #a855f7, var(--color-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-plan {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-icon {
  color: var(--color-text-secondary);
}

/* ============================================================
   Chat Header
   ============================================================ */

.chat-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  padding: 0 24px;
  background: rgba(16, 25, 34, 0.8);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.chat-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.star-icon {
  color: var(--color-primary);
}

.badge {
  padding: 2px 8px;
  border-radius: 9999px;
  background: var(--color-surface);
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  background: var(--color-surface);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: background-color 0.15s;
}

.fav-btn:hover {
  background: var(--color-surface-hover);
}

.heart-icon {
  font-size: 18px;
  color: #ec4899;
}

.fav-text {
  display: none;
}

@media (min-width: 640px) {
  .fav-text {
    display: inline;
  }
}

/* ============================================================
   Message Area
   ============================================================ */

.message-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  scroll-behavior: smooth;
}

.spacer {
  height: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  color: var(--color-text-secondary);
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.empty-icon .material-symbols-outlined {
  font-size: 32px;
  color: var(--color-primary);
}

.empty-state h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.messages-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Message Bubbles */

.message-user {
  display: flex;
  flex-direction: row-reverse;
  gap: 16px;
  max-width: 768px;
  margin: 0 auto;
  width: 100%;
}

.message-bot {
  display: flex;
  gap: 16px;
  max-width: 768px;
  margin: 0 auto;
  width: 100%;
}

.user-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.user-avatar .material-symbols-outlined {
  font-size: 18px;
}

.bot-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(to bottom right, #6366f1, #9333ea);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(147, 51, 234, 0.2);
  color: #fff;
  margin-top: 4px;
}

.bot-avatar .material-symbols-outlined {
  font-size: 18px;
}

.msg-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.message-user .msg-content {
  align-items: flex-end;
}

.meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.msg-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.msg-time {
  font-size: 12px;
  color: var(--color-text-muted);
}

.user-bubble {
  color: #fff;
  font-size: 16px;
  line-height: 1.625;
  background: var(--color-primary);
  padding: 16px;
  border-radius: 16px;
  border-top-right-radius: 0;
  box-shadow: 0 4px 6px rgba(43, 140, 238, 0.1);
  width: fit-content;
}

.user-bubble p {
  margin: 0;
}

.bot-bubble {
  color: #e2e8f0;
  font-size: 16px;
  line-height: 1.625;
  background: var(--color-surface);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 16px;
  border-radius: 16px;
  border-top-left-radius: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  width: fit-content;
}

.bot-bubble p {
  margin: 0 0 8px 0;
}

.bot-bubble p:last-child {
  margin-bottom: 0;
}

.bot-bubble pre {
  background: var(--color-sidebar);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 16px;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 14px;
  color: #cbd5e1;
  margin: 12px 0;
}

.bot-bubble code {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 14px;
}

.bot-bubble :not(pre) > code {
  background: var(--color-sidebar);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.error-bubble {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
}

.typing-indicator {
  display: inline-flex;
  gap: 4px;
}

.typing-indicator span {
  animation: blink 1.4s infinite both;
  font-size: 24px;
  line-height: 1;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}

/* ============================================================
   Chat Input
   ============================================================ */

.chat-input-area {
  padding: 16px 24px;
  background: rgba(16, 25, 34, 0.95);
  backdrop-filter: blur(4px);
  border-top: 1px solid var(--color-border);
  width: 100%;
  max-width: 896px;
  margin: 0 auto;
  position: sticky;
  bottom: 0;
  flex-shrink: 0;
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: border-color 0.15s;
}

.input-wrapper:focus-within {
  border-color: var(--color-primary);
}

.chat-input-area textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text);
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  resize: none;
  padding: 12px 0;
  min-height: 44px;
  max-height: 160px;
  outline: none;
  line-height: 1.5;
}

.chat-input-area textarea::placeholder {
  color: var(--color-text-muted);
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background-color 0.15s;
  flex-shrink: 0;
  margin-bottom: 2px;
}

.icon-btn:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.05);
}

.icon-btn .material-symbols-outlined {
  font-size: 22px;
}

.right-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-bottom: 2px;
}

.send-btn {
  padding: 8px;
  background: var(--color-primary);
  border: none;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(43, 140, 238, 0.2);
  transition: background-color 0.15s;
}

.send-btn:hover {
  background: rgba(43, 140, 238, 0.9);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn .material-symbols-outlined {
  font-size: 20px;
}

.disclaimer {
  text-align: center;
  margin: 8px 0 0;
  font-size: 10px;
  color: var(--color-text-muted);
}

/* Suggestion Chips */

.chips {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 9999px;
  background: var(--color-sidebar);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.chip:hover {
  background: #19232d;
  border-color: #475569;
}

.chip .material-symbols-outlined {
  font-size: 16px;
}
```

---

### 5.3 Componentes Astro que NO se modifican

Los siguientes componentes Astro dejan de usarse en runtime pero **no deben eliminarse** (sirven como referencia de estilos):

| Componente | Razon |
|---|---|
| `Sidebar.astro` | Reemplazado por `react/Sidebar.tsx` |
| `SidebarHeader.astro` | Reemplazado por `react/SidebarHeader.tsx` |
| `NewChatButton.astro` | Reemplazado por `react/NewChatButton.tsx` |
| `SearchInput.astro` | Reemplazado por `react/SearchInput.tsx` |
| `ChatHistoryList.astro` | Reemplazado por `react/ChatHistoryList.tsx` |
| `ChatHistoryGroup.astro` | Ya no se usa |
| `ChatHistoryItem.astro` | Ya no se usa |
| `UserProfile.astro` | Reemplazado por `react/UserProfile.tsx` |
| `ChatHeader.astro` | Reemplazado por `react/ChatHeader.tsx` |
| `MessageArea.astro` | Reemplazado por `react/MessageArea.tsx` |
| `MessageBot.astro` | Reemplazado por `react/MessageBubble.tsx` |
| `MessageUser.astro` | Reemplazado por `react/MessageBubble.tsx` |
| `ChatInput.astro` | Reemplazado por `react/ChatInput.tsx` |
| `SuggestionChips.astro` | Reemplazado por `react/SuggestionChips.tsx` |
| `DateDivider.astro` | Ya no se usa |
| `CodeBlock.astro` | Los code blocks se renderizan via `marked` |
| `MessageActions.astro` | Se integrara en futuras fases |

---

## 6. Orden de Implementacion

### Paso 1: Infraestructura (sin dependencias)

1. Ejecutar `pnpm add @astrojs/node marked`
2. Modificar `astro.config.mjs` (seccion 1.2)
3. Verificar que `.env` tiene `GROQ_API_KEY`

### Paso 2: Librerias base (sin dependencias entre si)

1. Crear `src/lib/db.ts` (seccion 2.1)
2. Crear `src/lib/session.ts` (seccion 2.2)
3. Crear `src/lib/markdown.ts` (seccion 2.3)
4. Crear `src/lib/groq-client.ts` (seccion 2.4)

### Paso 3: API Endpoint (depende de groq-sdk)

1. Crear `src/pages/api/chat.ts` (seccion 3.1)

### Paso 4: React Context (base de todo lo demas)

1. Crear `src/components/react/ChatContext.tsx` (seccion 4.1)

### Paso 5: Componentes React hoja (sin dependencias entre si)

1. Crear `src/components/react/SidebarHeader.tsx` (seccion 4.4)
2. Crear `src/components/react/NewChatButton.tsx` (seccion 4.5)
3. Crear `src/components/react/SearchInput.tsx` (seccion 4.6)
4. Crear `src/components/react/ChatHistoryList.tsx` (seccion 4.7)
5. Crear `src/components/react/UserProfile.tsx` (seccion 4.8)
6. Crear `src/components/react/ChatHeader.tsx` (seccion 4.10)
7. Crear `src/components/react/MessageBubble.tsx` (seccion 4.12)
8. Crear `src/components/react/SuggestionChips.tsx` (seccion 4.13)
9. Crear `src/components/react/ChatInput.tsx` (seccion 4.14)

### Paso 6: Componentes React contenedor

1. Crear `src/components/react/MessageArea.tsx` (seccion 4.11)
2. Crear `src/components/react/MainArea.tsx` (seccion 4.9)
3. Crear `src/components/react/Sidebar.tsx` (seccion 4.3)

### Paso 7: Componente raiz React

1. Crear `src/components/react/ChatApp.tsx` (seccion 4.2)

### Paso 8: Integrar con Astro

1. Modificar `src/components/ChatLayout.astro` (seccion 5.1)
2. Modificar `src/layouts/Layout.astro` - agregar estilos globales (seccion 5.2)

### Paso 9: Verificacion

1. Ejecutar `pnpm dev` y probar:
    - Primera visita: se crea sesion, se crea chat vacio, se muestra empty state
    - Escribir mensaje: se envia, aparece respuesta del bot en streaming
    - Crear nuevo chat: sidebar se actualiza, area se limpia
    - Cambiar de chat: mensajes se cargan correctamente
    - Buscar en historial: filtra chats
    - Eliminar chat (clic derecho): se borra y se navega al siguiente
    - Suggestion chips: envian el texto como mensaje

---

## Diagrama de Arquitectura

```text
src/pages/index.astro
  |
  v
src/layouts/Layout.astro  (HTML shell + estilos globales)
  |
  v
src/components/ChatLayout.astro  (monta el React island)
  |
  v
src/components/react/ChatApp.tsx  (client:load)
  |
  +-- ChatProvider (Context + Reducer)
  |     |
  |     +-- Sidebar.tsx
  |     |     +-- SidebarHeader.tsx
  |     |     +-- NewChatButton.tsx
  |     |     +-- SearchInput.tsx
  |     |     +-- ChatHistoryList.tsx
  |     |     +-- UserProfile.tsx
  |     |
  |     +-- MainArea.tsx
  |           +-- ChatHeader.tsx
  |           +-- MessageArea.tsx
  |           |     +-- MessageBubble.tsx (x N)
  |           |     +-- SuggestionChips.tsx (empty state)
  |           +-- ChatInput.tsx
  |
  +-- Usa: src/lib/db.ts, session.ts, groq-client.ts, markdown.ts
  |
  +-- Llama a: src/pages/api/chat.ts (servidor, Groq SDK)
```

---

## Comparacion: Vanilla JS vs React

| Aspecto | Vanilla JS (plan anterior) | React (este plan) |
|---|---|---|
| Comunicacion entre componentes | Custom Events en `document` | React Context + `useReducer` |
| Renderizado dinamico | `innerHTML`, `insertAdjacentHTML` | JSX declarativo |
| Estado | Variables globales en cada `<script>` | Estado centralizado en reducer |
| Archivos de libreria | `src/lib/events.ts` (ya no necesario) | Eliminado |
| Numero de `<script>` tags | 9 scripts independientes | 0 (todo en React) |
| Bundle size adicional | ~0 KB (vanilla) | ~45 KB (React + ReactDOM gzipped) |
| Mantenibilidad | Baja (DOM imperativo, eventos dispersos) | Alta (componentes declarativos, estado predecible) |
| Depuracion | DevTools DOM + console | React DevTools + estado visible |

---

## Consideraciones Tecnicas

### Por que un unico React island

Segun la documentacion de Astro sobre islands, si multiples componentes React necesitan compartir estado, se recomienda envolverlos en un unico island. En nuestro caso, **todos** los componentes interactivos necesitan acceder al estado del chat (activeChatId, messages, isStreaming, etc.), por lo que un unico island con Context es la arquitectura correcta.

### Estilos globales vs CSS-in-JS

Se usan estilos globales en `Layout.astro` porque:

- Los componentes React con `client:load` no pasan por el pipeline de scoped styles de Astro
- No se quiere agregar otra dependencia (styled-components, emotion, etc.)
- El proyecto ya usa plain CSS; mantener la consistencia
- Las clases CSS son simples y descriptivas, sin riesgo de colision significativo

### `client:load` vs `client:idle`

Se usa `client:load` porque el chat es la funcionalidad principal de la pagina y debe estar interactivo inmediatamente. `client:idle` introduciria un delay perceptible donde el usuario veria la UI pero no podria interactuar.

### Archivo `src/lib/events.ts` eliminado

Ya no se necesita el sistema de Custom Events (`events.ts`) porque React Context reemplaza completamente esa funcionalidad. La comunicacion entre componentes se hace via `dispatch` y el estado compartido del reducer.

---

## Dependencias Nuevas

| Paquete | Proposito | Estado |
|---|---|---|
| `@astrojs/react` | Integracion React en Astro | Ya instalado |
| `react` | Libreria UI | Ya instalado |
| `react-dom` | Renderizado DOM | Ya instalado |
| `@types/react` | Tipos TypeScript | Ya instalado |
| `@types/react-dom` | Tipos TypeScript | Ya instalado |
| `@astrojs/node` | Adaptador para API routes | Por instalar |
| `marked` | Parseo de Markdown a HTML | Por instalar |
| `groq-sdk` | Cliente Groq API | Ya instalado |

---

## Alternativas Consideradas

### 1. Multiples React islands (uno por componente)

**Descartado**: Cada island es una instancia React independiente. No pueden compartir Context entre si. Se necesitaria un mecanismo externo (Custom Events, nanostores) para comunicarlos, anulando el beneficio de usar React.

### 2. Nanostores para estado compartido entre islands

**Descartado**: Agrega complejidad innecesaria. Si toda la pagina necesita interactividad, es mas simple un unico island con Context que multiples islands sincronizados via nanostores.

### 3. CSS Modules o styled-components

**Descartado**: El proyecto usa plain CSS. Agregar CSS Modules requiere configuracion adicional. Styled-components agrega ~12KB al bundle. Estilos globales son suficientes y consistentes con el proyecto.

### 4. Svelte en lugar de React

**Descartado**: El usuario ya instalo React y @astrojs/react. Svelte tendria menor bundle size pero requeriria cambiar la decision ya tomada.

### 5. `client:only="react"` en vez de `client:load`

**Descartado**: `client:only` salta el server render completamente. `client:load` permite que Astro renderice el HTML inicial en el servidor (aunque React lo rehidrate inmediatamente). Esto da un HTML inicial mas completo para SEO y primera pintura, aunque en una app de chat el beneficio es minimo. Se prefiere `client:load` por ser la opcion estandar.
