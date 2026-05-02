#!/usr/bin/env bash
# Runs the maestro wizard inside a detached terminal window.
# Maintains a lockfile so the parent launcher can block until the wizard exits.
#
# Args: $1 = absolute path to lockfile, $2 = absolute path to maestro.js, $3 = project CWD

set -u
LOCK="$1"
ENTRY="$2"
PROJECT_CWD="$3"

if [ -z "$PROJECT_CWD" ]; then
  echo "Error: PROJECT_CWD not provided as \$3"
  exit 1
fi
if [ ! -d "$PROJECT_CWD" ]; then
  echo "Error: PROJECT_CWD does not exist: $PROJECT_CWD"
  exit 1
fi

cleanup() { rm -f "$LOCK"; }
trap cleanup EXIT INT TERM HUP

echo $$ > "$LOCK"

cd "$PROJECT_CWD"
node "$ENTRY"
CODE=$?

cleanup
trap - EXIT INT TERM HUP

echo
echo "Wizard exited with code $CODE. Press enter to close this window."
read -r _ || true
