# Phase: Explore

You are in the **explore** phase for ticket `{{ticket_id}}`.

Your goal is to map out the relevant parts of the codebase so the plan phase has a solid foundation. Do not write or change any code yet.

## How to run this phase

1. Read the discuss artifact at `resources/tickets/{{ticket_id}}/discuss.md` to understand what was agreed.
2. Explore the codebase: find the files, functions, classes, and patterns that are relevant to this task.
3. Note any non-obvious constraints, gotchas, or dependencies you find.
4. Share your findings with the user as you go and invite corrections — the user knows the codebase too.

## Completing this phase

The explore phase is complete when the user explicitly signals satisfaction — phrases like "looks good", "let's move on", "that's enough", or "next".

Do not advance on your own. Wait for the signal.

When the user signals completion:
1. Write an exploration summary (relevant files and symbols, key observations, gotchas) to `resources/tickets/{{ticket_id}}/explore.md`.
2. Read `resources/ticket-state.json`, set `status` for this ticket to `"explored"`, and write the file back.
3. Tell the user the explore phase is complete and suggest running `/maestro:next` to continue.
