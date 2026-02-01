const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const extractScript = path.resolve(__dirname, '../extract-runlog.js');
const tempDir = path.resolve(__dirname, 'temp-extract');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const inputJsonl = path.join(tempDir, 'input.jsonl');
const outputMd = path.join(tempDir, 'output.md');

// Cleanup function
function cleanup() {
  if (fs.existsSync(inputJsonl)) fs.unlinkSync(inputJsonl);
  if (fs.existsSync(outputMd)) fs.unlinkSync(outputMd);
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
}

try {
  // Test Case 1: Standard success case
  const jsonlData = [
    JSON.stringify({ type: 'text', part: { text: 'Thinking...' } }),
    JSON.stringify({ type: 'text', part: { text: 'INSPECT\n- Checked files\n\nPLAN\n- Do work\n\nACTIONS\n- edit\n\nRESULTS\n- Done\n\nNEXT\n- Sleep' } })
  ].join('\n');

  fs.writeFileSync(inputJsonl, jsonlData);

  execSync(`node "${extractScript}" "${inputJsonl}" "${outputMd}"`);

  const output = fs.readFileSync(outputMd, 'utf8');
  assert.ok(output.includes('INSPECT'), 'Output should contain INSPECT');
  assert.ok(output.includes('NEXT'), 'Output should contain NEXT');
  assert.ok(!output.includes('Thinking...'), 'Output should only contain the last text event');

  console.log('Test passed: Standard extraction');

  // Test Case 2: Error event in stream
  const errorJsonl = [
    JSON.stringify({ type: 'text', part: { text: 'Thinking...' } }),
    JSON.stringify({ type: 'error', message: 'Something went wrong' })
  ].join('\n');

  fs.writeFileSync(inputJsonl, errorJsonl);

  try {
    execSync(`node "${extractScript}" "${inputJsonl}" "${outputMd}"`, { stdio: 'ignore' });
    assert.fail('Should have failed due to error event');
  } catch (e) {
    console.log('Test passed: Error handling');
  }

} catch (err) {
  console.error('Test failed:', err);
  process.exit(1);
} finally {
  cleanup();
}
