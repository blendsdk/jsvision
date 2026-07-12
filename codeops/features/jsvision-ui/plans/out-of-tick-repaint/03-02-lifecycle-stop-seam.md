# Lifecycle Stop Seam: Out-of-tick Repaint

> **Document**: 03-02-lifecycle-stop-seam.md
> **Parent**: [Index](00-index.md)
> **Owns**: `EventLoop.stop()`, the `stopped` gate, and the `run()` wiring (PA-3)

## Overview

Add an explicit `EventLoop.stop()` that hard-gates the coalesced painter after teardown, so a deferred
paint queued just before shutdown cannot write to a stopping/stopped host. This closes Gap 2
(`02-current-state.md`).

## Architecture

### Current architecture

There is no loop lifecycle method. `run()`'s `finally` (`run.ts:132-139`) restores the terminal
(`host.stop()`) and then nulls the sinks (`onFrame = undefined; onCaret = undefined; writeClipboard =
undefined`). That makes a *post-`finally`* deferred paint harmless (the sinks are no-ops), but a
microtask firing **during** `await host.stop()` — while the sinks are still wired — could still call
`host.render` on a stopping host. With Option A introducing a microtask painter, this window becomes
reachable (e.g. a `runSpinner` timer still firing during shutdown).

### Proposed changes

- A new `stopped` boolean on `EventLoopImpl`, initially `false`.
- A public `EventLoop.stop()` that sets it `true` (idempotent).
- The coalesced painter's seam and its queued microtask both early-return when `stopped` (defined in
  03-01; this doc owns the flag + method + wiring).
- `run()`'s `finally` calls `ctx.loop.stop()` **before** it nulls the sinks (order: `host.stop()` →
  `loop.stop()` → null sinks), so the gate is closed the moment restore begins to settle.

## Implementation Details

### New method on the `EventLoop` interface (`event/types.ts`)

```ts
export interface EventLoop {
  // ...existing members...

  /**
   * Stop the loop's out-of-tick painter. After `stop()`, a mutation that would normally schedule a
   * deferred repaint (a timer, a promise continuation) is ignored, and any already-queued deferred
   * paint is skipped — so a late callback during or after teardown never writes to a stopped host.
   * Idempotent. In-tick painting is unaffected (a running loop never calls this); `run()` calls it
   * once during shutdown. Does not dispose the mounted tree.
   *
   * @example
   * // run() shutdown (simplified):
   * } finally {
   *   await host.stop();
   *   loop.stop();            // gate the painter before nulling the sinks
   *   loop.onFrame = undefined;
   * }
   */
  stop(): void;
}
```

### Implementation on `EventLoopImpl`

```ts
/** True after stop() — the out-of-tick painter is gated so no deferred paint runs post-teardown. */
private stopped = false;

stop(): void {
  this.stopped = true;
}
```

The `stopped` guard is consumed in the seam and the queued microtask (see 03-01 §The `schedule`
seam / §microtask). No other method reads it — a running loop never sets it, so `dispatch`/`resize`/
`runTick` behaviour is untouched.

### `run()` wiring (`run.ts` finally)

```ts
} finally {
  await host.stop();          // always restore the terminal
  ctx.loop.stop();            // NEW — gate the out-of-tick painter before detaching sinks
  ctx.loop.onFrame = undefined;
  ctx.loop.onCaret = undefined;
  ctx.loop.writeClipboard = undefined;
  ctx.quitState.resolve = null;
}
```

## Integration Points

- **Headless / tests** — `createApplication` used without `run()` never calls `stop()`, so `stopped`
  stays `false` and out-of-tick paints work normally (required for ST-1…ST-5 and for any headless
  consumer). ST-6 calls `loop.stop()` explicitly to assert the gate.
- **`@jsvision/web` `mountApp`** — mirrors `run()`. Wiring a `loop.stop()` into its teardown is a
  natural follow-up but **not required** by this plan (the browser host tolerates a late no-op frame;
  the gate is a `run()`-path hardening). Noted so a future edit is obvious; out of scope here (PA-8).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Deferred paint fires during `await host.stop()` | `loop.stop()` sets `stopped` before sinks detach; seam + microtask early-return | PA-3 |
| `stop()` called twice | Idempotent (sets a boolean) | PA-3 |
| `stop()` called on a headless loop that never ran | Harmless — just disables future out-of-tick paints; tests that need paints don't call it | PA-3 |

> **Traceability:** strategies cite PA-3 in `00-ambiguity-register.md`.

## Testing Requirements

- Spec: ST-6 — after `loop.stop()`, a queued deferred paint does not fire `onFrame`. See
  `07-testing-strategy.md`.
- Impl: `stop()` is idempotent; an in-tick `dispatch` after mount but before `stop()` still paints
  (the gate does not leak into the live path).
