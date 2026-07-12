# Global Clipboard & Selection Implementation Plan

> **Feature**: Framework-wide `Ctrl+A/C/X/V` (select-all / copy / cut / paste) across every editable widget in `@jsvision/ui`
> **Status**: Planning Complete
> **Created**: 2026-07-12
> **Source**: GitHub issue #73 (self-contained spec) — supersedes #5
> **CodeOps Skills Version**: 3.4.1

## Overview

Today clipboard behavior in `@jsvision/ui` is fragmented: the `Editor` uses modern
`Ctrl+X/C/V/A`, the single-line `Input` uses the classic Turbo Vision chords
(`Ctrl+Insert`/`Shift+Insert`/`Shift+Delete`), and there is **no global layer** — nothing binds
clipboard keys application-wide. This plan makes `Ctrl+A/C/X/V` work **globally** in every editable
widget, by design, without changing per-widget code paths that already work.

The mechanism is already present in the codebase: the event loop translates a keymapped chord into a
command and routes it to the focused widget, and both editable widgets already honor clipboard
**commands**. The one gap is that there is no **default keymap** — `EventLoop.keymap` defaults to
`undefined`. This plan adds a framework default keymap that maps `Ctrl+A/C/X/V` to
`Commands.selectAll/copy/cut/paste`, adds the missing `Commands.selectAll`, wires both widgets to
handle it as a command, and makes in-app **paste** functional on every terminal via a loop-owned
app-local clipboard buffer (the `Editor`'s existing model) — with **no** OSC-52 clipboard *read*
(DEF-25 stays deferred).

The critical invariant: because the default keymap **swallows the raw chord before any view sees it**,
every globalized chord MUST be handled as a command by every editable widget — otherwise existing
behavior regresses (notably `Ctrl+A` select-all). This plan satisfies that invariant explicitly.

## Document Index

| #   | Document                                                       | Description                                       |
| --- | -------------------------------------------------------------- | ------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                 | Zero-Ambiguity Gate decisions (audit trail)       |
| 00  | [Index](00-index.md)                                           | This document — overview and navigation           |
| 01  | [Requirements](01-requirements.md)                             | Feature requirements and scope                    |
| 02  | [Current State](02-current-state.md)                           | Analysis of the current implementation            |
| 03-01 | [Default Keymap & Commands](03-01-keymap-and-commands.md)    | The default keymap, `clipboardKeys`, `Commands.selectAll` |
| 03-02 | [Clipboard Buffer & Seam](03-02-clipboard-buffer-seam.md)   | Dual-sink `setClipboard` + `readClipboard()`      |
| 03-03 | [Widget Integration](03-03-widget-integration.md)           | Input + Editor command wiring, cross-widget, gating, story |
| 07  | [Testing Strategy](07-testing-strategy.md)                     | Specification test cases (ST-*) and verification  |
| 99  | [Execution Plan](99-execution-plan.md)                         | Phases, sessions, and task checklist              |

## Quick Reference

### Usage Examples

```ts
import { createApplication } from '@jsvision/ui';

// Default: modern chords + classic aliases everywhere ('both').
const app = createApplication({ menuBar, statusLine });

// Modern-only (Ctrl+A/C/X/V, no classic aliases):
const app2 = createApplication({ clipboardKeys: 'modern' });

// Opt out entirely (hand-roll your own keymap) — e.g. an app hosting a WordStar-mode Editor:
const app3 = createApplication({ clipboardKeys: 'none', keymap });
```

Once running, a focused `Input`, `ComboBox`, `History` field, or `Editor` responds to `Ctrl+A`
(select-all), `Ctrl+C` (copy), `Ctrl+X` (cut), and `Ctrl+V` (paste). Copy in one field and paste in
another — including Editor↔Input — works within the app on every terminal.

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| Structure | Standalone plan under `jsvision-ui`, no RD; issue #73 is the spec | AR-1 |
| `Ctrl+C` | Always copy; `Alt+X` stays quit | AR-2 |
| Default mode | `clipboardKeys: 'both'` (modern + classic aliases) | AR-3 |
| Paste seam | Dual-sink `setClipboard` + `readClipboard()`; app-local buffer; no OSC-52 read | AR-4 |
| Classic classifier | Retire `Input`'s `clipboardChord()` | AR-5 |
| Cross-widget clipboard | In scope (Editor↔Input) | AR-6 |
| Enable-gating | In scope (grey `Cut`/`Copy` with no selection) | AR-7 |
| WordStar-mode Editor | Modern-first; documented opt-out via `clipboardKeys` | AR-8 |

## Related Files

**New:**
- `packages/ui/src/event/default-keymap.ts`
- `packages/examples/kitchen-sink/stories/clipboard.story.ts`
- New spec/impl test files (see [07](07-testing-strategy.md))

**Modified:**
- `packages/ui/src/status/commands.ts` — add `Commands.selectAll`; rewrite the clipboard JSDoc
- `packages/ui/src/event/event-loop.ts` — merge the default keymap; own `clipboardText`; dual-sink `setClipboard`; expose `readClipboard`
- `packages/ui/src/event/dispatch.ts` — `readClipboard` on `RouteContext` + `ev2`
- `packages/ui/src/event/types.ts` — `EventLoopOptions.clipboardKeys`
- `packages/ui/src/view/types.ts` — `DispatchEvent.readClipboard`
- `packages/ui/src/controls/input.ts` — handle `Commands.selectAll`; paste from `readClipboard()`; enable-gating
- `packages/ui/src/controls/input-clipboard.ts` — retire `clipboardChord()`
- `packages/ui/src/editor/editor-events.ts` — handle `Commands.selectAll`
- `packages/ui/src/editor/editor-clipboard.ts` — paste falls back to `readClipboard()`
- `packages/ui/src/app/application.ts` — `ApplicationOptions.clipboardKeys` → loop
- `packages/ui/src/index.ts` — barrel re-exports for any new public symbols
- `packages/examples/kitchen-sink/stories/index.ts` — register the new story
- `CHANGELOG.md`
