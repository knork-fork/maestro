#!/usr/bin/env bash
# Runs the maestro wizard inside a detached terminal window.
# Maintains a lockfile so the parent launcher can block until the wizard exits.
#
# Args: $1 = absolute path to lockfile, $2 = absolute path to maestro.js

set -u
LOCK="$1"
ENTRY="$2"

cleanup() { rm -f "$LOCK"; }
trap cleanup EXIT INT TERM HUP

echo $$ > "$LOCK"

node "$ENTRY"
CODE=$?

cleanup
trap - EXIT INT TERM HUP

echo
echo "Wizard exited with code $CODE. Press enter to close this window."
read -r _ || true
