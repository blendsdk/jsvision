# Async Loading + Baseline Rebase — Implementation Plan

> **Feature**: Asynchronous record loading for `@jsvision/forms` — the "open this form to **edit an
>   existing record**" case. An imperative `form.load(loader)` runs an author-supplied async loader
>   and, on success, **replaces every field value and rebases the whole baseline** to the loaded
>   record in one `batch()`, leaving the form **pristine**; a form-level `loading()` drives the
>   "Loading…" swap. Concurrency, cancellation, and teardown reuse RD-06's ratified idioms.
> **Status**: 📋 Plan created (0/16 tasks)
> **Created**: 2026-07-16
> **Implements**: jsvision-forms/RD-07
> **CodeOps Skills Version**: 3.8.0

## Overview

Today a form's baseline is fixed at creation: the seeded `baseline` snapshot
(`create-form.ts:99`, written once at `:103`) is never rewritten, so `field.dirty()`
(`:142`) and `reset()` (`:174`) always compare against the original `initial`. There is no way to
signal "Loading…" while a record is fetched, and after a record **is** poured into the fields every
field reads as **dirty** (its value now differs from the blank `initial`) and `reset()` would wipe
the loaded record back to blank — both wrong for an edit form.

This plan adds an **imperative `form.load(loader): Promise<boolean>`** method. On success it
**replaces every field value and rebases the whole baseline** to the loaded raw record, in one
`batch()`, and leaves the form pristine — `touched` and submit-attempted cleared, `dirty()` false —
so `dirty()` now means "changed since it was loaded" and `reset()` returns to the loaded record. A
form-level `loading()` signal drives the swap. A monotonic **generation counter + `AbortController`**
make a slow load for an old request unable to clobber a newer one; a separate **`disposed` flag**
(dispose bumps no generation) makes a post-teardown settle a true no-op.

**Why a method, not a `load:` construction option?** A method is re-invokable (a Reload button, or
loading a different record into the same form), keeps I/O out of the constructor, is testable in
isolation, and is symmetric with `submit(onValid)` (RD-07 AR-46).

The change is confined to **`@jsvision/forms`** — additive edits to `types.ts` (the `Form` interface)
and `create-form.ts` (the load flow, inlined per AR-PL1) — plus **one kitchen-sink story** in
`@jsvision/examples`. No new module, no barrel change, no `async.ts` change (AR-PL7). `@jsvision/core`
and `@jsvision/ui` are untouched and stay zero runtime deps; `zod` remains the only peer dependency;
`load` uses the platform `AbortController` (no new dependency).

## Document Index

| #   | Document                                              | Description                                          |
| --- | ---------------------------------------------------- | ---------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)       | Zero-Ambiguity Gate — imported AR-46…53 + plan rows AR-PL1…PL8 |
| 00  | [Index](00-index.md)                                 | This document — overview and navigation              |
| 01  | [Requirements](01-requirements.md)                   | Delta view over RD-07 (the owning requirements doc)  |
| 02  | [Current State](02-current-state.md)                 | The exact code the plan touches (verified `file:line`) |
| 03-01 | [Load orchestration](03-01-load-orchestration.md)  | The `load` flow + `types.ts`/`create-form.ts` edits  |
| 03-02 | [Kitchen-sink load story](03-02-story.md)          | The live "Loading…" + load→edit→reset-to-loaded demo + smoke |
| 07  | [Testing Strategy](07-testing-strategy.md)           | Spec oracles (ST-L*) — every RD-07 AC maps to ≥1 oracle |
| 99  | [Execution Plan](99-execution-plan.md)               | Phases, tasks, checklist                             |

## Quick Reference

### Usage Example

```ts
import { createForm } from '@jsvision/forms';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  port: z.coerce.number().int().min(1).max(65535),
});
// Blank while we fetch; the loader maps the server record → the RAW editing shape.
const form = createForm({ schema, initial: { name: '', port: '8080' } });

// Open-to-edit: load an existing record. `loading()` drives the "Loading…" swap.
const ok = await form.load(async ({ signal }) => {
  const res = await fetch('/api/servers/42', { signal });
  const s = await res.json();
  return { name: s.name, port: String(s.port) }; // raw editing values (port as a string)
});
if (!ok) status.set('Could not load'); // rejection → false; state untouched

form.dirty();   // false — the loaded record is the new baseline
form.reset();   // returns to the LOADED record, not the blank initial
form.dispose(); // aborts an in-flight load and tears the scope down
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| Trigger surface | `form.load(loader): Promise<boolean>` method (re-invokable) | AR-46 |
| Loaded shape | Full **raw** record `Promise<I>`; replace every value + rebase whole baseline | AR-47 |
| Post-load state | Pristine — `touched` + submit-attempted cleared; `dirty()` false | AR-48 |
| Rejection | Resolve `false`; state untouched; `loading()`→false; no `loadError()` | AR-49 |
| Baseline | Mutable at one point (load success); `fieldDirty`/`reset` logic unchanged | AR-50 |
| Concurrency | Generation counter (drop superseded) + `AbortController` (cancel superseded) | AR-51 |
| **Disposal** | **`disposed` flag** (set via a root-body `onCleanup`, so it fires on `form.dispose()` **and** enclosing-scope teardown) checked before every state write + abort of an in-flight loader | AR-51 / PF-001 / PF-201 |
| `loading()` | Form-level only; independent of `isValid()`/`submit()` (app composes) | AR-52 |
| **Code placement** | **Inline in `create-form.ts`** (not a new module) | **AR-PL1 (user)** |
| **Load after dispose** | **Early-return `false`** (never sets `loading`, never calls the loader) | **AR-PL2 (user)** |
| Async on load | Automatic via the existing per-field effect; **changed fields only** (`signal.ts:52`) | AR-52 / AR-PL8 |

## Related Files

**Modify** — `packages/forms/src/types.ts` (add `Form.loading()` + `Form.load()`) ·
`packages/forms/src/create-form.ts` (inline the load flow: `loading`/`loadGen`/`loadController`/
`disposed` state, the `load` closure, the `onCleanup` teardown that sets `disposed` + aborts, the
returned-object additions, and the class `@example`; add `onCleanup` to the `@jsvision/ui` import) · `packages/examples/kitchen-sink/stories/index.ts` (register the story) ·
`packages/examples/test/kitchen-sink.smoke.spec.test.ts` (ST-LS1).

**Create** — `packages/forms/test/load.spec.test.ts` (ST-L1…L12) ·
`packages/forms/test/load.impl.test.ts` (internals/edges) ·
`packages/forms/test/load-security.spec.test.ts` (ST-L-SEC, mirrors `async-security.spec.test.ts`) ·
`packages/examples/kitchen-sink/stories/forms-load.story.ts` (the `forms/load` story).

**Deliberately unchanged** — `packages/forms/src/index.ts` (no new barrel export) ·
`packages/forms/src/async.ts` (re-validation on load rides the existing effect) ·
`packages/forms/test/surface.impl.test.ts` (5-value lock stays green — a regression check).
