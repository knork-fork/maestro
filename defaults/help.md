maestro — AI workflow orchestrator

Commands:
  /maestro               Show this help message
  /maestro:help          Show this help message
  /maestro:start         Launch the ticket wizard in a new terminal window
  /maestro:pick          Interactively pick a ticket to work on
  /maestro:pick <id>     Jump straight to a specific ticket by id
  /maestro:next          Continue work on the current ticket

The ticket wizard guides you through configuring a Claude workflow:
selecting a pipeline type, target stack, quality gates, and plan strictness.
Steps are defined in config/wizard.json and picked up automatically.

To resume work on an open ticket, run:
  maestro resume

This shows a numbered list of open tickets (with their summaries when available),
lets you pick one, and launches Claude Code to continue work on it.

Each ticket folder also contains a resume.sh you can run directly to reopen
Claude for that specific ticket:
  .maestro/resources/tickets/<ticket-id>/resume.sh
