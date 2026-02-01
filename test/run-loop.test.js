const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const assert = require('assert');

// Setup temp test environment
const TEST_DIR = path.join(__dirname, 'tmp_test_run_loop');
const RUN_LOOP = path.join(__dirname, '../run-loop.sh');

function setup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR);

  const OPENCODE_MOCK = path.join(TEST_DIR, 'opencode-mock');
  const VALIDATE_MOCK = path.join(TEST_DIR, 'validate-loop.js');
  const PROMPT_MD = path.join(TEST_DIR, 'prompt.md');
  const SPEC_MD = path.join(TEST_DIR, 'spec.md');
  const PLAN_MD = path.join(TEST_DIR, 'implementation-plan.md');

  // Mock opencode default success
  fs.writeFileSync(OPENCODE_MOCK, `#!/bin/sh
echo "MOCK OPENCODE RUNNING: $@"
exit 0
`);
  fs.chmodSync(OPENCODE_MOCK, '755');

  // Mock validate-loop.js
  fs.writeFileSync(VALIDATE_MOCK, `
console.log("MOCK VALIDATOR RUNNING");
process.exit(0);
`);

  // Mock context files
  fs.writeFileSync(PROMPT_MD, '# Prompt');
  fs.writeFileSync(SPEC_MD, '# Spec');
  fs.writeFileSync(PLAN_MD, `
# Plan
- [ ] Task 1
- [ ] Task 2
`);

  // Mock curl for server check
  const CURL_MOCK = path.join(TEST_DIR, 'curl');
  fs.writeFileSync(CURL_MOCK, `#!/bin/sh
echo '{"directory": "${TEST_DIR}"}'
`);
  fs.chmodSync(CURL_MOCK, '755');

  // Copy run-loop.sh
  fs.copyFileSync(RUN_LOOP, path.join(TEST_DIR, 'run-loop.sh'));

  return { TEST_DIR, OPENCODE_MOCK, PLAN_MD };
}

function run(envOverrides = {}) {
  const env = {
    ...process.env,
    PATH: `${TEST_DIR}:${process.env.PATH}`,
    OPENCODE_CMD: path.join(TEST_DIR, 'opencode-mock'),
    OPENCODE_SERVER_URL: 'http://mock-server',
    MAX_ITERS: '5',
    FAIL_THRESHOLD: '3',
    ...envOverrides
  };

  return spawnSync(path.join(TEST_DIR, 'run-loop.sh'), ['exploration'], {
    env,
    cwd: TEST_DIR,
    encoding: 'utf8'
  });
}

// Test 1: Happy path (already tested, but good for regression)
console.log('Test 1: Happy path');
let ctx = setup();
let res = run({ MAX_ITERS: '1' });
assert.strictEqual(res.status, 0, 'Should exit 0');
assert(res.stdout.includes('Max iterations reached (1)'), 'Should hit max iters');

// Test 2: Stop condition - All tasks checked
console.log('Test 2: Stop when all tasks checked');
ctx = setup();
// Update plan to have no unchecked boxes
fs.writeFileSync(ctx.PLAN_MD, `
# Plan
- [x] Task 1
- [x] Task 2
`);
res = run();
assert.strictEqual(res.status, 0);
assert(res.stdout.includes('All tasks complete'), 'Should output "All tasks complete"');
// Should NOT run opencode if plan is already done (script checks plan at end of loop, but also we want to ensure it stops)
// Wait, the script runs loop THEN checks plan. So it runs at least once?
// Let's check script logic:
// for loop...
//   opencode run ...
//   validate ...
//   grep unchecked ... if none, exit 0
// done
// So it runs ONCE even if tasks are checked? That seems inefficient but let's verify behavior.
// Actually, strict "Ralph loop" implies looking at plan determines action. If no unchecked, maybe it shouldn't run?
// The prompt says "Pick the highest-leverage unchecked checkbox".
// If opencode is called, it might fail or hallucinate if no unchecked task.
// But the script purely checks POST-iteration.
// So yes, it runs once.
// Assert it runs once.
assert(res.stdout.match(/=== iter_001/g)?.length === 1, 'Should run exactly 1 iteration then stop');


// Test 3: Failure threshold
console.log('Test 3: Failure threshold');
ctx = setup();
// Mock opencode to fail
fs.writeFileSync(ctx.OPENCODE_MOCK, `#!/bin/sh
echo "MOCK OPENCODE FAILING"
exit 1
`);
res = run({ FAIL_THRESHOLD: '2', MAX_ITERS: '5' });
assert.notStrictEqual(res.status, 0, 'Should exit non-zero');
assert(res.stderr.includes('Failure threshold reached (2)'), 'Should report threshold reached');
// Should have run 2 times (failed twice)
assert(res.stdout.match(/=== iter_001/g), 'Iter 1 should start');
assert(res.stdout.match(/=== iter_002/g), 'Iter 2 should start');
assert(!res.stdout.match(/=== iter_003/g), 'Iter 3 should NOT start');


// Test 4: Max iterations
console.log('Test 4: Max iterations');
ctx = setup();
// Mock opencode to succeed always, plan never completes (mock doesn't update plan)
res = run({ MAX_ITERS: '2' });
assert.strictEqual(res.status, 0);
assert(res.stdout.includes('Max iterations reached (2)'), 'Should report max iters reached');
assert(res.stdout.match(/=== iter_001/g), 'Iter 1');
assert(res.stdout.match(/=== iter_002/g), 'Iter 2');
assert(!res.stdout.match(/=== iter_003/g), 'Iter 3 should not run');

console.log('All tests passed!');
fs.rmSync(ctx.TEST_DIR, { recursive: true, force: true });
