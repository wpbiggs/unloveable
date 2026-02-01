#!/bin/bash
# Verifies that README.md contains the required sections for the "Bring Your Own Model" release.

FILE="README.md"

if [ ! -f "$FILE" ]; then
  echo "Error: $FILE does not exist."
  exit 1
fi

MISSING=0

if ! grep -q "Bring Your Own Model" "$FILE"; then
  echo "Missing section: 'Bring Your Own Model'"
  MISSING=1
fi

if ! grep -q "Compute-Only Loop" "$FILE"; then
  echo "Missing section: 'Compute-Only Loop'"
  MISSING=1
fi

if ! grep -q "How to Run Without UI" "$FILE"; then
  echo "Missing section: 'How to Run Without UI'"
  MISSING=1
fi

if [ $MISSING -eq 1 ]; then
  echo "Validation failed: README.md is missing required sections."
  exit 1
else
  echo "Validation passed: README.md contains all required sections."
  exit 0
fi
