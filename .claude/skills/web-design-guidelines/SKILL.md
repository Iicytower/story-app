---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

Rules are pinned in [guidelines.md](guidelines.md) (copied from `vercel-labs/web-interface-guidelines` `command.md` on 2026-11-12, skill from `vercel-labs/agent-skills` @ `1a2c79d`). Do not fetch them from the network; update the copy only when the user asks.

## How It Works

1. Read `guidelines.md` next to this file
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the guidelines
4. Output findings in the terse `file:line` format

## Project notes (story_app)

- UI copy comes from `messages/en.json` and `messages/pl.json`; report copy issues against the message key, not the component.
- "Title Case" applies to English only; Polish copy uses sentence case.
- Links and navigation use `@/i18n/navigation`, not `next/link`.

If no files specified, ask the user which files to review.
