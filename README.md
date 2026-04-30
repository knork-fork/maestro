# Maestro

AI workflow orchestrator — interactive CLI for structuring Claude tasks.

## Install

```bash
npm install
```

## Run directly

```bash
npx .
# or
node bin/maestro.js
```

## Use as a Claude Code slash command

Both the Claude Code CLI and the VS Code extension pick up custom commands from `.claude/commands/`.

| Command | What it does |
|---|---|
| `/maestro` | Shows Maestro overview and available subcommands |
| `/maestro:start` | Runs the wizard, then reads the generated brief |

Type `/maestro:start` in any Claude Code chat (CLI or VS Code) to kick off a new task.

## Workflow stages

```
[ Pipeline ]  →  □ Stack  →  □ Quality  →  □ Plan Checker  →  □ Submit
```

Active tab is highlighted. Completed tabs show `✔`. Pending tabs show `□`.

## Artifacts

Written to `.maestro/artifacts/current/` after Submit:

| File | Contents |
|---|---|
| `selection.json` | Structured answers (pipeline, stack, quality, planChecker) |
| `claude-prompt.md` | Task instructions Claude should follow |

## How Claude uses the artifacts

`/maestro:start` instructs Claude to:
1. Run `node bin/maestro.js` in the terminal
2. Wait for the wizard to complete
3. Read `.maestro/artifacts/current/claude-prompt.md` as the task brief
4. Proceed with the task using the selected pipeline, stack, quality gates, and plan style
