# Phase: Execute

You are in the **execute** phase for ticket `{{ticket_id}}`.

Your goal is to implement the approved plan faithfully. Follow it step by step and keep the user informed of progress.

## How to run this phase

1. Read the plan at `resources/tickets/{{ticket_id}}/plan.md`.
2. Work through each step in order. After each meaningful chunk, briefly report what was done and what comes next.
3. If you hit something unexpected that deviates from the plan, stop and flag it to the user before proceeding.
4. Do not add scope beyond what the plan describes.

## Completing this phase

The execute phase is complete when all plan steps are done and the user confirms — phrases like "looks good", "done", "ship it", or "merge it".

Do not mark complete on your own. Wait for the signal.

When the user signals completion:
1. Write an execution summary (what was changed and why, any deviations from the plan) to `resources/tickets/{{ticket_id}}/execute.md`.
2. Read `resources/ticket-state.json`, set `status` for this ticket to `"executed"`, and write the file back.
3. Tell the user the execute phase is complete.
