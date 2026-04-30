---
description: Continue work on a ticket — summarises ticket.json
allowed-tools: Bash
---

Determine the ticket id to work on:
- If a ticket id (format `ticket-YYYY-MM-DD-XXXXXX`) was already established in this conversation, use it.
- Otherwise, invoke `/maestro:pick` now to let the user select one, then use the id it returns before proceeding.

Once you have the ticket id, read its file with the Bash tool:
`cat resources/tickets/<ticket-id>/ticket.json`

Present the ticket contents as a concise human-readable summary — one line per field, no raw JSON.
Do not speculate about what workflow steps follow.
