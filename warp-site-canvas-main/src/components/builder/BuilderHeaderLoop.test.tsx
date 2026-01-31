import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BuilderHeader from './BuilderHeader';
import { BrowserRouter } from 'react-router-dom';
import { OpenCode } from '@/lib/opencode-client';
import { vi, afterEach } from 'vitest';
import { ThemeProvider } from '../ThemeProvider';
import userEvent from '@testing-library/user-event';

// Mock dependencies
vi.mock('@/lib/opencode-client', () => ({
  OpenCode: {
    runShell: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([]),
    readFile: vi.fn(),
    fileStatus: vi.fn().mockResolvedValue([]),
    sessionDiff: vi.fn().mockResolvedValue([]),
    revert: vi.fn(),
    getSession: vi.fn(),
    listMessages: vi.fn().mockResolvedValue([]),
  },
  OpenCodeDirectory: {
    get: vi.fn().mockReturnValue('/mock/dir'),
    set: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

afterEach(() => {
  document.body.removeAttribute('data-scroll-locked');
  document.body.style.pointerEvents = '';
});

describe('BuilderHeader Loop Control', () => {
  const defaultProps = {
    sessions: [],
    isSessionsLoading: false,
    onRefreshSessions: vi.fn(),
    onSelectSession: vi.fn(),
    sessionID: 'session-123',
    lastAssistantMessageID: null,
    directory: '/mock/dir',
    loopState: "IDLE" as const,
    iteration: 0,
    isRunning: false,
    onRunLoop: vi.fn(),
    onStop: vi.fn(),
    onApplyNextPatch: vi.fn(),
    onResetSession: vi.fn(),
    onNewWorkspaceSession: vi.fn(),
    onChangeDirectory: vi.fn(),
    onUndo: vi.fn(),
    onRequestComponent: vi.fn(),
    sseStatus: { state: 'connected' as const, lastAt: Date.now() },
  };

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <ThemeProvider>
        <BrowserRouter>
          {ui}
        </BrowserRouter>
      </ThemeProvider>
    );
  };

  it('renders "Run Loop" button when idle', () => {
    renderWithProviders(<BuilderHeader {...defaultProps} isRunning={false} />);
    expect(screen.getByText('Run Loop')).toBeInTheDocument();
  });

  it('renders "Stop" button when running', () => {
    renderWithProviders(<BuilderHeader {...defaultProps} isRunning={true} />);
    expect(screen.getByText('Stop')).toBeInTheDocument();
  });

  it('calls onRunLoop when "Run Loop" is clicked', () => {
    const onRunLoop = vi.fn();
    renderWithProviders(<BuilderHeader {...defaultProps} onRunLoop={onRunLoop} />);
    fireEvent.click(screen.getByText('Run Loop'));
    expect(onRunLoop).toHaveBeenCalled();
  });

  it('calls onStop when "Stop" is clicked', () => {
    const onStop = vi.fn();
    renderWithProviders(<BuilderHeader {...defaultProps} isRunning={true} onStop={onStop} />);
    fireEvent.click(screen.getByText('Stop'));
    expect(onStop).toHaveBeenCalled();
  });

  it('renders "Run Headless" option when onRunHeadless is provided', async () => {
    const onRunHeadless = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<BuilderHeader {...defaultProps} onRunHeadless={onRunHeadless} />);
    
    // Find the dropdown trigger (it's an icon button with a ChevronDown)
    // We can find it by the lucide icon class or by role if we add aria-labels
    // For now, let's try finding by the chevron icon which is likely unique in that button group
    // Or we can assume it's the button next to Run Loop.
    
    // Let's use a querySelector to be safe since we know the structure
    // It's a button with a chevron-down icon inside a dropdown trigger
    const trigger = screen.getByLabelText('Headless menu');
    await user.click(trigger);

    const item = await screen.findByRole('menuitem', { name: 'Run Headless (Exploration)' });
    await user.click(item);
    expect(onRunHeadless).toHaveBeenCalled();
  });

  it('shows loop state badges', () => {
    renderWithProviders(<BuilderHeader {...defaultProps} loopState="PLANNING" iteration={5} />);
    expect(screen.getByText('PLANNING →')).toBeInTheDocument();
    expect(screen.getByText('iter 5')).toBeInTheDocument();
  });
});
