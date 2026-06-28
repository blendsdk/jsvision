# Ambiguity Register: jsvision UI

> **Status**: ✅ RD-01 items resolved
> **Last Updated**: 2026-06-29
> **Scope**: The `@jsvision/ui` feature-set (reimagined Turbo Vision UI layer). This
> register grows per RD; entries below cover **RD-01 (Reactive core)**.

Every decision in an RD back-references its `AR #` here. AR-01…AR-04 are explicit
user choices (offered as multiple options, user selected); AR-05…AR-11 are
single-dominant-option decisions (no second viable alternative — recorded for
traceability); AR-12 is a housekeeping decision.

| AR # | Area | Question | Options Considered | Decision | Status |
|------|------|----------|--------------------|----------|--------|
| AR-01 | RD-01 · Signal API | How are signals read/written? | (a) callable + methods `s()`/`s.set()`/`s.update()`; (b) tuple `[get,set]` (Solid); (c) ref object `.value` (Vue) | **(a) callable + methods** — read by calling, write via `.set`/`.update` | ✅ Resolved (user) |
| AR-02 | RD-01 · Effect timing | When do effects run after a write? | (a) synchronous + explicit `batch()`; (b) auto-batch on a microtask | **(a) synchronous, glitch-free; `batch(fn)` coalesces writes**; redraws are frame-scheduled by the view layer (RD-03) | ✅ Resolved (user) |
| AR-03 | RD-01 · Disposal | How are computations cleaned up on unmount? | (a) owner-scope tree + `onCleanup`; (b) manual `dispose()` handles only | **(a) owner-scope tree + `onCleanup`** — disposing a scope disposes everything created under it | ✅ Resolved (user) |
| AR-04 | RD-01 · `For` keying | How are list items keyed for reconciliation? | (a) key function; (b) reference identity; (c) index | **(a) key function** `key: item => item.id` — stable identity across moves | ✅ Resolved (user) |
| AR-05 | RD-01 · Equality | When does a write count as a change? | Referential `Object.is` (dominant); deep-equal (rejected: cost/ambiguous); always-notify (rejected: wasteful) | **`Object.is` by default**, skip notify if unchanged; per-signal `equals` override; `equals: false` forces always-notify | ✅ Resolved |
| AR-06 | RD-01 · Computed | Eager or lazy evaluation? | Lazy + memoized (dominant); eager (rejected: computes unused values) | **Lazy + memoized** — recompute on read only after a dependency changed | ✅ Resolved |
| AR-07 | RD-01 · Consistency | May an effect observe a partially-updated graph? | Glitch-free topological order (requirement); ad-hoc (rejected: incorrect) | **Glitch-free required** — dependents run in topological order; no inconsistent intermediate reads | ✅ Resolved |
| AR-08 | RD-01 · Untracked read | Provide a non-subscribing read? | Provide `untrack(fn)` (standard); omit (rejected: needed for effects that read-without-depending) | **Provide `untrack(fn)`** | ✅ Resolved |
| AR-09 | RD-01 · Reactive↔view seam | Where does "mark widget dirty" live? | RD-01 owns primitives only, RD-03 owns binding (dominant); RD-01 owns widget invalidation (rejected: couples reactivity to views) | **RD-01 provides `effect`/owner/`onCleanup`; the view spine (RD-03) binds a property by creating an effect that marks its widget dirty.** No VDOM. | ✅ Resolved |
| AR-10 | RD-01 · Packaging | Where does it live + dependency policy? | `packages/ui/src/reactive/`, zero deps, ESM/NodeNext, re-exported via the single `@jsvision/ui` entry (only viable per project conventions) | **As stated** — pure TS, zero runtime deps (passes `check:deps`) | ✅ Resolved |
| AR-11 | RD-01 · `Show` semantics | What does `Show` do? | `Show(cond, then, else?)` mounts one branch, disposes the inactive branch's scope, re-evaluates on `cond` change (dominant) | **As stated** | ✅ Resolved |
| AR-12 | Feature-set · Requirements folder | Reuse the existing `requirements/` set or start fresh? | Start fresh for the UI feature-set; archive the stale foundation scaffolding (dominant — foundation is done/archived); reuse (rejected: mixes two feature-sets, old `@blendsdk/tui` name) | **Fresh UI set; foundation README/register/_draft moved to `plans/_archive/foundation/requirements/`; RD numbering restarts at RD-01** | ✅ Resolved |
