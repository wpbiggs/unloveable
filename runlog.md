
INSPECT
- Analyzed `warp-site-canvas-main/src/components/builder/TemplateGallery.tsx` and related files to understand how templates are currently handled.
- Found `WORKSPACE_TEMPLATES` in `src/lib/workspace-templates.ts` defining the list of templates.
- Checked for existing template files and found none in the source tree, implying they might be hardcoded or dynamically generated.
- Verified that `TemplateGallery` is integrated into `BuilderHeader`.
- Noticed that `TemplateGallery` uses `onNewWorkspaceSession` callback which seems to use `createWorkspaceSession` in `Builder.tsx`.
- The `createWorkspaceSession` function in `Builder.tsx` seems to scaffold files based on the template ID, but the implementation is truncated in the read output.
- The task "Template gallery (starter templates per website type)" is unchecked in `implementation-plan.md` under Phase 4.
- However, based on the `implementation-plan.md`, there is a simpler, more "foundational" task available: "Sync `templates/unloveable/` with root loop pack".
- Wait, I should stick to the "highest-leverage unchecked task".
- Looking at `implementation-plan.md`:
  - Phase 2: All checked.
  - Phase 3: "Template gallery" is actually in Phase 4 (P3 product expansion) in the file content I read, but labeled as Phase 3 in my analysis? No, Phase 3 is P2 UX improvements. Phase 4 is P3 product expansion.
  - Phase 3 unchecked items:
    - Loading states
    - Progress visualization (partially checked? "Progress visualization for loop states" is checked.)
    - User-friendly error messages (Checked)
    - Confirmation dialogs (Checked)
    - Input validation (Checked)
    - Success/error toasts (Checked)
    - Responsive preview modes (Checked)
    - File tree UX improvements (Checked)
    - Chat UX improvements (Checked)
  - Phase 4 unchecked items:
    - Template gallery
    - Visual component library
    - Theme customization
    - Keyboard shortcuts
    - Search within files
  - Component registry unchecked items:
    - "Add retrieval prompt snippet: choose components only from registry"
  - Packaging unchecked items:
    - "Sync `templates/unloveable/` with root loop pack"

- The `spec.md` mentions "Component registry enforcement" as a "Next" item for MVP.
- "Add retrieval prompt snippet" seems high leverage to enforce quality.
- "Sync `templates/unloveable/`" is also critical for the "loop runner" aspect which is the core value prop.
- Let's look at the "highest leverage". Enforcing component registry via prompt snippet ensures the AI uses the right components, which reduces "repairing" loops. This seems very high leverage.
- However, "Sync `templates/unloveable/`" enables the distribution of this very project as a template, which is the meta-goal ("Unloveable: a Lovable-style UI + headless loop runner").
- Let's check "Add retrieval prompt snippet: choose components only from registry".
- I'll search for where the system prompt or retrieval logic resides.
- `warp-site-canvas-main/src/lib/question-extract.ts` mentions "unloveable_questions".
- I'll look for prompt construction logic.

PLAN
- chosen task: [ ] Add retrieval prompt snippet: choose components only from registry
- files you will change: `warp-site-canvas-main/src/lib/retrieval-prompt.ts` (new file) or modify existing prompt logic if found.
- tests you will add: `warp-site-canvas-main/src/lib/retrieval-prompt.test.ts`
- commands you will run: `npm test` inside `warp-site-canvas-main`

Wait, I need to find where the prompt is constructed first.
I'll search for "prompt" or "system" in `warp-site-canvas-main/src`.

ACTIONS
- [tool_call: grep for pattern 'prompt|system' in src]
- [tool_call: read relevant files]
- [tool_call: create test]
- [tool_call: implement retrieval prompt snippet]
- [tool_call: verify with test]

RESULTS
- (To be filled)

NEXT
- Sync `templates/unloveable/` with root loop pack
