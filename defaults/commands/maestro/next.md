---
description: Load and run the next workflow phase for a ticket
allowed-tools: Bash
---

Determine the ticket id to work on:
- If a ticket id (format `ticket-YYYY-MM-DD-XXXXXX`) was passed as an argument to this skill, use it directly — no pick, no confirmation.
- If a ticket id was already established in this conversation, use it.
- Otherwise, invoke `/maestro:pick` now to let the user select one, then use the id it returns before proceeding.

Once you have the ticket id, run:
1. `maestro get-phase <ticket-id>` — outputs the phase prompt for the current phase
2. `maestro get-all-phases <ticket-id>` — outputs all phases in the pipeline with their descriptions
3. `maestro get-conventions-for-ticket <ticket-id>` — index of available conventions as `<path>: <tags>` per line

Use the full pipeline list to understand what belongs to other phases — don't overstep.

## Conventions

The index is candidates only — paths and tags. Don't read convention files at the start of the phase; the timing for reading them is described below.

If the previous phase's artifact lists conventions to apply, read those at the start of the phase so the conversation respects them.

If the index is empty (no `maestro get-conventions-for-ticket` output) and the previous artifact has no conventions to apply, the conventions step doesn't apply for this ticket — skip it. Otherwise, follow the picking process below.

### Picking conventions

After the user agrees on this phase's decisions and before writing the artifact, pick conventions in two steps:

**Step 1 — Shortlist by tag.** Scan the index. Add to a shortlist any convention whose tags overlap with decisions being made in *this phase's artifact specifically* — not the ticket overall. The test: would this convention directly inform something being written or decided right now? A testing convention during a discuss phase doesn't qualify (no tests are being written); the same convention during an execute phase does. When genuinely uncertain, keep it on the shortlist — step 2 resolves it. Drop only conventions that clearly address a different phase's concerns.

**Step 2 — Read the shortlist and select.** Open every file on the shortlist and read it. Tag-relevance gets a convention onto the shortlist; *content* relevance — confirmed by reading — gets it selected. After reading, decide for each:
- *Select* — the convention bears on this phase's work; apply or carry forward per the rules below.
- *Discard* — having read the file, it's not relevant after all. Note which conventions you discarded and why (one phrase each), so the user can verify your judgment.

You may not skip step 2. Concluding "no conventions apply" without opening files is only valid if the shortlist is empty after step 1. If the shortlist has any entries, those files must be read before any conclusion about applicability.

If the shortlist is empty after step 1 (no tags plausibly relate to the work), say so explicitly and proceed without conventions.

To read a convention file, use the path from the index directly under `.maestro/conventions/` — e.g. `common/foo.md` → `.maestro/conventions/common/foo.md`.

For each selected convention:
- If it bears on a decision already made and contradicts it: surface the conflict, ask the user.
- If it bears on later-phase work: add it to the artifact's "conventions to apply" section.

Each phase picks independently. The only cross-phase channel is the artifact's "conventions to apply" section.

## Run the phase

Before executing the phase prompt, run `maestro get-summary <ticket-id>` and note whether its output is empty — call this **needs-summary**.

Follow the phase prompt, applying conventions at the moments described above.

## After the phase

If **needs-summary** is true (summary was empty at the start of this invocation), once the phase is complete run `maestro set-summary <ticket-id> "<summary>"`, where `<summary>` is a ≤ 80-character description of what the ticket accomplishes, derived from what the user described during this phase. Keep it terse and action-oriented (e.g. `"Add --resume flag to maestro CLI"`).
