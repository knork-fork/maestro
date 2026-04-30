#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function getPhaseForTicket(ticketId) {
  const ticketState = JSON.parse(readFileSync(join(root, 'resources/ticket-state.json'), 'utf8'));
  const ticket = JSON.parse(readFileSync(join(root, `resources/tickets/${ticketId}/ticket.json`), 'utf8'));
  const pipelines = JSON.parse(readFileSync(join(root, 'config/pipelines.json'), 'utf8'));
  const phases = JSON.parse(readFileSync(join(root, 'config/phases.json'), 'utf8'));

  const status = ticketState[ticketId]?.status;
  if (!status) throw new Error(`Ticket "${ticketId}" not found in ticket-state.json`);

  const pipeline = pipelines.find(p => p.label === ticket.pipeline);
  if (!pipeline) throw new Error(`Pipeline "${ticket.pipeline}" not found in pipelines.json`);
  const steps = pipeline.steps;

  // Build map: status_when_done → phase label
  const statusToPhase = {};
  for (const phase of phases) {
    statusToPhase[phase.status_when_done] = phase.label;
  }

  let nextPhase;
  if (status === 'created') {
    nextPhase = steps[0];
  } else {
    const currentPhase = statusToPhase[status];
    const currentIndex = steps.indexOf(currentPhase);
    if (currentIndex === -1) {
      throw new Error(`Phase for status "${status}" not found in pipeline steps: ${steps.join(', ')}`);
    }
    if (currentIndex >= steps.length - 1) {
      throw new Error(`All phases complete for ticket ${ticketId}`);
    }
    nextPhase = steps[currentIndex + 1];
  }

  const phaseMd = readFileSync(join(root, 'config/phases', `${nextPhase}.md`), 'utf8');
  return phaseMd.replace(/\{\{ticket_id\}\}/g, ticketId);
}

function listTickets() {
  let ticketState;
  try {
    ticketState = JSON.parse(readFileSync(join(root, 'resources/ticket-state.json'), 'utf8'));
  } catch {
    ticketState = {};
  }

  const tickets = Object.entries(ticketState).map(([id, state]) => {
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

if (command === 'listTickets') {
  try {
    listTickets();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
} else if (command === 'getPhaseForTicket') {
  const [ticketId] = args;
  if (!ticketId) {
    console.error('Usage: node bin/util.js getPhaseForTicket <ticket-id>');
    process.exit(1);
  }
  try {
    console.log(getPhaseForTicket(ticketId));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
