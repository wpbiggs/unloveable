import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TemplateGallery } from "../TemplateGallery";
import { WORKSPACE_TEMPLATES } from "@/lib/workspace-templates";

describe("TemplateGallery", () => {
  it("renders all available templates", () => {
    render(<TemplateGallery open={true} onOpenChange={() => {}} onSelect={() => {}} />);
    
    // Check if the dialog title is present
    expect(screen.getByText("New Workspace")).toBeDefined();
    
    // Check if all templates are rendered
    WORKSPACE_TEMPLATES.forEach((template) => {
      // Use getAllByText because tags might duplicate the label
      const elements = screen.getAllByText(template.label);
      expect(elements.length).toBeGreaterThan(0);
      expect(screen.getByText(template.description)).toBeDefined();
    });
  });

  it("calls onSelect when a template is chosen and Create is clicked", () => {
    const onSelect = vi.fn();
    render(<TemplateGallery open={true} onOpenChange={() => {}} onSelect={onSelect} />);
    
    // Find the button/card for the first template
    const firstTemplate = WORKSPACE_TEMPLATES[0];
    
    // Find the specific card heading to click
    const headings = screen.getAllByRole("heading", { level: 3 });
    const targetHeading = headings.find(h => h.textContent === firstTemplate.label);
    expect(targetHeading).toBeDefined();
    
    // Click the template card (parent of heading)
    fireEvent.click(targetHeading!);
    
    // Verify "Create Project" button is now enabled (it starts disabled)
    const createBtn = screen.getByText("Create Project");
    expect(createBtn).not.toBeDisabled();
    
    // Click create
    fireEvent.click(createBtn);
    
    // Check if onSelect was called with the correct ID
    expect(onSelect).toHaveBeenCalledWith(firstTemplate.id);
  });
});
