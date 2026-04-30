---
description: Pick a ticket to work on
allowed-tools: Bash, AskUserQuestion
---

This skill accepts an optional ticket id argument (e.g. `/maestro:pick ticket-2026-04-30-a1b2c3`).

**If a ticket id was passed as an argument**: skip the interactive flow entirely — treat that ticket as the confirmed choice and output `MAESTRO_TICKET=<id>`.

**Otherwise**, gather context by running these two commands:

!`node bin/util.js listTickets`

!`git branch --show-current`

Using that output:

1. Tickets are already sorted by `createdAt` descending. The first is the most recently created.
2. All ticket details are included in the `listTickets` output — do not read any additional files.
3. Offer the most recently created ticket using `AskUserQuestion`. The question should be "Continue ticket `<id>`?" and if `branch` differs from the current branch, add a description "(created on `<ticket-branch>`, you're currently on `<current-branch>`)". Use header "Ticket" and options: "Continue" and "No".

4. If the user picks "Continue":
   - Output `MAESTRO_TICKET=<id>` so the caller can pick it up.

5. If the user picks "No":
   Use `AskUserQuestion` with question "What would you like to do?", header "Action", and options:
   - "Pick a different ticket"
   - "Start a new ticket"
   - "Cancel"

   - **Pick a different ticket**: List up to 5 tickets in prose, sorted by `createdAt` descending, with number, id, creation time (relative), branch, and a one-line summary of the ticket fields. Use `AskUserQuestion` to let the user pick one by label. Once they pick one, output `MAESTRO_TICKET=<chosen-id>`.
   - **Start a new ticket**: invoke `/maestro:start`.
   - **Cancel**: stop, say nothing further.
