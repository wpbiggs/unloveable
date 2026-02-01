#!/usr/bin/env node
/*
 * inject-validation.cjs
 * Inject runner validation results into the RESULTS section of a runlog.
 *
 * Usage:
 *   node inject-validation.cjs <runlog.md> <payload.json>
 */

const fs = require("fs");

const [, , runlogPath, payloadPath] = process.argv;
if (!runlogPath || !payloadPath) {
  console.error("Usage: node inject-validation.cjs <runlog.md> <payload.json>");
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
} catch {
  console.error("Invalid payload JSON");
  process.exit(2);
}

const runlog = fs.readFileSync(runlogPath, "utf8");
const re = /(^|\n)RESULTS\n([\s\S]*?)\nNEXT\n/;
const m = runlog.match(re);
if (!m) {
  console.error("Could not locate RESULTS -> NEXT section boundary");
  process.exit(1);
}

const insert = (() => {
  const lines = [];
  lines.push("");
  lines.push(`- runner validations: mode=${payload.mode || "unknown"} ok=${payload.ok ? "true" : "false"}`);
  for (const r of Array.isArray(payload.results) ? payload.results : []) {
    const label = String(r.label || "(unnamed)");
    const code = typeof r.code === "number" ? r.code : -1;
    const cwd = r.cwd ? ` cwd=${r.cwd}` : "";
    const log = r.log ? ` log=${r.log}` : "";
    lines.push(`- ${label}: exit=${code}${cwd}${log}`);
  }
  return lines.join("\n") + "\n";
})();

const updated = runlog.replace(re, (full, p1, body) => {
  const trimmed = String(body).replace(/\s+$/g, "");
  return `${p1}RESULTS\n${trimmed}${insert}\nNEXT\n`;
});

fs.writeFileSync(runlogPath, updated, "utf8");
