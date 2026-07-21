# Async Validation — Implementation Plan

> **Feature**: Opt-in per-field asynchronous validation for `@jsvision/forms` — the "is this
>   username / email already taken?" round-trip class of check — beside the retained synchronous
>   Zod parse, with per-field `validating()`/`asyncError()`, debounce, a generation stale-guard +
>   `AbortSignal`, an async-aware `submit()`, and a `dispose()` seam.
> **Status**: ✅ Complete (28/28 tasks, `yarn verify` green — shipped 2026-07-16)
> **Created**: 2026-07-15
> **Implements**: jsvision-forms/RD-06
> **CodeOps Skills Version**: 3.7.0

## Overview

Today `@jsvision/forms` is strictly synchronous: one memoized `computed(() => schema.safeParse(
rawValues()))` (`validation.ts:25`) drives every accessor, and `submit()` gates on that sync
`isValid()` (`create-form.ts:150`). A field cannot say "checking…", a slow server answer for an old
keystroke can clobber a newer one, and `submit()` can wave through a value an async rule would
reject.

This plan adds an **opt-in per-field async validator layer that sits beside the sync parse** — it
does not replace it. A new `asyncValidators` map on `CreateFormOptions` opts a field in; the field
handle gains `validating()` and a distinct `asyncError()`; the store runs each async validator
debounced-on-change (only while the field is sync-clean), guarded by a monotonic generation counter
and an `AbortSignal`; `submit()` becomes the single authoritative async-aware gate; and `createForm`
gains an idempotent `dispose()` that tears down the whole reactive scope (the async effects are the
store's first standing subscriptions).

**Why not native Zod `.refine(async)` in one schema?** A synchronous `schema.safeParse` on a schema
that contains an async refinement **throws** (`$ZodAsyncError`, verified against the pinned
zod 4.4.3) — it would crash every accessor — and answering "which field is validating?" from a
whole-object `safeParseAsync` needs `schema.shape`, which the feature's guardrails forbid. The
per-field layer is the only model that yields field-granular `validating()` while leaving the
instant sync `isValid()` intact (AR-33). Accepted cost: cross-field **async** is out of scope
(AR-43); cross-field **sync** via `.refine`/`.superRefine` is unchanged (AR-11).

The change is confined to **`@jsvision/forms`** (a new `async.ts` module + additive edits to
`types.ts`, `create-form.ts`, `validation.ts`, the barrel) plus **one kitchen-sink story** in
`@jsvision/examples`. `@jsvision/core` and `@jsvision/ui` are untouched and stay zero runtime deps;
`zod` remains the only peer dependency; the debounce uses the platform `setTimeout`.

## Document Index

| #   | Document                                              | Description                                          |
| --- | ---------------------------------------------------- | ---------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)       | Zero-Ambiguity Gate — imported AR-33…45 + AR-P rows (incl. 3 new user decisions) |
| 00  | [Index](00-index.md)                                 | This document — overview and navigation              |
| 01  | [Requirements](01-requirements.md)                   | Delta view over RD-06 (the owning requirements doc)  |
| 02  | [Current State](02-current-state.md)                 | The exact code the plan touches (verified file:line) |
| 03-01 | [Async engine](03-01-async-engine.md)              | `async.ts` orchestration + `types.ts`/`create-form.ts`/`validation.ts` edits |
| 03-02 | [Kitchen-sink async story](03-02-story.md)         | The live "checking…" + async-error demo + smoke      |
| 07  | [Testing Strategy](07-testing-strategy.md)           | Spec oracles (ST-A*) — every RD-06 AC maps to ≥1 oracle |
| 99  | [Execution Plan](99-execution-plan.md)               | Phases, tasks, checklist                             |

## Quick Reference

### Usage Example

```ts
import { createForm } from '@jsvision/forms';
import { z } from 'zod';

const schema = z.object({ username: z.string().min(3, 'Too short') });

const form = createForm({
  schema,
  initial: { username: '' },
  asyncValidators: {
    // Runs debounced, only while the field is sync-clean. Catch your own I/O errors.
    username: async (value, { signal }) => {
      try {
        const res = await fetch(`/api/available?u=${encodeURIComponent(value)}`, { signal });
        return (await res.json()).taken ? 'Already in use' : null;
      } catch {
        return 'Could not verify'; // an uncaught rejection is treated as "no error"
      }
    },
  },
  asyncDebounceMs: 300,
});

form.field('username').validating(); // true while the check is in flight
form.field('username').asyncError();  // 'Already in use' | null (distinct from error())
await form.submit((values) => save(values)); // force-runs async, gates on it
form.dispose(); // tears down the async effects (per-dialog forms must call this)
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| Architecture | Sync parse retained + per-field async layer beside it | AR-33 |
| Config surface | `asyncValidators` map + `asyncDebounceMs` (default 300) on `CreateFormOptions` | AR-34/37 |
| Value to validator | The field's **raw** editing value; author coerces | AR-35 |
| Trigger | Debounced on change, only when sync-clean; one effect per field, own value tracked, gate untracked | AR-36 / PF-002 |
| Concurrency | Generation stale-guard (drop; bumped on supersede in the effect — not only at run-start — so correctness never depends on abort-honoring) + `AbortSignal` (best-effort cancel) | AR-38 / AR-P11 |
| Error surface | Distinct `asyncError(): string \| null`; `error()` stays sync `ZodIssue` | AR-40 |
| `isValid()`/submit | `isValid` = sync AND no async error (optimistic re pending); `submit` force-runs + awaits async then gates, cancels pending debounces first | AR-41 / PF-003 |
| Schema-async guard | Guard the sync parse; rethrow a **named** error → `asyncValidators` | AR-42 |
| Lifecycle | `dispose()` tears down the whole reactive scope; idempotent | AR-44 / PF-001 |
| **Mount run** | **Skip** — only on user changes (per-field `firstRun` guard) | **AR-P7 (user)** |
| **Stale verdict** | **Clear `asyncError` on any value change** | **AR-P8 (user)** |
| **Submit scope** | **Short-circuit `false` on sync-invalid** — no async calls on a doomed submit | **AR-P9 (user)** |
| Validator rejection | Caught → treated as no-error; documented in the `@example` | AR-P4 |
| Module boundary | New `src/async.ts` (`createAsyncValidation`) beside `validation.ts` | AR-P2 |

## Related Files

**Modify** — `packages/forms/src/types.ts` (`AsyncValidator`, options + handle/form additions) ·
`packages/forms/src/create-form.ts` (wire the async layer, expose the `createRoot` disposer as
`dispose()`, async-aware `submit()`) · `packages/forms/src/validation.ts` (schema-async guard) ·
`packages/forms/src/index.ts` (barrel-export `AsyncValidator`) · a kitchen-sink story +
`stories/index.ts` (if a new story) · `packages/examples/test/kitchen-sink.smoke.spec.test.ts`.

**Create** — `packages/forms/src/async.ts` (the orchestration module) · new spec/impl tests:
`async.spec.test.ts` (store-level async oracles ST-A1…A16), `async.impl.test.ts` (internals/edges),
and a `Text`-render control-byte oracle mirroring `security.spec.test.ts`.
