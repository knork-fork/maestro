---
description: Zip a ticket and prepare it for import into another maestro installation
allowed-tools: Bash
---

Determine the ticket id to work on:
- If a ticket id (format `ticket-YYYY-MM-DD-XXXXXX`) was already established in this conversation, use it.
- Otherwise, invoke `/maestro:pick` now to let the user select one, then use the id it returns before proceeding.

Once you have the ticket id, run:
`maestro export <ticket-id>`

Report the output zip path to the user. Also tell them:
- Unzip the archive first, then run `bash import.sh <path-to-destination-maestro-project>` from inside the unzipped folder.
- `import.sh` requires Node.js to be available at the destination.
