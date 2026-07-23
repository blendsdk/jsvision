# Documentation and Distribution: Cross-Platform Function Keys

> **Document**: 03-04-documentation-and-distribution.md
> **Parent**: [Index](00-index.md)

## Overview

This public input change must ship with accurate consumer guidance and synchronized Codex plugin
material. See AR-6, AR-7, AR-9, and AR-10.

## Consumer Documentation

Update the keyboard guide with:

- The canonical F1–F12 model and supported terminal families.
- The default `Alt+1…0,-,=` mapping.
- The `'none'` opt-out and migration example.
- The fast Escape-prefix equivalence and unchanged 50 ms boundary.
- The distinction between physical-key capture and action accessibility.
- Configuration pointers for commonly reserved F-keys without promising exhaustive OS control.
- xterm.js direct handling and the limits of browser/OS reservations.

Update public JSDoc/API references for `FunctionKeyFallback`, `EventLoopOptions`,
`ApplicationOptions`, `TerminalLike`, and browser host behavior.

## Distribution Governance

Changes under core engine, UI application/event, and web source paths affect plugin references
reported by `tools/jsvision-plugin-impact.json`. Execution must:

1. Review the exact deduplicated impact set reported for the changed paths, expected to include
   `references/architecture.md`, `references/theming.md`, `references/gotchas.md`,
   `references/app-lifecycle.md`, and `references/api/web.md`.
2. Update canonical material only under `tools/jsvision-skill/`.
3. Run `yarn plugin:update`; never hand-edit `plugins/jsvision-plugin/skills/jsvision/`.
4. Run `yarn plugin:check`.
5. Include generated API pages, synchronized snippets, impact snapshot, and assembled skill copy in
   the same implementation commit.

## Compatibility Communication

Root/package changelogs identify default-on aliases as intentional and provide the one-line opt-out.
They also clarify that low-level `decode()` retains literal Alt events.

## Testing Requirements

- Documentation/API generation and link checks pass.
- Plugin drift checks pass after regeneration.
- Packaging tests include the new public type/option.
- Search confirms no stale statement says function keys are limited to only the prior grammar or
  that physical capture is universally guaranteed.
