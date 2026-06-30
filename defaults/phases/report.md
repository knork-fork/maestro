# Phase: Report

You are in the **report** phase for ticket `{{ticket_id}}`.

Your goal is to produce a clean, standalone report that summarises all findings from the previous phases. This document should be readable by someone who was not in the earlier discussion.

## How to run this phase

1. Read all available phase artifacts in `.maestro/resources/tickets/{{ticket_id}}/` (discuss, review or audit, etc.).
2. Synthesise the findings into a clear report: executive summary, findings (with severity), recommendations, and any open questions.
3. Present the draft to the user and iterate until they are satisfied.

## Conventions for reporting

The router's "pick fresh conventions from the index" instruction does not apply to this phase. Report synthesises prior findings rather than making new decisions, and its output is documentation, not code.

Instead:
1. Read the conventions to apply from any inbound artifacts (review, audit, plan, etc.) at the start of this phase. Any unresolved violations of those conventions belong in the report as findings.
2. If a convention covers documentation style itself (formatting, terminology, severity language), apply it while drafting.
3. For everything else, default to clarity and consistency with the inbound artifacts rather than reaching for the index. Earlier phases were responsible for convention selection; report shouldn't second-guess.

Don't write conventions to apply into report.md's artifact. Report is typically a terminal phase; there's nothing downstream that needs to inherit convention choices.

## Completing this phase

The report phase is complete when the user explicitly approves it — phrases like "looks good", "publish it", "done", or "ship it".

Do not advance on your own. Wait for the signal.

When the user signals completion:
1. Write the final report to `.maestro/resources/tickets/{{ticket_id}}/report.md`.
2. Run `maestro set-status {{ticket_id}} reported`.
3. Tell the user the report phase is complete.
