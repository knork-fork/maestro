#!/usr/bin/env bash
set -e

INSTALL_DIR="$HOME/.maestro"
BIN_DIR="$HOME/.local/bin"
CLAUDE_COMMANDS_DIR="$HOME/.claude/commands"
DEV_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  --local)
    echo "Switching to local dev..."

    # Remove existing install (symlink or directory)
    rm -rf "$INSTALL_DIR"

    # Symlink ~/.maestro to this repo
    ln -s "$DEV_DIR" "$INSTALL_DIR"

    # Install all dependencies (including dev)
    cd "$DEV_DIR"
    npm install

    # Symlink binary
    mkdir -p "$BIN_DIR"
    chmod +x "$DEV_DIR/bin/maestro.js"
    ln -sf "$DEV_DIR/bin/maestro.js" "$BIN_DIR/maestro"

    # Symlink Claude Code commands
    mkdir -p "$CLAUDE_COMMANDS_DIR"
    rm -rf "$CLAUDE_COMMANDS_DIR/maestro" "$CLAUDE_COMMANDS_DIR/maestro.md"
    ln -sf "$DEV_DIR/defaults/commands/maestro" "$CLAUDE_COMMANDS_DIR/maestro"
    if [ -f "$DEV_DIR/defaults/commands/maestro.md" ]; then
      ln -sf "$DEV_DIR/defaults/commands/maestro.md" "$CLAUDE_COMMANDS_DIR/maestro.md"
    fi

    echo ""
    echo "Done. ~/.maestro and maestro binary now point to $DEV_DIR"
    ;;

  --release)
    echo "Switching to release..."

    rm -rf "$INSTALL_DIR"
    rm -f "$BIN_DIR/maestro"
    rm -rf "$CLAUDE_COMMANDS_DIR/maestro" "$CLAUDE_COMMANDS_DIR/maestro.md"

    bash "$DEV_DIR/install.sh"
    ;;

  *)
    echo "Usage: $0 [--local | --release]"
    echo ""
    echo "  --local    Symlink ~/.maestro and maestro binary to this dev folder"
    echo "  --release  Remove dev setup and reinstall from the release repo"
    exit 1
    ;;
esac
