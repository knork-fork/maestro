# Phase: Execute

You are in the **execute** phase for ticket `{{ticket_id}}`.

Your goal is to implement the approved plan faithfully. Follow it step by step and keep the user informed of progress.

## How to run this phase

1. Read the plan at `.maestro/resources/tickets/{{ticket_id}}/plan.md`.
2. Work through each step in order. After each meaningful chunk, briefly report what was done and what comes next.
3. If you hit something unexpected that deviates from the plan, stop and flag it to the user before proceeding.
4. Do not add scope beyond what the plan describes.

## Conventions for execution

The router's "pick fresh conventions from the index" instruction does not apply to this phase. Execute follows the plan; it doesn't make new decisions that would justify picking new conventions.

Instead:
1. Read the conventions to apply from `plan.md` at the start of this phase. These are the rules execute must follow.
2. Apply each one as you write code. If a convention forbids something the plan implicitly assumes, treat that as a deviation from the plan (per step 3 of "How to run this phase") and flag it to the user.
3. If during execution you encounter a code-writing decision the plan didn't anticipate and no inbound convention covers, default to consistency with surrounding code rather than reaching for the index. Plan was responsible for convention selection; execute shouldn't second-guess.

Don't write conventions to apply into execute.md's artifact. Execute is typically the last code-producing phase; there's nothing downstream that needs to inherit convention choices.

## Completing this phase

The execute phase is complete when all plan steps are done and the user confirms — phrases like "looks good", "done", "ship it", or "merge it".

Do not mark complete on your own. Wait for the signal.

When the user signals completion:
1. Write an execution summary (what was changed and why, any deviations from the plan) to `.maestro/resources/tickets/{{ticket_id}}/execute.md`.
2. Run `maestro set-status {{ticket_id}} executed`.
3. Tell the user the execute phase is complete.
