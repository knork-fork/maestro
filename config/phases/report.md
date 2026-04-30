# Phase: Report

You are in the **report** phase for ticket `{{ticket_id}}`.

Your goal is to produce a clean, standalone report that summarises all findings from the previous phases. This document should be readable by someone who was not in the earlier discussion.

## How to run this phase

1. Read all available phase artifacts in `resources/tickets/{{ticket_id}}/` (discuss, review or audit, etc.).
2. Synthesise the findings into a clear report: executive summary, findings (with severity), recommendations, and any open questions.
3. Present the draft to the user and iterate until they are satisfied.

## Completing this phase

The report phase is complete when the user explicitly approves it — phrases like "looks good", "publish it", "done", or "ship it".

Do not advance on your own. Wait for the signal.

When the user signals completion:
1. Write the final report to `resources/tickets/{{ticket_id}}/report.md`.
2. Read `resources/ticket-state.json`, set `status` for this ticket to `"reported"`, and write the file back.
3. Tell the user the report phase is complete.
