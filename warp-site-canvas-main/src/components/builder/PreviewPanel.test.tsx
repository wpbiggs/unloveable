import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PreviewPanel from "./PreviewPanel";
import { GeneratedCode } from "@/lib/ai-config";

// Mock Lucide icons to avoid issues in testing environment
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    Monitor: () => <div data-testid="icon-monitor" />,
    Tablet: () => <div data-testid="icon-tablet" />,
    Smartphone: () => <div data-testid="icon-smartphone" />,
  };
});

describe("PreviewPanel", () => {
  const mockCode: GeneratedCode = {
    html: "<div>Hello World</div>",
    css: "",
    js: "",
  };

  const defaultProps = {
    code: mockCode,
    isGenerating: false,
    url: "http://localhost:3000",
    canRun: true,
    isRunning: true,
    onRun: vi.fn(),
    onRefresh: vi.fn(),
    onNavigate: vi.fn(),
  };

  it("renders responsive toggles when in preview mode", () => {
    render(<PreviewPanel {...defaultProps} />);
    
    // Ensure we are in preview mode (default)
    expect(screen.getByText("Preview")).toBeInTheDocument();
    
    // Check for the icons
    expect(screen.getByTestId("icon-monitor")).toBeInTheDocument();
    expect(screen.getByTestId("icon-tablet")).toBeInTheDocument();
    expect(screen.getByTestId("icon-smartphone")).toBeInTheDocument();
  });

  it("changes container width when tablet toggle is clicked", () => {
    const { container } = render(<PreviewPanel {...defaultProps} />);
    
    // Find the tablet button (parent of the icon)
    const tabletIcon = screen.getByTestId("icon-tablet");
    const tabletButton = tabletIcon.closest("button");
    
    fireEvent.click(tabletButton!);
    
    // Find the container that holds the iframe. 
    // It has the style width applied. 
    // We can look for the iframe and then its parent.
    const iframe = screen.getByTitle("Preview");
    const iframeContainer = iframe.parentElement;
    
    expect(iframeContainer).toHaveStyle({ width: "768px" });
  });

  it("changes container width when mobile toggle is clicked", () => {
    const { container } = render(<PreviewPanel {...defaultProps} />);
    
    const mobileIcon = screen.getByTestId("icon-smartphone");
    const mobileButton = mobileIcon.closest("button");
    
    fireEvent.click(mobileButton!);
    
    const iframe = screen.getByTitle("Preview");
    const iframeContainer = iframe.parentElement;
    
    expect(iframeContainer).toHaveStyle({ width: "375px" });
  });

  it("defaults to desktop width", () => {
    render(<PreviewPanel {...defaultProps} />);
    
    const iframe = screen.getByTitle("Preview");
    const iframeContainer = iframe.parentElement;
    
    expect(iframeContainer).toHaveStyle({ width: "100%" });
  });
});
