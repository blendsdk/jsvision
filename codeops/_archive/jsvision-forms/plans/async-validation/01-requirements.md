# Requirements — Async Validation

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-06](../../requirements/RD-06-async-validation.md) (the owning requirements doc)
> **CodeOps Skills Version**: 3.7.0

This is a **delta view** over RD-06 — it does not restate the RD. Read
[RD-06](../../requirements/RD-06-async-validation.md) for the full functional/technical/security
requirements and the 16 acceptance criteria; read the
[requirements register](../../requirements/00-ambiguity-register.md) (AR-33…45) and the
[RD-06 preflight report](../../requirements/00-preflight-report-rd-06.md) (PF-001…006, all applied)
for the resolved decisions. This document captures only what the plan pins beyond the RD.

## Scope (this plan)

**IN** — everything in RD-06 §Must-Have + §Should-Have, delivered inside `@jsvision/forms` plus one
kitchen-sink story:

1. `AsyncValidator<T>` type + `asyncValidators` / `asyncDebounceMs` on `CreateFormOptions`.
2. Per-field `field.validating()` + `field.asyncError()`; form-level `form.validating()`.
3. The per-field async trigger: debounced-on-change, sync-clean-gated, isolated per field (own value
   tracked, gate untracked), generation stale-guard + `AbortSignal` cancellation.
4. `isValid()` accounts for async (optimistic re pending); async-aware `submit()`.
5. Schema-async guard (named developer error, not a raw `$ZodAsyncError`).
6. `form.dispose()` — idempotent whole-scope teardown.
7. Kitchen-sink async story (live "checking…" + async error) + smoke test.
8. Security oracle: an async message is inert data; when rendered via `Text` bound to `asyncError()`
   the existing sanitisation path paints no control cell.

**OUT** (RD-06 §Won't-Have — do not build): cross-field **async** validation (AR-43); in-schema
async `.refine` support (guarded/rejected, AR-42); `form.submitting()` (RD-08, AR-45); async
`load()`/`loading()` + baseline rebase (RD-07); per-field `asyncDebounceMs` override (AR-37); any
warning-severity engine tier (GH #89 fence).

## Plan-pinned behavior (beyond the RD prose)

These are the three async-trigger lifecycle forks the RD did not pin, resolved with the user for this
plan (register AR-P7/P8/P9) — each carries a spec oracle in [07](07-testing-strategy.md):

- **Mount run — skipped (AR-P7).** The per-field trigger `effect` fires once immediately on
  `createForm` (`effect.ts:47`); it skips that first run via a per-field `firstRun` guard, so an
  async validator runs only on a genuine user change, never for the pre-filled initial value.
- **Stale verdict — cleared on change (AR-P8).** Any value change resets that field's `asyncError`
  to `null` immediately, so a just-changed value never displays the prior value's message and
  `isValid()` is not held `false` by a superseded verdict during the debounce/network window.
- **Submit — short-circuits on sync-invalid (AR-P9).** `submit()` returns `false` without invoking
  any async validator when the object is synchronously invalid; it force-runs async only when the
  sync gate is open.

## Definition of done

- All 16 RD-06 acceptance criteria met, each mapped to a spec oracle (ST-A*) in
  [07-testing-strategy.md](07-testing-strategy.md).
- The three plan-pinned forks (AR-P7/P8/P9) each have a passing oracle.
- `yarn verify` green (`lint` → `typecheck` `build` `test` `check:docs`); `check:docs` passes with an
  updated `createForm` class `@example` covering `asyncValidators`/`validating()`/`asyncError()`/
  `dispose()`; no banned CodeOps/TV references in shipped `packages/forms/src`.
- `@jsvision/forms` gains **no** new dependency; `@jsvision/core`/`@jsvision/ui` untouched (zero-dep).
- The first slice's spec oracles (ST-11…ST-17, security, surface-lock) stay green — additive change.

## Verify command (AR-P1)

`yarn verify` = `yarn lint` then `turbo run typecheck build test check:docs`. Per-package during
red/green loops: `yarn workspace @jsvision/forms test` and `yarn workspace @jsvision/examples test`.
