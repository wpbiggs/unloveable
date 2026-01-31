import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DiffViewer } from "./DiffViewer";

describe("DiffViewer", () => {
  it("renders empty state when no diff selected", () => {
    render(<DiffViewer before="" after="" />);
    expect(screen.getByText("(empty)", { selector: ".before-content" })).toBeInTheDocument();
    expect(screen.getByText("(empty)", { selector: ".after-content" })).toBeInTheDocument();
  });

  it("renders before and after content", () => {
    const before = "const a = 1;";
    const after = "const a = 2;";
    render(<DiffViewer before={before} after={after} />);
    expect(screen.getByText(before)).toBeInTheDocument();
    expect(screen.getByText(after)).toBeInTheDocument();
  });
});
