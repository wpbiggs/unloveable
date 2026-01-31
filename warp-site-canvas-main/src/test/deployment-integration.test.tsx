import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BuilderHeader from '../components/builder/BuilderHeader';
import { BrowserRouter } from 'react-router-dom';
import * as deploymentUtils from '../lib/deployment-utils';
import { ThemeProvider } from "../components/ThemeProvider";
import userEvent from '@testing-library/user-event';
import { afterEach } from 'vitest';

vi.mock('@/lib/opencode-client', () => ({
  OpenCode: {
    listFiles: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue({ type: 'text', content: '' }),
  },
}));

afterEach(() => {
  document.body.removeAttribute('data-scroll-locked');
  document.body.style.pointerEvents = '';
});

// Mock the deployment utility
vi.mock('../lib/deployment-utils', () => ({
  deployToVercel: vi.fn(),
}));

describe('BuilderHeader Deployment Integration', () => {
  const defaultProps = {
    sessions: [],
    isSessionsLoading: false,
    onRefreshSessions: vi.fn(),
    onSelectSession: vi.fn(),
    sessionID: 'test-session',
    directory: '/test/dir',
    loopState: "IDLE" as const,
    iteration: 0,
    isRunning: false,
    onRunLoop: vi.fn(),
    onStop: vi.fn(),
    onApplyNextPatch: vi.fn(),
    onResetSession: vi.fn(),
    onNewWorkspaceSession: vi.fn(),
    onChangeDirectory: vi.fn(),
  };

  // Mock matchMedia for ThemeProvider
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
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

  it('renders the Deploy button in the dropdown menu', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <BrowserRouter>
          <BuilderHeader {...defaultProps} />
        </BrowserRouter>
      </ThemeProvider>
    );

    // Open the dropdown menu (using the MoreHorizontal icon button)
    // The button structure in BuilderHeader is:
    // <DropdownMenuTrigger asChild>
    //   <Button variant="ghost" size="icon" className="h-9 w-9">
    //     <MoreHorizontal className="h-4 w-4" />
    //   </Button>
    // </DropdownMenuTrigger>
    
    // We can target the dropdown trigger by its size/icon class or position
    // Or we can query by icon if we mock lucide-react, but that's invasive.
    // Let's use getByRole('button') and assume it's the one with the menu trigger behavior.
    
    // In shadcn/ui DropdownMenuTrigger usually adds aria-haspopup="menu"
    const menuTrigger = screen.getByLabelText('More actions');
    await user.click(menuTrigger);

    // Now check if "Deploy to Vercel" option exists (it should now)
    const deployOption = await screen.findByRole('menuitem', { name: /Deploy to Vercel/i });
    expect(deployOption).toBeInTheDocument();
  });

  it('calls deployToVercel when the deploy option is clicked', async () => {
    const user = userEvent.setup();
    // This test expects the functionality to be there, so it will fail initially
    render(
      <ThemeProvider>
        <BrowserRouter>
          <BuilderHeader {...defaultProps} />
        </BrowserRouter>
      </ThemeProvider>
    );

    const menuTrigger = screen.getByLabelText('More actions');
    await user.click(menuTrigger);

    // Wait for dropdown content
    const deployText = await screen.findByRole('menuitem', { name: /Deploy to Vercel/i });
    await user.click(deployText);

    // Deployment is async, wait for it
    await waitFor(() => {
        expect(deploymentUtils.deployToVercel).toHaveBeenCalled();
    });
  });
});
