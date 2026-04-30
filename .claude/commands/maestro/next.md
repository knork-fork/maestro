---
description: Load and run the next workflow phase for a ticket
allowed-tools: Bash
---

Determine the ticket id to work on:
- If a ticket id (format `ticket-YYYY-MM-DD-XXXXXX`) was already established in this conversation, use it.
- Otherwise, invoke `/maestro:pick` now to let the user select one, then use the id it returns before proceeding.

Once you have the ticket id, run:
`node bin/util.js getPhaseForTicket <ticket-id>`

The output is a phase prompt. Follow its instructions exactly.
