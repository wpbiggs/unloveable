
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BuilderHeader from './BuilderHeader';
import { BrowserRouter } from 'react-router-dom';

describe('BuilderHeader', () => {
  const defaultProps = {
    sessions: [],
    isSessionsLoading: false,
    onRefreshSessions: () => {},
    onSelectSession: () => {},
    sessionID: null,
    directory: null,
    loopState: 'ready' as const,
    iteration: 0,
    isRunning: false,
    onRunLoop: () => {},
    onStop: () => {},
    onApplyNextPatch: () => {},
    onResetSession: () => {},
    onNewWorkspaceSession: () => {},
    onChangeDirectory: () => {},
    sseStatus: undefined,
  };

  it('renders correctly', () => {
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} />
      </BrowserRouter>
    );
    expect(screen.getByText('UnLoveable')).toBeDefined();
  });
});
