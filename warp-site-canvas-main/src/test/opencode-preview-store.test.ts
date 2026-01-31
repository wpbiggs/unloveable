import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenCodePreviewStore } from '../lib/opencode-preview-store';

describe('OpenCodePreviewStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should return null for unknown directory', () => {
    expect(OpenCodePreviewStore.get('/some/path')).toBeNull();
  });

  it('should store and retrieve preview entry', () => {
    const entry = { url: 'http://localhost:3000', pid: 123, startedAt: 1000 };
    OpenCodePreviewStore.set('/some/path', entry);
    
    const retrieved = OpenCodePreviewStore.get('/some/path');
    expect(retrieved).toEqual(entry);
  });

  it('should handle null directory as default', () => {
    const entry = { url: 'http://default', pid: 456 };
    OpenCodePreviewStore.set(null, entry);
    expect(OpenCodePreviewStore.get(null)).toEqual(entry);
  });

  it('should remove entry when setting to null', () => {
    const entry = { url: 'http://localhost:3000' };
    OpenCodePreviewStore.set('/some/path', entry);
    expect(OpenCodePreviewStore.get('/some/path')).toEqual(entry);
    
    OpenCodePreviewStore.set('/some/path', null);
    expect(OpenCodePreviewStore.get('/some/path')).toBeNull();
  });

  it('should tolerate malformed localstorage data', () => {
    localStorage.setItem("opencode.previewByDir", "not-json");
    expect(OpenCodePreviewStore.get('/some/path')).toBeNull();

    localStorage.setItem("opencode.previewByDir", JSON.stringify({
      "__default__": { url: 123 } // Invalid url type
    }));
    expect(OpenCodePreviewStore.get(null)).toBeNull();
  });
});
