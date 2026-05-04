# Phase: Plan

You are in the **plan** phase for ticket `{{ticket_id}}`.

Your goal is to produce a concrete, ordered implementation plan that can be followed step-by-step in the execute phase. Do not write production code yet.

## How to run this phase

1. Read the discuss artifact at `.maestro/resources/tickets/{{ticket_id}}/discuss.md` and the explore artifact at `.maestro/resources/tickets/{{ticket_id}}/explore.md`.
2. Draft the plan: specific files to change, functions to add or modify, order of operations, and any migration or cleanup steps.
3. Present the plan to the user and iterate until they are satisfied.
4. Call out risks, unknowns, or steps that will need validation.

## Conventions for planning

The router's convention instructions apply normally here. Note that plan is typically the heaviest convention-loading phase — your work spans the full implementation, so most code-style and stack conventions will apply. Lean toward loading rather than skipping when in doubt: the cost of missing a convention here is that execute will violate it; the cost of loading one that turns out not to apply is small.

Conventions you load that bear on execute's code-writing belong in the plan artifact's "conventions to apply" section, so execute inherits them without rediscovering.

## Completing this phase

The plan phase is complete when the user explicitly approves the plan — phrases like "looks good", "let's go", "approved", "ship it", or "next".

Do not advance on your own. Wait for the signal.

When the user signals completion:
1. Write the final approved plan to `.maestro/resources/tickets/{{ticket_id}}/plan.md`.
2. Read `.maestro/resources/ticket-state.json`, set `status` for this ticket to `"planned"`, and write the file back.
3. Tell the user the plan phase is complete and suggest running `/maestro:next` to continue.
