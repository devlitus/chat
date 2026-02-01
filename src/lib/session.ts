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
