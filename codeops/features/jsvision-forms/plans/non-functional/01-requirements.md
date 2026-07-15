# Requirements: Non-Functional (RD-04)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-04](../../requirements/RD-04-non-functional.md) — the OWNING requirements doc

This is a delta view only; RD-04 owns the functional/non-functional requirements and their
acceptance criteria. Do not restate them here.

## Scope of this plan (delta view)

### In this plan
- **RD-04 FR-4.6** — the NON-NEGOTIABLE kitchen-sink `forms/*` story + smoke test (the marquee
  deliverable). Requires adding `zod` + `@jsvision/forms` to `packages/examples`. See `03-01`.
- **RD-04 FR-4.3** — the render-path security test (the one genuine coverage gap). See `03-02 §Render-path security`.
- **RD-04 FR-4.5** — spec-coverage audit: every RD-01/02/03 AC traces to a passing spec test; fill
  only genuine gaps. See `03-02 §Coverage audit` + `07`.
- **RD-04 FR-4.2** — barrel-surface lock test (the surface is already correct; add the regression
  guard). See `03-02 §Surface lock`.
- **RD-04 FR-4.8** — the green `yarn verify` + `yarn lint:fix` gate before any PR-opening push.

### Already satisfied (verify-only — no net-new work in this plan)
- **RD-04 FR-4.1** (package & deps) — `packages/forms/package.json` already declares `@jsvision/ui`
  dep + `zod` peer/dev; `yarn workspace @jsvision/forms check:deps` is green (`AR-P` recon
  2026-07-15). This plan only re-runs it under `yarn verify`.
- **RD-04 FR-4.7** (documentation) — `check:docs` reports `8 files · 0 banned refs · 0 missing
  @example` (recon 2026-07-15). This plan only re-runs it, and covers the **new** examples/story
  code under the same JSDoc discipline.
- **RD-04 FR-4.4** (performance) — no-op by design (AR-23): no debounce, no bench extension.

### Deferred / out of this plan
- Everything in RD-04 §Out of scope: npm publish, bench-harness extension, async-slice perf work
  (debounce). Plus all requirements-register AR-17 deferrals.

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Render-path security proof | Add `security.spec.test.ts` render-path oracle | AR-P2 |
| Coverage-audit depth | Map every RD-01/02/03 AC → spec test; fill only real gaps | AR-P3 |
| Story submit UX | Echo submitted values; invalid submit reveals errors | AR-P4 |
| Story concrete design | Server-connection form (see `03-01 §Story spec`) | AR-P5 |
| Barrel-surface AC | Runtime keys-exactly impl test | AR-P6 |
| Verify command | `yarn verify` | AR-P7 |

## Acceptance Criteria

RD-04 owns the acceptance criteria (`../../requirements/RD-04-non-functional.md` §Acceptance
criteria). This plan adds no plan-local criteria beyond them; the execution plan's Success Criteria
map 1:1 to that list.
