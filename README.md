<img src="https://github.com/user-attachments/assets/28251111-ae4d-4d16-b777-f15815d0ef11">

## About

AI workflow orchestrator for Claude Code. Define your project once, then drive it through structured, repeatable phases with a single command.

## Install

Official release coming soon. For now, clone and install dependencies:

```bash
git clone <repo-url>
cd maestro
npm install
```

## Run

Open Claude Code and run `/maestro:start` to launch the ticket wizard in a new terminal window. Follow the prompts to create a new ticket and define your workflow.

## Wizard steps (WIP)

Steps are defined in [`config/wizard.json`](config/wizard.json) and loaded at runtime.

At default, wizard prompts for:

| Step | Type | Notes |
|---|---|---|
| Pipeline | single | Options from `config/pipelines.json`: `modify`, `code-review`, `security-audit` |
| Stack | single | `backend-legacy-php`, `frontend-legacy-js`, `twig-vue`, `backend + frontend`, `maestro` |
| Quality | multi | `run tests`, `run static analysis`, `formatter/checkstyle`, `security inspection` |
| Plan Checker | single | `normal`, `lightweight`, `strict` |
| Submit | summary | Review and confirm |

Each pipeline type maps to a specific sequence of workflow phases (e.g. `modify` → discuss → explore → plan → execute).

## Workflow

After the wizard completes, a ticket is created under `resources/tickets/<ticket-id>/`. From there:

1. Run `/maestro:next` — it reads `resources/ticket-state.json` to determine the current phase and loads the appropriate phase prompt.
2. Work through each phase (discuss, explore, plan, execute, etc.) with Claude. Each phase writes an artifact into the ticket folder.
3. Repeat `/maestro:next` until the pipeline is complete.

Each ticket folder also contains a `resume.sh` you can run directly to reopen Claude and immediately continue that ticket.

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

### How `/maestro:start` works

`/maestro:start` is registered in [.claude/commands/maestro/start.md](.claude/commands/maestro/start.md). It runs [bin/launch-detached.js](bin/launch-detached.js), which:

1. Spawns the wizard in a **new detached terminal window** so Ink has a real TTY (Claude Code's Bash tool can't host an interactive TUI).
2. Blocks the slash command (and therefore Claude) on a lockfile until the wizard exits.
3. Returns control to Claude once the lockfile is removed.

### Terminal detection

[bin/launch-detached.js](bin/launch-detached.js):

- **macOS** — iTerm if running, else Terminal.app (via `osascript`)
- **Windows** — `wt.exe` if available, else `start` + inline PowerShell wrapper
- **Linux** — checks `MAESTRO_TERMINAL` / `TERMINAL` first, then probes `x-terminal-emulator`, `gnome-terminal`, `konsole`, `xfce4-terminal`, `tilix`, `alacritty`, `kitty`, `wezterm`, `foot`, `ghostty`, `terminator`, `xterm`

If no supported terminal is found, set `MAESTRO_TERMINAL=<binary>` or just run `node bin/ticket-wizard.js` in your own terminal.

### Lockfile protocol

[bin/_wizard-wrapper.sh](bin/_wizard-wrapper.sh) runs inside the spawned window:

- writes its PID to a temp lockfile on start
- traps `EXIT INT TERM HUP` to remove the lockfile even on force-close
- removes the lockfile cleanly when the wizard exits, then prompts to close the window

The launcher polls the lockfile (10s timeout for first appearance, then unbounded wait for removal) and exits when the wizard is done.

## Layout

```
bin/
  ticket-wizard.js       # Ink wizard entry point
  launch-detached.js     # cross-platform terminal spawner + lockfile poller
  _wizard-wrapper.sh     # in-window wrapper that maintains the lockfile
  util.js                # ticket utilities (list, state, export/import)
  delete-all-tickets.js  # wipe all tickets
config/
  wizard.json            # wizard step definitions
  pipelines.json         # pipeline types and their phase sequences
  phases.json            # phase metadata
  help.md                # help text (used by /maestro and /maestro:help)
  phases/                # per-phase prompt files (discuss.md, explore.md, …)
resources/
  ticket-state.json      # tracks status of all tickets
  tickets/               # one folder per ticket, with phase artifacts
exports/                 # zip archives produced by /maestro:export
.claude/commands/
  maestro.md             # /maestro (help alias)
  maestro/
    start.md             # /maestro:start
    next.md              # /maestro:next
    pick.md              # /maestro:pick
    export.md            # /maestro:export
    help.md              # /maestro:help
```
