#!/usr/bin/env bash
set -euo pipefail

# run-loop.sh — Ralph Wiggum static-context loop runner
# Runs one task per iteration with a fresh context window.

MODE="${1:-}"
if [[ -z "$MODE" ]]; then
  echo "Usage: $0 production|exploration" >&2
  exit 2
fi
if [[ "$MODE" != "production" && "$MODE" != "exploration" ]]; then
  echo "Error: Invalid mode '$MODE'" >&2
  echo "Usage: $0 production|exploration" >&2
  exit 2
fi

MAX_ITERS="${MAX_ITERS:-25}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-3}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNLOG_DIR="$ROOT_DIR/runlogs"
mkdir -p "$RUNLOG_DIR"

# Fast-exit: if there's nothing left to do, don't require a running server.
if [[ -f "$ROOT_DIR/implementation-plan.md" ]]; then
  if ! grep -qE '^\s*- \[ \]' "$ROOT_DIR/implementation-plan.md"; then
    echo "All tasks complete. Done."
    exit 0
  fi
fi

OPENCODE_CMD="${OPENCODE_CMD:-opencode}"
OPENCODE_SERVER_URL="${OPENCODE_SERVER_URL:-http://127.0.0.1:4096}"
OPENCODE_AGENT="${OPENCODE_AGENT:-}"
OPENCODE_MODEL="${OPENCODE_MODEL:-github-copilot/gemini-3-pro-preview}"

if [[ ! -x "$OPENCODE_CMD" ]] && ! command -v "$OPENCODE_CMD" >/dev/null 2>&1; then
  echo "Error: OpenCode CLI not found: $OPENCODE_CMD" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Error: node not found in PATH (needed for validate-loop.js)" >&2
  exit 1
fi

run_validator() {
  local runlog_path="$1"
  local plan_path="$2"
  if [[ -z "$plan_path" ]]; then
    plan_path="$ROOT_DIR/implementation-plan.md"
  fi

  if [[ -f "$ROOT_DIR/validate-loop.js" ]]; then
    node "$ROOT_DIR/validate-loop.js" "$runlog_path" "$plan_path"
    return $?
  fi

  if [[ -f "$ROOT_DIR/validate-loop.ts" ]]; then
    if command -v bun >/dev/null 2>&1; then
      bun "$ROOT_DIR/validate-loop.ts" "$runlog_path" "$plan_path"
      return $?
    fi
    echo "Error: validate-loop.ts exists but bun is not available to execute it" >&2
    return 1
  fi

  if [[ -f "$ROOT_DIR/templates/unloveable/validate-loop.js" ]]; then
    cp -f "$ROOT_DIR/templates/unloveable/validate-loop.js" "$ROOT_DIR/validate-loop.js"
    node "$ROOT_DIR/validate-loop.js" "$runlog_path" "$plan_path"
    return $?
  fi

  echo "Error: No validator found (validate-loop.js / validate-loop.ts)" >&2
  return 1
}

archive_failed_iteration() {
  local iter_id="$1"
  local reason="$2"
  local ts
  ts=$(date +%s)

  if [[ -f "$RUNLOG_DIR/${iter_id}.md" ]]; then
    mv -f "$RUNLOG_DIR/${iter_id}.md" "$RUNLOG_DIR/${iter_id}.failed.${ts}.md" || true
  fi
  if [[ -f "$RUNLOG_DIR/${iter_id}.jsonl" ]]; then
    mv -f "$RUNLOG_DIR/${iter_id}.jsonl" "$RUNLOG_DIR/${iter_id}.failed.${ts}.jsonl" || true
  fi
  if [[ -f "$RUNLOG_DIR/${iter_id}.plan.before.md" ]]; then
    mv -f "$RUNLOG_DIR/${iter_id}.plan.before.md" "$RUNLOG_DIR/${iter_id}.failed.${ts}.plan.before.md" || true
  fi
  if [[ -f "$RUNLOG_DIR/${iter_id}.validation.log" ]]; then
    mv -f "$RUNLOG_DIR/${iter_id}.validation.log" "$RUNLOG_DIR/${iter_id}.failed.${ts}.validation.log" || true
  fi
  if [[ -f "$RUNLOG_DIR/${iter_id}.validation.json" ]]; then
    mv -f "$RUNLOG_DIR/${iter_id}.validation.json" "$RUNLOG_DIR/${iter_id}.failed.${ts}.validation.json" || true
  fi
  echo "Iteration ${iter_id} failed: ${reason}" >&2
}

extract_and_validate_or_retry() {
  local iter_id="$1"
  local rawlog="$2"
  local runlog="$3"
  local plan_before="$4"

  local err
  if [[ -f "$ROOT_DIR/extract-runlog.cjs" ]]; then
    err=$(node "$ROOT_DIR/extract-runlog.cjs" "$rawlog" "$runlog" 2>&1)
  elif [[ -f "$ROOT_DIR/extract-runlog.js" ]]; then
    err=$(node "$ROOT_DIR/extract-runlog.js" "$rawlog" "$runlog" 2>&1)
  elif [[ -f "$ROOT_DIR/templates/unloveable/extract-runlog.cjs" ]]; then
    cp -f "$ROOT_DIR/templates/unloveable/extract-runlog.cjs" "$ROOT_DIR/extract-runlog.cjs"
    err=$(node "$ROOT_DIR/extract-runlog.cjs" "$rawlog" "$runlog" 2>&1)
  else
    archive_failed_iteration "$iter_id" "extract failed: missing extract-runlog.cjs"
    return 1
  fi
  if [[ $? -ne 0 ]]; then
    archive_failed_iteration "$iter_id" "extract failed: $err"
    return 1
  fi

  err=$(run_validator "$runlog" "$plan_before" 2>&1)
  if [[ $? -ne 0 ]]; then
    archive_failed_iteration "$iter_id" "validation failed: $err"
    return 1
  fi

  return 0
}

run_cmd() {
  local cwd="$1"
  local label="$2"
  local log_path="$3"
  shift 3

  {
    echo "=== ${label} ==="
    echo "cwd: ${cwd}"
    echo "cmd: $*"
  } >>"$log_path"

  (cd "$cwd" && "$@") >>"$log_path" 2>&1
  local code=$?
  echo "exit: ${code}" >>"$log_path"
  echo "" >>"$log_path"
  return $code
}

run_validations() {
  local iter_id="$1"
  local mode="$2"
  local out_json="$3"

  local ok=1
  local log_path="$RUNLOG_DIR/${iter_id}.validation.log"
  : >"$log_path"

  local results="[]"

  if [[ -d "$ROOT_DIR/warp-site-canvas-main" && -f "$ROOT_DIR/warp-site-canvas-main/package.json" ]]; then
    local cwd="$ROOT_DIR/warp-site-canvas-main"

    run_cmd "$cwd" "ui:test" "$log_path" npm test
    local c1=$?
    if [[ $c1 -ne 0 ]]; then ok=0; fi
    results=$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(0,"utf8")); p.push({label:"ui:test",code:Number(process.argv[1]),cwd:process.argv[2],log:process.argv[3]}); process.stdout.write(JSON.stringify(p));' "$c1" "$cwd" "$log_path" <<<"$results")

    if [[ "$mode" == "production" ]]; then
      run_cmd "$cwd" "ui:typecheck" "$log_path" npx tsc -p tsconfig.json --noEmit
      local ct=$?
      if [[ $ct -ne 0 ]]; then ok=0; fi
      results=$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(0,"utf8")); p.push({label:"ui:typecheck",code:Number(process.argv[1]),cwd:process.argv[2],log:process.argv[3]}); process.stdout.write(JSON.stringify(p));' "$ct" "$cwd" "$log_path" <<<"$results")

      run_cmd "$cwd" "ui:lint" "$log_path" npm run lint
      local c2=$?
      if [[ $c2 -ne 0 ]]; then ok=0; fi
      results=$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(0,"utf8")); p.push({label:"ui:lint",code:Number(process.argv[1]),cwd:process.argv[2],log:process.argv[3]}); process.stdout.write(JSON.stringify(p));' "$c2" "$cwd" "$log_path" <<<"$results")
    fi

    run_cmd "$cwd" "ui:build" "$log_path" npm run build
    local c3=$?
    if [[ $c3 -ne 0 ]]; then ok=0; fi
    results=$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(0,"utf8")); p.push({label:"ui:build",code:Number(process.argv[1]),cwd:process.argv[2],log:process.argv[3]}); process.stdout.write(JSON.stringify(p));' "$c3" "$cwd" "$log_path" <<<"$results")
  fi

  node -e 'const fs=require("fs"); const payload={mode:process.argv[1], ok:process.argv[2]==="1", results:JSON.parse(fs.readFileSync(0,"utf8"))}; fs.writeFileSync(process.argv[3], JSON.stringify(payload, null, 2));' "$mode" "$ok" "$out_json" <<<"$results"
  return $([[ $ok -eq 1 ]] && echo 0 || echo 1)
}

# Safety: ensure the server is operating on THIS repo root.
# Without patching opencode, `opencode run --attach` cannot reliably set directory headers.
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

fail_count=0

start_iter=1
shopt -s nullglob
existing=("$RUNLOG_DIR"/iter_*.md)
if [[ ${#existing[@]} -gt 0 ]]; then
  max=0
  for f in "${existing[@]}"; do
    b=$(basename "$f")
    n=${b#iter_}
    n=${n%.md}
    if [[ $n =~ ^[0-9]{3}$ ]]; then
      v=$((10#$n))
      if [[ $v -gt $max ]]; then max=$v; fi
    fi
  done
  start_iter=$((max+1))
fi
shopt -u nullglob

for ((i=0; i<MAX_ITERS; i++)); do
  iter_num=$((start_iter+i))
  iter_id=$(printf "iter_%03d" "$iter_num")
  runlog="$RUNLOG_DIR/${iter_id}.md"
  rawlog="$RUNLOG_DIR/${iter_id}.jsonl"
  plan_before="$RUNLOG_DIR/${iter_id}.plan.before.md"
  validation_json="$RUNLOG_DIR/${iter_id}.validation.json"

  if [[ -e "$runlog" ]]; then
    if run_validator "$runlog" >/dev/null 2>&1; then
      echo "Note: runlog already exists, skipping: $runlog" >&2
      continue
    fi
    archive_failed_iteration "$iter_id" "existing runlog did not validate"
    # Retry the same iter_id in this loop pass.
  fi

  if [[ -e "$rawlog" ]]; then
    # Recover a previous partial iteration (e.g. if the runner crashed after writing rawlog).
    echo "Note: raw log already exists, attempting recovery: $rawlog" >&2
    if [[ ! -f "$plan_before" ]]; then
      cp -f "$ROOT_DIR/implementation-plan.md" "$plan_before"
    fi
    if extract_and_validate_or_retry "$iter_id" "$rawlog" "$runlog" "$plan_before"; then
      echo "Recovered: $runlog" >&2
      continue
    fi
    echo "Recovery failed; rerunning: $iter_id" >&2
  fi

  cp -f "$ROOT_DIR/implementation-plan.md" "$plan_before"

  echo "=== ${iter_id} (mode=${MODE}) ==="
  echo "Runlog: ${runlog}"

  set +e

  cmd=(
    "$OPENCODE_CMD"
    run
    --attach "$OPENCODE_SERVER_URL"
    --format json
    --file "$ROOT_DIR/prompt.md"
    --file "$ROOT_DIR/spec.md"
    --file "$ROOT_DIR/implementation-plan.md"
    --title "unloveable ${iter_id} (${MODE})"
  )
  if [[ -n "${OPENCODE_AGENT}" ]]; then 
    cmd+=(--agent "${OPENCODE_AGENT}")
  elif [[ "${MODE}" == "production" ]]; then
    cmd+=(--agent "task")
  fi
  if [[ -n "${OPENCODE_MODEL}" ]]; then cmd+=(--model "${OPENCODE_MODEL}"); fi

  "${cmd[@]}" \
    "This is iteration ${iter_id} running in ${MODE} mode." \
    "Follow the attached prompt.md EXACTLY." \
    "Pick the highest-leverage unchecked checkbox in implementation-plan.md and do one small, test-driven change." \
    > "$rawlog"

  status=$?
  set -e

  if [[ $status -ne 0 ]]; then
    echo "Iteration failed (exit=$status)." >&2
    fail_count=$((fail_count+1))
    # Keep the raw log for recovery, but don't block the next run.
    if [[ $fail_count -ge $FAIL_THRESHOLD ]]; then
      echo "Failure threshold reached ($FAIL_THRESHOLD). Stopping." >&2
      exit 1
    fi
    continue
  fi

  if ! extract_and_validate_or_retry "$iter_id" "$rawlog" "$runlog" "$plan_before"; then
    fail_count=$((fail_count+1))
    if [[ $fail_count -ge $FAIL_THRESHOLD ]]; then
      echo "Failure threshold reached ($FAIL_THRESHOLD). Stopping." >&2
      exit 1
    fi
    continue
  fi

  if [[ -f "$ROOT_DIR/inject-validation.cjs" ]]; then
    :
  elif [[ -f "$ROOT_DIR/inject-validation.js" ]]; then
    :
  elif [[ -f "$ROOT_DIR/templates/unloveable/inject-validation.cjs" ]]; then
    cp -f "$ROOT_DIR/templates/unloveable/inject-validation.cjs" "$ROOT_DIR/inject-validation.cjs"
  elif [[ -f "$ROOT_DIR/templates/unloveable/inject-validation.js" ]]; then
    cp -f "$ROOT_DIR/templates/unloveable/inject-validation.js" "$ROOT_DIR/inject-validation.js"
  else
    echo "Error: inject-validation.js not found" >&2
    archive_failed_iteration "$iter_id" "missing inject-validation.js"
    fail_count=$((fail_count+1))
    continue
  fi

  set +e
  run_validations "$iter_id" "$MODE" "$validation_json"
  vstatus=$?
  set -e

  if [[ -f "$ROOT_DIR/inject-validation.cjs" ]]; then
    node "$ROOT_DIR/inject-validation.cjs" "$runlog" "$validation_json" >/dev/null 2>&1 || true
  else
    node "$ROOT_DIR/inject-validation.js" "$runlog" "$validation_json" >/dev/null 2>&1 || true
  fi

  if [[ $vstatus -ne 0 ]]; then
    cp -f "$plan_before" "$ROOT_DIR/implementation-plan.md"
    archive_failed_iteration "$iter_id" "runner validations failed"
    fail_count=$((fail_count+1))
    if [[ $fail_count -ge $FAIL_THRESHOLD ]]; then
      echo "Failure threshold reached ($FAIL_THRESHOLD). Stopping." >&2
      exit 1
    fi
    continue
  fi

  fail_count=0

  if ! grep -qE '^\s*- \[ \]' "$ROOT_DIR/implementation-plan.md"; then
    echo "All tasks complete. Done."
    exit 0
  fi
done

echo "Max iterations reached ($MAX_ITERS). Stopping."
exit 0
