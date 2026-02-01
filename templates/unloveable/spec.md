# spec.md — Unloveable Ralph Wiggum Loop (OpenCode)

## Purpose
Build **Unloveable**: a Lovable-style UI + headless loop runner that uses **OpenCode** as the development engine so users can bring **any model** (local/self-hosted/remote) and iterate until satisfied. Cost = compute only.

## Core principles (Ralph Wiggum loop)
- Treat the context window as a **static allocation** problem.
- Move “source of truth” out of chat history and into **static documents**.
- Each iteration runs with a **fresh context window** to avoid context rot.
- The agent does one small, verifiable unit of work per iteration.

## System components
### 1) Static source-of-truth files (required)
- `spec.md` (this file): requirements and constraints.
- `implementation-plan.md`: granular checklist; agent checks off tasks only when validated.
- `prompt.md`: recurring instruction set used *at the start of every iteration*.

### 2) Loop runner (required)
- `run-loop.sh`: headless script that:
  1. starts a fresh run context each iteration
  2. feeds in `spec.md`, `implementation-plan.md`, and minimal repo context
  3. asks agent to pick top unchecked task
  4. enforces test-driven change
  5. marks task complete only if tests pass

### 3) Output artifacts (required)
- `runlogs/iter_<n>.json` (or `.md`): per-iteration record:
  - chosen task
  - tests created/updated
  - files changed
  - commands run + exit codes
  - what got checked off

## Non-negotiable engineering constraints
- **Fresh context per iteration** (never run the loop inside one long chat).
- **Test-driven** per task:
  - write unbiased test first
  - implement until test passes
  - run repo checks (typecheck/lint/build/tests)
  - only then check off in `implementation-plan.md`
- **Small steps**:
  - choose highest leverage unchecked task
  - minimize diff surface area
- **No hallucinated repo assumptions**:
  - inspect repo structure and scripts before acting

## Stopping criteria
Stop loop when any of these occur:
- All tasks in `implementation-plan.md` are checked.
- Human stops the loop.
- The agent hits a failure threshold (e.g., 3 consecutive red iterations on the same task).
- Max iterations reached (configurable).

## Modes
### Production mode
- Strict checks, conservative diffs, heavy validation.
- Mandatory tests + build + lint + typecheck each iteration.

### Exploration mode
- Faster iteration; may relax lint/build frequency.
- Still requires at least one objective verification per task.

## Scope for current MVP
MVP goal: **Connect existing frontend** (`warp-site-canvas-main`) to OpenCode server and implement an observable loop UX:
- Sessions + chat + file tree + file content ✅ (already underway)
- Next:
  - SSE event streaming for real progress
  - loop state machine + runlogs
  - diff viewer (git/status)
  - component registry enforcement (shadcn/21st/Aceternity via wrappers)

## Canonical dev commands (local)

### 1) Start OpenCode server (backend)
From the repo root (so the server default directory is this project):

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

Sanity check:

```bash
curl -sS http://127.0.0.1:4096/global/health
```

### 2) Start UnLoveable UI (builder)
From `warp-site-canvas-main/`:

```bash
npm install
VITE_OPENCODE_URL=http://127.0.0.1:4096 npm run dev
```

Point the UI at the repo you want OpenCode to operate on:
- via UI: open Settings and set `Directory` (stored in `localStorage` as `opencode.directory`)
- or via env: `VITE_OPENCODE_DIRECTORY=/absolute/path`

### 3) Headless loop runner (this directory)
This repo-level runner expects a running server and uses `opencode run --attach`.

```bash
chmod +x run-loop.sh
OPENCODE_SERVER_URL=http://127.0.0.1:4096 ./run-loop.sh production
```
