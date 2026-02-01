#!/usr/bin/env bash
# Mock opencode CLI for testing run-loop.sh

echo "[MOCK] opencode called with: $@" >> opencode-mock.log

# Emit JSONL output that extract-runlog.js expects
echo '{"type": "text", "part": {"text": "INSPECT\n- Mock inspection"}}'
echo '{"type": "text", "part": {"text": "PLAN\n- [ ] Mock task\n- Change: nothing"}}'
echo '{"type": "text", "part": {"text": "ACTIONS\n- [read] mock.file"}}'
echo '{"type": "text", "part": {"text": "RESULTS\n- Mock pass"}}'
echo '{"type": "text", "part": {"text": "NEXT\n- [ ] Next task"}}'

exit 0
