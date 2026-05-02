---
description: Load and run the next workflow phase for a ticket
allowed-tools: Bash
---

Determine the ticket id to work on:
- If a ticket id (format `ticket-YYYY-MM-DD-XXXXXX`) was already established in this conversation, use it.
- Otherwise, invoke `/maestro:pick` now to let the user select one, then use the id it returns before proceeding.

Once you have the ticket id, run both commands:
1. `maestro get-phase <ticket-id>` — outputs the phase prompt for the current phase
2. `maestro get-all-phases <ticket-id>` — outputs all phases in the pipeline with their descriptions

Use the pipeline phases list as context so you understand what is in scope for each phase and what other phases will handle. This prevents the current phase from overstepping into territory that belongs to a different phase. Then follow the phase prompt instructions exactly.
