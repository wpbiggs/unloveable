
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

describe('BuilderHeader Run Headless Button', () => {
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
    onRunHeadless: vi.fn(), // Ensure this is passed
  };

  it('renders headless run menu item', async () => {
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} />
      </BrowserRouter>
    );

    const menuTrigger = screen.getByLabelText('Headless menu');
    fireEvent.click(menuTrigger);

    const menuItem = await screen.findByText('Run Headless (Exploration)');
    expect(menuItem).toBeInTheDocument();
  });

  it('calls onRunHeadless when menu item is clicked', async () => {
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} />
      </BrowserRouter>
    );

    const menuTrigger = screen.getByLabelText('Headless menu');
    fireEvent.click(menuTrigger);

    const menuItem = await screen.findByText('Run Headless (Exploration)');
    fireEvent.click(menuItem);

    expect(defaultProps.onRunHeadless).toHaveBeenCalled();
  });
});
