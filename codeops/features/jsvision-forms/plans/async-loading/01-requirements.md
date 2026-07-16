# Requirements — async-loading

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-07](../../requirements/RD-07-async-loading-baseline-rebase.md) (preflighted ✅ PASSED
>   — `../../requirements/00-preflight-report-rd-07.md`)

This is a **delta view** over RD-07 — the owning requirements document. RD-07 holds the full
functional/technical requirements, the 15 acceptance criteria, and the scope-decision table
(AR-46…53). This file states only what the plan adds on top: the concrete surface, the in/out scope
as the plan will build it, and the success definition. Where RD-07 owns a fact, this cites it rather
than restating it.

## What ships

A new public surface on the `Form` store (RD-07 §"New public surface"):

```ts
interface Form<S, I> {
  // …existing: field, values, rawValues, errors, isValid, dirty, validating, submit, reset, dispose
  loading(): boolean;                                             // NEW — a load is in flight
  load(loader: (ctx: { signal: AbortSignal }) => Promise<I>): Promise<boolean>; // NEW
}
```

- `load(loader)` sets `loading()` `true`, invokes `loader` with a fresh `AbortSignal`, and on success
  applies the resolved **full raw record** — replacing every field value and rebasing the whole
  baseline in one `batch()`, leaving the form **pristine** — then resolves `true`. On rejection it
  resolves `false` leaving state untouched; `loading()` returns to `false`. (RD-07 FR §Must-Have.)
- `loading()` is a form-level signal read; there is no per-field loading; `isValid()`/`submit()` do
  **not** auto-gate on it — the app composes the busy state (AR-52).
- `CreateFormOptions` is **unchanged** — load is a method, not an option (AR-46).

## In scope (this plan)

- The `load` flow inlined in `create-form.ts`: `loading`/`loadGen`/`loadController`/`disposed` state,
  the async `load` closure, and the root-body `onCleanup` that sets `disposed` + aborts an in-flight
  loader on any teardown (03-01; AR-PL1/PL2/PL3/PF-201).
- Rebasing the `baseline` on load success — the single mutation point (AR-50); `fieldDirty`/`reset`
  logic unchanged.
- Concurrency (generation counter + `AbortController`) and disposal (the `disposed` flag) correctness
  (AR-51 / PF-001).
- The kitchen-sink `forms/load` story + ST-LS1 smoke (AR-53 / AR-PL5).
- The render-path control-byte oracle for a loaded string value (AR-53 / RD-07 AC #14).
- The updated `createForm` class `@example` (load → rebase → reset) and a green `yarn verify` /
  `check:docs` (RD-07 AC #15).

## Out of scope (RD-07 §Won't Have — not built here)

- Partial-record merge load (`Promise<Partial<I>>`) — full raw replace is the model (AR-47).
- A `load:` option on `createForm` (auto-run at construction) (AR-46).
- A `loadError()` engine surface — the loader owns its failure reporting (AR-49).
- Per-field `loading()` (AR-52). `submitting()` — stays deferred to RD-08 (AR-45).
- Optimistic / streaming / paginated loading.
- Any `@jsvision/core` / `@jsvision/ui` change; any new dependency; any barrel or `async.ts` change
  (AR-PL7).

## Success criteria

The feature is done when **all 15 RD-07 acceptance criteria** are met by a green spec oracle
(mapped 1:1 in [07-testing-strategy.md](07-testing-strategy.md)), the kitchen-sink `forms/load` story
passes the headless smoke test, the loaded-string control-byte oracle is green, the `createForm`
class `@example` covers `load`/`loading`, and `yarn verify` + `check:docs` are green with no banned
CodeOps/TV references in `packages/forms/src` (AR-PL6). Verify command: **`yarn verify`**.
