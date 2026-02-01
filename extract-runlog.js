#!/usr/bin/env node
/*
 * extract-runlog.js
 * Convert `opencode run --format json` JSONL output into a plain-text runlog.
 *
 * Usage:
 *   node extract-runlog.js <input.jsonl> <output.md>
 */

const fs = require("fs")

const [, , inputPath, outputPath] = process.argv
if (!inputPath || !outputPath) {
  console.error("Usage: node extract-runlog.js <input.jsonl> <output.md>")
  process.exit(2)
}

const raw = fs.readFileSync(inputPath, "utf8")
const lines = raw.split("\n").filter(Boolean)

let hadError = false
let lastText = ""

for (const line of lines) {
  let evt
  try {
    evt = JSON.parse(line)
  } catch {
    continue
  }

  if (evt && evt.type === "error") {
    hadError = true
  }

  if (evt && evt.type === "text") {
    const t =
      (evt.part && typeof evt.part.text === "string" && evt.part.text) ||
      (evt.part && typeof evt.part.delta === "string" && evt.part.delta) ||
      (typeof evt.text === "string" && evt.text) ||
      ""
    if (t.trim()) lastText = t
  }
}

if (hadError) {
  console.error("Run contained error events; refusing to extract runlog")
  process.exit(1)
}

let out = ""
if (lastText.trim()) {
  out = lastText.trim() + "\n"
} else {
  // Fallback: some OpenCode CLI builds ignore `--format json` and emit plain text.
  // If it already looks like a runlog, accept it as-is.
  const plain = raw.trim()
  if (/^INSPECT\n/m.test(plain) && /\nPLAN\n/m.test(plain)) {
    out = plain + "\n"
  } else {
    console.error("No text events found to extract")
    process.exit(1)
  }
}

fs.writeFileSync(outputPath, out, "utf8")
