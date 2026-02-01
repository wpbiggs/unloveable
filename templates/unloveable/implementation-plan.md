# implementation-plan.md — UnLoveable (Surreal Sites) Build Plan

Rule: only check a box if validation passes (tests + required commands). If something is “implemented” but failing lint/tests or broken in the UI, leave it unchecked.

This plan was updated using a real UI test report (localhost:8080) so it includes concrete bugs/UX gaps that weren’t visible from UI-only planning.

## Phase 0 — Loop + foundations (build system)

- [x] Document canonical dev commands (frontend + OpenCode server) in `spec.md`
- [x] Confirm OpenCode endpoints used by frontend are stable (sessions/chat/files)
- [x] Define the minimal repo context bundle per iteration (paths + scripts)

- [x] Add `run-loop.sh` that runs one fresh iteration per task
- [x] Define `runlogs/` format and write a runlog per iteration
- [x] Add failure thresholds + stop conditions to script
- [x] Add `--mode production|exploration` and validation profiles
- [x] Add `loop.json` protocol (state machine + required artifacts)
- [x] Add `validate-loop.ts` that checks runlogs comply with protocol
- [x] Ensure agent outputs required sections (INSPECT/PLAN/ACTIONS/RESULTS/NEXT)
- [x] Enforce “test-first” in prompt (must create/extend tests before code)

## Phase 1 — P0 bugs (ship a functioning marketing + builder)

- [x] Add missing page sections for nav links (create `How it Works` + `Pricing` sections with stable anchors)
- [x] Wire nav links to anchors (or routes) and ensure they actually navigate
- [x] Add click handlers for primary CTAs (`Sign In`, `Get Started`, `Watch Demo`, `Start Building Free`)
- [x] Fix builder connection error (`CONNECTION_FAILED` when hitting `/builder`)
- [x] Fix `npm run lint` failures in `warp-site-canvas-main` (eliminate `@typescript-eslint/no-explicit-any` and other blocking errors)
- [x] Make file editing not read-only in Builder (expose edit affordance + persist edits in workspace)

## Phase 2 — P1 core product features

- [x] Authentication (real sign-in/sign-up) for CTA flows
- [x] Project persistence (save/load projects; not only session-based)
- [x] Export project to ZIP
- [x] Export / publish to GitHub repo
- [x] Deployment integration (one-click deploy to Vercel/Netlify)
- [x] Persistent AI chat history across sessions
- [x] Undo/redo for AI-driven changes (snapshot history)

## Phase 3 — P2 UX improvements (Lovable feel)

- [x] Loading states when AI is processing (spinner + progress indicator)
- [x] Progress visualization for loop states (PLANNING → RUNNING → OBSERVING → PATCHING)
- [x] SSE event streaming for real progress (implemented via opencode-events.ts)
- [x] User-friendly error messages (no raw console errors)
- [x] Confirmation dialogs for destructive actions (e.g., leaving builder)
- [x] Input validation before submitting to AI
- [x] Success/error toasts for key actions
- [x] Responsive preview modes (mobile/tablet/desktop toggles)
- [x] File tree UX improvements (icons, breadcrumbs, search)
- [x] Chat UX improvements (auto-scroll, markdown render, copy button, timestamps)
- [x] Template gallery (starter templates per website type)
- [x] Visual component library/picker
- [x] Theme customization UI (colors/fonts)
- [x] Keyboard shortcuts for common actions
- [x] Search within files

## Phase 5 — P4 hardening + scale

- [x] AbortController everywhere (Stop cancels network + loop)
- [x] Path safety: do not expose arbitrary filesystem roots (no VITE_* directory)
- [x] E2E test (Playwright): load `/builder`, send message, open file, apply patch, verify preview
- [ ] CI: run tests + lint on PRs

## Component registry contract (quality gate)

- [x] Add component-registry.json and schema
- [x] Add wrapper folders: components/ui (shadcn), components/patterns, components/brand
- [x] Add lint rule / CI check: forbid direct imports from Aceternity in app
- [x] Add retrieval prompt snippet: choose components only from registry

## Packaging

- [x] Sync `templates/unloveable/` with root loop pack (spec, plan, prompt, loop, validator)
- [ ] Add README: bring your own model + compute-only loop (how to run without UI)
- [ ] Optional: UI “Run loop” button that starts a headless iteration and streams SSE into Console
