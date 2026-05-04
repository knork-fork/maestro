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

Each ticket folder contains a resume.sh you can run directly to reopen
Claude and immediately continue that ticket:
  .maestro/resources/tickets/<ticket-id>/resume.sh
