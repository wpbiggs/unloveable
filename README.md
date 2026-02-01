# Unloveable: Bring Your Own Model + Compute-Only Loop

This repository implements the **Unloveable** architecture: a Lovable-style UI connected to a headless "Ralph Wiggum" loop runner. It uses **OpenCode** as the development engine, allowing you to bring **any model** (local, self-hosted, or remote) and iterate until satisfied.

The core philosophy is **compute-only**: instead of paying for a SaaS subscription, you pay only for the tokens/compute you consume.

## The "Ralph Wiggum" Loop

At the heart of Unloveable is the Ralph Wiggum loop, designed to prevent context rot and ensure reliable, verifiable progress:

- **Static Source of Truth:** Requirements live in `spec.md` and `implementation-plan.md`, not in chat history.
- **Fresh Context:** Each iteration starts with a fresh context window.
- **Test-Driven:** Every task requires a passing test before it's marked complete.
- **Headless:** The loop runs autonomously via a script, interacting with the OpenCode server.

## Files Structure

- `spec.md`: The project requirements and constraints.
- `implementation-plan.md`: A granular checklist of tasks.
- `prompt.md`: The system prompt used for every iteration.
- `loop.json`: State machine definition for the loop.
- `run-loop.sh`: The headless script that drives the loop.
- `validate-loop.ts`: A validation script to ensure runlogs comply with the protocol.
- `runlogs/`: Directory where execution logs for each iteration are stored.

## How to Run Without UI (Headless Mode)

You can run the Unloveable loop entirely without the frontend UI. This is useful for CI/CD, batch processing, or purely terminal-based workflows.

### Prerequisites

1.  **OpenCode Server:** Ensure you have the OpenCode server running (or a compatible backend).
2.  **OpenCode CLI:** You need a way to invoke the agent (e.g., via `opencode run` or a custom script).

### Steps

1.  **Configure Environment:**
    Set the `OPENCODE_SERVER_URL` environment variable to your running server:
    ```bash
    export OPENCODE_SERVER_URL=http://127.0.0.1:4096
    ```

2.  **Make the Script Executable:**
    ```bash
    chmod +x run-loop.sh
    ```

3.  **Run the Loop:**
    Execute the loop runner in either `production` or `exploration` mode:

    **Production Mode** (Strict checks: tests + build + lint + typecheck):
    ```bash
    ./run-loop.sh production
    ```

    **Exploration Mode** (Faster: tests + build):
    ```bash
    ./run-loop.sh exploration
    ```

The script will:
1.  Read `spec.md` and `implementation-plan.md`.
2.  Select the highest-leverage unchecked task.
3.  Start a fresh agent session.
4.  Feed in the context.
5.  Wait for the agent to complete the task (write tests, implement code, verify).
6.  Generate a runlog in `runlogs/`.
7.  Repeat until stopped or all tasks are complete.

## Setup for Development

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  (Optional) Run the validate script to check loop integrity:
    ```bash
    npx ts-node validate-loop.ts
    ```
