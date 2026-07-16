# Execution Plan — widget-binding

> **Implements**: jsvision-forms/RD-03 · **Feature**: jsvision-forms
> **CodeOps Skills Version**: 3.7.0
> **Progress**: 11/11 tasks (100%) · Complete — `yarn verify` green (26/26 turbo tasks), forms 45/45
> **Last Updated**: 2026-07-15

Specification-first ordering per phase: **Spec Tests → Implementation → Impl Tests & Hardening**.
Commits go through **/gitcm** (commit) or **/gitcmp** (commit + push) — never raw git in this doc;
commit behavior is owned by exec_plan. Run **`yarn lint:fix`** before any PR-opening push (prime
directive) and commit its changes.

**Verify:** per task `yarn workspace @jsvision/forms test`; phase gate `yarn verify`.

The package already exists (RD-01/02) — **no scaffold phase**. All work is additive: three new
modules, three new barrel exports, and a one-line registration edit to `create-form.ts`.

---

## Phase 1 — Binding helpers

### Session A — Spec Tests (write oracles, go red)

- [x] **T1.1** `test/bind-field.spec.test.ts` — ST-01 (direct text two-way), ST-02 (direct switch
      two-way), ST-03 (`bindField` touched: not-on-mount / not-on-enter / on-first-leave / cleaned-up-
      on-unmount). Uses the real-loop helpers (`createEventLoop`/`key`/`caps`). *Ref: 07 §ST-01…03.*
      (ST-01/02 green — direct bind needs no new code; external-set reads flush the coalesced paint.)
- [x] **T1.2** `test/adapters.spec.test.ts` — ST-04 (`bindRadio` lens), ST-05 (`bindCheck` lens),
      ST-06 (choice widgets keep the domain schema), ST-07 (adapters are pure lenses). *Ref: 07
      §ST-04…07.*
- [x] **T1.3** Confirm **red** — the 5 impl-dependent ST fail against the missing exports
      (`bindField`/`bindRadio`/`bindCheck` not yet in the barrel); ST-01/02 green.

### Session B — Implementation (go green)

- [~] **T1.4** `src/internal.ts` — the `touchedSinks` `WeakMap<object, () => void>` registry
      (PA-1); **and** the one-line registration in `create-form.ts` right after
      `handles.set(key, handle)` (`create-form.ts:125`). *Ref: 03-01 §A.* (impl 2026-07-15)
- [~] **T1.5** `src/bind-field.ts` — `bindField<T>(field, view)`: sink lookup + foreign-handle throw
      (PA-1), the `bound` idempotency guard (PA-3), and the `onMount`→`bind` touched effect (PA-2,
      PA-8). *Ref: 03-01 §B.* (impl 2026-07-15)
- [~] **T1.6** `src/bind-choice.ts` — `bindRadio` + `bindCheck` stateless lenses over `field.value`
      (`Object.assign(read, {peek,set,update})`). *Ref: 03-02.* (impl 2026-07-15)
- [~] **T1.7** `src/index.ts` — export `bindField`, `bindRadio`, `bindCheck` (do **not** export the
      registry). *Ref: 03-01, 03-02.* (impl 2026-07-15)
- [x] **T1.8** **Green** — `yarn workspace @jsvision/forms test` passes ST-01…ST-07 (34/34); forms
      `typecheck` clean. Fix code, never the spec oracles.

### Session C — Impl Tests & Hardening

- [x] **T1.9** `test/bind-field.impl.test.ts` + `test/adapters.impl.test.ts` — idempotency (bind wired
      once), foreign-field throw, focus-in-no-leave / multi-cycle, `.update` routing, out-of-range
      `.set` (undefined, no guard), `bindCheck.set` flag-length edges + empty options, direct-bind
      store→widget for `Input`/`Switch`. *Ref: 07 §Impl tests.* (11 impl tests)
- [x] **T1.10** JSDoc `@example` on `bindField`/`bindRadio`/`bindCheck` (real, copy-pasteable — the
      direct-bind gotcha, the domain-value adapter usage, the `bindField(field, view)` wiring); code
      comments explain the *why* (the touched write seam, the focus-order invariant) in plain
      language with **no** process-ID / plan / Turbo-Vision references. Also broaden
      `FormFieldError`'s JSDoc to name the foreign-handle trigger (preflight PF-002; docs-only, type
      unchanged). `yarn workspace @jsvision/forms check:docs` green (0 banned refs, 0 missing @example).
      *Ref: 01 success criteria.*
- [x] **T1.11** **Phase gate** — `yarn verify` green (lint → typecheck → build → test → check:docs,
      26/26 turbo tasks); `yarn lint:fix` run (no changes needed); core/UI still zero-dep and forms
      gained no new dependency (the `View`/`Signal` imports are type-only).

---

## Definition of done

All 11 tasks checked; ST-01…ST-07 green; `yarn verify` green; the barrel exports
`bindField`/`bindRadio`/`bindCheck` with `@example`s; the public `Field` surface is **unchanged**
(the touched seam is internal, PA-1); core/UI/forms dependency surface unchanged. Next plan: **RD-04**
(non-functional + the kitchen-sink `forms/*` story that renders a form with these bindings).

**Kitchen-sink gate (conscious deferral, PA-9).** RD-03 ships binding *helper functions*, not new
visual components (the widgets it binds already have stories). The NON-NEGOTIABLE `forms/*` story is
a rendered form, which RD-04 owns — exec_plan may mark these tasks `[x]` without a story on that
basis, exactly as the form-store plan deferred it.
