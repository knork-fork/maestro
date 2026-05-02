# Plan: Maestro Version, Update Check & Uninstall

Extends `install_plan.md`. Assumes all changes there are implemented first.

---

## Changes

### 1. Add `version.txt`
**File:** `version.txt` (new, repo root)

Full git tag string. Initial content: `v0.1.0-pre-release`. Preferred over `package.json` since it's easier to read without JSON parsing and matches GitHub tag names directly — enabling a simple equality check as the fast path in `update`.

### 2. Add `maestro version` subcommand
**File:** `bin/maestro.js`

```
maestro version
```

Logic:
1. Read `join(installDir, 'version.txt')` — `installDir` is `dirname(import.meta.url)/..`
2. Fall back to `package.json` `version` field if `version.txt` absent
3. Print to stdout, e.g. `maestro 0.1.0`

Extract into a shared helper `getLocalVersion()` since `update` also needs it.

### 3. Update `maestro update` subcommand
**File:** `bin/maestro.js`

New logic before pulling:

1. Call `getLocalVersion()` — current installed version
2. Fetch latest git tag from GitHub API (no auth required for public repos):
   ```
   GET https://api.github.com/repos/knork-fork/maestro/releases/latest
   ```
   Parse `.tag_name` (format: `v0.1.0` or `v0.1.0-pre-release`) — strip leading `v` for comparison.
   Fall back to `https://api.github.com/repos/knork-fork/maestro/tags` and take `[0].name` if no releases exist yet.
3. Compare: if `localVersion === latestTag` (direct string equality), print `Already up to date (v0.1.0-pre-release).` and exit 0.
4. Otherwise strip `v` from both and run semver comparison. If `localVersion >= latestVersion`, same "already up to date" exit.
5. If `localVersion < latestVersion`, print `Updating from v0.1.0-pre-release → v0.2.0...` then re-download and run `install.sh` from the exact tag fetched in step 2: `curl -fsSL https://raw.githubusercontent.com/knork-fork/maestro/<latestTag>/install.sh | bash`. Using the tag (not a branch) ensures we run the install script that ships with that release. `install.sh` prints its own completion message.

**Semver comparison** (used only when string equality fails — e.g. comparing `v0.1.0-pre-release` vs `v0.1.0`):
- Strip leading `v`, then split on `-` to separate version core from pre-release label
- Compare numeric segments of the core first
- If cores are equal: a version with a pre-release label is lower than one without (per semver spec: `0.1.0-pre-release < 0.1.0`)
- No dependency needed — stdlib only.

**Network failure:** If the GitHub API request fails (offline, rate-limited), warn and ask user to confirm before proceeding anyway:
```
Warning: Could not check latest version. Proceed with update anyway? [y/N]
```
Use `readline` from Node stdlib for the prompt.

### 4. Add `maestro uninstall` subcommand
**File:** `bin/maestro.js`

Removes the global installation. Does NOT touch any per-project `.maestro/` folders (those are the user's data and we can't enumerate all projects anyway).

Steps:
1. Print what will be deleted and ask for confirmation:
   ```
   This will remove:
     ~/.local/bin/maestro  (symlink)
     ~/.claude/commands/maestro/
     ~/.claude/commands/maestro.md
     ~/.maestro/

   Per-project .maestro/ folders will NOT be touched.
   Proceed? [y/N]
   ```
2. On confirmation:
   - Delete symlink: `~/.local/bin/maestro`
   - Delete skills: `~/.claude/commands/maestro/` and `~/.claude/commands/maestro.md`
   - Delete install dir: `~/.maestro/`
3. Print `Maestro uninstalled.`

**Note:** The binary deletes itself (`~/.maestro/bin/maestro.js` is inside `~/.maestro/`). That's fine — Node has already loaded it into memory. The `rm -rf` on `~/.maestro/` runs last, after all other steps.

Symlink location is `~/.local/bin/maestro` (matches what `install.sh` creates). If it doesn't exist there, skip with a notice rather than erroring.

---

## Updated subcommand table for `bin/maestro.js`

| Command | Action |
|---|---|
| `install` | Copy skills → `~/.claude/commands/` |
| `init` | Scaffold `.maestro/` in cwd from `defaults/` |
| `update` | Check GitHub tag vs local version, pull + reinstall if newer |
| `version` | Print local version from `version.txt` or `package.json` |
| `uninstall` | Remove binary, skills, and `~/.maestro/` after confirmation |
| `help` | Print `.maestro/config/help.md` or fallback to `defaults/help.md` |
| `list-tickets` | `listTickets()` from util.js |
| `get-phase <id>` | `getPhaseForTicket(id)` from util.js |
| `get-all-phases <id>` | `getAllPhasesForTicket(id)` from util.js |
| `export <id>` | `exportTicket(id)` from util.js |
| `launch` | launch-detached logic, pass `process.cwd()` as project CWD |
| `reset` | delete-all-tickets logic scoped to `process.cwd()/.maestro/` |

---

## Files changed

| File | Change |
|---|---|
| `version.txt` | New — plain semver string |
| `bin/maestro.js` | Add `version`, `uninstall` subcommands; update `update` with version check |

No other files need changes for this followup.

---

## Verification

1. **version:** `maestro version` prints `maestro 0.1.0` (or whatever is in `version.txt`).
2. **update — already current:** Mock a matching tag on GitHub (or temporarily bump `version.txt` above latest tag). `maestro update` prints "Already up to date" and exits without pulling.
3. **update — new version available:** Set `version.txt` to `0.0.1`, run `maestro update`. Verify it pulls and prints the version transition.
4. **update — offline:** Disconnect network, run `maestro update`. Verify warning prompt appears and `y` proceeds with pull.
5. **uninstall:** Run `maestro uninstall`, confirm with `y`. Verify symlink, skills, and `~/.maestro/` are gone. Verify a test project's `.maestro/` is untouched.
