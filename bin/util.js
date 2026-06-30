#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const root = process.cwd();

const stateFilePath = join(root, '.maestro/resources/ticket-state.json');

function readState() {
  return JSON.parse(readFileSync(stateFilePath, 'utf8'));
}

function writeState(state) {
  writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
}

// Sets the status field for a ticket. Validates the status against the allowed set
// ('created', 'done', plus every status_when_done in phases.json) so typos are caught.
export function setTicketStatus(ticketId, status) {
  const phases = JSON.parse(readFileSync(join(root, '.maestro/config/phases.json'), 'utf8'));
  const validStatuses = new Set(['created', 'done', ...phases.map(p => p.status_when_done)]);
  if (!validStatuses.has(status)) {
    throw new Error(`Invalid status "${status}". Valid statuses: ${[...validStatuses].join(', ')}`);
  }
  const state = readState();
  if (!state[ticketId]) throw new Error(`Ticket "${ticketId}" not found in ticket-state.json`);
  state[ticketId].status = status;
  writeState(state);
}

// Sets the summary field for a ticket.
export function setTicketSummary(ticketId, summary) {
  const state = readState();
  if (!state[ticketId]) throw new Error(`Ticket "${ticketId}" not found in ticket-state.json`);
  state[ticketId].summary = summary;
  writeState(state);
}

// Returns the summary for a ticket, or an empty string if none is set.
export function getTicketSummary(ticketId) {
  const state = readState();
  if (!state[ticketId]) throw new Error(`Ticket "${ticketId}" not found in ticket-state.json`);
  return state[ticketId].summary ?? '';
}

// Returns the full markdown prompt for the next phase to execute (reads the .md file).
export function getPhaseForTicket(ticketId) {
  const ticketState = JSON.parse(readFileSync(join(root, '.maestro/resources/ticket-state.json'), 'utf8'));
  const ticket = JSON.parse(readFileSync(join(root, `.maestro/resources/tickets/${ticketId}/ticket.json`), 'utf8'));
  const pipelines = JSON.parse(readFileSync(join(root, '.maestro/config/pipelines.json'), 'utf8'));
  const phases = JSON.parse(readFileSync(join(root, '.maestro/config/phases.json'), 'utf8'));

  const status = ticketState[ticketId]?.status;
  if (!status) throw new Error(`Ticket "${ticketId}" not found in ticket-state.json`);
  if (status === 'done') return `Ticket ${ticketId} is complete. All phases have been finished and the ticket is marked as done.`;

  const pipeline = pipelines.find(p => p.label === ticket.pipeline);
  if (!pipeline) throw new Error(`Pipeline "${ticket.pipeline}" not found in pipelines.json`);
  const steps = pipeline.steps;

  const statusToPhase = {};
  for (const phase of phases) {
    statusToPhase[phase.status_when_done] = phase.label;
  }

  let nextPhase;
  let isLastPhase = false;
  if (status === 'created') {
    nextPhase = steps[0];
    isLastPhase = steps.length === 1;
  } else {
    const currentPhase = statusToPhase[status];
    const currentIndex = steps.indexOf(currentPhase);
    if (currentIndex === -1) {
      throw new Error(`Phase for status "${status}" not found in pipeline steps: ${steps.join(', ')}`);
    }
    if (currentIndex >= steps.length - 1) {
      if (status !== 'done') setTicketStatus(ticketId, 'done');
      return `Ticket ${ticketId} is complete. All phases have been finished and the ticket is now marked as done.`;
    }
    nextPhase = steps[currentIndex + 1];
    isLastPhase = currentIndex + 1 === steps.length - 1;
  }

  const lastPhaseNote = isLastPhase
    ? `\n\n> **This is the last phase in the pipeline. When complete, run \`maestro set-status ${ticketId} done\`. Do not suggest running \`/maestro:next\` after completion.**`
    : '';

  const phaseMd = readFileSync(join(root, '.maestro/config/phases', `${nextPhase}.md`), 'utf8');
  return phaseMd.replace(/\{\{ticket_id\}\}/g, ticketId) + lastPhaseNote;
}

// Returns a JSON summary of all phases in the ticket's pipeline (label + description only, no .md content).
// Used to give the active phase context about what other phases handle, so it doesn't overstep.
export function getAllPhasesForTicket(ticketId) {
  const ticket = JSON.parse(readFileSync(join(root, `.maestro/resources/tickets/${ticketId}/ticket.json`), 'utf8'));
  const pipelines = JSON.parse(readFileSync(join(root, '.maestro/config/pipelines.json'), 'utf8'));
  const phases = JSON.parse(readFileSync(join(root, '.maestro/config/phases.json'), 'utf8'));

  const pipeline = pipelines.find(p => p.label === ticket.pipeline);
  if (!pipeline) throw new Error(`Pipeline "${ticket.pipeline}" not found in pipelines.json`);

  const phaseMap = Object.fromEntries(phases.map(p => [p.label, p]));

  const steps = pipeline.steps.map(stepLabel => {
    const phase = phaseMap[stepLabel];
    if (!phase) throw new Error(`Phase "${stepLabel}" not found in phases.json`);
    return { label: phase.label, description: phase.description };
  });

  return JSON.stringify({ pipeline: pipeline.label, steps }, null, 2);
}

// Returns a CSV-like string of conventions relevant to the ticket: one row per line as `<path>: <tag>, <tag>, ...`.
// Includes all common[] entries, all playbooks[] entries, and stacks[] entries living in the ticket's stack
// directory or any of its ancestor directories. The stack directory comes from ticket['stack-path'] (a relative
// path like "stacks/backend/symfony"); when absent it falls back to lowercase(ticket.stack) matched by folder name.
export function getConventionsForTicket(ticketId) {
  const ticket = JSON.parse(readFileSync(join(root, `.maestro/resources/tickets/${ticketId}/ticket.json`), 'utf8'));
  const index = JSON.parse(readFileSync(join(root, '.maestro/conventions/index.json'), 'utf8'));
  const stack = ticket.stack;
  const stackPath = ticket['stack-path'];

  const rows = [];
  const emit = entry => rows.push(`${entry.path}: ${entry.tags.join(', ')}`);

  for (const entry of index.common ?? []) emit(entry);
  if (stack || stackPath) {
    const stacks = index.stacks ?? [];

    // Leaf stack folder path(s) whose conventions apply. Prefer the explicit stack-path;
    // otherwise fall back to lowercase(stack) matched by folder name (backwards compatibility).
    const stackFolderPaths = new Set();
    if (stackPath) {
      stackFolderPaths.add(stackPath.replace(/\/+$/, '').toLowerCase());
    } else {
      const stackLower = stack.toLowerCase();
      for (const e of stacks) {
        const parts = e.path.split('/');
        if (parts[parts.length - 2].toLowerCase() === stackLower)
          stackFolderPaths.add(parts.slice(0, -1).join('/').toLowerCase());
      }
    }

    // Expand each leaf to itself + all ancestor directories so that conventions at every
    // enclosing scope (e.g. stacks/backend/symfony/ and stacks/backend/) are included.
    const applicableDirs = new Set();
    for (const folderPath of stackFolderPaths) {
      const parts = folderPath.split('/');
      for (let i = parts.length; i >= 1; i--) applicableDirs.add(parts.slice(0, i).join('/'));
    }

    for (const e of stacks) {
      const containingFolderPath = e.path.split('/').slice(0, -1).join('/').toLowerCase();
      if (applicableDirs.has(containingFolderPath)) emit(e);
    }
  }
  for (const entry of index.playbooks ?? []) emit(entry);

  return rows.join('\n');
}

export function exportTicket(ticketId) {
  const ticketDir = join(root, '.maestro/resources/tickets', ticketId);
  const stateFile = join(root, '.maestro/resources/ticket-state.json');
  const exportsDir = join(root, '.maestro/exports');
  const outputZip = join(exportsDir, `${ticketId}.zip`);
  const stagingDir = join(exportsDir, `_staging_${ticketId}`);

  const fullState = JSON.parse(readFileSync(stateFile, 'utf8'));
  const ticketState = { [ticketId]: fullState[ticketId] };

  const importSh = `#!/usr/bin/env bash
set -e
DEST="$1"
TICKET_ID="${ticketId}"

[ -z "$DEST" ] && echo "Usage: bash import.sh <path-to-maestro-project>" && exit 1
[ ! -d "$DEST" ] && echo "Error: destination path does not exist" && exit 1
[ ! -d "$DEST/.maestro/resources/tickets" ] && echo "Error: not a maestro project (missing .maestro/resources/tickets/)" && exit 1
[ -d "$DEST/.maestro/resources/tickets/$TICKET_ID" ] && echo "Error: ticket $TICKET_ID already exists in destination" && exit 1

cp -r "$(dirname "$0")/$TICKET_ID" "$DEST/.maestro/resources/tickets/"
node -e "
  const fs = require('fs');
  const dest = process.argv[1];
  const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const state = JSON.parse(fs.readFileSync(dest, 'utf8'));
  Object.assign(state, src);
  fs.writeFileSync(dest, JSON.stringify(state, null, 2));
" "$DEST/.maestro/resources/ticket-state.json" "$(dirname "$0")/state.json"
echo "Imported $TICKET_ID into $DEST"
`;

  mkdirSync(stagingDir, { recursive: true });
  try {
    cpSync(ticketDir, join(stagingDir, ticketId), { recursive: true });
    writeFileSync(join(stagingDir, 'state.json'), JSON.stringify(ticketState, null, 2));
    writeFileSync(join(stagingDir, 'import.sh'), importSh);
    execSync(`zip -r "${outputZip}" .`, { cwd: stagingDir });
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }

  console.log(outputZip);
}

export function listTickets() {
  let ticketState;
  try {
    ticketState = JSON.parse(readFileSync(join(root, '.maestro/resources/ticket-state.json'), 'utf8'));
  } catch {
    ticketState = {};
  }

  const tickets = Object.entries(ticketState).filter(([, state]) => state.status !== 'done').map(([id, state]) => {
    let ticketData = {};
    try {
      ticketData = JSON.parse(readFileSync(join(root, `.maestro/resources/tickets/${id}/ticket.json`), 'utf8'));
    } catch {
      // ticket.json missing, return state only
    }
    return { id, ...state, ...ticketData };
  });

  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  console.log(JSON.stringify(tickets.slice(0, 5), null, 2));
}
