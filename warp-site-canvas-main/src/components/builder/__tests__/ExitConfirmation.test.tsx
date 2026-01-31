
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BuilderHeader from '../BuilderHeader';
import { BrowserRouter } from 'react-router-dom';
import * as OpenCodeClient from '@/lib/opencode-client';

// Mock dependencies
vi.mock('@/lib/opencode-client', () => ({
  OpenCode: {
    runShell: vi.fn().mockResolvedValue({}),
    fileStatus: vi.fn().mockResolvedValue([]),
    sessionDiff: vi.fn().mockResolvedValue([]),
    listFiles: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('../ComponentPicker', () => ({ ComponentPicker: () => <div data-testid="component-picker" /> }));
vi.mock('../TemplateGallery', () => ({ TemplateGallery: () => <div data-testid="template-gallery" /> }));
vi.mock('../ThemeCustomizer', () => ({ ThemeCustomizer: () => <div data-testid="theme-customizer" /> }));
vi.mock('../KeyboardShortcutsDialog', () => ({ KeyboardShortcutsDialog: () => <div data-testid="shortcuts-dialog" /> }));

describe('BuilderHeader Exit Logic', () => {
  const defaultProps = {
    sessions: [],
    isSessionsLoading: false,
    onRefreshSessions: vi.fn(),
    onSelectSession: vi.fn(),
    sessionID: 'test-session-id',
    directory: '/test/dir',
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

  it('shows exit confirmation dialog when Back is clicked while loop is running', () => {
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} isRunning={true} />
      </BrowserRouter>
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    const dialogTitle = screen.getByText('Exit Builder?');
    expect(dialogTitle).toBeInTheDocument();
  });

  it('calls onStop and navigates away when exit is confirmed', () => {
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} isRunning={true} />
      </BrowserRouter>
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    const confirmButton = screen.getByText('Stop & Exit');
    fireEvent.click(confirmButton);

    expect(defaultProps.onStop).toHaveBeenCalled();
  });

  it('navigates away immediately when Back is clicked while loop is NOT running', () => {
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} isRunning={false} />
      </BrowserRouter>
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    // Since we are mocking navigation, we can't easily check the URL change here without more setup,
    // but we can verify the dialog does NOT appear.
    const dialogTitle = screen.queryByText('Exit Builder?');
    expect(dialogTitle).not.toBeInTheDocument();
  });
});
