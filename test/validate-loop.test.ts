
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

const VALIDATOR = path.resolve(__dirname, '../validate-loop.ts');
const PLAN_PATH = path.resolve(__dirname, '../implementation-plan.md');

// Ensure PLAN_PATH exists for the validator to read (it just needs to exist)
if (!fs.existsSync(PLAN_PATH)) {
    console.error("implementation-plan.md not found");
    process.exit(1);
}

// Helper to run validator
function runValidator(runlogContent: string): number {
    const tmpLog = path.resolve(__dirname, `temp_runlog_${Math.random().toString(36).substring(7)}.md`);
    fs.writeFileSync(tmpLog, runlogContent);
    
    try {
        child_process.execSync(`npx ts-node ${VALIDATOR} ${tmpLog} ${PLAN_PATH}`, { stdio: 'ignore' });
        fs.unlinkSync(tmpLog);
        return 0;
    } catch (e: any) {
        fs.unlinkSync(tmpLog);
        return e.status;
    }
}

// 1. Valid Runlog
const validRunlog = `INSPECT
- looking at stuff

PLAN
- [ ] CI: run tests + lint on PRs
- doing things

ACTIONS
- ran tools

RESULTS
- validated

NEXT
- do next thing
`;

console.log("Test 1: Valid runlog");
if (runValidator(validRunlog) !== 0) {
    console.error("FAIL: Valid runlog was rejected");
    process.exit(1);
}
console.log("PASS");

// 2. Missing Section
const missingSectionRunlog = `INSPECT
- looking at stuff

PLAN
- [ ] CI: run tests + lint on PRs

ACTIONS
- ran tools

NEXT
- do next thing
`;
// Missing RESULTS

console.log("Test 2: Missing section");
if (runValidator(missingSectionRunlog) === 0) {
    console.error("FAIL: Runlog missing RESULTS was accepted");
    process.exit(1);
}
console.log("PASS");

// 3. Wrong Order
const wrongOrderRunlog = `INSPECT
- looking at stuff

ACTIONS
- ran tools

PLAN
- [ ] CI: run tests + lint on PRs

RESULTS
- validated

NEXT
- do next thing
`;

console.log("Test 3: Wrong order");
if (runValidator(wrongOrderRunlog) === 0) {
    console.error("FAIL: Runlog with wrong order was accepted");
    process.exit(1);
}
console.log("PASS");

// 4. Missing Checkbox in PLAN
const noCheckboxRunlog = `INSPECT
- looking

PLAN
- no checkbox here
- just text

ACTIONS
- act

RESULTS
- res

NEXT
- next
`;

console.log("Test 4: Missing checkbox");
if (runValidator(noCheckboxRunlog) === 0) {
    console.error("FAIL: Runlog without checkbox was accepted");
    process.exit(1);
}
console.log("PASS");

console.log("All tests passed.");
