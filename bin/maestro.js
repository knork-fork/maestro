#!/usr/bin/env node
import { cpSync, mkdirSync, existsSync, readdirSync, rmSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { homedir } from 'os';
import { createInterface } from 'readline';

const __installDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultsDir = join(__installDir, 'defaults');
const REPO_URL = 'https://raw.githubusercontent.com/knork-fork/maestro/main/install.sh';

const [,, command, ...args] = process.argv;

const maestroDir = join(process.cwd(), '.maestro');

function requireInit() {
  if (!existsSync(maestroDir)) {
    console.error('Error: No .maestro/ folder found in the current directory.\nRun "maestro init" to initialize maestro for this project.');
    process.exit(1);
  }
}

async function main() {
  switch (command) {
    case 'install': {
      const src = join(defaultsDir, 'commands');
      const dest = join(homedir(), '.claude', 'commands');
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
      console.log(`Installed maestro skills to ${dest}`);
      break;
    }

    case 'init': {
      mkdirSync(maestroDir, { recursive: true });
      const configDest = join(maestroDir, 'config');
      const commandsDir = join(defaultsDir, 'commands');
      cpSync(defaultsDir, configDest, {
        recursive: true,
        filter: (src) => !src.startsWith(commandsDir),
      });
      writeFileSync(join(maestroDir, '.gitignore'), 'resources/\nexports/\n');
      console.log(`Initialized maestro in ${maestroDir}`);
      console.log('Run "maestro install" to install Claude Code skills.');
      break;
    }

    case 'update': {
      const result = spawnSync('bash', ['-c', `curl -fsSL ${REPO_URL} | bash`], { stdio: 'inherit' });
      process.exit(result.status ?? 0);
    }

    case 'help': {
      const projectHelp = join(maestroDir, 'config', 'help.md');
      const defaultHelp = join(defaultsDir, 'help.md');
      const helpPath = existsSync(projectHelp) ? projectHelp : defaultHelp;
      console.log(readFileSync(helpPath, 'utf8'));
      break;
    }

    case 'reset': {
      requireInit();
      const resourcesDir = join(maestroDir, 'resources');
      const ticketsDir = join(resourcesDir, 'tickets');
      const stateFile = join(resourcesDir, 'ticket-state.json');
      const tickets = existsSync(ticketsDir)
        ? readdirSync(ticketsDir).filter(f => statSync(join(ticketsDir, f)).isDirectory())
        : [];
      const hasState = existsSync(stateFile);
      if (tickets.length === 0 && !hasState) {
        console.log('Nothing to delete.');
        break;
      }
      console.log('This will permanently delete:');
      if (tickets.length > 0) console.log(`  - ${tickets.length} ticket(s) in .maestro/resources/tickets/`);
      if (hasState) console.log('  - .maestro/resources/ticket-state.json');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      await new Promise(resolve => rl.question('\nProceed? [y/N] ', answer => {
        rl.close();
        if (answer.trim().toLowerCase() !== 'y') { console.log('Aborted.'); resolve(); return; }
        for (const ticket of tickets) rmSync(join(ticketsDir, ticket), { recursive: true, force: true });
        if (hasState) rmSync(stateFile, { force: true });
        console.log('Done.');
        resolve();
      }));
      break;
    }

    case 'list-tickets': {
      requireInit();
      const { listTickets } = await import('./util.js');
      listTickets();
      break;
    }

    case 'get-phase': {
      requireInit();
      const [ticketId] = args;
      if (!ticketId) { console.error('Usage: maestro get-phase <ticket-id>'); process.exit(1); }
      const { getPhaseForTicket } = await import('./util.js');
      console.log(getPhaseForTicket(ticketId));
      break;
    }

    case 'get-all-phases': {
      requireInit();
      const [ticketId] = args;
      if (!ticketId) { console.error('Usage: maestro get-all-phases <ticket-id>'); process.exit(1); }
      const { getAllPhasesForTicket } = await import('./util.js');
      console.log(getAllPhasesForTicket(ticketId));
      break;
    }

    case 'export': {
      requireInit();
      const [ticketId] = args;
      if (!ticketId) { console.error('Usage: maestro export <ticket-id>'); process.exit(1); }
      const { exportTicket } = await import('./util.js');
      exportTicket(ticketId);
      break;
    }

    case 'launch': {
      requireInit();
      const launchPath = join(dirname(fileURLToPath(import.meta.url)), 'launch-detached.js');
      const result = spawnSync('node', [launchPath], { stdio: 'inherit' });
      process.exit(result.status ?? 0);
    }

    case undefined:
    case '--help':
    case '-h': {
      const projectHelp = join(maestroDir, 'config', 'help.md');
      const defaultHelp = join(defaultsDir, 'help.md');
      const helpPath = existsSync(projectHelp) ? projectHelp : defaultHelp;
      if (existsSync(helpPath)) console.log(readFileSync(helpPath, 'utf8'));
      else console.log('maestro — AI workflow orchestrator\nRun "maestro init" in your project to get started.');
      break;
    }

    default: {
      console.error(`Unknown command: ${command}\nRun "maestro help" for usage.`);
      process.exit(1);
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
