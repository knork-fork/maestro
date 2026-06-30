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
  index         Rebuild .maestro/conventions/index.json
  update        Check for a newer release and update if available
  version       Print the installed version
  help          Show this help message
  reset         Delete all tickets in the current project
  uninstall     Remove the binary, skills, and ~/.maestro/
  resume        Pick an open ticket and resume work in Claude Code`;

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
      // Create local .maestro/ dir
      mkdirSync(maestroDir, { recursive: true });

      // Create .maestro/config/ by copying from defaults/, excluding commands/ which go to ~/.claude/ instead
      const configDest = join(maestroDir, 'config');
      if (!existsSync(configDest)) {
        const excludeDirs = ['commands', 'conventions'].map((d) => join(defaultsDir, d));
        cpSync(defaultsDir, configDest, {
          recursive: true,
          filter: (src) => !excludeDirs.some((d) => src.startsWith(d)),
        });
      }

      // Create .maestro/.gitignore for resources and exports, if it didn't already exist
      const gitignoreDest = join(maestroDir, '.gitignore');
      if (!existsSync(gitignoreDest)) {
        writeFileSync(gitignoreDest, 'resources/\nexports/\n');
      }

      // Create .maestro/conventions dir if it doesn't exist
      const conventionsDest = join(maestroDir, 'conventions');
      if (!existsSync(conventionsDest)) {
        cpSync(join(defaultsDir, 'conventions'), conventionsDest, { recursive: true });
      }

      // Run `maestro index` to generate the initial conventions index.json
      spawnSync('node', [process.argv[1], 'index'], { stdio: 'ignore' });

      console.log(`Initialized maestro in ${maestroDir}`);
      break;
    }

    case 'index': {
      requireInit();
      const dryRun = args.includes('--dry-run');

      const conventionsDir = join(maestroDir, 'conventions');
      const indexFile = join(conventionsDir, 'index.json');

      if (!existsSync(indexFile)) {
        console.error('Error: .maestro/conventions/index.json not found. Run "maestro init" again.');
        process.exit(1);
      }

      const wizardFile = join(maestroDir, 'config', 'wizard.json');
      if (existsSync(wizardFile)) {
        const wizard = JSON.parse(readFileSync(wizardFile, 'utf8'));
        const hasStack = Array.isArray(wizard) && wizard.some(s => s.name === 'Stack');
        if (!hasStack) {
          console.error('Error: wizard.json has no step with name "Stack". Add a Stack step or conventions cannot be assigned automatically.');
          process.exit(1);
        }
      }

      const index = { common: [], stacks: [], playbooks: [] };

      function walkConventions(dir, relBase) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const fullPath = join(dir, entry.name);
          const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            walkConventions(fullPath, relPath);
            continue;
          }
          if (!entry.name.endsWith('.md')) continue;
          if (entry.name === 'CLAUDE.md' || entry.name === 'README.md') continue;

          const parts = relPath.split('/');
          const category = parts[0];

          if (category === 'stacks' && parts.length === 2) {
            console.error(`Error: ${relPath}: stack conventions must be inside a subdirectory of stacks/ (e.g. stacks/php/foo.md)`);
            process.exit(1);
          }

          const content = readFileSync(fullPath, 'utf8');
          const firstLine = content.split('\n')[0] ?? '';

          if (!firstLine.startsWith('# tags:')) {
            console.error(`Error: ${relPath}: first line must be "# tags: tag1, tag2, ..." (got: "${firstLine}")`);
            process.exit(1);
          }

          const tags = firstLine.slice('# tags:'.length).trim().split(',').map(t => t.trim()).filter(Boolean);
          if (tags.length === 0) {
            console.error(`Error: ${relPath}: must have at least one non-empty tag`);
            process.exit(1);
          }

          if (index[category] !== undefined) {
            index[category].push({ path: relPath, tags });
          }
        }
      }

      walkConventions(conventionsDir, '');

      const generated = JSON.stringify(index, null, 2) + '\n';

      if (dryRun) {
        const current = readFileSync(indexFile, 'utf8');
        if (generated === current) {
          console.log('index.json is up to date.');
        } else {
          console.error('index.json is out of date. Run "maestro index" to update.');
          process.exit(1);
        }
      } else {
        writeFileSync(indexFile, generated);
        console.log('Updated .maestro/conventions/index.json');
      }
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

    case 'resume-list-only':
    case 'resume': {
      requireInit();
      const pickerPath = join(dirname(fileURLToPath(import.meta.url)), 'resume-picker.js');
      const pickerArgs = command === 'resume-list-only' ? ['--list-only'] : [];
      const result = spawnSync('node', [pickerPath, ...pickerArgs], { stdio: 'inherit' });
      process.exit(result.status ?? 0);
    }

    case 'get-phase': {
      requireInit();
      const [ticketId] = args;
      if (!ticketId) { console.error('Usage: maestro get-phase <ticket-id>'); process.exit(1); }
      const { getPhaseForTicket } = await import('./util.js');
      console.log(getPhaseForTicket(ticketId));
      break;
    }

    case 'set-status': {
      requireInit();
      const [ticketId, status] = args;
      if (!ticketId || !status) { console.error('Usage: maestro set-status <ticket-id> <status>'); process.exit(1); }
      const { setTicketStatus } = await import('./util.js');
      setTicketStatus(ticketId, status);
      break;
    }

    case 'set-summary': {
      requireInit();
      const [ticketId, ...rest] = args;
      const summary = rest.join(' ');
      if (!ticketId || !summary) { console.error('Usage: maestro set-summary <ticket-id> <summary>'); process.exit(1); }
      const { setTicketSummary } = await import('./util.js');
      setTicketSummary(ticketId, summary);
      break;
    }

    case 'get-summary': {
      requireInit();
      const [ticketId] = args;
      if (!ticketId) { console.error('Usage: maestro get-summary <ticket-id>'); process.exit(1); }
      const { getTicketSummary } = await import('./util.js');
      console.log(getTicketSummary(ticketId));
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

    case 'get-conventions-for-ticket': {
      requireInit();
      const [ticketId] = args;
      if (!ticketId) { console.error('Usage: maestro get-conventions-for-ticket <ticket-id>'); process.exit(1); }
      const { getConventionsForTicket } = await import('./util.js');
      console.log(getConventionsForTicket(ticketId));
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
