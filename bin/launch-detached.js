#!/usr/bin/env node
// Launch the maestro wizard in a new, detached terminal window across
// macOS / Linux / Windows, then BLOCK until the wizard exits (via a lockfile).
// While we block, Claude Code is effectively frozen — it can't act until this
// process returns.
//
// Exit codes:
//   0 — wizard ran and exited cleanly
//   1 — no terminal emulator could be launched
//   2 — wizard never signalled start (lockfile didn't appear within timeout)

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(__dirname, "ticket-wizard.js");
const WRAPPER = resolve(__dirname, "_wizard-wrapper.sh");
const PROJECT_CWD = resolve(__dirname, "..");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function which(bin) {
  const probe = process.platform === "win32" ? "where" : "which";
  return spawnSync(probe, [bin], { stdio: "ignore" }).status === 0;
}

function shQuote(s) {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// ── platform launchers ────────────────────────────────────────────────────────

function launchMac(lock) {
  const inner = `bash ${shQuote(WRAPPER)} ${shQuote(lock)} ${shQuote(ENTRY)}`;
  const iterm = spawnSync("osascript", ["-e", 'application "iTerm" is running'], { encoding: "utf8" });
  const useIterm = iterm.stdout.trim() === "true";
  const script = useIterm
    ? `tell application "iTerm"
         create window with default profile
         tell current session of current window to write text "cd ${shEscDQ(PROJECT_CWD)} && ${shEscDQ(inner)}"
         activate
       end tell`
    : `tell application "Terminal"
         do script "cd ${shEscDQ(PROJECT_CWD)} && ${shEscDQ(inner)}"
         activate
       end tell`;
  return spawnSync("osascript", ["-e", script]).status === 0;
}

function shEscDQ(s) {
  // escape for embedding inside an osascript double-quoted string
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function launchWindows(lock) {
  // On Windows we don't use the bash wrapper; emulate it inline in cmd.
  // The lockfile is created by the cmd shell ($$ equivalent: %RANDOM% won't do, use PID via title).
  // Simpler: write a tiny ps1 inline using node's child to create the lockfile, then run wizard.
  // For portability we use PowerShell.
  const ps = [
    `New-Item -Path '${lock}' -ItemType File -Force | Out-Null;`,
    `try { node '${ENTRY}'; $code = $LASTEXITCODE }`,
    `finally { Remove-Item -LiteralPath '${lock}' -Force -ErrorAction SilentlyContinue }`,
    `Write-Host ''; Write-Host \"Wizard exited with code $code. Press enter to close.\"; [void][System.Console]::ReadLine()`,
  ].join(" ");
  if (which("wt.exe")) {
    const r = spawn("wt.exe", ["-d", PROJECT_CWD, "powershell", "-NoProfile", "-Command", ps], {
      detached: true, stdio: "ignore",
    });
    r.unref();
    return true;
  }
  const r = spawn("cmd.exe", ["/c", "start", "powershell", "-NoProfile", "-Command", ps], {
    cwd: PROJECT_CWD, detached: true, stdio: "ignore",
  });
  r.unref();
  return true;
}

function launchLinux(lock) {
  const explicit = process.env.MAESTRO_TERMINAL || process.env.TERMINAL;
  const candidates = [];
  if (explicit) candidates.push(explicit);
  candidates.push(
    "x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal",
    "tilix", "alacritty", "kitty", "wezterm", "foot", "ghostty",
    "terminator", "xterm",
  );

  for (const term of candidates) {
    if (!which(term)) continue;
    const args = argsFor(term, lock);
    if (!args) continue;
    try {
      const child = spawn(term, args, { detached: true, stdio: "ignore", cwd: PROJECT_CWD });
      child.unref();
      return true;
    } catch { /* try next */ }
  }
  return false;
}

function argsFor(term, lock) {
  const wrap = ["bash", WRAPPER, lock, ENTRY];
  const wrapStr = `bash ${shQuote(WRAPPER)} ${shQuote(lock)} ${shQuote(ENTRY)}`;
  switch (term) {
    case "gnome-terminal":
    case "tilix":
    case "terminator":
      return ["--working-directory", PROJECT_CWD, "--", ...wrap];
    case "konsole":
      return ["--workdir", PROJECT_CWD, "-e", ...wrap];
    case "xfce4-terminal":
      return [`--working-directory=${PROJECT_CWD}`, "-e", wrapStr];
    case "alacritty":
    case "wezterm":
    case "ghostty":
      return ["--working-directory", PROJECT_CWD, "-e", ...wrap];
    case "kitty":
      return ["--directory", PROJECT_CWD, ...wrap];
    case "foot":
      return ["--working-directory", PROJECT_CWD, ...wrap];
    case "xterm":
    case "x-terminal-emulator":
      return ["-e", wrapStr];
    default:
      return ["-e", wrapStr];
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(ENTRY)) {
    console.error(`maestro entry not found at ${ENTRY}`);
    process.exit(2);
  }
  if (!existsSync(WRAPPER) && process.platform !== "win32") {
    console.error(`wizard wrapper not found at ${WRAPPER}`);
    process.exit(2);
  }

  const dir = mkdtempSync(join(tmpdir(), "maestro-lock-"));
  const lock = join(dir, "wizard.lock");

  let launched = false;
  if (process.platform === "darwin") launched = launchMac(lock);
  else if (process.platform === "win32") launched = launchWindows(lock);
  else launched = launchLinux(lock);

  if (!launched) {
    rmSync(dir, { recursive: true, force: true });
    console.error(
      "Could not detect a terminal emulator to launch. " +
        "Set MAESTRO_TERMINAL=<binary> or run `node bin/maestro.js` directly.",
    );
    process.exit(1);
  }

  // Wait for the wizard to signal START (lockfile appears) — bounded.
  const startDeadline = Date.now() + 10_000;
  while (!existsSync(lock) && Date.now() < startDeadline) await sleep(100);
  if (!existsSync(lock)) {
    rmSync(dir, { recursive: true, force: true });
    console.error("Wizard window opened but never signalled start (lockfile not created within 10s).");
    process.exit(2);
  }

  console.log("Wizard running in detached window. Claude is paused until it exits…");

  // Wait for the wizard to signal END (lockfile removed) — unbounded.
  while (existsSync(lock)) await sleep(250);

  rmSync(dir, { recursive: true, force: true });
  console.log("Wizard finished. Resuming.");

  const stateFile = resolve(__dirname, "../resources/ticket-state.json");
  if (existsSync(stateFile)) {
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    const ids = Object.keys(state).sort((a, b) =>
      new Date(state[b].createdAt) - new Date(state[a].createdAt)
    );
    if (ids.length > 0) console.log(`MAESTRO_TICKET=${ids[0]}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
