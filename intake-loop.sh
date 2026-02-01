#!/usr/bin/env bash
set -euo pipefail

# Wrapper that delegates to the template intake runner.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$ROOT_DIR/templates/unloveable/intake-loop.sh" "$@"
