import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RunlogPanel } from "./RunlogPanel";
import { OpenCode } from "../../lib/opencode-client";

// Mock the OpenCode client
vi.mock("../../lib/opencode-client", () => ({
  OpenCode: {
    listFiles: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe("RunlogPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays a list of runlogs", async () => {
    vi.mocked(OpenCode.listFiles).mockResolvedValue([
      { name: "iter_001.md", type: "file", path: "runlogs/iter_001.md", absolute: "/runlogs/iter_001.md", ignored: false },
      { name: "iter_002.md", type: "file", path: "runlogs/iter_002.md", absolute: "/runlogs/iter_002.md", ignored: false },
    ]);

    render(<RunlogPanel />);

    // Open the dialog first
    fireEvent.click(screen.getByText("Runlogs"));

    await waitFor(() => {
      expect(screen.getByText("iter_001.md")).toBeInTheDocument();
      expect(screen.getByText("iter_002.md")).toBeInTheDocument();
    });

    expect(OpenCode.listFiles).toHaveBeenCalledWith("runlogs");
  });

  it("loads and displays runlog content when clicked", async () => {
    vi.mocked(OpenCode.listFiles).mockResolvedValue([
      { name: "iter_001.md", type: "file", path: "runlogs/iter_001.md", absolute: "/runlogs/iter_001.md", ignored: false },
    ]);
    vi.mocked(OpenCode.readFile).mockResolvedValue({
      type: "text",
      content: "# Runlog 001\nSuccess",
    });

    render(<RunlogPanel />);

    // Open the dialog
    fireEvent.click(screen.getByText("Runlogs"));

    await waitFor(() => {
      expect(screen.getByText("iter_001.md")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("iter_001.md"));

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("# Runlog 001"))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes("Success"))).toBeInTheDocument();
    });

    expect(OpenCode.readFile).toHaveBeenCalledWith("runlogs/iter_001.md");
  });
});
