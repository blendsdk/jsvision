# Requirements: Out-of-tick Repaint (missing-flush bug class)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-04](../../requirements/RD-04-event-loop.md) — the OWNING requirements doc (event loop + one-frame-per-tick contract)
> **Driver**: GitHub issue #68

## Scope of this plan (delta view)

This plan hardens RD-04's frame contract. RD-04 established "one coalesced frame per dispatch tick"
via a loop-owned deferring `schedule` (RD-04 AR-61 / event-loop PA-11). That contract silently
assumed *every* state mutation flows through a tick. It does not — reactivity is effect-based and
fires from timers/promises/streams. This plan extends the contract to **out-of-tick** mutations.

### In this plan

- **R1 — Out-of-tick paint.** Any mutation that marks the retained tree dirty **outside** a
  `runTick` (async `finally`, timer/promise/stream callback, direct public-API call between ticks)
  must produce a painted frame without waiting for the next input event. [PA-1]
- **R2 — Coalescing.** A burst of out-of-tick invalidations in one JS turn collapses to **at most
  one** deferred paint. [PA-1, PA-5]
- **R3 — Caret fidelity.** The out-of-tick paint fires the same `onFrame` → caret pipeline as a
  tick, in the same order, so the terminal receives the frame and the caret does not drift. [PA-5]
- **R4 — No double-paint / no regression on the in-tick path.** A synchronous paint (`runTick`,
  `resize`, `mount`) must neutralise the redundant microtask Option A introduces, so in-tick
  behaviour and frame counts are unchanged. [PA-5]
- **R5 — Teardown safety.** After the app stops, a stray deferred paint must not run (no write to a
  stopped host). [PA-3]
- **R6 — Deterministic tests.** The out-of-tick paint must be steppable in tests without racing real
  microtasks. [PA-2]
- **R7 — Audit deliverable.** A written classification of every mutator / `invalidate*` site as
  in-tick vs out-of-tick (issue DoD). [PA-7 → `02-current-state.md`]

### Deferred / out of this plan

- The shipped `Desktop.removeWindow` else-branch fix — already landed (v0.2.0 / PR #70); Option A
  merely backstops it. [PA-9]
- Per-site `runTick`-wrapping of direct WM mutators — rejected in favour of the Option A backstop.
  [PA-4]
- Any web/theme-designer/files-specific test — they inherit the loop fix; tests stay in
  `packages/ui/test/`. [PA-8]

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Systemic approach (A / B / C) | A — coalesced `schedule` | PA-1 |
| Injectable microtask seam | `EventLoopOptions.scheduleMicrotask` (default `queueMicrotask`) | PA-2 |
| Lifecycle gate | `EventLoop.stop()` + `stopped` flag | PA-3 |
| Direct WM mutators | Backstop only (paint next microtask) | PA-4 |
| Painter mechanics | `paint()` trio + `flushPending` | PA-5 |
| Plan shape / RD linkage | Full multi-doc; hardens RD-04 | PA-6 |
| Test scope/location | `packages/ui/test/`, painted-frame oracles | PA-8 |

## Technical Requirements

### Performance
- At most one deferred paint per out-of-tick burst (R2). No added per-frame cost on the in-tick
  path; `flush()` is a near-no-op when nothing is dirty (`render-root.ts:332`).

### Compatibility
- **Additive public surface only** — `EventLoopOptions.scheduleMicrotask` (new optional opt) and
  `EventLoop.stop()` (new method). No existing signature changes. Behaviour of loop-wrapped mutators
  is unchanged.
- Must not regress the 90+ tests that call `renderRoot.flush()` manually, nor the 3 tests asserting
  exact `onFrame` counts (`07 §Verification`).

### Security
- No new input path. The painter re-runs the existing sanitized compose/serialize pipeline only; a
  terminal-render library has no injection/authz surface here.

## Acceptance Criteria

1. [ ] A timer-driven signal write repaints with no further input (R1, R3) — ST-1.
2. [ ] A direct `desktop.cascade()` between ticks repaints (R1) — ST-2.
3. [ ] A bare out-of-tick signal write repaints (R1) — ST-3.
4. [ ] N out-of-tick writes in one turn coalesce to one paint (R2) — ST-4.
5. [ ] `resize()` / `mount()` do not double-paint (R4) — ST-5.
6. [ ] After `loop.stop()`, a queued deferred paint does not run (R5) — ST-6.
7. [ ] The injectable `scheduleMicrotask` seam captures/steps the paint deterministically (R6) — used by ST-1…ST-6.
8. [ ] `02-current-state.md` carries the exhaustive site classification (R7).
9. [ ] Full `yarn verify` green; no regressions.
