# Foundation: Types, Additive View Surface & Loop/Frame Ownership

> **Document**: 03-01-foundation-types-and-view-surface.md
> **Parent**: [Index](00-index.md)

## Overview

The type foundation every later component builds on: the event-handler **contract types**, the
additive `View`/`Group` fields, and the `EventLoop` skeleton that **builds and owns** the
`RenderRoot` and drives one coalesced frame per dispatch tick. Covers AC-1, AC-16, AC-17, AC-18,
AC-19.

## Architecture

### Contract types — live in `view/types.ts` (PA-8)

To let `View.onEvent` reference the envelope **without** a `view/`→`event/` import cycle, the
handler-contract types are declared alongside `View`, in `view/types.ts`, and re-exported through
both `view/index.ts` and `event/index.ts`:

```ts
import type { InputEvent } from '@jsvision/core';
import type { Point } from './geometry.js';

/** A typed command raised within the app, routed through the 3-phase machine. (AR-52) */
export interface CommandEvent {
  readonly type: 'command';
  readonly command: string;        // opaque command name, e.g. 'ok' | 'cancel' | 'quit'
  readonly arg?: unknown;          // optional payload
}

/** Any event the loop dispatches: a decoded core input event or an internal command. */
export type AppEvent = InputEvent | CommandEvent;

/**
 * The envelope the loop wraps each event in before 3-phase routing; this — not the readonly core
 * `InputEvent` — is what `View.onEvent(ev)` receives. Keeps core's event model pure. (AR-60)
 */
export interface DispatchEvent {
  readonly event: AppEvent;        // the wrapped decoded input event or internal command
  handled: boolean;                // set true by a handler to halt propagation (AR-51)
  readonly local?: Point;          // mouse/wheel coords translated to view-local (AR-50, AR-63)
}
```

### Additive `View` surface (`view/view.ts`, PA-8)

```ts
// On View (additive — defaults preserve RD-03 behavior):
focusable = false;     // TV ofSelectable; eligibility = visible && !disabled && focusable
                       // AND no !visible/disabled ancestor (AR-56, AR-65)
preProcess = false;    // participates in the pre-process sweep, root→down (AR-51, PA-2)
postProcess = false;   // participates in the post-process sweep (AR-51, PA-2)

// Retype the RD-03 stub (override-compatible widening, PA-8):
onEvent(_ev: DispatchEvent): void { /* stub stays; RD-04 dispatch fills the routing */ }
```

### Additive `Group` surface (`view/group.ts`)

```ts
// On Group (additive, @internal — the focus manager maintains it):
/** @internal The focused child in this group's local order; null until focus enters. (AR-48) */
current: View | null = null;
```

### The `EventLoop` interface & options (`event/types.ts`)

```ts
import type { InputEvent, Keymap, CapabilityProfile, Theme, Logger } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';
import type { View, RenderRoot } from '../view/index.js';
import type { AppEvent } from '../view/index.js'; // re-exported contract type

export interface EventLoopOptions {
  caps: CapabilityProfile;                 // REQUIRED — built into the loop's RenderRoot (AR-44)
  theme?: Theme;                           // forwarded to the RenderRoot (AR-35)
  logger?: Logger;                         // onEvent() + draw() errors; default disabled (AR-66)
  keymap?: Keymap;                         // core createKeymap result (AR-62, PA-1)
  commands?: Iterable<string>;             // upfront hint; unknown ⇒ enabled by default (PA-3)
  onIdle?: () => void;                     // fires when a tick's cascade queue drains (AR-58)
}

export interface EventLoop {
  readonly renderRoot: RenderRoot;         // the loop-built root (host integration + tests, AR-61)
  mount(root: View): void;                 // mount the tree into the loop's render root
  dispatch(event: AppEvent): void;         // the single pure input entry (AR-49)
  resize(size: Size2D): void;              // reflow + one flush (AR-54)
  focusNext(): void; focusPrev(): void; focusView(view: View): void; getFocused(): View | null;
  emitCommand(command: string, arg?: unknown): void;
  enableCommand(command: string, on: boolean): void; isCommandEnabled(command: string): boolean;
  execView<R>(view: View): Promise<R>; endModal<R>(result: R): void;
}
```

## Implementation Details

### `createEventLoop(viewport, opts)` — builds + owns the `RenderRoot` (`event/event-loop.ts`)

```ts
export function createEventLoop(viewport: Size2D, opts: EventLoopOptions): EventLoop;
```

- Constructs the render root via `createRenderRoot(viewport, { caps, theme, logger, schedule })`
  where `schedule` is a **deferring** seam (a no-op w.r.t. running the flush) so the root never
  self-flushes; the loop drives `renderRoot.flush()` itself once per tick (AR-61, AR-64). The same
  `logger` is reused for `onEvent` errors (AR-66).
- `mount(root)` stores the root `View` (for focus/hit-test walks) and calls `renderRoot.mount(root)`.
- Holds the focus manager (03-03), command registry (03-02), and modal stack (03-04) as loop-owned
  plain structures (no signals, AR-58).

### `runTick(work)` — the one coalesced frame (AR-60, AR-64, PA-11)

**Every** public mutator that can change focus/command/modal state and the buffer routes through a
single internal `runTick` so each produces **exactly one** coalesced frame — not just `dispatch`.
This is the PA-11/PF-001 correction: a standalone `loop.focusNext()` or `loop.emitCommand('ok')`
(both shown in the usage example and called directly by ST-04/ST-09) must paint, and `emitCommand`
must actually drain — neither holds if only `dispatch`/`resize` flush.

```
runTick(work):                       # work = a thunk that enqueues an event OR mutates focus/modal
  if draining:                       # re-entrant call (e.g. emitCommand inside a handler)
     work()                          # …just contribute to the active tick; the owner drains+flushes
     return
  draining = true
  work()                             # enqueue the initial event / perform the focus|modal mutation
  while queue non-empty:
    ev = queue.shift()
    route(ev)                         # 3-phase / hit-test (03-02, 03-03) — may enqueue commands
  draining = false
  onIdle?.()                          # cascade drained (AR-58)
  renderRoot.flush()                  # exactly one coalesced frame for the tick (AR-54, AR-64)

dispatch(event):      runTick(() => enqueue(wrap event in DispatchEvent { event, handled:false }))
emitCommand(name,arg):runTick(() => registry.emit(name, arg))     # emit enqueues a CommandEvent (03-02)
focusNext():          runTick(() => focus.next())                 # mutation only; queue stays empty → one flush
focusPrev():          runTick(() => focus.prev())
focusView(view):      runTick(() => focus.focusView(view))        # no-op mutation still flushes harmlessly
endModal(result):     runTick(() => modal.end(result))
execView(view):       runTick(() => modal.begin(view))            # push + focus modal → one frame paints it (PF-009)
                      # …then returns the Promise that endModal resolves (03-04); the push/focus is the tick's work
```

- A focus/modal mutation enqueues nothing, so its `runTick` drains an empty queue and flushes once —
  the single frame that repaints the two flipped `focused` views (AC-6/ST-06).
- A handler that **throws** in `onEvent` is caught, logged via `logger.error('event', …)`, and the
  loop continues to the next phase/event (AR-66) — mirroring RD-03's `draw()` isolation (AR-42). The
  `draining` flag is reset in a `finally` so a throw can never wedge the loop.
- `resize(size)` is the one exception to the queue path: `renderRoot.resize(size)` then
  `renderRoot.flush()` once (AR-54) — a reflow, no event cascade.

### Integration Points
- **`RenderRoot`** — built and driven by the loop; `mount`/`resize`/`flush`/`buffer` consumed
  as-is (03-04 details the deferring `schedule`).
- **`view/types.ts`** — owns the contract types; `event/` re-exports them so `@jsvision/ui` exposes
  `CommandEvent`/`DispatchEvent` as RD-04 symbols (AC-20).
- **3-phase router (03-02), focus (03-03), modal (03-04)** plug into `route(ev)`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| `View.onEvent` throws | catch → `logger.error('event', …)` → continue dispatch/render | AR-66 |
| `dispatch` given an event of unknown `type` | route by known kind; unknown ⇒ ignored no-op (never throw) | RD-04 Security § |
| `mount` before any `dispatch` | required; focus/hit-test walks no-op until a root is mounted | AR-49 |
| Re-entrant `emitCommand` inside a handler | `runTick` sees `draining` → contributes to the active tick's cascade; one flush at drain | AR-64, PA-11 |
| Standalone `focusNext`/`emitCommand`/`endModal` (outside any dispatch) | owns a fresh `runTick` → drain + exactly one flush (so the call paints) | PA-11 (PF-001) |
| Standalone `execView` (open a modal, then `await`) | the synchronous push+focus is the `runTick` work → one flush paints the opened modal; the returned `Promise` resolves later on `endModal` (never relies on `serialize()`'s force-flush) | PA-11 (PF-009) |

> **Traceability:** every strategy references the AR/PA entry that resolved it. See
> [00-ambiguity-register.md](00-ambiguity-register.md).

## Testing Requirements
- **Spec (ST-01,16,17,18,19):** pure construct with no host; one flush per tick; resize → reflow +
  one frame; `onIdle` once per drained tick; a throwing `onEvent` is logged and the loop survives.
- **Impl:** deferring `schedule` never self-flushes; `serialize()` reflects the single tick frame;
  re-entrant `emitCommand` coalesces into one flush; `onEvent` retype compiles against an
  RD-03-style `onEvent(_ev: unknown)` subclass.
