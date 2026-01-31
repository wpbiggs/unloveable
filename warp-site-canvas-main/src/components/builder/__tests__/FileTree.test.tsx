import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FileTree from "../FileTree";
import type { OpenCodeFileNode } from "@/lib/opencode-client";

describe("FileTree", () => {
  const mockFiles: OpenCodeFileNode[] = [
    { name: "index.html", path: "/index.html", type: "file" },
    { name: "style.css", path: "/style.css", type: "file" },
    { name: "src", path: "/src", type: "directory" },
  ];

  const mockGetChildren = (path: string) => {
    if (path === "/src") {
      return [
        { name: "App.tsx", path: "/src/App.tsx", type: "file" },
        { name: "utils.ts", path: "/src/utils.ts", type: "file" },
      ];
    }
    return [];
  };

  it("renders file list", () => {
    render(
      <FileTree
        files={mockFiles}
        selectedFile={null}
        onSelectFile={vi.fn()}
        onExpandDir={vi.fn()}
        getChildren={mockGetChildren}
      />
    );

    expect(screen.getByText("index.html")).toBeInTheDocument();
    expect(screen.getByText("style.css")).toBeInTheDocument();
  });

  it("filters files by name when search input is used", () => {
    render(
      <FileTree
        files={mockFiles}
        selectedFile={null}
        onSelectFile={vi.fn()}
        onExpandDir={vi.fn()}
        getChildren={mockGetChildren}
      />
    );

    // Initial state: all root files visible
    expect(screen.getByText("index.html")).toBeInTheDocument();
    expect(screen.getByText("style.css")).toBeInTheDocument();

    // Find search input (assuming placeholder contains "search" or "filter")
    const searchInput = screen.getByPlaceholderText(/search/i);
    
    // Type "index"
    fireEvent.change(searchInput, { target: { value: "index" } });

    // "index.html" should be visible, "style.css" should not
    expect(screen.getByText("index.html")).toBeInTheDocument();
    expect(screen.queryByText("style.css")).not.toBeInTheDocument();
  });
});
