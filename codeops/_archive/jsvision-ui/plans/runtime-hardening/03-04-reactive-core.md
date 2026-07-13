# Reactive Core Hardening: Runtime Hardening (RD-13)

> **Document**: 03-04-reactive-core.md
> **Parent**: [Index](00-index.md)
> **Covers**: HR-03 (Critical), HR-13, HR-27, HR-28, HR-29
> **Files**: `packages/ui/src/reactive/{owner.ts,scheduler.ts,computed.ts,for.ts,show.ts}`, `view/group.ts`

## Overview

Disposal/flush correctness underpins every widget's lifecycle. HR-03 and HR-13 remove real leaks in
the documented `Show`/`For`/`addDynamic` pattern; HR-27/28/29 fix error-path semantics.

## Implementation Details

### HR-03 — Disposal is final (Critical)

**Defect** (`owner.ts:141-158` + `scheduler.ts:205-216`): `dispose()` severs source edges and runs
cleanups but never marks the computation disposed; a queued effect left `DIRTY` is executed by the
flush loop, **re-collects its dependency edges**, and — because `owner.owned` was already emptied —
can never be disposed again. Repro: `batch(() => { s.set(1); dispose(scope); })` → the effect
re-runs on every future `s.set` forever. Same path via a `Show` flip / `For` row removal mid-flush.

**Fix spec.** Add a `disposed` flag to `Computation`. `dispose()` sets it on every owned
computation (recursively, as it already walks). The flag is checked:

1. at the top of the flush loop (a queued-but-disposed effect is skipped — the skip the loop
   comment already *claims*),
2. at the top of `execute`/`updateIfNecessary` (defense in depth: a disposed node never runs its
   `fn`, never re-subscribes).

Disposal is final; a disposed node's `state` is irrelevant thereafter. Both RD oracles apply: the
batch repro and the mid-flush `Show`/`For` teardown (no post-teardown execution, removed node
absent from every source's `observers`).

### HR-13 — `addDynamic` owns its combinator

**Defect** (`for.ts:119-124`, `show.ts:26-45` attach to the **ambient owner at call time**; the
spec-blessed `group.addDynamic(Show(...))` runs during construction, outside any scope → owner
`null`): after the group unmounts, the `For`/`Show` driving effect stays subscribed and keeps
reconciling into nowhere, creating never-disposed item roots. A structural leak in the documented
pattern (`view/group.ts:88-91`, `test/view.dynamic.spec.test.ts:36,63`).

**Fix spec.** `Group.addDynamic(producer)` invokes the producer **under the group's owner scope**
via the existing `runWithOwner` primitive, so the combinator's effect/computeds are owned by the
group and dispose on unmount. Signature unchanged (the producer is already a thunk-shaped accessor
— verified against `group.ts:88-91` during planning; if the current parameter is the
already-constructed combinator result rather than a callable producer, the construction call moves
inside `runWithOwner` at the `addDynamic` call boundary — the observable contract is identical).
Post-unmount `sig` writes trigger zero render calls and zero new scopes.

### HR-27 — Throwing computed stays re-evaluable

**Defect** (`scheduler.ts:90` marks CLEAN before running `fn`; `computed.ts:56-66`): a throwing
compute is left CLEAN with an uninitialized memo → later reads silently return `undefined` forever.

**Fix spec.** A compute that throws does **not** settle CLEAN (state restored to DIRTY, or an
`errored` marker holding the thrown value); the first read throws (propagation per AR-15 foundation
policy), and every subsequent read **re-throws** (re-running the compute if sources may have
changed) — never `undefined`.

### HR-28 — Compute-cycle detection

**Defect** (`scheduler.ts:81-106,171-188`): the runaway guard counts flush iterations, not compute
recursion — `a ⇄ b` computeds yield a silent `undefined`.

**Fix spec.** Detect re-entrant evaluation of a node already on the compute stack (an
`evaluating` flag set for the duration of `fn`) and throw `ReactiveCycleError` (the existing typed
error, `errors.ts`) from the read. The 1000-iteration effect guard is unchanged.

### HR-29 — Batch error policy *(Decision per PA-15)*

**Defect** (`scheduler.ts:255-263`): when the batch body throws and the closing flush also throws,
the `finally` flush's error replaces the in-flight body error.

**Fix spec (PA-15).** Follow the established reactive multi-throw precedent (plan PA-2 of
reactive-core): the **body's exception propagates**; a flush exception raised while unwinding is
routed through the existing multi-throw drain policy (first-error-rethrown, rest
`console.error`-reported) rather than masking the in-flight error. Concretely: the `finally` flush
is wrapped; if an exception is already in flight, the flush error is reported, not thrown.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Write + dispose in one batch | disposed effect skipped at flush; no resurrection | RD HR-03 (pinned) |
| Combinator created with no ambient owner via `addDynamic` | owned by the group scope | RD HR-13 (pinned) |
| Computed `fn` throws | error surfaces on read, node re-evaluable, never `undefined` | RD HR-27 (pinned) |
| Computed dependency cycle | `ReactiveCycleError` on read | RD HR-28 (pinned) |
| Batch body + flush both throw | body error wins; flush error reported | **PA-15** |

## Testing Requirements

- Spec oracles ST-1.z (HR-03 + dispose-finality property test), ST-3.d (HR-13), ST-6.a–c
  ([07-testing-strategy.md](07-testing-strategy.md)).
- Impl tests: dispose during flush of a *sibling* scope; nested `createRoot` disposal order;
  cycle through three nodes; throwing computed re-read after source change.
