
import { OpenCodeSessionStore } from '../lib/opencode-session-store';
import { OpenCodeDirectory } from '../lib/opencode-client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Persistent Chat History (OpenCodeSessionStore)', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should persist session ID per directory', () => {
    const dir1 = '/path/to/project1';
    const session1 = 'session-123';
    
    OpenCodeSessionStore.set(dir1, session1);
    
    expect(OpenCodeSessionStore.get(dir1)).toBe(session1);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'opencode.activeSessionByDir', 
      expect.stringContaining(session1)
    );
  });

  it('should handle multiple directories independently', () => {
    const dir1 = '/path/to/project1';
    const session1 = 'session-123';
    const dir2 = '/path/to/project2';
    const session2 = 'session-456';
    
    OpenCodeSessionStore.set(dir1, session1);
    OpenCodeSessionStore.set(dir2, session2);
    
    expect(OpenCodeSessionStore.get(dir1)).toBe(session1);
    expect(OpenCodeSessionStore.get(dir2)).toBe(session2);
  });

  it('should clear session ID when set to null', () => {
    const dir = '/path/to/project';
    const session = 'session-123';
    
    OpenCodeSessionStore.set(dir, session);
    expect(OpenCodeSessionStore.get(dir)).toBe(session);
    
    OpenCodeSessionStore.set(dir, null);
    expect(OpenCodeSessionStore.get(dir)).toBeNull();
  });

  it('should handle default directory (null input)', () => {
    const session = 'session-default';
    
    OpenCodeSessionStore.set(null, session);
    expect(OpenCodeSessionStore.get(null)).toBe(session);
  });
});
