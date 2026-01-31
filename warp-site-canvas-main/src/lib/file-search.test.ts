import { describe, it, expect, vi } from "vitest";
import { searchFiles, type SearchResult } from "./file-search";

describe("searchFiles", () => {
  it("constructs the correct grep command", async () => {
    const runCommand = vi.fn().mockResolvedValue({ ok: true, output: "" });
    await searchFiles("foobar", runCommand);

    expect(runCommand).toHaveBeenCalledWith(
      expect.stringContaining('grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.opencode "foobar" .')
    );
  });

  it("parses grep output correctly", async () => {
    const output = `src/App.tsx:10:import React from "react";
src/components/Button.tsx:5:export const Button = () => {
src/utils.ts:20:  const x = "foo:bar";`; // content with colon

    const runCommand = vi.fn().mockResolvedValue({ ok: true, output });
    const results = await searchFiles("foo", runCommand);

    expect(results).toHaveLength(3);
    
    expect(results[0]).toEqual({
      file: "src/App.tsx",
      line: 10,
      content: 'import React from "react";'
    });

    expect(results[1]).toEqual({
      file: "src/components/Button.tsx",
      line: 5,
      content: "export const Button = () => {"
    });

    expect(results[2]).toEqual({
      file: "src/utils.ts",
      line: 20,
      content: '  const x = "foo:bar";'
    });
  });

  it("handles empty results", async () => {
    const runCommand = vi.fn().mockResolvedValue({ ok: true, output: "" });
    const results = await searchFiles("missing", runCommand);
    expect(results).toEqual([]);
  });

  it("handles errors gracefully", async () => {
    const runCommand = vi.fn().mockResolvedValue({ ok: false, output: "grep: invalid option" });
    const results = await searchFiles("error", runCommand);
    expect(results).toEqual([]);
  });
});
