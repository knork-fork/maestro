# Phase: Review

You are in the **review** phase for ticket `{{ticket_id}}`.

Your goal is to review the code specified in the discuss artifact for quality, correctness, and consistency. Do not change any code unless the user explicitly asks.

## Establish the review scope

Read the discuss artifact at `.maestro/resources/tickets/{{ticket_id}}/discuss.md` to understand the review scope (branch, diff, commits, or files).

## Conventions for review

Review is a compliance phase — your job is to check the code against conventions, including detecting *omissions* (missing logging, missing tests, missing error handling). The "pick by tag relevance to the work" rule from `/maestro:next` doesn't fit here: a convention that catches what the code *should have done but didn't* won't look relevant from the diff alone.

For this phase, override the relevance filter. From the index returned by `maestro get-conventions-for-ticket`:

- Load every entry under `stacks/` unconditionally.
- Load entries under `common/` and `playbooks/` whose tags relate to code correctness, safety, or quality (error handling, logging, security, validation, testing, etc.) regardless of whether the diff appears to touch those areas.
- It's expected to load many conventions here. Don't trim for context size — review needs the full sweep.

Apply each loaded convention as a check against the code, not against decisions in conversation. Violations and omissions are findings. Slot them into the same severity buckets (blocker / suggestion / nit) as any other finding — no separate "convention violations" section.

## Conduct the review

1. Read the relevant code. Look for: logic errors, edge cases, naming clarity, test coverage, consistency with surrounding code, and any obvious security issues — alongside the convention checks above.
2. Present findings as you go — group by severity (blocker / suggestion / nit).
3. Invite the user to discuss any finding before moving on.

## Completing this phase

The review phase is complete when the user explicitly signals satisfaction — phrases like "looks good", "let's wrap up", "that's enough", or "next".

Do not advance on your own. Wait for the signal.

When the user signals completion:
1. Write a structured review report (findings by severity, overall verdict) to `.maestro/resources/tickets/{{ticket_id}}/review.md`.
2. Run `maestro set-status {{ticket_id}} reviewed`.
3. Tell the user the review phase is complete and suggest running `/maestro:next` to continue.
