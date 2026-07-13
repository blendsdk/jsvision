# Testing Strategy: Out-of-tick Repaint

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core loop logic (the painter + gate) | 90% |
| Public API surface (`scheduleMicrotask`, `stop()`) | 100% (both exercised) |

- Every oracle asserts the **painted** frame via `loop.onFrame` — never a manual
  `renderRoot.flush()`. That manual-flush habit is exactly what masked this bug class (Gap 3), so it
  is prohibited in this suite.
- The out-of-tick paint is stepped deterministically through the injected `scheduleMicrotask` seam
  (PA-2): capture callbacks into an array, trigger the mutation, then run the array. No reliance on
  real microtask timing.

### Shared test harness (all ST-cases)

```ts
// Capture deferred paints instead of queuing them; count/snapshot painted frames.
const pending: Array<() => void> = [];
const runPending = () => { const q = pending.splice(0); q.forEach((cb) => cb()); };
let paints = 0; let last: ScreenBuffer | null = null;
const loop = createEventLoop(size, { caps, scheduleMicrotask: (cb) => pending.push(cb) });
// ...mount (+ any addWindow/setup)...
runPending(); // drain the mount-time deferred paint (PA-12) so the render root's scheduled flag settles
loop.onFrame = (buf) => { paints++; last = buf.clone(); }; // wired AFTER the settle → counts only new frames
```

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from `01-requirements.md` (R1–R7), `03-01`/`03-02`, and the Ambiguity Register.
> IMMUTABLE ORACLE. The in-code traceability comment quotes the behaviour in plain language — never a
> `PA-`/`ST-`/`R#` id or a `codeops/` path (the project's shipped-code doc ban).

### Out-of-tick painter

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | Mount a `Spinner` bound to a `signal` frame; `runSpinner` over an injected fake timer; step the timer once (no input); `runPending()` | `paints === 1`; the painted `last` buffer shows the advanced spinner glyph; caret unchanged/correct | R1,R3 / PA-1,PA-5 / `run-spinner.ts:46` |
| ST-2 | Mount a desktop with 2 windows; call `desktop.cascade()` **directly** (no dispatch); `runPending()` | `paints === 1`; the painted frame shows the cascaded (stepped-offset) window geometry | R1 / PA-1,PA-4 / `desktop.ts:183` |
| ST-3 | Mount a view whose `draw` reads a `signal`; call `signal.set(next)` **outside** any dispatch; `runPending()` | `paints === 1`; the painted frame shows the new content | R1 / PA-1 / `view.ts:236-237` |
| ST-4 | Perform **N** out-of-tick `signal.set` calls in one JS turn, then `runPending()` | exactly **one** callback was queued (`pending.length === 1` before run) and `paints === 1` after | R2 / PA-5 |
| ST-5 | Wire `onFrame`, then call `loop.resize(newSize)` (paints synchronously); then `runPending()` | `resize` produced its own frame(s); the leftover deferred callback fires **0** additional `onFrame` (no double-paint) | R4 / PA-5 |
| ST-6 | Queue an out-of-tick write (callback pending); call `loop.stop()`; `runPending()` | `paints === 0` — the gated painter does not fire `onFrame`; a subsequent out-of-tick write also queues nothing / paints nothing | R5 / PA-3 |

> **AUTHORING RULE:** expectations above come from the spec, not imagined implementation output. ST-1
> reuses the shipped `desktop-removewindow-repaint.impl.test.ts` painted-frame pattern (glyph-position
> assertion on the `onFrame` buffer).

## Test Categories

### Specification Tests (from ST-cases above)
> Written BEFORE implementation. `packages/ui/test/out-of-tick-repaint.spec.test.ts`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `out-of-tick-repaint.spec.test.ts` | ST-1 … ST-6 | Coalesced painter (03-01) + stop gate (03-02) |

### Implementation Tests (edge cases, internals)
> Written AFTER implementation. `packages/ui/test/out-of-tick-repaint.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `out-of-tick-repaint.impl.test.ts` | Bursts across multiple turns; a partial vs full recompose triggered out-of-tick; caret cell correct after a deferred paint; `stop()` idempotent; an in-tick `dispatch` before `stop()` still paints; default `queueMicrotask` path (no injected seam) paints after `await Promise.resolve()` | High |

### Integration / regression
| Test | Components | Description |
| ---- | ---------- | ----------- |
| Existing `desktop-removewindow-repaint.impl.test.ts` (`toBe(1)`) | desktop + loop | Must stay green — Option A must not change its exact paint count |
| Existing `app-shell.lifecycle.impl`, `app-shell.seams.spec` (onFrame-count assertions) | app shell | Must stay green |

## Verification Checklist
- [ ] ST-1…ST-6 defined with concrete input/output pairs (above)
- [ ] Every ST case traces to R#/PA# and a code site
- [ ] Spec tests written BEFORE implementation
- [ ] Spec tests verified to FAIL before implementation (red phase) — a bare loop with the no-op
      schedule paints 0 out-of-tick frames, so ST-1…ST-4/ST-6 fail red; ST-5 may pass pre-impl
      (documented)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Impl tests written for edge cases and internals
- [ ] The 3 exact-`onFrame`-count regression tests stay green
- [ ] `yarn verify` green (lint + typecheck + build + test + check:docs) — full monorepo, no regressions
- [ ] `yarn check:docs` green — both new public symbols carry `@example` JSDoc, no `codeops/`/RD refs
