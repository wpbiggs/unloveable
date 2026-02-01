# Unloveable Template

This template contains the core components for the **Unloveable** Ralph Wiggum loop.

## Components

- `spec.md`: The "Unloveable" specification.
- `implementation-plan.md`: The checklist of tasks.
- `prompt.md`: The recurring prompt for the agent.
- `loop.json`: The state machine definition.
- `validate-loop.js`: The validation script for the loop.

## Intake

- `templates/unloveable/intake/questions.prompt.md`: asks the 5 intake questions.
- `templates/unloveable/intake/doc-generator.prompt.md`: generates canonical docs.
- `templates/unloveable/intake-loop.sh`: runs questions -> answers -> docs (optionally starts `run-loop.sh`).

## Usage

Use these files to bootstrap a new "Unloveable" instance or to reset the current instance to a known state.
