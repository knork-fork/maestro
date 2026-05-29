#!/usr/bin/env node

import React, { useState } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const h = React.createElement;

const listOnly = process.argv[2] === '--list-only';

const stateFile = join(process.cwd(), '.maestro/resources/ticket-state.json');
let ticketState = {};
try { ticketState = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { /* no tickets */ }

const tickets = Object.entries(ticketState)
  .filter(([, s]) => s.status !== 'done')
  .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt))
  .slice(0, 5);

if (tickets.length === 0) {
  console.log('No open tickets.');
  process.exit(0);
}

if (listOnly) {
  tickets.forEach(([id, s], i) => {
    const label = s.summary ? `${s.summary}  (${id})` : id;
    console.log(`${i + 1}. ${label}`);
  });
  process.exit(0);
}

function Row({ id, summary, isActive }) {
  const arrow = isActive ? h(Text, { color: 'cyan' }, '❯ ') : h(Text, null, '  ');
  const label = summary
    ? h(Text, null,
        h(Text, isActive ? { bold: true, color: 'cyan' } : {}, summary),
        h(Text, { dimColor: true }, `  (${id})`),
      )
    : h(Text, isActive ? { bold: true, color: 'cyan' } : {}, id);
  return h(Text, null, arrow, label);
}

function App() {
  const [cursor, setCursor] = useState(0);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.upArrow) setCursor(c => (c - 1 + tickets.length) % tickets.length);
    else if (key.downArrow) setCursor(c => (c + 1) % tickets.length);
    else if (key.return) {
      const [selectedId] = tickets[cursor];
      exit();
      spawnSync('claude', [`/maestro:next ${selectedId}`], { stdio: 'inherit' });
    }
    else if (input === 'q' || key.escape) exit();
  });

  return h(
    Box,
    { flexDirection: 'column' },
    h(Text, { bold: true }, 'Resume a ticket'),
    h(Box, { marginTop: 1, flexDirection: 'column' },
      ...tickets.map(([id, s], i) =>
        h(Row, { key: id, id, summary: s.summary || '', isActive: cursor === i }),
      ),
    ),
    h(Box, { marginTop: 1 },
      h(Text, { dimColor: true }, '↑↓ move   ↵ open   q quit'),
    ),
  );
}

render(h(App));
