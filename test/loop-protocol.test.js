const fs = require('fs');
const assert = require('assert');
const path = require('path');

const loopJsonPath = path.join(__dirname, '../loop.json');

try {
  const loopJson = JSON.parse(fs.readFileSync(loopJsonPath, 'utf8'));

  // Validate presence of top-level keys
  const requiredKeys = [
    'protocolVersion',
    'name',
    'freshContextRequired',
    'sourceOfTruthFiles',
    'states',
    'requiredSections',
    'taskSelectionRule',
    'testDrivenRule',
    'stopConditions'
  ];

  requiredKeys.forEach(key => {
    assert.ok(loopJson.hasOwnProperty(key), `Missing key: ${key}`);
  });

  // Validate states
  const expectedStates = [
    "INSPECT", "PLAN", "PATCH", "RUN", "OBSERVE", "REPAIR", "DONE", "STOPPED", "ERROR"
  ];
  assert.deepStrictEqual(loopJson.states, expectedStates, "States do not match expected protocol");

  // Validate required sections
  const expectedSections = [
    "INSPECT", "PLAN", "ACTIONS", "RESULTS", "NEXT"
  ];
  assert.deepStrictEqual(loopJson.requiredSections, expectedSections, "Required sections do not match expected protocol");

  console.log("PASS: loop.json protocol is valid.");
} catch (err) {
  console.error("FAIL: loop.json validation failed", err);
  process.exit(1);
}
