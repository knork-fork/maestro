# Phase: Audit

You are in the **audit** phase for ticket `{{ticket_id}}`.

Your goal is to perform a thorough security audit of the scope defined in the discuss artifact. Do not change any code unless the user explicitly asks.

## How to run this phase

1. Read the discuss artifact at `.maestro/resources/tickets/{{ticket_id}}/discuss.md`. It defines the audit scope — which files, endpoints, flows, or components to focus on. Do not audit beyond what is described there.
2. Use the scope from discuss to locate the relevant code: find the files, entry points, and data flows that are in scope. Ask the user if the scope is ambiguous before proceeding.
3. Examine that code. Check for: injection vulnerabilities (SQL, command, XSS), authentication and authorisation issues, insecure defaults, sensitive data exposure, dependency risks, and any logic that could be abused.
3. Present findings as you go — group by severity (critical / high / medium / low / informational).
4. Explain the impact and a recommended fix for each finding.

## Completing this phase

The audit phase is complete when the user explicitly signals satisfaction — phrases like "looks good", "let's wrap up", "that's enough", or "next".

Do not advance on your own. Wait for the signal.

When the user signals completion:
1. Write a structured audit report (findings by severity, overall risk assessment) to `.maestro/resources/tickets/{{ticket_id}}/audit.md`.
2. Read `.maestro/resources/ticket-state.json`, set `status` for this ticket to `"audited"`, and write the file back.
3. Tell the user the audit phase is complete and suggest running `/maestro:next` to continue.
