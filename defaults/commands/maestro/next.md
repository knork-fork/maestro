---
description: Load and run the next workflow phase for a ticket
allowed-tools: Bash
---

Determine the ticket id to work on:
- If a ticket id (format `ticket-YYYY-MM-DD-XXXXXX`) was already established in this conversation, use it.
- Otherwise, invoke `/maestro:pick` now to let the user select one, then use the id it returns before proceeding.

Once you have the ticket id, run:
1. `maestro get-phase <ticket-id>` — outputs the phase prompt for the current phase
2. `maestro get-all-phases <ticket-id>` — outputs all phases in the pipeline with their descriptions
3. `maestro get-conventions-for-ticket <ticket-id>` — index of available conventions as `<path>: <tags>` per line

Use the full pipeline list to understand what belongs to other phases — don't overstep.

## Conventions

The index is candidates only — paths and tags. Don't read any files yet.

If the previous phase's artifact lists conventions to apply, read those at the start of the phase so the conversation respects them.

Pick fresh conventions from the index *after* the user agrees on this phase's decisions, *before* writing the artifact. Picking earlier wastes context on rules that may not apply.

Pick by tag relevance to the work actually happening — not topical adjacency. Load many small conventions if many apply; load none if none do. The test is per-convention: would this directly inform a decision in this phase?

To read a convention file, use the path from the index directly under `.maestro/conventions/` — e.g. `common/foo.md` → `.maestro/conventions/common/foo.md`.

For each picked convention:
- If it bears on a decision already made and contradicts it: surface the conflict, ask the user.
- If it bears on later-phase work: add it to the artifact's "conventions to apply" section.

Each phase picks independently. The only cross-phase channel is the artifact's "conventions to apply" section.

If the index is empty and the previous artifact has no conventions to apply, skip this section.

## Run the phase

Follow the phase prompt, applying conventions at the moments described above.
