
import { describe, it, expect, vi, afterEach } from 'vitest';
import { openOpenCodeEvents } from '../lib/opencode-events';

// Mock EventSource
const EventSourceMock = vi.fn(function(url: string) {
  return {
    url,
    close: vi.fn(),
    onmessage: null as any,
    onopen: null as any,
    onerror: null as any,
  };
});
globalThis.EventSource = EventSourceMock as any;

describe('openOpenCodeEvents', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should connect to the correct URL', () => {
    // Mock imports
    vi.stubGlobal('import', { meta: { env: { VITE_OPENCODE_URL: 'http://test-server' } } });
    
    // We can't easily mock import.meta in vitest without more setup, 
    // but we can rely on the default behavior or mock the window.localStorage if used.
    
    const close = openOpenCodeEvents(() => {});
    expect(EventSourceMock).toHaveBeenCalledWith(expect.stringContaining('/event'));
    close();
  });

  it('should parse and emit valid JSON events', () => {
    let capturedInstance: any;
    EventSourceMock.mockImplementation(function() {
      capturedInstance = {
        close: vi.fn(),
        onmessage: null,
        onopen: null,
        onerror: null,
      };
      return capturedInstance;
    });

    const onEvent = vi.fn();
    openOpenCodeEvents(onEvent);

    expect(capturedInstance).toBeDefined();

    // Simulate a message
    const mockEvent = {
      type: 'test.event',
      properties: { foo: 'bar' }
    };
    
    // Simulate async message arrival
    capturedInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(mockEvent) }));

    expect(onEvent).toHaveBeenCalledWith(mockEvent);
  });

  it('should unwrap wrapped payloads', () => {
    let capturedInstance: any;
    EventSourceMock.mockImplementation(function() {
      capturedInstance = {
        close: vi.fn(),
        onmessage: null,
        onopen: null,
        onerror: null,
      };
      return capturedInstance;
    });

    const onEvent = vi.fn();
    openOpenCodeEvents(onEvent);

    const mockEvent = {
      directory: '/some/path',
      payload: {
        type: 'wrapped.event',
        properties: { baz: 'qux' }
      }
    };
    capturedInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(mockEvent) }));

    expect(onEvent).toHaveBeenCalledWith(mockEvent.payload);
  });

  it('should ignore invalid JSON', () => {
    let capturedInstance: any;
    EventSourceMock.mockImplementation(function() {
      capturedInstance = {
        close: vi.fn(),
        onmessage: null,
        onopen: null,
        onerror: null,
      };
      return capturedInstance;
    });

    const onEvent = vi.fn();
    openOpenCodeEvents(onEvent);

    capturedInstance.onmessage(new MessageEvent('message', { data: 'invalid-json' }));

    expect(onEvent).not.toHaveBeenCalled();
  });
});
