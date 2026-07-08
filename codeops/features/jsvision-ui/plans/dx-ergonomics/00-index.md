# DX Ergonomics Pass Implementation Plan

> **Feature**: Convenience-layer ergonomics for `@jsvision/ui` — zero-config capabilities, single-package imports, first-class command handling, and async modal helpers.
> **Status**: Planning Complete
> **Created**: 2026-07-08
> **Source of truth**: [`DX-ASSESSMENT.md`](../../../../../DX-ASSESSMENT.md) — Proposals 2, 3, 4 (no RD; standalone plan per AR-1)
> **CodeOps Skills Version**: 3.3.2

## Overview

The `@jsvision/ui` engine is strong but the developer-facing surface front-loads friction: an app
can't start without hand-building a capability profile from a second package, catching an app
command means hand-rolling an invisible view, and the simplest "show a message" bypasses the nice
`Dialog` for ~7 steps of raw modal ceremony. This plan closes the three highest-leverage gaps the
DX assessment identified — all **additive and backward-compatible**, none touching a rendered glyph.

Three phases, one per proposal:

- **Phase 1 (Proposal 2) — Zero-config onboarding.** Make `ApplicationOptions.caps` optional
  (`'auto'` default; `createApplication` resolves it once via `resolveCapabilities().profile`), and
  re-export the seven `@jsvision/core` essentials a UI developer needs so "hello world" is a
  single-package import.
- **Phase 2 (Proposal 3) — First-class commands.** Add `loop.onCommand(name, fn)` /
  `app.onCommand(name, fn)` (returns an unsubscribe fn), generalizing the framework's own internal
  quit-sink into one public mechanism and retiring the invisible-`CommandSink` pattern.
- **Phase 3 (Proposal 4) — Async modal helpers.** Add `messageBox`/`confirm`/`inputBox` over the
  existing `Dialog`, sharing the editor family's proven `{loop, desktop}` host seam and refactoring
  the editor's `infoBox`/`confirmBox` to delegate (DRY).

## Document Index

| #   | Document                                                        | Description                                 |
| --- | -------------------------------------------------------------- | ------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                 | Zero-Ambiguity Gate decisions (audit trail) |
| 00  | [Index](00-index.md)                                           | This document — overview and navigation     |
| 01  | [Requirements](01-requirements.md)                             | Feature requirements and scope              |
| 02  | [Current State](02-current-state.md)                           | Analysis of current implementation          |
| 03-01 | [Caps 'auto' & re-exports](03-01-caps-and-reexports.md)      | Proposal 2 technical spec                   |
| 03-02 | [onCommand handler API](03-02-oncommand.md)                  | Proposal 3 technical spec                   |
| 03-03 | [Async modal helpers](03-03-modal-helpers.md)                | Proposal 4 technical spec                   |
| 07  | [Testing Strategy](07-testing-strategy.md)                     | Specification test cases and verification   |
| 99  | [Execution Plan](99-execution-plan.md)                         | Phases, sessions, and task checklist        |

## Quick Reference

### Usage Examples

```ts
// Phase 1 — zero-config, single package
import { createApplication, menuBar, statusLine } from '@jsvision/ui';
const app = createApplication({ menuBar: bar, statusLine: status }); // caps auto-detected

// Phase 2 — first-class command handling (no invisible view)
const off = app.onCommand('about', () => messageBox(app, { title: 'About', text: '…' }));

// Phase 3 — async modal helpers (no centering math, no manual teardown)
await messageBox(app, { title: 'About', text: 'jsvision — Turbo Vision, reimagined' });
const ok = await confirm(app, 'Discard unsaved changes?');            // boolean
const name = await inputBox(app, { title: 'Rename', label: 'New name', value: signal('') }); // string | null
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| `caps: 'auto'` scope | `ApplicationOptions` only; loop/root stay strict | AR-3 |
| Re-export set | 6 essentials + `resolveCapabilitiesAsync` | AR-4 |
| `onCommand` semantics | many handlers, consume, `loop`+`app`, unsubscribe | AR-5/6/7 |
| Quit path | generalize into the one mechanism (preProcess sink) | AR-8/9 |
| Modal helpers | general `dialog/` helpers on the `{loop,desktop}` seam; editor delegates | AR-10/11 |
| `confirm` shape | Yes/No boolean; `messageBox` needs a title; `confirm` default title | AR-12 |
| Kitchen-sink stories | exempt (non-visual); proven in `tvision-demo` | AR-13 |

## Related Files

- `packages/ui/src/app/application.ts` · `run.ts` — caps resolution + `onCommand` forward (P1/P2)
- `packages/ui/src/index.ts` — the core re-exports (P1)
- `packages/ui/src/event/event-loop.ts` · `types.ts` — `EventLoop.onCommand` (P2)
- `packages/ui/src/dialog/message-box.ts` *(new)* — `messageBox`/`confirm`/`inputBox` (P3)
- `packages/ui/src/editor/dialogs.ts` — refactor `infoBox`/`confirmBox` to delegate (P3)
- `packages/examples/tvision-demo/{main,widgets}.ts` — flagship proof for all three
