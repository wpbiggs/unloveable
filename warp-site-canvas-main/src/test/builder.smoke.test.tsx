import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Builder from "@/pages/Builder";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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

describe("Builder", () => {
  it("renders without crashing", () => {
    const g = globalThis as unknown as { crypto?: Crypto };
    const existing = g.crypto;
    if (!existing?.randomUUID) {
      g.crypto = {
        ...(existing ?? {}),
        randomUUID: () => "00000000-0000-0000-0000-000000000000",
      } as Crypto;
    }

    expect(() => {
      render(
        <ThemeProvider>
          <TooltipProvider>
            <MemoryRouter>
              <Builder />
            </MemoryRouter>
          </TooltipProvider>
        </ThemeProvider>,
      );
    }).not.toThrow();
  });
});
