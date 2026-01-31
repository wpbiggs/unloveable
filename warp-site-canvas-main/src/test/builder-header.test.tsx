import { render, screen } from "@testing-library/react";
import BuilderHeader from "../components/builder/BuilderHeader";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

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
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} loopState="PLANNING" />
      </BrowserRouter>
    );
    expect(screen.getByText("PLANNING →")).toBeDefined();
  });

  it("renders iteration count", () => {
    render(
      <BrowserRouter>
        <BuilderHeader {...defaultProps} iteration={5} />
      </BrowserRouter>
    );
    expect(screen.getByText("iter 5")).toBeDefined();
  });
});
