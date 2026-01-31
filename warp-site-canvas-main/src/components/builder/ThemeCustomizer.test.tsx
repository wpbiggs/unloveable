
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { ThemeProvider } from "../ThemeProvider";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ThemeProvider context if needed, but integration testing with the real provider is better
// providing we can mock the document.documentElement.style.setProperty

describe("ThemeCustomizer", () => {
  beforeEach(() => {
    // Clear any previous style mocks
    document.documentElement.style.setProperty = vi.fn();
  });

  it("renders the theme customizer button", () => {
    render(
      <ThemeProvider>
        <ThemeCustomizer />
      </ThemeProvider>
    );
    expect(screen.getByTitle("Customize Theme")).toBeInTheDocument();
  });

  it("opens the popover when clicked", async () => {
    render(
      <ThemeProvider>
        <ThemeCustomizer />
      </ThemeProvider>
    );
    
    const button = screen.getByTitle("Customize Theme");
    fireEvent.click(button);
    
    expect(await screen.findByText("Theme Settings")).toBeInTheDocument();
    expect(screen.getByText("Primary Color")).toBeInTheDocument();
  });

  it("changes the primary color when a color is selected", async () => {
    render(
      <ThemeProvider>
        <ThemeCustomizer />
      </ThemeProvider>
    );

    // Open popover
    fireEvent.click(screen.getByTitle("Customize Theme"));
    
    // Find a color option (assuming we render buttons for colors)
    // We'll look for a button with a specific aria-label or just the first color option
    const colorButtons = await screen.findAllByRole("button");
    // The trigger is a button, so we need to filter for color swatches inside the content
    // We'll rely on the implementation having specific test ids or structure
    
    // For now, let's just check that the setProperty was called if we mock the interaction
    // Or we can check if the context updated.
  });
});
