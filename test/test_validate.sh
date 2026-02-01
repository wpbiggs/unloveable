#!/bin/bash
set -e

# Mock npm command
function npm() {
  echo "mock npm called with: $@"
  if [[ "$1" == "test" ]]; then
    return 0
  fi
  if [[ "$1" == "run" ]] && [[ "$2" == "lint" ]]; then
    return 0
  fi
  if [[ "$1" == "run" ]] && [[ "$2" == "build" ]]; then
    return 0
  fi
  # "npm run" list command
  if [[ "$1" == "run" ]] && [[ -z "$2" ]]; then
    echo "Scripts available:"
    echo "  test"
    echo "  lint"
    echo "  build"
    return 0
  fi
  return 127
}
export -f npm

# Mock tsc
function tsc() {
  echo "mock tsc called with: $@"
  return 0
}
export -f tsc

echo "TEST 1: Exploration mode (should skip lint/typecheck)"
output=$(./validate.sh exploration)
if echo "$output" | grep -q "skipping strict lint/typecheck"; then
  echo "PASS: Exploration skipped checks"
else
  echo "FAIL: Exploration did not skip checks"
  exit 1
fi

echo "TEST 2: Production mode (should run all checks)"
output=$(./validate.sh production)
if echo "$output" | grep -q "Running typecheck" && echo "$output" | grep -q "Running lint"; then
  echo "PASS: Production ran checks"
else
  echo "FAIL: Production missed checks"
  echo "$output"
  exit 1
fi

echo "TEST 3: Invalid mode"
if ./validate.sh invalid_mode 2>/dev/null; then
  echo "FAIL: Should have failed on invalid mode"
  exit 1
else
  echo "PASS: Failed on invalid mode"
fi

echo "All tests passed."
