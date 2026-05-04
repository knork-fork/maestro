#!/usr/bin/env node
import { cpSync, mkdirSync, existsSync, lstatSync, readdirSync, rmSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { homedir } from 'os';
import { createInterface } from 'readline';

const __installDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultsDir = join(__installDir, 'defaults');

const USAGE = `maestro — AI workflow orchestrator

Usage: maestro <command>

Commands:
  init          Initialize .maestro/ in the current project
  update        Check for a newer release and update if available
  version       Print the installed version
  help          Show this help message
  reset         Delete all tickets in the current project
  uninstall     Remove the binary, skills, and ~/.maestro/`;

const [,, command, ...args] = process.argv;

const maestroDir = join(process.cwd(), '.maestro');

function requireInit() {
  if (!existsSync(maestroDir)) {
    console.error('Error: No .maestro/ folder found in the current directory.\nRun "maestro init" to initialize maestro for this project.');
    process.exit(1);
  }
}

function isDevMode() {
  const installLink = join(homedir(), '.maestro');
  try { return lstatSync(installLink).isSymbolicLink(); } catch { return false; }
}

function getLocalVersion() {
  const versionFile = join(__installDir, 'version.txt');
  if (existsSync(versionFile)) return readFileSync(versionFile, 'utf8').trim();
  const pkg = JSON.parse(readFileSync(join(__installDir, 'package.json'), 'utf8'));
  return pkg.version;
}

// Strip leading 'v', split core from pre-release label, compare numerically.
// Returns -1 | 0 | 1.
function compareSemver(a, b) {
  const parse = s => {
    const clean = s.replace(/^v/, '');
    const [core, pre] = clean.split('-');
    return { parts: core.split('.').map(Number), pre: pre ?? null };
  };
  const va = parse(a), vb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (va.parts[i] ?? 0) - (vb.parts[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  // Equal cores: pre-release is lower than release (semver spec)
  if (va.pre !== null && vb.pre === null) return -1;
  if (va.pre === null && vb.pre !== null) return 1;
  return 0;
}

function prompt(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

async function fetchLatestTag() {
  const headers = { 'User-Agent': 'maestro-cli' };

  // Try releases/latest first
  const relRes = await fetch('https://api.github.com/repos/knork-fork/maestro/releases/latest', { headers });
  if (relRes.ok) {
    const data = await relRes.json();
    if (data.tag_name) return data.tag_name;
  }

  // Fall back to tags list
  const tagRes = await fetch('https://api.github.com/repos/knork-fork/maestro/tags', { headers });
  if (tagRes.ok) {
    const tags = await tagRes.json();
    if (Array.isArray(tags) && tags.length > 0) return tags[0].name;
  }

  return null;
}

async function main() {
  switch (command) {
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
      break;
    }

    case 'version': {
      if (isDevMode()) { console.log('maestro DEV VERSION'); break; }
      const v = getLocalVersion();
      console.log(`maestro ${v}`);
      break;
    }

    case 'update': {
      if (isDevMode()) {
        console.error('Error: cannot update in dev mode. Run dev.sh --release to switch to the release version, or just git pull.');
        process.exit(1);
      }
      const localVersion = getLocalVersion();
      let latestTag = null;

      try {
        latestTag = await fetchLatestTag();
      } catch {
        // network failure
      }

      if (!latestTag) {
        const answer = await prompt('Warning: Could not check latest version. Proceed with update anyway? [y/N] ');
        if (answer.toLowerCase() !== 'y') { console.log('Aborted.'); break; }
      } else {
        const cmp = compareSemver(localVersion, latestTag);
        if (cmp >= 0) {
          console.log(`Already up to date (${localVersion}).`);
          break;
        }
        console.log(`Updating from ${localVersion} → ${latestTag}...`);
      }

      const tag = latestTag ?? 'main';
      const installUrl = `https://raw.githubusercontent.com/knork-fork/maestro/${tag}/install.sh`;
      const result = spawnSync('bash', ['-c', `curl -fsSL ${installUrl} | bash`], { stdio: 'inherit' });
      process.exit(result.status ?? 0);
    }

    case 'help': {
      console.log(USAGE);
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
      const answer = await prompt('\nProceed? [y/N] ');
      if (answer.toLowerCase() !== 'y') { console.log('Aborted.'); break; }
      for (const ticket of tickets) rmSync(join(ticketsDir, ticket), { recursive: true, force: true });
      if (hasState) rmSync(stateFile, { force: true });
      console.log('Done.');
      break;
    }

    case 'uninstall': {
      const binLink = join(homedir(), '.local', 'bin', 'maestro');
      const skillsDir = join(homedir(), '.claude', 'commands', 'maestro');
      const skillsMd = join(homedir(), '.claude', 'commands', 'maestro.md');
      const installDir = __installDir;

      console.log('This will remove:');
      if (existsSync(binLink)) console.log(`  ${binLink}  (symlink)`);
      if (existsSync(skillsDir)) console.log(`  ${skillsDir}/`);
      if (existsSync(skillsMd)) console.log(`  ${skillsMd}`);
      console.log(`  ${installDir}/`);
      console.log('\nPer-project .maestro/ folders will NOT be touched.');

      const answer = await prompt('\nProceed? [y/N] ');
      if (answer.toLowerCase() !== 'y') { console.log('Aborted.'); break; }

      if (existsSync(binLink)) rmSync(binLink, { force: true });
      if (existsSync(skillsDir)) rmSync(skillsDir, { recursive: true, force: true });
      if (existsSync(skillsMd)) rmSync(skillsMd, { force: true });
      // Remove install dir last — this binary lives inside it
      rmSync(installDir, { recursive: true, force: true });

      console.log('Maestro uninstalled.');
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
      console.log(USAGE);
      break;
    }

    default: {
      console.error(`Unknown command: ${command}\nRun "maestro help" for usage.`);
      process.exit(1);
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
