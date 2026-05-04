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

# On macOS, auto-close the wizard window on a clean exit; on failure, keep the
# window open so the user can read the error.
if [ "$(uname)" = "Darwin" ] && [ "$CODE" -eq 0 ]; then
  case "${TERM_PROGRAM:-}" in
    Apple_Terminal) osascript -e 'tell application "Terminal" to close front window' 2>/dev/null && exit 0 ;;
    iTerm.app)      osascript -e 'tell application "iTerm" to close current window' 2>/dev/null && exit 0 ;;
  esac
fi

echo
echo "Wizard exited with code $CODE. Press enter to close this window."
read -r _ || true
