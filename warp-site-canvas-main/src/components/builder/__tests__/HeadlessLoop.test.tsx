
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import Builder from '@/pages/Builder';
import { OpenCode } from '@/lib/opencode-client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from "../../ThemeProvider";

// Mock child components
vi.mock('@/components/builder/ChatPanel', () => ({ default: () => <div data-testid="chat-panel">ChatPanel</div> }));
vi.mock('@/components/builder/PreviewPanel', () => ({ default: () => <div data-testid="preview-panel">PreviewPanel</div> }));
vi.mock('@/components/builder/ConsolePanel', () => ({ default: () => <div data-testid="console-panel">ConsolePanel</div> }));
vi.mock('@/components/builder/FileTree', () => ({ default: () => <div data-testid="file-tree">FileTree</div> }));
vi.mock('@/components/builder/CodeEditor', () => ({ default: () => <div data-testid="code-editor">CodeEditor</div> }));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock OpenCode client
vi.mock('@/lib/opencode-client', () => ({
  OpenCodeDirectory: {
    get: () => "/tmp/test",
  },
  OpenCode: {
    listFiles: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({ id: 'session-123' }),
    listSessions: vi.fn().mockResolvedValue([]),
    runShell: vi.fn().mockResolvedValue({ info: { id: 'msg-123' } }),
    getMessage: vi.fn().mockResolvedValue({ parts: [] }),
    fileStatus: vi.fn().mockResolvedValue([]),
    listMessages: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockRejectedValue(new Error("File not found")), // Default
  },
  OpenCodePreferences: {
      agent: { get: () => 'task' },
      model: { get: () => 'openai/gpt-4' }
  },
  OpenCodeSessionStore: {
      get: () => null,
      set: vi.fn()
  },
  OpenCodePreviewStore: {
      get: () => null,
      set: vi.fn()
  }
}));

// Mock useConsoleLogs hook
const mockInfo = vi.fn();
const mockError = vi.fn();
const mockSuccess = vi.fn();

vi.mock('@/hooks/use-console-logs', () => ({
  useConsoleLogs: () => ({
    logs: [],
    info: mockInfo,
    error: mockError,
    success: mockSuccess,
    warn: vi.fn(),
    debug: vi.fn(),
    clearLogs: vi.fn(),
  }),
}));

// Mock BuilderHeader to verify prop passing and direct interaction
vi.mock('@/components/builder/BuilderHeader', () => ({
    default: ({ onRunHeadless }: { onRunHeadless: (mode: string) => void }) => (
        <button onClick={() => onRunHeadless('exploration')}>Mock Run Headless</button>
    )
}));

describe('Builder Headless Loop Integration', () => {
    // Mock matchMedia for ThemeProvider
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });

  it('calls OpenCode.runShell with correct arguments when headless loop is triggered', async () => {
    render(
        <ThemeProvider>
            <BrowserRouter>
                <Builder />
            </BrowserRouter>
        </ThemeProvider>
    );

    const btn = screen.getByText('Mock Run Headless');
    fireEvent.click(btn);

    // Wait for the async operation
    await waitFor(() => {
        expect(mockInfo).toHaveBeenCalledWith("Headless Loop", "Starting exploration loop...");
    });

    expect(OpenCode.runShell).toHaveBeenCalledWith(
        'session-123', // session ID from ensureShellSession mock
        './run-loop.sh exploration > /dev/null 2>&1',
        expect.objectContaining({
            agent: 'task'
        })
    );
    
    expect(mockSuccess).toHaveBeenCalledWith("Headless Loop", "Completed successfully");
  });
});
