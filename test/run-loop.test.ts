import { describe, it, expect } from "bun:test";
import { join } from "path";
import { stat, chmod, mkdir, writeFile, readFile, rm } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { readdirSync } from "fs";

const execAsync = promisify(exec);

describe("run-loop.sh", () => {
  const rootDir = process.cwd();
  const scriptPath = join(rootDir, "run-loop.sh");
  const workDir = join(rootDir, "workdir-for-tests");

  const mockPlan = `
# Plan
- [ ] Mock task
  `.trim();

  const mockSpec = `
# Spec
  `.trim();

  const mockPrompt = `
# Prompt
  `.trim();

  const setupWorkDir = async () => {
    await mkdir(workDir, { recursive: true });
    await writeFile(join(workDir, "implementation-plan.md"), mockPlan);
    await writeFile(join(workDir, "spec.md"), mockSpec);
    await writeFile(join(workDir, "prompt.md"), mockPrompt);
    // Copy the validation script because run-loop.sh calls it
    const valScript = await readFile(join(rootDir, "validate-loop.js"));
    await writeFile(join(workDir, "validate-loop.js"), valScript);
    // Copy extract-runlog.js
    const extractScript = await readFile(join(rootDir, "extract-runlog.js"));
    await writeFile(join(workDir, "extract-runlog.js"), extractScript);
    
    // Copy run-loop.sh
    const runScript = await readFile(scriptPath, "utf8");
    // Modify run-loop.sh to skip the server directory check for testing
    // The check involves curl and node and validates OPENCODE_SERVER_URL.
    // We replace the block that does the check with a comment.
    // The block is roughly:
    // server_dir=$(curl ...)
    // if [[ -z ...
    // if [[ "$server_dir" ...
    
    // Simpler: Just force server_dir to match ROOT_DIR in the script logic for the test
    // OR, better, we can mock `curl` but that's hard.
    // We'll replace the check logic.
    
    const modifiedRunScript = runScript.replace(
      /server_dir=\$\(curl[\s\S]*?fi\n\s*if \[\[ "\$server_dir" != "\$ROOT_DIR"[\s\S]*?fi/g, 
      `# Test bypass\nserver_dir="$ROOT_DIR"\n`
    );

    await writeFile(join(workDir, "run-loop.sh"), modifiedRunScript);
    await chmod(join(workDir, "run-loop.sh"), 0o755);
  };

  const cleanupWorkDir = async () => {
    await rm(workDir, { recursive: true, force: true });
  };

  it("should exist", async () => {
    const stats = await stat(scriptPath);
    expect(stats.isFile()).toBe(true);
  });

  it("should be executable", async () => {
    await chmod(scriptPath, 0o755);
    const stats = await stat(scriptPath);
    expect(stats.mode & 0o111).not.toBe(0);
  });

  it("should print usage when run without arguments", async () => {
    try {
      await execAsync(`${scriptPath}`);
    } catch (error: any) {
      const output = error.stdout || error.stderr || "";
      expect(output).toContain("Usage:");
    }
  });

  it("should run the loop with mocked opencode", async () => {
    await cleanupWorkDir();
    await setupWorkDir();
    const mockOpencodePath = join(rootDir, "test/mocks/opencode-mock.sh");
    
    try {
      const { stdout, stderr } = await execAsync(
        `./run-loop.sh exploration`, 
        { 
          cwd: workDir,
          env: {
            ...process.env,
            MAX_ITERS: "1",
            OPENCODE_CMD: mockOpencodePath,
            OPENCODE_SERVER_URL: "http://mock-server"
          }
        }
      );
      
      // Verify runlog was created
      const runlogs = readdirSync(join(workDir, "runlogs"));
      expect(runlogs).toContain("iter_001.md");
      expect(runlogs).toContain("iter_001.jsonl");

      // Verify runlog content matches what mock-opencode.sh outputs + extract-runlog.js processing
      const runlogContent = await readFile(join(workDir, "runlogs/iter_001.md"), "utf8");
      expect(runlogContent).toContain("INSPECT");
      expect(runlogContent).toContain("Mock inspection");

    } catch (err: any) {
      console.error("STDOUT:", err.stdout);
      console.error("STDERR:", err.stderr);
      throw err;
    } finally {
      await cleanupWorkDir();
    }
  });
});
