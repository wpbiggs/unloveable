import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Retrieval Prompt Snippet", () => {
  it("should exist", () => {
    const promptPath = path.resolve(__dirname, "../retrieval-prompt.md");
    expect(fs.existsSync(promptPath)).toBe(true);
  });

  it("should contain the registry rule", () => {
    const promptPath = path.resolve(__dirname, "../retrieval-prompt.md");
    const content = fs.readFileSync(promptPath, "utf-8");
    expect(content).toContain("Component Registry");
    expect(content).toContain("src/components/ui");
  });
});
