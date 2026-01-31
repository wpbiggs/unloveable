import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BuilderHeader from '../BuilderHeader';
import { BrowserRouter } from 'react-router-dom';
import * as OpencodeEvents from '@/lib/opencode-events';
import { ThemeProvider } from '@/components/ThemeProvider';

// Mock matchMedia for ThemeProvider
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock dependencies
vi.mock('@/lib/opencode-client', () => ({
  OpenCode: {
    fileStatus: vi.fn().mockResolvedValue([]),
    sessionDiff: vi.fn().mockResolvedValue([]),
    revert: vi.fn().mockResolvedValue({}),
  },
  OpenCodeDirectory: {
      get: vi.fn().mockReturnValue('/tmp/test-project')
  }
}));

// Mock the SSE hook
const mockOpenOpenCodeEvents = vi.fn();
vi.mock('@/lib/opencode-events', () => ({
  openOpenCodeEvents: (...args: unknown[]) => mockOpenOpenCodeEvents(...args)
}));

describe('BuilderHeader SSE Indicator', () => {
  const defaultProps = {
    sessions: [],
    isSessionsLoading: false,
    onRefreshSessions: vi.fn(),
    onSelectSession: vi.fn(),
    sessionID: 'test-session',
    directory: '/test',
    loopState: 'IDLE' as const,
    iteration: 0,
    isRunning: false,
    onRunLoop: vi.fn(),
    onStop: vi.fn(),
    onApplyNextPatch: vi.fn(),
    onResetSession: vi.fn(),
    onNewWorkspaceSession: vi.fn(),
    onChangeDirectory: vi.fn(),
  };

  it('shows amber indicator when connecting', () => {
    render(
      <ThemeProvider>
        <BrowserRouter>
          <BuilderHeader 
            {...defaultProps} 
            sseStatus={{ state: 'connecting', lastAt: Date.now() }} 
          />
        </BrowserRouter>
      </ThemeProvider>
    );
    
    // Find the indicator dot
    // In the component: sseStatus?.state === "connected" ? "bg-emerald-500/90" : sseStatus?.state === "error" ? "bg-red-500/90" : "bg-amber-400/90"
    const indicators = document.getElementsByClassName('bg-amber-400/90');
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('shows green indicator when connected', () => {
    render(
      <ThemeProvider>
        <BrowserRouter>
          <BuilderHeader 
            {...defaultProps} 
            sseStatus={{ state: 'connected', lastAt: Date.now() }} 
          />
        </BrowserRouter>
      </ThemeProvider>
    );
    
    const indicators = document.getElementsByClassName('bg-emerald-500/90');
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('shows red indicator when error', () => {
    render(
      <ThemeProvider>
        <BrowserRouter>
          <BuilderHeader 
            {...defaultProps} 
            sseStatus={{ state: 'error', lastAt: Date.now() }} 
          />
        </BrowserRouter>
      </ThemeProvider>
    );
    
    const indicators = document.getElementsByClassName('bg-red-500/90');
    expect(indicators.length).toBeGreaterThan(0);
  });
  
  it('displays loop state and iteration', () => {
      render(
        <ThemeProvider>
          <BrowserRouter>
            <BuilderHeader 
              {...defaultProps} 
              loopState="PLANNING"
              iteration={5}
            />
          </BrowserRouter>
        </ThemeProvider>
      );
      
      expect(screen.getByText('PLANNING →')).toBeInTheDocument();
      expect(screen.getByText('iter 5')).toBeInTheDocument();
  });
});
