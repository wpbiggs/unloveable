import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

describe("Documentation Compliance", () => {
  const specPath = join(import.meta.dir, "../spec.md");
  const specContent = readFileSync(specPath, "utf-8");

  test("spec.md should contain Canonical dev commands section", () => {
    expect(specContent).toContain("## Canonical dev commands (local)");
  });

  test("spec.md should document OpenCode server startup", () => {
    expect(specContent).toContain("### 1) Start OpenCode server (backend)");
    expect(specContent).toContain("opencode serve");
    expect(specContent).toContain("--port 4096");
  });

  test("spec.md should document UnLoveable UI startup", () => {
    expect(specContent).toContain("### 2) Start UnLoveable UI (builder)");
    expect(specContent).toContain("npm install");
    expect(specContent).toContain("npm run dev");
    expect(specContent).toContain("VITE_OPENCODE_URL=");
  });

  test("spec.md should document Headless loop runner", () => {
    expect(specContent).toContain("### 3) Headless loop runner");
    expect(specContent).toContain("./run-loop.sh");
  });
});
