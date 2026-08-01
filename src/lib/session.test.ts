// src/lib/session.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSession,
  createSession,
  updateSession,
  getOrCreateSession,
  type UserSession,
} from './session';

describe('session.ts - localStorage', () => {
  beforeEach(() => {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.clear();
    }
  });

  describe('getSession', () => {
    it('debe retornar null si no hay sesión', () => {
      const session = getSession();

      expect(session).toBeNull();
    });

    it('debe retornar la sesión si existe', () => {
      const mockSession: UserSession = {
        userId: 'user-123',
        displayName: 'Test User',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
        lastActiveChatId: null,
      };

      localStorage.setItem('chat-app-user', JSON.stringify(mockSession));

      const session = getSession();

      expect(session).toEqual(mockSession);
    });

    it('debe retornar null si el JSON está corrupto', () => {
      localStorage.setItem('chat-app-user', 'invalid-json{');

      const session = getSession();

      expect(session).toBeNull();
    });
  });

  describe('createSession', () => {
    it('debe crear una nueva sesión con valores por defecto', () => {
      const session = createSession();

      expect(session.userId).toMatch(/^mock-uuid-\d+$/);
      expect(session.displayName).toBe('Usuario');
      expect(session.avatarUrl).toBe('');
      expect(session.lastActiveChatId).toBeNull();
      expect(session.createdAt).toBeTruthy();
    });

    it('debe persistir la sesión en localStorage', () => {
      const session = createSession();

      const stored = localStorage.getItem('chat-app-user');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual(session);
    });
  });

  describe('updateSession', () => {
    it('debe actualizar campos de la sesión', () => {
      createSession();

      const updated = updateSession({
        displayName: 'Nuevo Nombre',
        lastActiveChatId: 'chat-123',
      });

      expect(updated.displayName).toBe('Nuevo Nombre');
      expect(updated.lastActiveChatId).toBe('chat-123');
    });

    it('debe mantener campos no modificados', () => {
      const original = createSession();

      const updated = updateSession({ displayName: 'Updated' });

      expect(updated.userId).toBe(original.userId);
      expect(updated.createdAt).toBe(original.createdAt);
    });

    it('debe lanzar error si no hay sesión', () => {
      expect(() => updateSession({ displayName: 'Test' })).toThrow(
        'No session found'
      );
    });

    it('debe persistir los cambios en localStorage', () => {
      createSession();
      updateSession({ displayName: 'Updated' });

      const stored = localStorage.getItem('chat-app-user');
      const parsed = JSON.parse(stored!);

      expect(parsed.displayName).toBe('Updated');
    });
  });

  describe('getOrCreateSession', () => {
    it('debe retornar sesión existente si ya existe', () => {
      const existing = createSession();

      const session = getOrCreateSession();

      expect(session).toEqual(existing);
    });

    it('debe crear nueva sesión si no existe', () => {
      const session = getOrCreateSession();

      expect(session).toBeTruthy();
      expect(session.userId).toMatch(/^mock-uuid-\d+$/);
    });
  });
});
