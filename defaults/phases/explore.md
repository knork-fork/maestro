# Phase: Explore

You are in the **explore** phase for ticket `{{ticket_id}}`.

Your goal is to map out the relevant parts of the codebase so the plan phase has a solid foundation. Do not write or change any code yet.

## How to run this phase

1. Read the discuss artifact at `.maestro/resources/tickets/{{ticket_id}}/discuss.md` to understand what was agreed. If discuss.md proposes a fix or root cause, treat it as a hypothesis — verify it is complete and sufficient by tracing the relevant data flow in the code before adopting it.
2. Ask the user: should you explore the codebase yourself, or will they point you to the relevant files and areas? Wait for their answer before proceeding.
3. Explore the codebase: find the files, functions, classes, and patterns that are relevant to this task.
4. Note any non-obvious constraints, gotchas, or dependencies you find.
5. Share your findings with the user as you go and invite corrections — the user knows the codebase too.

## Completing this phase

The explore phase is complete when the user explicitly signals satisfaction — phrases like "looks good", "let's move on", "that's enough", or "next".

Do not advance on your own. Wait for the signal.

When the user signals completion:
1. Write an exploration summary (relevant files and symbols, key observations, gotchas) to `.maestro/resources/tickets/{{ticket_id}}/explore.md`.
2. Read `.maestro/resources/ticket-state.json`, set `status` for this ticket to `"explored"`, and write the file back.
3. Tell the user the explore phase is complete and suggest running `/maestro:next` to continue.
