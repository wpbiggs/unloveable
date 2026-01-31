
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BuilderHeader from '../BuilderHeader';
import { BrowserRouter } from 'react-router-dom';
import * as OpenCodeClient from '@/lib/opencode-client';

// Mock the dependencies
vi.mock('@/lib/opencode-client', () => ({
  OpenCode: {
    runShell: vi.fn().mockResolvedValue({}),
    fileStatus: vi.fn().mockResolvedValue([]),
    sessionDiff: vi.fn().mockResolvedValue([]),
    listFiles: vi.fn().mockResolvedValue([]),
  }
}));

// Mock other components used in BuilderHeader
vi.mock('../ComponentPicker', () => ({ ComponentPicker: () => <div data-testid="component-picker" /> }));
vi.mock('../TemplateGallery', () => ({ TemplateGallery: () => <div data-testid="template-gallery" /> }));
vi.mock('../ThemeCustomizer', () => ({ ThemeCustomizer: () => <div data-testid="theme-customizer" /> }));
vi.mock('../KeyboardShortcutsDialog', () => ({ KeyboardShortcutsDialog: () => <div data-testid="shortcuts-dialog" /> }));

describe('BuilderHeader Run Loop Button', () => {
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

  it('renders "Run Loop" button when not running', () => {
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} />
      </BrowserRouter>
    );

    const runButton = screen.getByText('Run Loop');
    expect(runButton).toBeInTheDocument();
  });

  it('calls onRunLoop when "Run Loop" is clicked', () => {
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} />
      </BrowserRouter>
    );

    const runButton = screen.getByText('Run Loop');
    fireEvent.click(runButton);
    expect(defaultProps.onRunLoop).toHaveBeenCalled();
  });

  it('renders "Run Headless" menu item', async () => {
    const onRunHeadless = vi.fn();
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} onRunHeadless={onRunHeadless} />
      </BrowserRouter>
    );

    // Find the dropdown trigger (chevron down icon button next to Run Loop)
    const headlessMenuTrigger = screen.getByLabelText('Headless menu');
    fireEvent.click(headlessMenuTrigger);

    // Check if the menu item exists
    const menuItem = await screen.findByText(/Run Headless/); // Changed to regex for flexibility
    expect(menuItem).toBeInTheDocument();
  });
  
  it('calls onRunHeadless when headless option is clicked', async () => {
    const onRunHeadless = vi.fn();
    render(
        <BrowserRouter>
          <BuilderHeader {...defaultProps} onRunHeadless={onRunHeadless} />
        </BrowserRouter>
      );
  
      const headlessMenuTrigger = screen.getByLabelText('Headless menu');
      fireEvent.click(headlessMenuTrigger);
  
      const menuItem = await screen.findByText(/Run Headless/); // Changed to regex for flexibility
      fireEvent.click(menuItem);
      
      expect(onRunHeadless).toHaveBeenCalled();
  });
});
