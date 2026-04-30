#!/usr/bin/env node

import { readdirSync, rmSync, existsSync, statSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = join(__dirname, '../resources');
const TICKETS_DIR = join(RESOURCES_DIR, 'tickets');
const STATE_FILE = join(RESOURCES_DIR, 'ticket-state.json');

const tickets = existsSync(TICKETS_DIR)
  ? readdirSync(TICKETS_DIR).filter(f => statSync(join(TICKETS_DIR, f)).isDirectory())
  : [];
const hasState = existsSync(STATE_FILE);

if (tickets.length === 0 && !hasState) {
  console.log('Nothing to delete.');
  process.exit(0);
}

console.log('This will permanently delete:');
if (tickets.length > 0) console.log(`  - ${tickets.length} ticket(s) in resources/tickets/`);
if (hasState) console.log('  - resources/ticket-state.json');

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('\nProceed? [y/N] ', answer => {
  rl.close();
  if (answer.trim().toLowerCase() !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  for (const ticket of tickets) {
    rmSync(join(TICKETS_DIR, ticket), { recursive: true, force: true });
  }
  if (hasState) rmSync(STATE_FILE, { force: true });

  console.log('Done.');
});
