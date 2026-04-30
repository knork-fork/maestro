#!/usr/bin/env node

import React, { useState } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';

const h = React.createElement;

const STEPS = [
  {
    name: 'Pipeline',
    question: 'What type of work is this?',
    multiSelect: false,
    options: [
      { label: 'modify',      description: 'Modify existing functionality' },
      { label: 'bugfix',      description: 'Fix a bug' },
      { label: 'code-review', description: 'Review code for quality and correctness' },
      { label: 'tests',       description: 'Write or fix tests' },
    ],
  },
  {
    name: 'Stack',
    question: 'Which stack does this target?',
    multiSelect: false,
    options: [
      { label: 'backend-legacy-php', description: 'PHP backend (legacy)' },
      { label: 'frontend-legacy-js', description: 'JavaScript frontend (legacy)' },
      { label: 'twig-vue',           description: 'Twig templates + Vue components' },
      { label: 'backend + frontend', description: 'Both backend and frontend' },
    ],
  },
  {
    name: 'Quality',
    question: 'Which quality gates should be included?',
    multiSelect: true,
    options: [
      { label: 'run tests',            description: 'Execute the test suite' },
      { label: 'run static analysis',  description: 'Run phpstan or equivalent' },
      { label: 'formatter/checkstyle', description: 'Run code formatter and style checks' },
      { label: 'security inspection',  description: 'Inspect security-sensitive code' },
    ],
  },
  {
    name: 'Plan Checker',
    question: 'How strict should the generated plan be?',
    multiSelect: false,
    options: [
      { label: 'normal',      description: 'Balanced depth and coverage (Recommended)' },
      { label: 'lightweight', description: 'Quick checklist, minimal overhead' },
      { label: 'strict',      description: 'Thorough review with enforced gates' },
    ],
  },
  {
    name: 'Submit',
    isSummary: true,
    multiSelect: false,
    options: [],
  },
];

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
  const rows = [
    ['Pipeline',     selections[0]],
    ['Stack',        selections[1]],
    ['Quality',      selections[2].length ? selections[2].join(', ') : 'none'],
    ['Plan Checker', selections[3]],
  ];
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
