# Execution Plan — form-store

> **Implements**: jsvision-forms/RD-01 + RD-02 · **Feature**: jsvision-forms
> **CodeOps Skills Version**: 3.7.0
> **Progress**: 3/16 tasks (19%)
> **Last Updated**: 2026-07-15 01:33

Specification-first ordering per feature phase: **Spec Tests → Implementation → Impl Tests &
Hardening**. Build in a separate worktree. Commits go through **/gitcm** (commit) or **/gitcmp**
(commit + push) — never raw git in this doc; commit behavior is owned by exec_plan. Run
**`yarn lint:fix`** before any PR-opening push (prime directive).

**Verify:** per task `yarn workspace @jsvision/forms test`; phase gate `yarn verify`.

---

## Phase 0 — Package scaffold

Stand up `@jsvision/forms` by mirroring `@jsvision/files` (03-01 §1). No feature logic yet.

- [x] **T0.1** Create `packages/forms/` scaffold: `package.json` (name `@jsvision/forms`, `version`
      `0.2.0`, private, ESM, exports→dist, scripts copied — the unit `test` carries `--passWithNoTests`
      for the empty-scaffold phase), `tsconfig.json` (extends base), `vitest.config.ts`
      (unit/e2e split), `README.md`/`CHANGELOG.md`/`LICENSE`, and `src/index.ts` (empty barrel).
      *Ref: 03-01 §1, 02-current-state.* ✅ (completed: 2026-07-15 01:33)
- [x] **T0.2** Add `zod` as a **peerDependency** (`^4`) + a **devDependency**; add `@jsvision/ui`
      dependency; `yarn install`; add a minimal `src/types.ts` so `typecheck` passes. *Ref: AR-02.* ✅ (completed: 2026-07-15 01:33)
- [x] **T0.3** Verify scaffold: `yarn workspace @jsvision/forms typecheck` and
      `yarn workspace @jsvision/forms test` (passes with no tests) are green; `check:deps` green. ✅ (completed: 2026-07-15 01:33)

## Phase 1 — Store + Validation

### Session A — Spec Tests (write oracles, go red)

- [ ] **T1.1** `test/store.spec.test.ts` — ST-01…ST-10 (value model, stable handles, rawValues,
      values, dirty incl. arrays, reset, isValid pre-touch, submit gate, unknown-key throw, no-warn/
      no-dispose). *Ref: 07 §ST-01…10.*
- [ ] **T1.2** `test/validation.spec.test.ts` — ST-11…ST-17 (single eager validation, field error
      first/live, form-level path-less, field-routed refine, coercion, message passthrough, touched
      store-half). *Ref: 07 §ST-11…17.*
- [ ] **T1.3** Confirm **red** — all ST fail against the empty barrel (no implementation yet).

### Session B — Implementation (go green)

- [ ] **T1.4** `src/types.ts` — `Field`, `Form`, `CreateFormOptions` (typing contract AR-18).
      *Ref: 03-01 §3.*
- [ ] **T1.5** `src/errors.ts` — `FormFieldError extends Error` (PA-6). *Ref: 03-01 §4.*
- [ ] **T1.6** `src/create-form.ts` — `createForm` via `createRoot` (PA-1); baseline snapshot (PA-6);
      field enumeration + eager value/touched signals (PA-5); memoized handles + unknown-key throw
      (AR-19/21); `rawValues`/`dirty`/`reset`/`submit` (AR-06/12/13/07). *Ref: 03-01 §5–6.*
- [ ] **T1.7** `src/validation.ts` — the single `safeParse` `computed` + `error`/`errors`/`isValid`/
      `values` derivations (AR-02/03/04/06/11); wire them into the field handles + form. *Ref: 03-02.*
- [ ] **T1.8** `src/index.ts` — export `createForm`, `FormFieldError`, and the `Form`/`Field`/
      `CreateFormOptions` types; nothing internal. *Ref: 03-01 §7.*
- [ ] **T1.9** **Green** — `yarn workspace @jsvision/forms test` passes ST-01…ST-17. Fix code, never
      the spec oracles.

### Session C — Impl Tests & Hardening

- [ ] **T1.10** `test/store.impl.test.ts` + `test/validation.impl.test.ts` — baseline immutability,
      array-dirty edges, async `onValid` awaited, `reset` clears `submitAttempted`, `values()`
      freshness. *Ref: 07 §Impl tests.*
- [ ] **T1.11** JSDoc `@example` on every public export (purpose, params/returns, the `z.coerce` +
      raw-`initial` gotchas); `yarn workspace @jsvision/forms check:docs` green; no banned refs.
      *Ref: 03-01 §8, RD-04 FR-4.7.*
- [ ] **T1.12** Security assertion (AR-22): a control-byte-laden value stored via `field.value` is
      unchanged as data and the store performs no encoding/escaping of its own. *Ref: 07 §Non-functional.*
- [ ] **T1.13** **Phase gate** — `yarn verify` green (lint → typecheck → build → test → check:docs);
      `yarn lint:fix` run and its changes staged before any PR push.

---

## Definition of done

All 16 tasks checked; ST-01…ST-17 green; `yarn verify` green; `@jsvision/forms` scaffolded with
docs and the zod peer; core/ui still zero-dep. Next plans: **RD-03** (widget binding) and **RD-04**
(kitchen-sink story + smoke).

**Kitchen-sink gate (conscious deferral).** This is a **headless** slice with no visual component; a
meaningful `forms/*` story needs RD-03 widget binding to render, so the NON-NEGOTIABLE story is
deferred to the RD-04 plan **by design**. exec_plan may mark these headless store tasks `[x]` without
a story on that basis — the gate is satisfied when RD-04 lands the story + smoke test.
