#!/usr/bin/env bash
set -e

# validate.sh — Enforce validation profiles for Unloveable loop
# Usage: ./validate.sh [production|exploration]

MODE="${1:-production}"

echo "Running validation profile: $MODE"

# Common validations (always run)
echo "1. Running tests..."
# We assume standard npm test. If this fails, the script fails.
npm test

if [[ "$MODE" == "production" ]]; then
  echo "2. Running typecheck..."
  if command -v tsc >/dev/null; then
    tsc --noEmit
  else
    echo "Warning: tsc not found, skipping typecheck."
  fi

  echo "3. Running lint..."
  if npm run | grep -q "lint"; then
    npm run lint
  else
    echo "Warning: 'npm run lint' not defined, skipping."
  fi

  echo "4. Running build..."
  if npm run | grep -q "build"; then
    npm run build
  else
    echo "Warning: 'npm run build' not defined, skipping."
  fi
  
elif [[ "$MODE" == "exploration" ]]; then
  echo "2. Exploration mode: skipping strict lint/typecheck."
  echo "3. Running build (light check)..."
  # In exploration, we still build to ensure no breaking syntax errors, 
  # but maybe we tolerate warnings? For now, standard build.
  if npm run | grep -q "build"; then
    npm run build
  fi

else
  echo "Error: Unknown mode '$MODE'. Use 'production' or 'exploration'." >&2
  exit 1
fi

echo "✅ Validation profile '$MODE' passed."
