#!/usr/bin/env node

import React, { useState } from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { join } from 'path';

const h = React.createElement;

const CONFIG_DIR = join(process.cwd(), '.maestro/config');

function resolveOptions(options) {
  if (Array.isArray(options)) return options;
  if (options && options['$ref']) {
    return JSON.parse(readFileSync(join(CONFIG_DIR, options['$ref']), 'utf8'))
      .map(({ label, description }) => ({ label, description }));
  }
  return options ?? [];
}

const STEPS = JSON.parse(readFileSync(join(CONFIG_DIR, 'wizard.json'), 'utf8'))
  .map(step => ({ ...step, options: resolveOptions(step.options) }));

// The Stack step renders as a list with single-level collapsible groups (each option's `group` field).
const STACK_STEP = STEPS.find(s => s.name === 'Stack' && !s.isSummary) ?? null;
if (STACK_STEP) STACK_STEP.tree = buildStackTree(STACK_STEP.options);

const RESOURCES_DIR = join(process.cwd(), '.maestro/resources');
const TICKETS_DIR = join(RESOURCES_DIR, 'tickets');
const STATE_FILE = join(RESOURCES_DIR, 'ticket-state.json');

function makeTicketId() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hash = createHash('sha1').update(`${Date.now()}${Math.random()}`).digest('hex').slice(0, 6);
  return `ticket-${date}-${hash}`;
}

function submitTicket(selections, stackPath) {
  const ticketId = makeTicketId();
  const ticketDir = join(TICKETS_DIR, ticketId);
  mkdirSync(ticketDir, { recursive: true });

  const fields = STEPS
    .filter(s => !s.isSummary)
    .reduce((acc, s, i) => { acc[s.name.toLowerCase().replace(/\s+/g, '_')] = selections[i]; return acc; }, {});

  const ticket = { id: ticketId, createdAt: new Date().toISOString(), ...fields };
  if (stackPath) ticket['stack-path'] = stackPath;

  writeFileSync(join(ticketDir, 'ticket.json'), JSON.stringify(ticket, null, 2));

  let branch = null;
  try { branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim(); } catch { /* not a git repo */ }

  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
  state[ticketId] = { status: 'created', createdAt: ticket.createdAt, branch, summary: '' };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  const resumePath = join(ticketDir, 'resume.sh');
  writeFileSync(resumePath,
    `#!/usr/bin/env bash\ncd "$(dirname "$0")/../../../.."\nclaude "/maestro:pick ${ticketId} and then /maestro:next"\n`
  );
  chmodSync(resumePath, 0o755);

  return ticketId;
}

// --- Stack list grouping (single level, via each option's `group` field) ---

// Build the Stack list: options sharing a `group` value collapse under one (non-selectable) header.
// Grouping is a single level; ungrouped options stay top-level. Order follows wizard.json, with each
// group placed at the position of its first member. `group` is cosmetic only — it never affects the
// option's `path` / the ticket's stack-path.
function buildStackTree(options) {
  const forest = [];
  const groups = new Map(); // group label -> header node
  for (const opt of options ?? []) {
    const leaf = {
      isGroup: false,
      label: opt.label,
      description: opt.description,
      fullPath: opt.path ?? null,
      children: [],
      parentKey: null,
    };
    leaf.key = leaf.fullPath != null ? `p:${leaf.fullPath}` : `l:${leaf.label}`;
    if (opt.group) {
      let g = groups.get(opt.group);
      if (!g) {
        g = { isGroup: true, label: opt.group, description: undefined, fullPath: null, key: `g:${opt.group}`, children: [], parentKey: null };
        groups.set(opt.group, g);
        forest.push(g);
      }
      leaf.parentKey = g.key;
      g.children.push(leaf);
    } else {
      forest.push(leaf);
    }
  }
  return forest;
}

// Stable identity for a node.
function keyOf(node) {
  return node.key;
}

// The group key that should stay open for a highlighted node (its own key if it is a group, its
// parent group otherwise; null for an ungrouped top-level option).
function relevantGroupKey(node) {
  if (!node) return null;
  return node.isGroup ? node.key : node.parentKey;
}

// Keep a group expanded only if it was already open AND it contains (or is) the highlighted node,
// so leaving a group auto-collapses it. At most one group is open at a time.
function pruneExpanded(expanded, node) {
  const k = relevantGroupKey(node);
  return (k && expanded.has(k)) ? new Set([k]) : new Set();
}

// Depth-first list of currently-visible rows given the expanded set.
function flattenVisible(forest, expanded) {
  const rows = [];
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      const hasChildren = n.children.length > 0;
      const open = hasChildren && expanded.has(n.key);
      rows.push({ node: n, depth, hasChildren, open });
      if (open) walk(n.children, depth + 1);
    }
  };
  walk(forest, 0);
  return rows;
}

function TabBar({ step }) {
  const segs = [];
  STEPS.forEach((s, i) => {
    if (i > 0) segs.push(h(Text, { key: `sep-${i}`, dimColor: true }, '  →  '));
    if (i < step) {
      segs.push(h(Text, { key: i, color: 'green' }, `✔ ${s.name}`));
    } else if (i === step) {
      segs.push(h(Text, { key: i, bold: true, color: 'cyan' }, `[ ${s.name} ]`));
    } else {
      segs.push(h(Text, { key: i, dimColor: true }, `□ ${s.name}`));
    }
  });
  return h(
    Box,
    { borderStyle: 'round', paddingX: 1, borderColor: 'gray' },
    h(Text, { wrap: 'truncate' }, ...segs),
  );
}

function OptionRow({ opt, isActive, isChecked, multiSelect, labelWidth }) {
  const arrow = isActive
    ? h(Text, { color: 'cyan' }, '❯ ')
    : h(Text, null, '  ');
  const checkmark = multiSelect
    ? (isChecked ? h(Text, { color: 'green' }, '◉ ') : h(Text, { dimColor: true }, '○ '))
    : null;
  const label = h(
    Text,
    isActive ? { bold: true, color: 'cyan' } : {},
    opt.label.padEnd(labelWidth),
  );
  const desc = h(Text, { dimColor: true }, '  ' + opt.description);
  return h(Text, { wrap: 'truncate' }, arrow, checkmark, label, desc);
}

function ChatRow({ isActive }) {
  if (isActive) {
    return h(
      Text,
      null,
      h(Text, { color: 'cyan' }, '❯ '),
      h(Text, { bold: true }, "💬 Let's chat about this"),
      h(Text, { dimColor: true }, '  (coming soon)'),
    );
  }
  return h(Text, { dimColor: true }, "  💬 Let's chat about this");
}

function ConfirmRow({ isActive }) {
  if (isActive) {
    return h(
      Text,
      null,
      h(Text, { color: 'cyan' }, '❯ '),
      h(Text, { bold: true, color: 'cyan' }, 'Press Enter to confirm'),
    );
  }
  return h(Text, { dimColor: true }, '  Press Enter to confirm');
}

function SummaryBody({ selections, cursor, width }) {
  const rows = STEPS
    .map((s, i) => [s, selections[i]])
    .filter(([s]) => !s.isSummary)
    .map(([s, val]) => [
      s.name,
      s.multiSelect ? (val.length ? val.join(', ') : 'none') : val,
    ]);
  return h(
    Box,
    { flexDirection: 'column', width },
    h(Text, { bold: true }, 'Review your selections'),
    h(Box, { marginTop: 1, flexDirection: 'column', width },
      ...rows.map(([name, value], i) =>
        h(Text, { key: i, wrap: 'truncate' },
          h(Text, { dimColor: true }, name.padEnd(16) + ' '),
          value
            ? h(Text, { bold: true }, String(value))
            : h(Text, { color: 'red' }, '(not set)'),
        ),
      ),
    ),
    h(Box, { marginTop: 1 }, h(ConfirmRow, { isActive: cursor === 0 })),
  );
}

function StepBody({ step, cursor, selection, width }) {
  const labelWidth = Math.max(...step.options.map(o => o.label.length)) + 2;
  return h(
    Box,
    { flexDirection: 'column', width },
    h(Text, { bold: true, wrap: 'truncate' }, step.question),
    h(Box, { marginTop: 1, flexDirection: 'column', width },
      ...step.options.map((opt, i) =>
        h(OptionRow, {
          key: i,
          opt,
          isActive: cursor === i,
          isChecked: step.multiSelect && selection.includes(opt.label),
          multiSelect: step.multiSelect,
          labelWidth,
        }),
      ),
    ),
  );
}

// One row of the Stack tree: indent + cursor arrow + expand marker + label + (optional) description.
// The whole row is truncated to the panel width so long descriptions never wrap and break the UI.
function StackRow({ row, isActive }) {
  const { node, depth, hasChildren, open } = row;
  const prefix = '  '.repeat(depth)
    + (isActive ? '❯ ' : '  ')
    + (hasChildren ? (open ? '▾ ' : '▸ ') : '  ');
  return h(
    Text,
    { wrap: 'truncate' },
    h(Text, isActive ? { color: 'cyan' } : null, prefix),
    h(Text, isActive ? { bold: true, color: 'cyan' } : null, node.label),
    node.description ? h(Text, { dimColor: true }, '  ' + node.description) : null,
  );
}

function StackStepBody({ step, stackIndex, expanded, width }) {
  const rows = flattenVisible(step.tree, expanded);
  return h(
    Box,
    { flexDirection: 'column', width },
    h(Text, { bold: true, wrap: 'truncate' }, step.question),
    h(Box, { marginTop: 1, flexDirection: 'column', width },
      ...rows.map((row, i) => h(StackRow, { key: keyOf(row.node), row, isActive: stackIndex === i })),
    ),
  );
}

function ContentPanel({ step, cursor, selections, currentSelection, onChat, width, stackExpanded, stackIndex }) {
  const body = step.isSummary
    ? h(SummaryBody, { selections, cursor, width })
    : step.tree
      ? h(StackStepBody, { step, stackIndex, expanded: stackExpanded, width })
      : h(StepBody, { step, cursor, selection: currentSelection, width });

  return h(
    Box,
    { borderStyle: 'round', flexDirection: 'column', paddingX: 1, paddingY: 0, borderColor: 'gray' },
    body,
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, '─'.repeat(Math.max(0, Math.min(48, width))))),
    h(ChatRow, { isActive: onChat }),
  );
}

function FooterHints({ multiSelect, isSummary, isStack }) {
  const parts = ['↑↓ move'];
  if (multiSelect) parts.push('␣ toggle');
  parts.push(isSummary ? '↵ confirm' : '↵ select');
  if (isStack) {
    parts.push('→ expand/drill');
    parts.push('← collapse/back');
  } else {
    parts.push('← back');
    if (!isSummary) parts.push('→ next');
  }
  parts.push('^C quit');
  return h(
    Box,
    { paddingX: 2 },
    h(Text, { dimColor: true, wrap: 'truncate' }, parts.join('   ')),
  );
}

function App() {
  const [step, setStep] = useState(0);
  const [cursors, setCursors] = useState(STEPS.map(() => 0));
  const [selections, setSelections] = useState(STEPS.map(s => (s.multiSelect ? [] : null)));
  const [stackExpanded, setStackExpanded] = useState(new Set());
  const [stackIndex, setStackIndex] = useState(0);
  const [stackPath, setStackPath] = useState(null);
  const { exit } = useApp();
  const { stdout } = useStdout();

  const innerWidth = Math.max(20, (stdout?.columns || 80) - 4); // round border (2) + paddingX:1 (2)

  const currentStep = STEPS[step];
  const isStack = !currentStep.isSummary && !!currentStep.tree;

  const stackRows = isStack ? flattenVisible(currentStep.tree, stackExpanded) : null;
  const slots = currentStep.isSummary ? 2 : (isStack ? stackRows.length + 1 : currentStep.options.length + 1);
  const cursor = isStack ? stackIndex : cursors[step];
  const onChat = cursor === slots - 1;

  // --- Generic (flat-list) step navigation ---
  const setCursor = (next) => {
    const copy = cursors.slice();
    copy[step] = next;
    setCursors(copy);
  };

  const moveCursor = (delta) => {
    setCursor((cursors[step] + delta + slots) % slots);
  };

  const advance = () => {
    if (onChat) return;
    if (currentStep.isSummary) {
      submitTicket(selections, stackPath);
      exit();
      return;
    }
    if (!currentStep.multiSelect) {
      const copy = selections.slice();
      copy[step] = currentStep.options[cursor].label;
      setSelections(copy);
    }
    setStep(step + 1);
  };

  const goBack = () => {
    if (step === 0) return;
    setStep(step - 1);
  };

  const toggleSelection = () => {
    if (onChat || !currentStep.multiSelect) return;
    const label = currentStep.options[cursor].label;
    const copy = selections.slice();
    const arr = copy[step].slice();
    const idx = arr.indexOf(label);
    if (idx === -1) arr.push(label);
    else arr.splice(idx, 1);
    copy[step] = arr;
    setSelections(copy);
  };

  // --- Stack-tree navigation ---
  const selectStackNode = (node) => {
    const copy = selections.slice();
    copy[step] = node.label;
    setSelections(copy);
    setStackPath(node.fullPath ?? null);
    setStep(step + 1);
  };

  // Open a group header and drill into its first member (the only group left open).
  const expandGroup = (group) => {
    const expanded = new Set([group.key]);
    const newRows = flattenVisible(currentStep.tree, expanded);
    setStackExpanded(expanded);
    setStackIndex(newRows.findIndex(r => keyOf(r.node) === keyOf(group.children[0])));
  };

  // Move the highlight by `delta`, then auto-collapse a group once we've left it.
  const stackMove = (delta) => {
    const rows = flattenVisible(currentStep.tree, stackExpanded);
    const total = rows.length + 1; // + chat row
    const next = (stackIndex + delta + total) % total;
    if (next >= rows.length) { // landed on the chat row: collapse everything
      const collapsed = new Set();
      setStackExpanded(collapsed);
      setStackIndex(flattenVisible(currentStep.tree, collapsed).length);
      return;
    }
    const target = rows[next].node;
    const pruned = pruneExpanded(stackExpanded, target);
    const newRows = flattenVisible(currentStep.tree, pruned);
    setStackExpanded(pruned);
    setStackIndex(newRows.findIndex(r => keyOf(r.node) === keyOf(target)));
  };

  // RIGHT: a group expands and drills into its first member; a stack selects + advances.
  const stackRight = () => {
    const rows = flattenVisible(currentStep.tree, stackExpanded);
    if (stackIndex >= rows.length) return; // chat row
    const node = rows[stackIndex].node;
    if (node.isGroup) expandGroup(node);
    else selectStackNode(node);
  };

  // ENTER: a group is not selectable, so it just expands; a stack is selected.
  const stackEnter = () => {
    const rows = flattenVisible(currentStep.tree, stackExpanded);
    if (stackIndex >= rows.length) return; // chat row
    const node = rows[stackIndex].node;
    if (node.isGroup) expandGroup(node);
    else selectStackNode(node);
  };

  // LEFT: collapse an open group; from a member, collapse its group and land on the header;
  // otherwise (top-level row) go back a tab.
  const stackLeft = () => {
    const rows = flattenVisible(currentStep.tree, stackExpanded);
    if (stackIndex >= rows.length) { goBack(); return; } // chat row
    const node = rows[stackIndex].node;
    if (node.isGroup && stackExpanded.has(node.key)) {
      const collapsed = new Set();
      const newRows = flattenVisible(currentStep.tree, collapsed);
      setStackExpanded(collapsed);
      setStackIndex(newRows.findIndex(r => keyOf(r.node) === keyOf(node)));
      return;
    }
    if (node.parentKey) {
      const collapsed = new Set();
      const newRows = flattenVisible(currentStep.tree, collapsed);
      const idx = newRows.findIndex(r => keyOf(r.node) === node.parentKey);
      if (idx >= 0) { setStackExpanded(collapsed); setStackIndex(idx); return; }
    }
    goBack();
  };

  useInput((input, key) => {
    if (key.upArrow) isStack ? stackMove(-1) : moveCursor(-1);
    else if (key.downArrow) isStack ? stackMove(1) : moveCursor(1);
    else if (key.leftArrow) isStack ? stackLeft() : goBack();
    else if (key.rightArrow) { if (currentStep.isSummary) return; isStack ? stackRight() : advance(); }
    else if (key.return) isStack ? stackEnter() : advance();
    else if (input === ' ') { if (!isStack) toggleSelection(); }
  });

  return h(
    Box,
    { flexDirection: 'column' },
    h(TabBar, { step }),
    h(ContentPanel, {
      step: currentStep,
      cursor,
      selections,
      currentSelection: selections[step],
      onChat,
      width: innerWidth,
      stackExpanded,
      stackIndex,
    }),
    h(FooterHints, {
      multiSelect: !!currentStep.multiSelect,
      isSummary: !!currentStep.isSummary,
      isStack,
    }),
  );
}

render(h(App));
