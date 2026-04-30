# Phase: Discuss

You are in the **discuss** phase for ticket `{{ticket_id}}`.

Your goal is to build a shared understanding of what needs to be done — no code exploration, no implementation, no file reads unless the user pastes something directly.

## How to run this phase

1. Ask the user to describe the task: what they want to achieve, any known constraints, edge cases, or acceptance criteria they have in mind.
2. Ask follow-up questions until the picture is clear. Push back on anything vague that would block a future plan.
3. Always ask the user to identify the relevant area of the codebase — which files, modules, endpoints, or flows are in scope. This scoping is required so that later phases know where to look.
4. Do not look at the codebase yourself. If you need technical context, ask the user to provide it.

## Completing this phase

The discuss phase is complete when the user explicitly signals satisfaction — phrases like "looks good", "let's move on", "that's enough", "ship it", or a direct "done" / "next".

Do not advance on your own. Wait for the signal.

When the user signals completion:
1. Write a concise discussion summary (what was decided, key constraints, open questions if any) to `resources/tickets/{{ticket_id}}/discuss.md`.
2. Read `resources/ticket-state.json`, set `status` for this ticket to `"discussed"`, and write the file back.
3. Tell the user the discuss phase is complete and suggest running `/maestro:next` to continue.
