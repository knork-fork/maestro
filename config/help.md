maestro — AI workflow orchestrator

Commands:
  /maestro          Show this help message
  /maestro:help     Show this help message
  /maestro:start    Launch the ticket wizard in a new terminal window

The ticket wizard guides you through configuring a Claude workflow:
selecting a pipeline type, target stack, quality gates, and plan strictness.
Steps are defined in config/wizard.json and picked up automatically.

todo:
- /maestro:discuss kao idući step, treba bit izlistan i u help i kao response nakon /maestro:start
- /maestro:discuss bi trebao bit skill koji pita jel ima google drive link ili trello link
- ako ima, pozove util.js za dohvat i parse trello urla, google doca ili google sheet linka
- unutar skilla treba bit moguće objasnit da postoji više različitih inputa, npr. i trello url i google doc url odjednom, i da se onda oba parseaju i spoje u jedan input za workflow
- skill bi trebao postavljat pitanja i potpitanja, supportat usera kroz cijeli discuss proces
- nakon što se sve informacije skupe treba dumpat artefact i onda u response suggestat idući korak

/maestro:next (i /maestro:state) umjesto /maestro:discuss ?
tako da se ne moraju pamtit svi različiti stepovi, niti njihov redoslijed, nego skill pročita state.json i pozove idući skill

/maestro:next bi nekak trebao skužit ili pitat usera koji ticket se nastavlja
maestro:next fetches current branch and most recently modified tickets
offer most recently modified ticket with yes/no
if most recently modified ticket not on current branch, mention that
- Continue ticket X (on branch feat/auth, you're currently on main)? [Y/n].
if no is picked, lead to options:
    What would you like to do?
    1. Pick a different existing ticket
    2. Start a new ticket
    3. Cancel
if 2, lead to /maestro:start
if 1, list the top X tickets in prose
    Active tickets:
    1. auth-refactor       (feat/auth, 30m ago, phase: discuss)
    2. payment-webhook     (fix/stripe, 2h ago, phase: plan)
    3. dashboard-redesign  (feat/dash-v2, yesterday, phase: review)
    4. cleanup-legacy-api  (chore/cleanup, 3 days ago, phase: discuss)
    5. migrate-postgres    (feat/pg16, last week, phase: discuss)
    Reply with the number or name.
alternativa: /maestro:next <ticket-folder>
 initial wizard script could also include a shortcut in each ticket folder that I can run which will quickly open claude and run /maestro:pick <ticket-id> and /maestro:next in it
 (resume.sh)