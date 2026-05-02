Status: complete

---

# Context

Maestro currently works on Linux/Ubuntu. The goal is to make installation and usage work on macOS as well. The Node.js application layer (launch-detached.js) already has macOS support via `osascript`, so the gaps are in the shell scripts and documentation.

---

# Current State (as of latest commits)

- `version.txt` → `v0.1.5`
- `install.sh` removes old skills before copying — already correct
- `bump_version.sh` now has: version validation, `version_gt()` using bash arrays, release notes guard, `sed -i` on README.md, then `git commit + tag` — significantly expanded since original plan
- GitHub Actions release workflow added (`.github/workflows/`) — not relevant to macOS compat

# What Already Works on macOS

- `bin/launch-detached.js` — already handles macOS via `osascript` (iTerm or Terminal.app)
- `bin/maestro.js`, `bin/util.js`, `bin/ticket-wizard.js` — pure Node.js, fully cross-platform
- `install.sh` — core logic (git clone, npm install, ln -sf, mkdir -p, rm -rf) is POSIX and works on macOS

---

# What Needs to Change

## 1. `install.sh` — PATH guidance (lines ~32–36)

**Problem:** The post-install hint hardcodes `~/.bashrc`, but macOS uses zsh by default (since Catalina). A macOS user following this instruction would add the PATH to the wrong file and get no effect.

**Fix:** Detect the running shell via `$SHELL` and suggest the right RC file:
```bash
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  echo "Add $BIN_DIR to your PATH. For example:"
  if [[ "$SHELL" == */zsh ]]; then
    RCFILE="~/.zshrc"
  else
    RCFILE="~/.bashrc"
  fi
  echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> $RCFILE && source $RCFILE"
fi
```

**Bonus (optional):** When Node.js or git are missing, print macOS-specific install hints:
```bash
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required."
  if [[ "$(uname)" == "Darwin" ]]; then
    echo "  Install via Homebrew: brew install node"
    echo "  Or download from https://nodejs.org"
  else
    echo "  Install from https://nodejs.org"
  fi
  exit 1
fi
```

## 2. `bump_version.sh` — two macOS issues

### 2a. `sed -i` incompatibility (line ~50)

**Problem:** `sed -i "..."` (GNU sed) fails on macOS BSD sed, which requires `sed -i '' "..."`.

**Fix:** Detect OS with `uname` and branch:
```bash
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s|/maestro/v[^/]*/install\.sh|/maestro/$VERSION/install.sh|" "$SCRIPT_DIR/README.md"
else
  sed -i "s|/maestro/v[^/]*/install\.sh|/maestro/$VERSION/install.sh|" "$SCRIPT_DIR/README.md"
fi
```

### 2b. `version_gt()` uses bash 4+ array syntax

**Problem:** The `version_gt` function uses `IFS='.' read -r -a arr <<< "$str"` — this requires bash 4+. macOS ships bash 3.2 (GPLv2 era) as the default `/bin/bash`. This will silently produce wrong results or error.

**Fix:** Replace `read -r -a` (array flag, bash 4+ only) with scalar named variables. `<<<` herestrings work fine in bash 3.2 — only `-a` breaks it.
```bash
version_gt() {
  IFS='.' read -r a1 a2 a3 <<< "$1"
  IFS='.' read -r b1 b2 b3 <<< "$2"
  for pair in "$a1:$b1" "$a2:$b2" "$a3:$b3"; do
    local x="${pair%%:*}" y="${pair##*:}"
    if (( x > y )); then return 0; fi
    if (( x < y )); then return 1; fi
  done
  return 1
}
```

## 3. `README.md` — Prerequisites and stale Dev note

- Add one line under the install command: "Requires Node.js 18+ and git."
- Remove "Commit and tag afterwards" from the Dev section — `bump_version.sh` now handles that.

---

# Files to Modify

| File | Change |
|------|--------|
| `install.sh` | Shell-aware PATH hint; OS-aware missing dependency messages |
| `bump_version.sh` | Cross-platform `sed -i`; fix `version_gt()` array syntax for macOS bash 3.2 |
| `README.md` | macOS prerequisites, dual-shell PATH instructions |

---

# Verification

1. On macOS (or a simulated environment): run `bash install.sh` and confirm it completes without errors, places the symlink at `~/.local/bin/maestro`, and prints the correct `~/.zshrc` hint
2. Run `bash bump_version.sh v0.2.0` on macOS (with a filled release-notes file) and confirm README.md updates, version comparison works, and git commit+tag succeed
3. Confirm `maestro version` prints the correct version after install
4. Confirm `maestro update` and `maestro uninstall` still work (no macOS-specific breakage — they use Node.js, already cross-platform)
