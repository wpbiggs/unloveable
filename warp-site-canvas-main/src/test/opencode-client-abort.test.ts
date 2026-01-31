import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenCode } from '../lib/opencode-client';

// Mock the global fetch
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe('OpenCode Client Abort', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('runShell respects AbortSignal', async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    // Mock a delayed response
    globalFetch.mockImplementationOnce(() => 
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({})
          });
        }, 100);
        
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      })
    );

    const promise = OpenCode.runShell('session-1', 'ls', { signal });
    
    controller.abort();

    await expect(promise).rejects.toThrow('Aborted');
  });

  it('requestJson passes signal to fetch', async () => {
    globalFetch.mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    const controller = new AbortController();
    await OpenCode.listSessions({}, controller.signal);

    expect(globalFetch).toHaveBeenCalledWith(
      expect.stringContaining('/session'),
      expect.objectContaining({
        signal: controller.signal
      })
    );
  });

  it('sendMessage respects AbortSignal', async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    // Mock a delayed response
    globalFetch.mockImplementationOnce(() => 
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({})
          });
        }, 100);
        
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      })
    );

    const promise = OpenCode.sendMessage('session-1', [{ type: 'text', text: 'hello' }], undefined, signal);
    
    controller.abort();

    await expect(promise).rejects.toThrow('Aborted');
  });
});
