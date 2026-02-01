
import * as fs from 'fs';

const [, , runlogPath, planPath] = process.argv;
if (!runlogPath || !planPath) {
  console.error("Usage: ts-node validate-loop.ts <runlog.md> <implementation-plan.md>");
  process.exit(2);
}

const runlog = fs.readFileSync(runlogPath, "utf8");
const plan = fs.readFileSync(planPath, "utf8");

function stripAnsi(input: string) {
  return input.replace(/\u001b\[[0-9;]*m/g, "");
}

const clean = stripAnsi(runlog);

if (clean.includes("\r")) {
  console.error("Runlog must use LF newlines only");
  process.exit(1);
}

if (!clean.startsWith("INSPECT\n")) {
  console.error("Runlog must start with exactly: INSPECT");
  process.exit(1);
}

if (/^\s*#/m.test(clean)) {
  console.error("Runlog must not use markdown headings (#)");
  process.exit(1);
}

const required = ["INSPECT", "PLAN", "ACTIONS", "RESULTS", "NEXT"];

function sectionCount(h: string) {
  const re = new RegExp(`(^|\\n)${h}\\n`, "g");
  return (clean.match(re) || []).length;
}

for (const h of required) {
  const count = sectionCount(h);
  if (count !== 1) {
    console.error(count === 0 ? `Missing section: ${h}` : `Duplicate section: ${h}`);
    process.exit(1);
  }
}

function sectionIndex(h: string) {
  if (h === "INSPECT") return clean.indexOf("INSPECT\n");
  return clean.indexOf(`\n${h}\n`);
}

for (let i = 1; i < required.length; i++) {
  if (sectionIndex(required[i]) <= sectionIndex(required[i - 1])) {
    console.error("Sections must be in order: INSPECT -> PLAN -> ACTIONS -> RESULTS -> NEXT");
    process.exit(1);
  }
}

const planBlock = (() => {
  const m = clean.match(/(^|\n)PLAN\n([\s\S]*?)(\nACTIONS\n|$)/m);
  return m ? m[2] : "";
})();

function normalizeTask(input: string) {
  let s = String(input || "").trim();
  s = s.replace(/`/g, "").trim();

  // If a checkbox appears anywhere on the line, keep only text after it.
  const m = s.match(/\[[ xX]\]\s*(.+)$/);
  if (m) s = m[1];

  // Strip leading bullets like '-', '*', possibly repeated.
  for (;;) {
    const next = s.replace(/^[-*]\s+/, "");
    if (next === s) break;
    s = next;
  }

  return s.trim();
}

const chosenLine = (() => {
  // The chosen task must be an unchecked checkbox line.
  const line = planBlock.match(/^.*\[ \].+$/m);
  return line ? line[0] : "";
})();

if (!chosenLine) {
  console.error("Could not find an unchecked checkbox line in PLAN.");
  process.exit(1);
}

const chosenTask = normalizeTask(chosenLine);
if (!chosenTask) {
  console.error("Could not parse chosen task.");
  process.exit(1);
}

const planTasks = plan
  .split(/\n/)
  .map((l) => l.trim())
  .filter((l) => /^-\s*\[[ xX]\]\s+/.test(l))
  .map((l) => normalizeTask(l));

if (!planTasks.includes(chosenTask)) {
  console.error("Chosen task not found in implementation-plan.md:", chosenTask);
  process.exit(1);
}

console.log("OK: runlog has required sections and includes a checkbox line in PLAN.");
process.exit(0);
