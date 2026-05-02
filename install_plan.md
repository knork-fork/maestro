# Plan: Maestro Global Install Refactor

## Context
Maestro currently assumes it runs from its own project directory — all scripts use `__dirname`-relative paths to find `config/` and `resources/`. To support global installation via a curl-pipeable `install.sh`, the tool needs restructuring so a single `maestro` binary (on PATH) dispatches all subcommands, per-project config and state live in `.maestro/` in the user's project, and bundled defaults are stored in a `defaults/` folder inside the package.

---

## Directory Structure After Refactor

**Package (installed at `~/.maestro/`):**
```
bin/
  maestro.js           ← new CLI entry point (shebang: #!/usr/bin/env node)
  util.js              ← refactored to export functions (no longer run directly)
  ticket-wizard.js     ← updated paths
  launch-detached.js   ← updated paths + pass project CWD to wrapper
  _wizard-wrapper.sh   ← accept 3rd arg: project CWD, cd to it before wizard
  delete-all-tickets.js← updated to use process.cwd()/.maestro/
defaults/              ← all bundled templates (renamed from config/ + moved from .claude/)
  commands/            ← skills (installed to ~/.claude/commands/ via maestro install)
    maestro.md
    maestro/
      help.md, pick.md, start.md, next.md, export.md
  help.md
  pipelines.json
  phases.json
  phases/
    discuss.md, explore.md, plan.md, execute.md, review.md, audit.md, report.md
  wizard.json
.claude/
  settings.local.json  ← only dev settings remain here
install.sh             ← curl-pipeable installer
package.json           ← fix bin entry to ./bin/maestro.js
```

**Per-project (in user's project, after `maestro init`):**
```
.maestro/
  .gitignore           ← contains: resources/ and exports/
  config/              ← copied from defaults/, tracked in git
    (same structure as defaults/)
  resources/           ← gitignored
    ticket-state.json
    tickets/
      <ticket-id>/
        ticket.json
        resume.sh
        discuss.md, plan.md, etc.
  exports/             ← gitignored
    <ticket-id>.zip
```

---

## Changes

### 1. Consolidate bundled assets into `defaults/`
All read-only bundled content moves into `defaults/`, sourced via `import.meta.url`-relative paths:

- `config/` → `defaults/` (config templates)
- `.claude/commands/` → `defaults/commands/` (skills)

The repo `.claude/` folder is left with only `settings.local.json`.

### 2. Create `bin/maestro.js` — CLI entry point
**File:** `bin/maestro.js` (new)

Shebang: `#!/usr/bin/env node`

Subcommands dispatched — split into public (documented in README and `maestro help`) and private (used by skills only, not surfaced to users):

**Public:**
| Command | Action |
|---|---|
| `install` | Copy `defaults/commands/` (via `import.meta.url`) → `~/.claude/commands/` |
| `init` | Copy `defaults/` → `process.cwd()/.maestro/config/`; create `.maestro/.gitignore` with `resources/` and `exports/` |
| `update` | Re-download `install.sh` via curl and pipe to bash — identical to the original install command |
| `help` | Print `process.cwd()/.maestro/config/help.md` (falls back to `defaults/help.md`) |
| `reset` | Absorb delete-all-tickets.js logic |
| `uninstall` | See install_plan_followup.md |

**Private (skill-facing, not documented to end users):**
| Command | Action |
|---|---|
| `list-tickets` | Call `listTickets()` from util.js |
| `get-phase <id>` | Call `getPhaseForTicket(id)` from util.js |
| `get-all-phases <id>` | Call `getAllPhasesForTicket(id)` from util.js |
| `export <id>` | Call `exportTicket(id)` from util.js |
| `launch` | Run launch-detached logic, passing `process.cwd()` as project CWD |

Install dir is always `dirname(import.meta.url)/..` — works via symlink too since Node resolves symlinks for `import.meta.url`.

### 3. Refactor `bin/util.js`
**File:** `bin/util.js`

- Export named functions instead of running as a CLI script
- Change `root` from `join(__dirname, '..')` → `process.cwd()`
- All path changes:
  - `resources/` → `.maestro/resources/`
  - `config/` → `.maestro/config/`
  - `exports/` → `.maestro/exports/`
- Phase action resolution: `join(process.cwd(), '.maestro', phase.action)` — works unchanged since action values are still `config/phases/discuss.md` relative to `.maestro/`

### 4. Add `.maestro/` guard to all entry points
**Files:** `bin/ticket-wizard.js`, `bin/maestro.js` (subcommands: `launch`, `list-tickets`, `get-phase`, `get-all-phases`, `export`, `reset`)

Before doing any work that requires per-project state, check that `process.cwd()/.maestro/` exists. If not, print an error and exit 1:
```
Error: No .maestro/ folder found in the current directory.
Run "maestro init" to initialize maestro for this project.
```

Subcommands exempt from this check: `install`, `init`, `update`, `version`, `help`, `uninstall`.

### 5. Update `bin/ticket-wizard.js`
**File:** `bin/ticket-wizard.js`

- `CONFIG_DIR`: `join(__dirname, '../config')` → `join(process.cwd(), '.maestro/config')`
- `RESOURCES_DIR`: `join(__dirname, '../resources')` → `join(process.cwd(), '.maestro/resources')`
- Resume script `cd` depth: `../../..` → `../../../..` (4 levels up from `.maestro/resources/tickets/<id>/`)

### 6. Update `bin/launch-detached.js`
**File:** `bin/launch-detached.js`

- Remove `PROJECT_CWD = resolve(__dirname, '..')` 
- Capture `const projectCwd = process.cwd()` at startup
- Pass `projectCwd` as 3rd argument to `_wizard-wrapper.sh` in `argsFor()`
- Remove stateFile reference (now handled by wizard via its own CWD)

### 7. Update `bin/_wizard-wrapper.sh`
**File:** `bin/_wizard-wrapper.sh`

- Accept `$3` as `PROJECT_CWD`
- Add `cd "$PROJECT_CWD"` before `node "$ENTRY"`

### 8. Update `bin/delete-all-tickets.js`
**File:** `bin/delete-all-tickets.js`

- `RESOURCES_DIR`: `join(__dirname, '../resources')` → `join(process.cwd(), '.maestro/resources')`
- (This script's logic will be absorbed into `maestro reset` in maestro.js)

### 9. Update phase prompts and help
**Files:** `defaults/phases/*.md`, `defaults/help.md`

- Replace all `resources/tickets/` → `.maestro/resources/tickets/`
- Replace resume.sh path in `help.md`: `resources/tickets/<id>/resume.sh` → `.maestro/resources/tickets/<id>/resume.sh`

### 10. Update skill files
**Files:** `defaults/commands/maestro/*.md`

| Old | New |
|---|---|
| `` !`node bin/util.js listTickets` `` | `` !`maestro list-tickets` `` |
| `` !`node bin/launch-detached.js` `` | `` !`maestro launch` `` |
| `node bin/util.js getPhaseForTicket <id>` | `maestro get-phase <id>` |
| `node bin/util.js getAllPhasesForTicket <id>` | `maestro get-all-phases <id>` |
| `node bin/util.js export <id>` | `maestro export <id>` |
| `` !`cat config/help.md` `` | `` !`maestro help` `` |

### 11. Fix `package.json`
**File:** `package.json`

- `"bin": { "maestro": "./bin/maestro.js" }` — already correct, now the file will exist
- `"start"` script stays as-is

### 12. Create `install.sh`
**File:** `install.sh` (new, in repo root)

```bash
#!/usr/bin/env bash
set -e

INSTALL_DIR="$HOME/.maestro"
BIN_DIR="$HOME/.local/bin"
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

# 5. PATH guidance
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  echo "Add $BIN_DIR to your PATH, e.g.:"
  echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
fi

echo ""
echo "Done. Next steps:"
echo "  maestro install       # install Claude Code skills"
echo "  maestro init          # initialize maestro in a project"
```

### 13. Update `.gitignore` in maestro repo
**File:** `.gitignore`

- Add `.maestro/resources/` and `.maestro/exports/` (for when maestro is used on itself)
- Remove old `resources/` entry if present
- Keep `exports/` removed (now lives under `.maestro/`)

### 14. Remove obsolete files/dirs from repo
- `resources/` directory (state moves to per-project `.maestro/resources/`)
- `exports/` directory (moves to per-project `.maestro/exports/`)

---

## Verification

1. **Install flow:** Run `bash install.sh` on a clean machine (or temp dir). Verify `~/.maestro/` is created, `~/.local/bin/maestro` symlink exists, `maestro --help` works.

2. **Init flow:** `cd` to a test project, run `maestro init`. Verify `.maestro/config/` is populated from defaults, `.maestro/.gitignore` contains `resources/` and `exports/`.

3. **Skill install:** Run `maestro install`. Verify `.claude/commands/maestro/` appears in `~/.claude/commands/`.

4. **Ticket creation:** In a test project, run `/maestro:start` in Claude Code. Verify wizard launches, ticket is created under `.maestro/resources/tickets/`, `ticket-state.json` is updated.

5. **Ticket workflow:** Run `/maestro:pick` and `/maestro:next`. Verify phase prompt loads from `.maestro/config/phases/`.

6. **Update:** Run `maestro update`. Verify `install.sh` is invoked and pulls latest.

7. **Dev isolation:** In the maestro repo itself, `npm link` should make the dev version win. `npm unlink` restores the global install.
