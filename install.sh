#!/usr/bin/env bash
set -e

INSTALL_DIR="$HOME/.maestro"
BIN_DIR="$HOME/.local/bin"
CLAUDE_COMMANDS_DIR="$HOME/.claude/commands"
REPO_URL="https://github.com/knork-fork/maestro"

# 1. Check dependencies
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required. Install from https://nodejs.org"
  exit 1
fi
if ! command -v git &>/dev/null; then
  echo "Error: git is required."
  exit 1
fi

# 2. Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating maestro..."
  git -C "$INSTALL_DIR" pull
else
  echo "Installing maestro..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# 3. Install dependencies
cd "$INSTALL_DIR"
npm install --omit=dev

# 4. Symlink binary
mkdir -p "$BIN_DIR"
chmod +x "$INSTALL_DIR/bin/maestro.js"
ln -sf "$INSTALL_DIR/bin/maestro.js" "$BIN_DIR/maestro"

# 5. Install Claude Code skills (remove first so deleted skills don't persist)
mkdir -p "$CLAUDE_COMMANDS_DIR"
rm -rf "$CLAUDE_COMMANDS_DIR/maestro" "$CLAUDE_COMMANDS_DIR/maestro.md"
cp -r "$INSTALL_DIR/defaults/commands/." "$CLAUDE_COMMANDS_DIR/"

# 6. PATH guidance
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  echo "Add $BIN_DIR to your PATH, e.g.:"
  echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
fi

echo ""
echo "Done. Run 'maestro init' in a project to get started."
