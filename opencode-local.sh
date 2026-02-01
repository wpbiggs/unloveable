#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bun run --cwd "$ROOT_DIR/opencode/packages/opencode" --conditions=browser src/index.ts "$@"
