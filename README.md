# Maestro

Interactive TUI wizard that walks through pipeline / stack / quality / plan-strictness choices for a Claude Code task. Built with [Ink](https://github.com/vadimdemedes/ink).

> **Status:** early scaffolding. The wizard renders and captures selections in memory, but **does not yet persist anything to disk**. Submit currently just exits. Artifact generation, the "Let's chat about this" branch, and reading the brief back into Claude are all TODO.

## Install

```bash
npm install
```

## Run directly

```bash
node bin/maestro.js
# or
npx .
```

The wizard takes over the terminal. Navigate with arrows, space to toggle multi-select, enter to advance, left arrow to go back, `^C` to quit.

## Wizard steps

```
[ Pipeline ]  →  □ Stack  →  □ Quality  →  □ Plan Checker  →  □ Submit
```

| Step | Type | Choices |
|---|---|---|
| Pipeline | single | `modify`, `bugfix`, `code-review`, `tests` |
| Stack | single | `backend-legacy-php`, `frontend-legacy-js`, `twig-vue`, `backend + frontend` |
| Quality | multi | `run tests`, `run static analysis`, `formatter/checkstyle`, `security inspection` |
| Plan Checker | single | `normal`, `lightweight`, `strict` |
| Submit | summary | review and confirm |

Each step also shows a `💬 Let's chat about this` row — placeholder, not wired up.

## Use as a Claude Code slash command

`/maestro:start` is registered in [.claude/commands/maestro/start.md](.claude/commands/maestro/start.md). It runs [bin/launch-detached.js](bin/launch-detached.js), which:

1. Spawns the wizard in a **new detached terminal window** so Ink has a real TTY (Claude Code's Bash tool can't host an interactive TUI).
2. Blocks the slash command (and therefore Claude) on a lockfile until the wizard exits.
3. Returns control to Claude once the lockfile is removed.

### Terminal detection

[bin/launch-detached.js](bin/launch-detached.js):

- **macOS** — iTerm if running, else Terminal.app (via `osascript`)
- **Windows** — `wt.exe` if available, else `start` + inline PowerShell wrapper
- **Linux** — checks `MAESTRO_TERMINAL` / `TERMINAL` first, then probes `x-terminal-emulator`, `gnome-terminal`, `konsole`, `xfce4-terminal`, `tilix`, `alacritty`, `kitty`, `wezterm`, `foot`, `ghostty`, `terminator`, `xterm`

If no supported terminal is found, set `MAESTRO_TERMINAL=<binary>` or just run `node bin/maestro.js` in your own terminal.

### Lockfile protocol

[bin/_wizard-wrapper.sh](bin/_wizard-wrapper.sh) runs inside the spawned window:

- writes its PID to a temp lockfile on start
- traps `EXIT INT TERM HUP` to remove the lockfile even on force-close
- removes the lockfile cleanly when the wizard exits, then prompts to close the window

The launcher polls the lockfile (10s timeout for first appearance, then unbounded wait for removal) and exits when the wizard is done.

## What's missing

These are referenced in the wizard UI / slash command but **not implemented yet**:

- Persistence: no `.maestro/artifacts/` directory, no `selection.json`, no `claude-prompt.md` — Submit calls `exit()` and discards selections.
- "Let's chat about this" row on each step.
- Any post-wizard step that feeds the brief back to Claude.

## Layout

```
bin/
  maestro.js           # Ink wizard entry
  launch-detached.js   # cross-platform terminal spawner + lockfile poller
  _wizard-wrapper.sh   # in-window wrapper that maintains the lockfile
.claude/commands/maestro/
  start.md             # /maestro:start slash command
```
