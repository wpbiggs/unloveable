
import { render, screen } from "@testing-library/react";
import ChatPanel from "../components/builder/ChatPanel";
import { describe, it, expect, vi } from "vitest";
import '@testing-library/jest-dom';

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("ChatPanel Loading State", () => {
  const defaultProps = {
    messages: [
      { id: "1", role: "assistant", content: "Thinking...", attachments: [] }
    ],
    onSendMessage: vi.fn(),
    isGenerating: true,
    activity: {
      loopState: "PLANNING",
      iteration: 1,
      lastError: null,
      logs: [],
      server: { status: "connected", feed: [] }
    },
  };

  it("shows loading indicator when generating", () => {
    // We need an assistant message at the end for the loading indicator to show up
    const props = {
      ...defaultProps,
      messages: [
        { id: "1", role: "user", content: "hi" },
        { id: "2", role: "assistant", content: "" } // Empty content triggers loading state UI when isGenerating is true
      ],
      isGenerating: true
    };
    
    render(<ChatPanel {...props} />);
    
    // Check for the spinner/indicator container
    expect(screen.getByTestId("ai-loading-indicator")).toBeInTheDocument();
    
    // Check for the loop state text
    expect(screen.getAllByText(/PLANNING/).length).toBeGreaterThan(0);
    expect(screen.getByText(/iter 1/)).toBeInTheDocument();

    // Check for progress bar
    expect(screen.getByTestId("ai-progress-bar")).toBeInTheDocument();
  });

  it("updates progress bar based on loop state", () => {
     const props = {
      ...defaultProps,
      messages: [
        { id: "1", role: "user", content: "hi" },
        { id: "2", role: "assistant", content: "" }
      ],
      isGenerating: true
    };

    const { rerender } = render(<ChatPanel {...props} activity={{ ...defaultProps.activity, loopState: "PLANNING", iteration: 1 }} />);
    expect(screen.getAllByText(/PLANNING/).length).toBeGreaterThan(0);
    
    rerender(<ChatPanel {...props} activity={{ ...defaultProps.activity, loopState: "RUNNING", iteration: 1 }} />);
    expect(screen.getAllByText(/RUNNING/).length).toBeGreaterThan(0);

    rerender(<ChatPanel {...props} activity={{ ...defaultProps.activity, loopState: "OBSERVING", iteration: 1 }} />);
    expect(screen.getAllByText(/OBSERVING/).length).toBeGreaterThan(0);
  });

  it("does not show loading indicator when idle", () => {
    render(<ChatPanel {...defaultProps} isGenerating={false} messages={[]} />);
    expect(screen.queryByTestId("ai-loading-indicator")).not.toBeInTheDocument();
  });
});
