#!/usr/bin/env node

import React, { useState } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
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
const RESOURCES_DIR = join(process.cwd(), '.maestro/resources');
const TICKETS_DIR = join(RESOURCES_DIR, 'tickets');
const STATE_FILE = join(RESOURCES_DIR, 'ticket-state.json');

function makeTicketId() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hash = createHash('sha1').update(`${Date.now()}${Math.random()}`).digest('hex').slice(0, 6);
  return `ticket-${date}-${hash}`;
}

function submitTicket(selections) {
  const ticketId = makeTicketId();
  const ticketDir = join(TICKETS_DIR, ticketId);
  mkdirSync(ticketDir, { recursive: true });

  const fields = STEPS
    .filter(s => !s.isSummary)
    .reduce((acc, s, i) => { acc[s.name.toLowerCase().replace(/\s+/g, '_')] = selections[i]; return acc; }, {});

  const ticket = { id: ticketId, createdAt: new Date().toISOString(), ...fields };
  writeFileSync(join(ticketDir, 'ticket.json'), JSON.stringify(ticket, null, 2));

  let branch = null;
  try { branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim(); } catch { /* not a git repo */ }

  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
  state[ticketId] = { status: 'created', createdAt: ticket.createdAt, branch };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  const resumePath = join(ticketDir, 'resume.sh');
  writeFileSync(resumePath,
    `#!/usr/bin/env bash\ncd "$(dirname "$0")/../../../.."\nclaude "/maestro:pick ${ticketId} and then /maestro:next"\n`
  );
  chmodSync(resumePath, 0o755);

  return ticketId;
}

function slotCount(step) {
  return step.isSummary ? 2 : step.options.length + 1;
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
    h(Text, null, ...segs),
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
  return h(Text, null, arrow, checkmark, label, desc);
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

function SummaryBody({ selections, cursor }) {
  const rows = STEPS
    .map((s, i) => [s, selections[i]])
    .filter(([s]) => !s.isSummary)
    .map(([s, val]) => [
      s.name,
      s.multiSelect ? (val.length ? val.join(', ') : 'none') : val,
    ]);
  return h(
    Box,
    { flexDirection: 'column' },
    h(Text, { bold: true }, 'Review your selections'),
    h(Box, { marginTop: 1, flexDirection: 'column' },
      ...rows.map(([name, value], i) =>
        h(Text, { key: i },
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

function StepBody({ step, cursor, selection }) {
  const labelWidth = Math.max(...step.options.map(o => o.label.length)) + 2;
  return h(
    Box,
    { flexDirection: 'column' },
    h(Text, { bold: true }, step.question),
    h(Box, { marginTop: 1, flexDirection: 'column' },
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

function ContentPanel({ step, cursor, selections, currentSelection }) {
  const slots = slotCount(step);
  const onChat = cursor === slots - 1;
  const body = step.isSummary
    ? h(SummaryBody, { selections, cursor })
    : h(StepBody, { step, cursor, selection: currentSelection });

  return h(
    Box,
    { borderStyle: 'round', flexDirection: 'column', paddingX: 1, paddingY: 0, borderColor: 'gray' },
    body,
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, '─'.repeat(48))),
    h(ChatRow, { isActive: onChat }),
  );
}

function FooterHints({ multiSelect, isSummary }) {
  const parts = ['↑↓ move'];
  if (multiSelect) parts.push('␣ toggle');
  parts.push(isSummary ? '↵ confirm' : '↵ select');
  parts.push('← back');
  if (!isSummary) parts.push('→ next');
  parts.push('^C quit');
  return h(
    Box,
    { paddingX: 2 },
    h(Text, { dimColor: true }, parts.join('   ')),
  );
}

function App() {
  const [step, setStep] = useState(0);
  const [cursors, setCursors] = useState(STEPS.map(() => 0));
  const [selections, setSelections] = useState(STEPS.map(s => (s.multiSelect ? [] : null)));
  const { exit } = useApp();

  const currentStep = STEPS[step];
  const cursor = cursors[step];
  const slots = slotCount(currentStep);
  const onChat = cursor === slots - 1;

  const setCursor = (next) => {
    const copy = cursors.slice();
    copy[step] = next;
    setCursors(copy);
  };

  const moveCursor = (delta) => {
    setCursor((cursor + delta + slots) % slots);
  };

  const advance = () => {
    if (onChat) return;
    if (currentStep.isSummary) {
      submitTicket(selections);
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

  useInput((input, key) => {
    if (key.upArrow) moveCursor(-1);
    else if (key.downArrow) moveCursor(1);
    else if (key.leftArrow) goBack();
    else if (key.rightArrow) { if (!currentStep.isSummary) advance(); }
    else if (key.return) advance();
    else if (input === ' ') toggleSelection();
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
    }),
    h(FooterHints, {
      multiSelect: !!currentStep.multiSelect,
      isSummary: !!currentStep.isSummary,
    }),
  );
}

render(h(App));
