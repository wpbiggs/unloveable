
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenCodeDirectory } from '../lib/opencode-client';

// Mock localStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: function(key: string) {
      return store[key] || null;
    },
    setItem: function(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem: function(key: string) {
      delete store[key];
    },
    clear: function() {
      store = {};
    }
  };
})();

// Assign to global.window if it exists (happy-dom/jsdom), or global if not
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true
    });
} else {
    const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
    g.window = { localStorage: localStorageMock };
    g.localStorage = localStorageMock;
}

describe('OpenCodeDirectory Path Safety', () => {
  beforeEach(() => {
    const g = globalThis as unknown as { window?: unknown };
    const w = g.window as { localStorage?: { clear?: () => void } } | undefined;
    if (w?.localStorage?.clear) {
        w.localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  it('allows safe user paths', () => {
    const safePath = '/home/user/projects/my-app';
    OpenCodeDirectory.set(safePath);
    expect(OpenCodeDirectory.get()).toBe(safePath);
  });

  it('rejects root directory on Unix', () => {
    expect(() => OpenCodeDirectory.set('/')).toThrow('Path is not allowed');
    expect(localStorage.getItem('opencode.directory')).toBeNull();
  });

  it('rejects system directories', () => {
    const dangerousPaths = ['/etc', '/var', '/bin', '/usr', '/sbin'];
    dangerousPaths.forEach(path => {
      expect(() => OpenCodeDirectory.set(path)).toThrow('Path is not allowed');
    });
  });

  // Windows-style checks (simple heuristic)
  it('rejects root drive on Windows', () => {
    expect(() => OpenCodeDirectory.set('C:\\')).toThrow('Path is not allowed');
    expect(() => OpenCodeDirectory.set('c:/')).toThrow('Path is not allowed');
  });

  it('rejects paths containing parent directory traversal', () => {
    const dangerousPaths = [
      '/home/user/../../etc',
      '../outside',
      '/var/../root'
    ];
    dangerousPaths.forEach(path => {
      expect(() => OpenCodeDirectory.set(path)).toThrow('Path is not allowed');
    });
  });
});
