---
description: Launch the maestro wizard in a new detached terminal window
allowed-tools: Bash
---

Launch the maestro wizard in a new terminal window so it has a real TTY. Control returns here immediately; the wizard runs independently in its own window.

!`maestro launch`

When the command returns:
1. Scan the output for a line in the exact format `MAESTRO_TICKET=ticket-YYYY-MM-DD-XXXXXX` (e.g. `MAESTRO_TICKET=ticket-2026-04-30-a1b2c3`). Extract everything after the `=` as the ticket id.
2. If found, tell the user: "The wizard created ticket `<ticket-id>`. You can continue with it by running `/maestro:next`." Then ask: "Would you like me to run `/maestro:next` now?"
3. If the user says yes (or anything affirmative), invoke the `/maestro:next` skill.
4. If no such line is found, tell the user the wizard finished without creating a ticket and ask what they'd like to do next.
