#!/usr/bin/env bash
set -euo pipefail

# intake-loop.sh — Foundry intake runner
# - asks 5 questions
# - collects answers
# - generates canonical docs
# - optionally starts the execution loop

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNLOG_DIR="$ROOT_DIR/runlogs"
mkdir -p "$RUNLOG_DIR"

OPENCODE_CMD="${OPENCODE_CMD:-opencode}"
OPENCODE_SERVER_URL="${OPENCODE_SERVER_URL:-http://127.0.0.1:4096}"
OPENCODE_MODEL="${OPENCODE_MODEL:-github-copilot/gemini-3-pro-preview}"

IDEA_PATH=""
ANSWERS_PATH=""
RUN_MODE=""

usage() {
  echo "Usage: $0 [--idea <path>] [--answers <path>] [--run production|exploration]" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --idea)
      IDEA_PATH="${2:-}"
      shift 2
      ;;
    --answers)
      ANSWERS_PATH="${2:-}"
      shift 2
      ;;
    --run)
      RUN_MODE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown arg: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -n "$RUN_MODE" && "$RUN_MODE" != "production" && "$RUN_MODE" != "exploration" ]]; then
  echo "Error: --run must be production|exploration" >&2
  exit 2
fi

if [[ ! -x "$OPENCODE_CMD" ]] && ! command -v "$OPENCODE_CMD" >/dev/null 2>&1; then
  echo "Error: OpenCode CLI not found: $OPENCODE_CMD" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Error: node not found in PATH (needed for extract-runlog.js)" >&2
  exit 1
fi

# Safety: ensure the server is operating on THIS repo root.
server_dir=$(curl -sS --max-time 2 "$OPENCODE_SERVER_URL/path" | node -e 'const fs=require("fs"); const s=fs.readFileSync(0,"utf8"); const d=JSON.parse(s); process.stdout.write(String(d.directory||""));' 2>/dev/null || true)
if [[ -z "$server_dir" ]]; then
  echo "Error: OpenCode server not reachable at $OPENCODE_SERVER_URL (expected /path JSON)" >&2
  exit 1
fi
if [[ "$server_dir" != "$ROOT_DIR" ]]; then
  echo "Error: OpenCode server directory mismatch" >&2
  echo "- expected: $ROOT_DIR" >&2
  echo "- server is: $server_dir" >&2
  echo "Fix: restart opencode server from $ROOT_DIR (or start a second server on another port)." >&2
  exit 1
fi

ts=$(date +%Y%m%d_%H%M%S)
idea_file="$RUNLOG_DIR/intake_${ts}.idea.md"
answers_file="$RUNLOG_DIR/intake_${ts}.answers.md"

if [[ -n "$IDEA_PATH" ]]; then
  if [[ ! -f "$IDEA_PATH" ]]; then
    echo "Error: --idea file not found: $IDEA_PATH" >&2
    exit 1
  fi
  cp -f "$IDEA_PATH" "$idea_file"
else
  if [[ -t 0 ]]; then
    echo "Paste your idea, then press Ctrl-D:" >&2
  fi
  cat >"$idea_file"
fi

if [[ ! -s "$idea_file" ]]; then
  echo "Error: idea is empty" >&2
  exit 1
fi

questions_jsonl="$RUNLOG_DIR/intake_${ts}.questions.jsonl"
questions_txt="$RUNLOG_DIR/intake_${ts}.questions.md"

"$OPENCODE_CMD" run \
  --attach "$OPENCODE_SERVER_URL" \
  --format json \
  --file "$ROOT_DIR/templates/unloveable/intake/questions.prompt.md" \
  --file "$idea_file" \
  --title "unloveable intake questions (${ts})" \
  --model "$OPENCODE_MODEL" \
  "Ask the 5 questions now. The idea is attached." \
  >"$questions_jsonl"

if [[ -f "$ROOT_DIR/extract-runlog.cjs" ]]; then
  node "$ROOT_DIR/extract-runlog.cjs" "$questions_jsonl" "$questions_txt" >/dev/null 2>&1
elif [[ -f "$ROOT_DIR/templates/unloveable/extract-runlog.cjs" ]]; then
  cp -f "$ROOT_DIR/templates/unloveable/extract-runlog.cjs" "$ROOT_DIR/extract-runlog.cjs"
  node "$ROOT_DIR/extract-runlog.cjs" "$questions_jsonl" "$questions_txt" >/dev/null 2>&1
else
  node "$ROOT_DIR/extract-runlog.js" "$questions_jsonl" "$questions_txt" >/dev/null 2>&1
fi

echo "" >&2
echo "=== Intake Questions ===" >&2
cat "$questions_txt" >&2
echo "" >&2

if [[ -n "$ANSWERS_PATH" ]]; then
  if [[ ! -f "$ANSWERS_PATH" ]]; then
    echo "Error: --answers file not found: $ANSWERS_PATH" >&2
    exit 1
  fi
  cp -f "$ANSWERS_PATH" "$answers_file"
else
  echo "Paste your answers (include 1) .. 5)), then press Ctrl-D:" >&2
  cat </dev/tty >"$answers_file"
fi

if [[ ! -s "$answers_file" ]]; then
  echo "Error: answers are empty" >&2
  exit 1
fi

docs_jsonl="$RUNLOG_DIR/intake_${ts}.docs.jsonl"
docs_txt="$RUNLOG_DIR/intake_${ts}.docs.md"

"$OPENCODE_CMD" run \
  --attach "$OPENCODE_SERVER_URL" \
  --format json \
  --file "$ROOT_DIR/templates/unloveable/intake/doc-generator.prompt.md" \
  --file "$idea_file" \
  --file "$answers_file" \
  --title "unloveable intake docs (${ts})" \
  --model "$OPENCODE_MODEL" \
  "Generate the canonical docs now. Inputs are attached." \
  >"$docs_jsonl"

if [[ -f "$ROOT_DIR/extract-runlog.cjs" ]]; then
  node "$ROOT_DIR/extract-runlog.cjs" "$docs_jsonl" "$docs_txt" >/dev/null 2>&1 || true
else
  node "$ROOT_DIR/extract-runlog.js" "$docs_jsonl" "$docs_txt" >/dev/null 2>&1 || true
fi

required=("spec.md" "architecture.md" "implementation-plan.md" "prompt.md" "brand-and-ux-spec.md")
missing=0
for f in "${required[@]}"; do
  if [[ ! -f "$ROOT_DIR/$f" ]]; then
    echo "Missing expected output file: $f" >&2
    missing=1
  fi
done
if [[ $missing -ne 0 ]]; then
  echo "Intake completed but outputs are missing; see: $docs_txt" >&2
  exit 1
fi

echo "Intake complete." >&2
echo "- idea: $idea_file" >&2
echo "- answers: $answers_file" >&2
echo "- docs log: $docs_txt" >&2

if [[ -n "$RUN_MODE" ]]; then
  exec "$ROOT_DIR/run-loop.sh" "$RUN_MODE"
fi
