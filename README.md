<img src="https://github.com/user-attachments/assets/28251111-ae4d-4d16-b777-f15815d0ef11">

## About

AI workflow orchestrator for Claude Code. Define your project once, then drive it through structured, repeatable phases with a single command.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/knork-fork/maestro/v0.3.0/install.sh | bash
```

> Requires Node.js 18+ and git.

The installer clones the repo, installs dependencies, symlinks the binary, and copies the Claude Code skills into `~/.claude/commands/`.

Run `maestro update` to pull the latest version at any time.

## Run

Open your project folder and run `maestro init` to set up Maestro in that project (creates `.maestro/` with config and gitignore). 

Then, open Claude Code and run `/maestro:start` to launch the ticket wizard in a new terminal window.

## How it works

<img src="https://github.com/user-attachments/assets/6548a546-325f-4894-9de1-8e2e0d299fb5">

After the wizard completes, a ticket is created under `.maestro/resources/tickets/<ticket-id>/`. From there:

1. Run `/maestro:next` — it reads `.maestro/resources/ticket-state.json` to determine the current phase and loads the appropriate phase prompt.
2. Work through each phase (discuss, explore, plan, execute, etc.) with Claude. Each phase writes an artifact into the ticket folder.
3. Repeat `/maestro:next` until the pipeline is complete.

Each ticket folder also contains a `resume.sh` you can run directly to reopen Claude and immediately continue that ticket.

## Per-project customization

Phases and pipelines are read exclusively from the project's `.maestro/config/` folder. `maestro init` seeds this folder from the built-in `defaults/`, so you can customize it per project:

- **Pipelines** — edit `.maestro/config/pipelines.json` to add, remove, or reorder pipeline types and their phase sequences.
- **Phase prompts** — add or override files in `.maestro/config/phases/` (e.g. `explore.md`) to change the instructions Claude receives for that phase.
- **Phase metadata** — edit `.maestro/config/phases.json` to adjust phase names, descriptions, or ordering.
- **Conventions** — add markdown files under `.maestro/config/conventions/` to create a shared knowledge base for your team. These are loaded into the context for every phase, so they can be used for general guidelines (e.g. coding style, commit message format) or specific instructions (e.g. how to run tests, deploy, etc.).
  - `common/` — general guidelines that apply to all pipelines (e.g. commit message format)
  - `stacks/` — instructions specific to certain tech stacks
  - `playbooks/` — domain-specific instructions

All of `.maestro/config/` is copied from `defaults/` by `maestro init` and tracked in git, so per-project changes are version-controlled alongside the codebase.


## CLI

```
maestro init              # initialize .maestro/ in the current project
maestro index             # rebuild .maestro/conventions/index.json
maestro index --dry-run   # check if index.json is up to date without writing
maestro update            # check for a newer release and update if available
maestro version           # print the installed version
maestro help              # show help
maestro reset             # delete all tickets in the current project
maestro uninstall         # remove the binary, skills, and ~/.maestro/
```

## Slash commands

| Command | Description |
|---|---|
| `/maestro` | Show help |
| `/maestro:help` | Show help |
| `/maestro:start` | Launch the ticket wizard in a new detached terminal window |
| `/maestro:pick` | Interactively pick a ticket to work on |
| `/maestro:pick <id>` | Jump straight to a specific ticket by id |
| `/maestro:next` | Continue work on the current ticket (runs the next phase) |
| `/maestro:export` | Zip a ticket for import into another maestro installation |

## Wizard steps (WIP)

Steps are defined in [`.maestro/config/wizard.json`](.maestro/config/wizard.json) (copied from [`defaults/wizard.json`](defaults/wizard.json) on `maestro init`) and loaded at runtime.

At default, wizard prompts for:

| Step | Type | Notes |
|---|---|---|
| Pipeline | single | Options from `pipelines.json`: `modify`, `code-review`, `security-audit` |
| Stack | single | `backend-legacy-php`, `frontend-legacy-js`, `twig-vue`, `backend + frontend`, `maestro` |
| Quality | multi | `run tests`, `run static analysis`, `formatter/checkstyle`, `security inspection` |
| Plan Checker | single | `normal`, `lightweight`, `strict` |
| Submit | summary | Review and confirm |

Each pipeline type maps to a specific sequence of workflow phases (e.g. `modify` → discuss → explore → plan → execute).

---

## Docs

### How `/maestro:start` works

`/maestro:start` runs `maestro launch`, which invokes [bin/launch-detached.js](bin/launch-detached.js):

1. Spawns the wizard in a **new detached terminal window** so Ink has a real TTY (Claude Code's Bash tool can't host an interactive TUI).
2. Passes the project CWD as `$3` to [bin/_wizard-wrapper.sh](bin/_wizard-wrapper.sh), which `cd`s there before running the wizard.
3. Blocks the slash command (and therefore Claude) on a lockfile until the wizard exits.
4. Returns control to Claude once the lockfile is removed.

### How conventions are loaded

Convention files live under `.maestro/config/conventions/`. Each file must begin with a `# tags: tag1, tag2, ...` line — tags are how Claude decides which conventions are relevant to the current phase.

`maestro index` builds `.maestro/conventions/index.json`, a map of `{ path, tags }` entries grouped by category. The index (paths + tags only, not file contents) is passed to Claude at the start of each phase. Claude then reads individual convention files selectively, based on tag relevance to the work at hand.

Which index entries are included depends on the subfolder:

- **`common/`** — all entries are always included in the index passed to Claude.
- **`playbooks/`** — all entries are always included in the index passed to Claude.
- **`stacks/`** — entries are filtered by the stack selected in the ticket wizard. Only entries whose path matches the chosen stack are included, so irrelevant stack conventions are never surfaced.

### Terminal detection

[bin/launch-detached.js](bin/launch-detached.js):

- **macOS** — iTerm if running, else Terminal.app (via `osascript`)
- **Windows** — `wt.exe` if available, else `start` + inline PowerShell wrapper
- **Linux** — checks `MAESTRO_TERMINAL` / `TERMINAL` first, then probes `x-terminal-emulator`, `gnome-terminal`, `konsole`, `xfce4-terminal`, `tilix`, `alacritty`, `kitty`, `wezterm`, `foot`, `ghostty`, `terminator`, `xterm`

If no supported terminal is found, set `MAESTRO_TERMINAL=<binary>` or run `node bin/ticket-wizard.js` in your own terminal from the project root.

### Lockfile protocol

[bin/_wizard-wrapper.sh](bin/_wizard-wrapper.sh) runs inside the spawned window:

- validates `$3` (project CWD) before doing anything
- writes its PID to a temp lockfile on start
- traps `EXIT INT TERM HUP` to remove the lockfile even on force-close
- removes the lockfile cleanly when the wizard exits, then prompts to close the window

The launcher polls the lockfile (10s timeout for first appearance, then unbounded wait for removal) and exits when the wizard is done.

---

## Dev

**Install from master:**

```bash
curl -fsSL https://raw.githubusercontent.com/knork-fork/maestro/master/install.sh | bash
```

**Switch to dev mode:**

```bash
bash dev.sh --local
```

To switch back to the release version, run `bash dev.sh --release`.

**Bump version:**

```bash
bash bump_version.sh v0.2.0
```

Updates `version.txt` and the install URL in this README, then commits and tags.

**CI/CD index check**

Add `maestro index --dry-run` to your CI to ensure `index.json` is up to date. This prevents stale convention data from causing hard-to-debug issues in the wizard and ticket phases.