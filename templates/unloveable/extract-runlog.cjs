#!/usr/bin/env node
/*
 * extract-runlog.cjs
 * Convert `opencode run --format json` JSONL output into a plain-text runlog.
 *
 * Notes:
 * - OpenCode has shipped multiple JSONL schemas over time.
 * - This extractor supports both:
 *   1) Event-style lines: { type: "text", part: { text|delta } }
 *   2) Message-style lines: { message: { info: { role }, parts: [...] } }
 *
 * Usage:
 *   node extract-runlog.cjs <input.jsonl> <output.md>
 */

const fs = require("fs");

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node extract-runlog.cjs <input.jsonl> <output.md>");
  process.exit(2);
}

const raw = fs.readFileSync(inputPath, "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);

let hadError = false;
let lastText = "";

for (const line of lines) {
  let evt;
  try {
    evt = JSON.parse(line);
  } catch {
    continue;
  }
  if (!evt || typeof evt !== "object") continue;

  if (evt.type === "error") {
    hadError = true;
  }

  // Schema A: event-style text
  if (evt.type === "text") {
    const t =
      (evt.part && typeof evt.part.text === "string" && evt.part.text) ||
      (evt.part && typeof evt.part.delta === "string" && evt.part.delta) ||
      (typeof evt.text === "string" && evt.text) ||
      "";
    if (t.trim()) lastText = t;
    continue;
  }

  // Schema B: message-style
  const msg = evt.message && typeof evt.message === "object" ? evt.message : evt;
  const info = msg.info && typeof msg.info === "object" ? msg.info : null;
  const role = info && typeof info.role === "string" ? info.role : "";
  if (role !== "assistant") continue;

  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const blocks = [];
  for (const p of parts) {
    if (!p || typeof p !== "object") continue;
    if (p.type === "text" || p.type === "reasoning") {
      if (typeof p.text === "string" && p.text.trim()) blocks.push(p.text);
    }
  }
  const combined = blocks.join("\n\n").trim();
  if (combined) lastText = combined;
}

if (hadError) {
  console.error("Run contained error events; refusing to extract runlog");
  process.exit(1);
}

if (!lastText.trim()) {
  // Fallback: some OpenCode CLI builds ignore `--format json` and emit plain text.
  const plain = raw.trim();
  if (/^INSPECT\n/m.test(plain) && /\nPLAN\n/m.test(plain)) {
    fs.writeFileSync(outputPath, plain + "\n", "utf8");
    process.exit(0);
  }
  console.error("No assistant text found in raw log");
  process.exit(1);
}

fs.writeFileSync(outputPath, lastText.trim() + "\n", "utf8");
