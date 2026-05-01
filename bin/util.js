#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function getPhaseForTicket(ticketId) {
  const ticketState = JSON.parse(readFileSync(join(root, 'resources/ticket-state.json'), 'utf8'));
  const ticket = JSON.parse(readFileSync(join(root, `resources/tickets/${ticketId}/ticket.json`), 'utf8'));
  const pipelines = JSON.parse(readFileSync(join(root, 'config/pipelines.json'), 'utf8'));
  const phases = JSON.parse(readFileSync(join(root, 'config/phases.json'), 'utf8'));

  const status = ticketState[ticketId]?.status;
  if (!status) throw new Error(`Ticket "${ticketId}" not found in ticket-state.json`);
  if (status === 'done') return `Ticket ${ticketId} is complete. All phases have been finished and the ticket is marked as done.`;

  const pipeline = pipelines.find(p => p.label === ticket.pipeline);
  if (!pipeline) throw new Error(`Pipeline "${ticket.pipeline}" not found in pipelines.json`);
  const steps = pipeline.steps;

  // Build map: status_when_done → phase label
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
      if (status !== 'done') {
        const stateFile = join(root, 'resources/ticket-state.json');
        const state = JSON.parse(readFileSync(stateFile, 'utf8'));
        state[ticketId].status = 'done';
        writeFileSync(stateFile, JSON.stringify(state, null, 2));
      }
      return `Ticket ${ticketId} is complete. All phases have been finished and the ticket is now marked as done.`;
    }
    nextPhase = steps[currentIndex + 1];
    isLastPhase = currentIndex + 1 === steps.length - 1;
  }

  const lastPhaseNote = isLastPhase
    ? '\n\n> **This is the last phase in the pipeline. When complete, set `status` for this ticket to `"done"` in `resources/ticket-state.json`. Do not suggest running `/maestro:next` after completion.**'
    : '';

  const phaseMd = readFileSync(join(root, 'config/phases', `${nextPhase}.md`), 'utf8');
  return phaseMd.replace(/\{\{ticket_id\}\}/g, ticketId) + lastPhaseNote;
}

function exportTicket(ticketId) {
  const ticketDir = join(root, 'resources/tickets', ticketId);
  const stateFile = join(root, 'resources/ticket-state.json');
  const exportsDir = join(root, 'exports');
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
[ ! -d "$DEST/resources/tickets" ] && echo "Error: not a maestro project (missing resources/tickets/)" && exit 1
[ -d "$DEST/resources/tickets/$TICKET_ID" ] && echo "Error: ticket $TICKET_ID already exists in destination" && exit 1

cp -r "$(dirname "$0")/$TICKET_ID" "$DEST/resources/tickets/"
node -e "
  const fs = require('fs');
  const dest = process.argv[1];
  const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const state = JSON.parse(fs.readFileSync(dest, 'utf8'));
  Object.assign(state, src);
  fs.writeFileSync(dest, JSON.stringify(state, null, 2));
" "$DEST/resources/ticket-state.json" "$(dirname "$0")/state.json"
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

function listTickets() {
  let ticketState;
  try {
    ticketState = JSON.parse(readFileSync(join(root, 'resources/ticket-state.json'), 'utf8'));
  } catch {
    ticketState = {};
  }

  const tickets = Object.entries(ticketState).filter(([, state]) => state.status !== 'done').map(([id, state]) => {
    let ticketData = {};
    try {
      ticketData = JSON.parse(readFileSync(join(root, `resources/tickets/${id}/ticket.json`), 'utf8'));
    } catch {
      // ticket.json missing, return state only
    }
    return { id, ...state, ...ticketData };
  });

  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  console.log(JSON.stringify(tickets.slice(0, 5), null, 2)); // pick skill shows at most 5
}

const [,, command, ...args] = process.argv;

const commands = {
  listTickets: () => listTickets(),
  export: () => {
    const [ticketId] = args;
    if (!ticketId) throw new Error('Usage: node bin/util.js export <ticket-id>');
    exportTicket(ticketId);
  },
  getPhaseForTicket: () => {
    const [ticketId] = args;
    if (!ticketId) throw new Error('Usage: node bin/util.js getPhaseForTicket <ticket-id>');
    console.log(getPhaseForTicket(ticketId));
  },
};

if (commands[command]) {
  try {
    commands[command]();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
