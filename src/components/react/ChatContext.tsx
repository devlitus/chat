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
