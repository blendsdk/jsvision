# Out-of-tick Repaint (missing-flush bug class) Implementation Plan

> **Feature**: Close the systemic "state mutations outside a loop tick don't repaint" bug class by turning the event loop's no-op `schedule` seam into a coalesced out-of-tick painter.
> **Status**: Planning Complete
> **Created**: 2026-07-12
> **Implements**: jsvision-ui/RD-04 (hardens the event loop's flush contract)
> **Driver**: GitHub issue #68
> **CodeOps Skills Version**: 3.4.1

## Overview

The `@jsvision/ui` event loop paints exactly one coalesced frame at the tail of every `runTick`.
Every loop-wrapped mutator (`dispatch`, `emitCommand`, `focus*`, `execView`/`endModal`, `setTheme`,
`resize`) runs inside a tick, so it paints. But the loop constructs its render root with a **no-op
`schedule`** (`event-loop.ts:193`), so any mutation that reaches the retained tree **outside** a tick
— an async continuation after `await`, a timer/promise/stream callback, or a direct public-API call
between ticks — marks the frame dirty and then stops. Nothing paints until the next input event
happens to run a tick, so the screen silently goes stale. This is the root of the "I have to click
twice" symptom and a whole class of latent staleness bugs.

The shipped fix for the exemplar (`Desktop.removeWindow`, v0.2.0 / PR #70) was a one-liner; this plan
closes the **class**. The chosen approach (**Option A**, PA-1) replaces the no-op `schedule` with a
painter that coalesces a burst of out-of-tick invalidations into a single microtask-deferred paint.
The coalescing machinery already exists in the render root (`scheduleFlush`/`scheduled`,
`render-root.ts:326`), and `flush()` is already a near-no-op when nothing is dirty — so the change is
small and confined to the loop. A new explicit `EventLoop.stop()` hard-gates the painter after
teardown, and a new injectable `EventLoopOptions.scheduleMicrotask` seam makes the out-of-tick paint
steppable in tests.

Because every JSVision runtime (`@jsvision/web`'s `mountApp`, `@jsvision/theme-designer`,
`@jsvision/files` dialogs) drives the same loop, the fix propagates to all of them without per-package
work.

## Document Index

| #   | Document                                                        | Description                                                  |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                  | Zero-Ambiguity Gate decisions (PA-1…PA-11) — audit trail     |
| 00  | [Index](00-index.md)                                            | This document — overview and navigation                      |
| 01  | [Requirements](01-requirements.md)                             | Scope delta against RD-04                                     |
| 02  | [Current State](02-current-state.md)                           | The 41-site audit + gaps (issue DoD deliverable)             |
| 03-01 | [Coalesced Out-of-tick Painter](03-01-coalesced-schedule.md) | The `schedule` seam, `paint()`, `flushPending`, `scheduleMicrotask` |
| 03-02 | [Lifecycle Stop Seam](03-02-lifecycle-stop-seam.md)          | `EventLoop.stop()` + `stopped` gate, wired from `run()`       |
| 07  | [Testing Strategy](07-testing-strategy.md)                     | ST-cases (painted-frame oracles) + verification              |
| 99  | [Execution Plan](99-execution-plan.md)                         | Phases, tasks, spec-first ordering                            |

## Quick Reference

### Usage Examples

```ts
// A timer that updates a signal now repaints with NO further input (the target case).
import { Group, Spinner, runSpinner, signal, createApplication } from '@jsvision/ui';

const frame = signal(0);
const app = createApplication({ caps });
// ...mount a Spinner bound to `frame`...
const stop = runSpinner(frame, { timer: app.runtime, intervalMs: 80 });
// Each tick advances `frame` out-of-tick; the coalesced painter now flushes a frame each time.
```

```ts
// Deterministic tests: inject the microtask seam and step it by hand.
const pending: Array<() => void> = [];
const loop = createEventLoop({ width: 40, height: 12 }, {
  caps,
  scheduleMicrotask: (cb) => pending.push(cb), // capture instead of queueMicrotask
});
// ...trigger an out-of-tick signal write...
pending.forEach((cb) => cb()); // run the deferred paint; assert loop.onFrame fired
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| Systemic approach | Option A — coalesced `schedule` (not B/C) | PA-1 |
| Injectable seam | `EventLoopOptions.scheduleMicrotask` (default `queueMicrotask`) | PA-2 |
| Lifecycle gate | `EventLoop.stop()` + `stopped` flag; `run()` finally calls it | PA-3 |
| Direct WM mutators | Backstop only — they paint on the next microtask | PA-4 |
| Painter mechanics | `paint()` trio + `flushPending` coalescing | PA-5 |
| Plan shape / RD | Full multi-doc; hardens RD-04 | PA-6 |
| Test location | `packages/ui/test/`, painted-frame oracles only | PA-8 |

## Related Files

- `packages/ui/src/event/event-loop.ts` — the `schedule` seam → coalesced painter; `paint()` extraction; `flushPending`; `stopped`; `stop()`
- `packages/ui/src/event/types.ts` — `EventLoopOptions.scheduleMicrotask`; `EventLoop.stop()`
- `packages/ui/src/app/run.ts` — `finally` calls `loop.stop()` after `host.stop()`
- `packages/ui/test/out-of-tick-repaint.spec.test.ts` / `.impl.test.ts` — new painted-frame regression suite
