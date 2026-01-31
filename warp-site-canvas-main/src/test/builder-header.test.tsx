import { render, screen } from "@testing-library/react";
import BuilderHeader from "../components/builder/BuilderHeader";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { ThemeProvider } from "../components/ThemeProvider";

describe("BuilderHeader", () => {
  const defaultProps = {
    sessions: [],
    isSessionsLoading: false,
    onRefreshSessions: vi.fn(),
    onSelectSession: vi.fn(),
    sessionID: "test-session",
    directory: "/test/dir",
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

  it("renders loop state", () => {
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

    render(
      <ThemeProvider>
        <BrowserRouter>
          <BuilderHeader {...defaultProps} loopState="PLANNING" />
        </BrowserRouter>
      </ThemeProvider>
    );
    expect(screen.getByText("PLANNING →")).toBeDefined();
  });

  it("renders iteration count", () => {
    render(
      <ThemeProvider>
        <BrowserRouter>
          <BuilderHeader {...defaultProps} iteration={5} />
        </BrowserRouter>
      </ThemeProvider>
    );
    expect(screen.getByText("iter 5")).toBeDefined();
  });
});
