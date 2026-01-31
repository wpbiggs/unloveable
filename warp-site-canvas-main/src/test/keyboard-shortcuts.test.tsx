import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Helper component to test the hook
type ShortcutTesterProps = {
  onSave?: () => void;
  onSendMessage?: () => void;
  onToggleCommandPalette?: () => void;
  onToggleSidebar?: () => void;
};

const ShortcutTester = ({ 
  onSave, 
  onSendMessage, 
  onToggleCommandPalette,
  onToggleSidebar 
}: ShortcutTesterProps) => {
  useGlobalShortcuts({ 
    onSave, 
    onSendMessage, 
    onToggleCommandPalette,
    onToggleSidebar
  });
  return (
    <div data-testid="container">
      <input type="text" placeholder="Type here" />
    </div>
  );
};

describe("Keyboard Shortcuts", () => {
  it("triggers onSave when Mod+S is pressed", () => {
    const onSave = vi.fn();
    render(
      <TooltipProvider>
        <Toaster />
        <ShortcutTester onSave={onSave} />
      </TooltipProvider>
    );

    // Simulate Cmd+S (Mac) or Ctrl+S (Windows/Linux)
    fireEvent.keyDown(document.body, { key: "s", metaKey: true, code: "KeyS" });
    
    // Note: react-hotkeys-hook might need a bit of time or specific event properties
    // If this fails, we might need to check how the library handles events in tests.
    // Sometimes it listens on 'keyup' or requires 'ctrlKey' instead of 'metaKey' depending on platform mock.
    
    // Let's try firing both just in case, or verify the mock behavior.
    // For simplicity, we assume the hook works if the library is reliable, 
    // but testing it confirms our integration.
    
    // Actually, react-hotkeys-hook often attaches to document/window. 
    // We might need to ensure the event bubbles or target is correct.
    
    expect(onSave).toHaveBeenCalled();
  });

  it("triggers onSendMessage when Mod+Enter is pressed", () => {
    const onSendMessage = vi.fn();
    render(
      <TooltipProvider>
        <ShortcutTester onSendMessage={onSendMessage} />
      </TooltipProvider>
    );

    fireEvent.keyDown(document.body, { key: "Enter", metaKey: true, code: "Enter" });
    expect(onSendMessage).toHaveBeenCalled();
  });

  it("triggers onToggleCommandPalette when Mod+K is pressed", () => {
    const onToggleCommandPalette = vi.fn();
    render(
      <TooltipProvider>
        <ShortcutTester onToggleCommandPalette={onToggleCommandPalette} />
      </TooltipProvider>
    );

    fireEvent.keyDown(document.body, { key: "k", metaKey: true, code: "KeyK" });
    expect(onToggleCommandPalette).toHaveBeenCalled();
  });

  it("triggers onToggleSidebar when Mod+B is pressed", () => {
    const onToggleSidebar = vi.fn();
    render(
      <TooltipProvider>
        <ShortcutTester onToggleSidebar={onToggleSidebar} />
      </TooltipProvider>
    );

    fireEvent.keyDown(document.body, { key: "b", metaKey: true, code: "KeyB" });
    expect(onToggleSidebar).toHaveBeenCalled();
  });
});
