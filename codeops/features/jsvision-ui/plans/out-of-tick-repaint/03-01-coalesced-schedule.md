# Coalesced Out-of-tick Painter: Out-of-tick Repaint

> **Document**: 03-01-coalesced-schedule.md
> **Parent**: [Index](00-index.md)
> **Owns**: the painter design, signatures, and the `flushPending`/`paint()` mechanics (PA-1, PA-2, PA-5)

## Overview

Replace the event loop's no-op `schedule` seam with a painter that coalesces a burst of out-of-tick
invalidations into **one** microtask-deferred paint, reusing the exact frame pipeline a tick uses.
This closes Gap 1 (`02-current-state.md`).

## Architecture

### Current architecture

`EventLoopImpl` builds the render root with `schedule: () => {}` (`event-loop.ts:189-195`). The render
root's `scheduleFlush()` (`render-root.ts:326`) sets `scheduled = true` and calls that no-op; nothing
paints out-of-tick. The only paint is the trailing trio at `runTick`'s tail (`event-loop.ts:375-377`).

### Proposed changes

The `schedule` seam becomes a real handler backed by two loop-owned flags and one extracted method:

- **`draining`** (existing) — true while a tick is in progress.
- **`flushPending`** (new) — true while a deferred out-of-tick paint is queued and not yet run.
- **`stopped`** (new; owned by `03-02`) — true after teardown.
- **`paint()`** (new, extracted from `runTick`'s tail) — the shared frame pipeline.
- **`scheduleMicrotask`** (new injectable seam) — how the deferred paint is enqueued.

## Implementation Details

### New types / options

```ts
// event/types.ts — EventLoopOptions (additive, optional)
export interface EventLoopOptions {
  // ...existing (caps, theme, logger, keymap, commands, onIdle, now, quitCommand, onQuit, revealKey)...

  /**
   * How the loop defers an out-of-tick repaint. Defaults to `queueMicrotask`. A mutation that reaches
   * the retained tree outside a dispatch tick (a timer, a promise continuation, a direct API call
   * between ticks) is painted on the callback this schedules — coalesced so a burst produces one
   * frame. Inject a capturing implementation to step the deferred paint deterministically in tests.
   *
   * @example
   * const pending: Array<() => void> = [];
   * const loop = createEventLoop(size, { caps, scheduleMicrotask: (cb) => pending.push(cb) });
   * // ...cause an out-of-tick signal write...
   * pending.forEach((cb) => cb()); // run the deferred paint
   */
  scheduleMicrotask?: (cb: () => void) => void;
}
```

### New fields on `EventLoopImpl`

```ts
/** How a deferred out-of-tick paint is enqueued (default queueMicrotask). */
private readonly scheduleMicrotask: (cb: () => void) => void;
/** True while a deferred out-of-tick paint is queued and not yet run — coalesces a burst to one paint. */
private flushPending = false;
// `stopped` is added by 03-02.
```

Constructor: `this.scheduleMicrotask = opts.scheduleMicrotask ?? ((cb) => queueMicrotask(cb));`

### The `schedule` seam (replaces the no-op at `event-loop.ts:193`)

```ts
schedule: () => {
  // In-tick, the trailing paint() already covers this; after teardown, never paint. Coalesce a
  // burst into one queued microtask via the flushPending guard.
  if (this.draining || this.stopped || this.flushPending) return;
  this.flushPending = true;
  this.scheduleMicrotask(() => {
    // A synchronous paint (a tick, resize, or mount) may have run first and cleared flushPending;
    // if so, this deferred paint is redundant — skip it. Never paint after stop().
    if (this.stopped || !this.flushPending) return;
    this.paint();
  });
},
```

> The render root's `scheduleFlush()` passes a `flush` callback to the seam; the loop **ignores** it
> and enqueues `paint()` instead, because `paint()` already calls `renderRoot.flush()` **and** the
> `onFrame`/caret steps the render root's own flush omits (PA-5).

### The extracted `paint()` (from `event-loop.ts:375-377`)

```ts
/**
 * Paint one frame: flush the render root, hand the composed buffer to the host, then report the
 * caret. The order is load-bearing — `onFrame` only stashes the frame; `emitCaret`→`onCaret` writes
 * it to the terminal together with the caret (run.ts) — so caret must follow frame. Clears
 * flushPending so any still-queued deferred paint becomes a no-op. Does NOT call onIdle (that is
 * command-queue-drain semantics, owned by runTick).
 */
private paint(): void {
  this.flushPending = false;
  this.renderRoot.flush();
  this.onFrame?.(this.renderRoot.buffer());
  this.emitCaret();
}
```

### Call-site edits

- **`runTick` tail** (`event-loop.ts:374-377`): keep `this.onIdle?.()`, then replace the inline trio
  with `this.paint();`.
- **`resize`** (`event-loop.ts:243-244`): after its existing `onFrame`/`emitCaret`, add
  `this.flushPending = false;` (its synchronous `renderRoot.flush()` already made the queued
  microtask redundant).
- **`mount`** (`event-loop.ts:203-208`): after `emitCaret()`, add `this.flushPending = false;`.

## Integration Points

- **Render root** — unchanged. `scheduleFlush`/`scheduled` still coalesces multiple invalidations
  into one call to the loop's seam; `flush()` is still the near-no-op dirty-diff.
- **`run()`** — unchanged for the paint path; `paint()` fires the same `onFrame`/`onCaret` sinks
  `run()` wires. (`run()` gains only the `loop.stop()` call — 03-02.)
- **`createApplication`** — no change; a real app takes the default `queueMicrotask`. The seam is
  injected only by tests (or an advanced embedder) via `createEventLoop`.

## Behaviour walk-through (why coalescing + no double-paint holds)

| Scenario | Trace | Result |
| -------- | ----- | ------ |
| Out-of-tick signal write | `bind` effect → `invalidate` → `scheduleFlush` (render root `scheduled=true`) → seam (`draining=false`) → `flushPending=true` + microtask → microtask runs `paint()` | 1 frame ✅ |
| N out-of-tick writes, one turn | first sets `flushPending`; the rest early-return (`flushPending` already true; render-root `scheduled` also true) | 1 frame ✅ |
| In-tick mutation | seam sees `draining=true` → returns; `runTick` tail `paint()` | 1 frame ✅ (no microtask) |
| `resize()` / `mount()` | inline `renderRoot.flush()` schedules a microtask (`draining=false`); the method ends `flushPending=false` → microtask no-ops | 1 frame ✅ |
| Tick pre-empts a queued microtask | tick `paint()` clears `flushPending`; the microtask then sees `!flushPending` → returns | no redundant frame ✅ |
| After `stop()` | seam returns on `stopped`; a queued microtask returns on `stopped` | no paint ✅ (03-02) |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Wrong trio order drops the frame / drifts caret | `paint()` fixes `flush → onFrame → emitCaret` order; reused by both call sites | PA-5 |
| Racing tick + microtask double-paint | `draining` guard (no schedule in-tick) + `flushPending` guard (microtask no-ops after a sync paint) | PA-5 |
| Redundant paint after resize/mount | `flushPending = false` at the end of `resize`/`mount` | PA-5 |
| Deferred paint after teardown | `stopped` guard in seam + microtask | PA-3 (03-02) |
| `onFrame`/`onCaret` handler throws in the deferred paint | Same posture as the in-tick path (the sinks are host/`run()` code); teardown gate prevents the post-stop case | PA-3 |

> **Traceability:** every strategy above cites its PA-# in `00-ambiguity-register.md`.

## Testing Requirements

- Spec (painted-frame oracles via `loop.onFrame`, injected `scheduleMicrotask`): ST-1 (timer spinner),
  ST-2 (direct `desktop.cascade()`), ST-3 (bare out-of-tick write), ST-4 (coalescing), ST-5
  (resize/mount no double-paint). See `07-testing-strategy.md`.
- Impl: multiple bursts across turns; a partial vs full recompose out-of-tick; caret position after a
  deferred paint.
