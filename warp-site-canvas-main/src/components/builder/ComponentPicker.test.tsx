import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ComponentPicker } from "./ComponentPicker";

describe("ComponentPicker", () => {
  it("renders the trigger button", () => {
    render(<ComponentPicker onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /components/i })).toBeInTheDocument();
  });

  it("opens the dialog when clicked", () => {
    render(<ComponentPicker onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /components/i }));
    expect(screen.getByText("Component Library")).toBeInTheDocument();
  });

  it("calls onSelect when a component is clicked", () => {
    const onSelect = vi.fn();
    render(<ComponentPicker onSelect={onSelect} />);
    
    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /components/i }));
    
    // Find and click 'Button' component card
    const btnCard = screen.getByText("Button").closest("div");
    if (!btnCard) throw new Error("Button card not found");
    fireEvent.click(btnCard);
    
    expect(onSelect).toHaveBeenCalledWith("Button");
  });
});
