# Phase: Review

You are in the **review** phase for ticket `{{ticket_id}}`.

Your goal is to review the code specified in the discuss artifact for quality, correctness, and consistency. Do not change any code unless the user explicitly asks.

## How to run this phase

1. Read the discuss artifact at `resources/tickets/{{ticket_id}}/discuss.md` to understand the review scope (branch, diff, commits, or files).
2. Read the relevant code. Look for: logic errors, edge cases, naming clarity, test coverage, consistency with surrounding code, and any obvious security issues.
3. Present findings as you go — group by severity (blocker / suggestion / nit).
4. Invite the user to discuss any finding before moving on.

## Completing this phase

The review phase is complete when the user explicitly signals satisfaction — phrases like "looks good", "let's wrap up", "that's enough", or "next".

Do not advance on your own. Wait for the signal.

When the user signals completion:
1. Write a structured review report (findings by severity, overall verdict) to `resources/tickets/{{ticket_id}}/review.md`.
2. Read `resources/ticket-state.json`, set `status` for this ticket to `"reviewed"`, and write the file back.
3. Tell the user the review phase is complete and suggest running `/maestro:next` to continue.
