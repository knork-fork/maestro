---
description: Launch the maestro wizard in a new detached terminal window
allowed-tools: Bash
---

Launch the maestro wizard in a new terminal window so it has a real TTY. Control returns here immediately; the wizard runs independently in its own window.

!`node bin/launch-detached.js`

When the command returns, tell the user the wizard has finished and ask what they'd like to do next. Do not speculate about what the wizard did or what steps might follow.
