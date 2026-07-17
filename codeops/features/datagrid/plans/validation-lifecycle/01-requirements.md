# Requirements: Validation & Lifecycle

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-12](../../requirements/RD-12-validation-lifecycle.md) — the OWNING requirements doc

This is a delta view over RD-12. The RD owns the feature requirements, the validation pipeline, the
state model, the security posture, and Acceptance Criteria AC-1…AC-8; this document records only what
is **in vs. out** of this plan and the plan-local decisions (all traced to the register).

## Scope of this plan (delta view)

### In this plan (RD-12 Must-Have)

- **Per-cell validation** — a typed column `validate` gate runs on the parsed value at commit; an
  invalid value blocks the commit, keeps the editor open, and marks the cell in the error role
  (RD-12 R1; AR-1).
- **Per-row cross-field gate** — `validateRow` runs on row-leave (when the row was edited); a failing
  row cannot leave, the cursor refocuses the reported invalid field, and the message surfaces
  (RD-12 R2; AR-5, AR-15, AR-16).
- **BeforeSave veto** — a per-cell `beforeSave` layered above `onCommit`; a veto reverts and surfaces
  the reason; `onCommit` is not called on veto (RD-12 R3; AR-3, AR-9).
- **Error surfacing** — an invalid-cell `gridInvalid` marker + a reactive message band; clearing the
  error clears the marker (RD-12 R4; AR-4, AR-10, AR-11).
- **Loading / empty / error states** — a caller-driven `status` input; `Spinner` while loading, a
  filter-aware empty state, an error state with a working `retry()` (RD-12 R5; AR-2, AR-6, AR-12,
  AR-13).
- **Showcase + security** — a kitchen-sink story (RD-12 AC-7) and a documented, sanitized,
  no-persistence-bypass security posture (RD-12 AC-8; AR-19, AR-21).

### Deferred / out of this plan

- **Optimistic concurrency / conflict detection** — RD-12 Should-Have, Phase B (AR-defer #10).
- **Pending "saving…" row state** — RD-12 Should-Have, Phase B.
- **Commit-error recovery / retry (per cell/row)** — RD-12 Should-Have, Phase B. (The **lifecycle**
  `error` state + `retry()` for a *load/source* failure IS in scope; per-cell commit-retry is not.)
- **Undo/redo of committed edits** — RD-12 Won't-Have.
- **Server-side validation** — the host/source owns it; the grid surfaces its result only.

## Plan-local decisions

Only decisions NOT already fixed by the RD. Full context in the register.

| Decision | Chosen | AR |
| -------- | ------ | -- |
| Per-cell validation surface | New typed `validate(value,row) => string \| null` on `GridColumn` | AR-1 |
| Lifecycle state source | Caller reactive `status?: () => GridStatus` grid option; empty auto-derived | AR-2 |
| `beforeSave` payload/timing | Per-cell `CellCommit`, above `onCommit` | AR-3 |
| Invalid-cell styling | New `gridInvalid` core theme role | AR-4 |
| `validateRow` trigger scope | Row-leave, only when the row is dirty | AR-5 |
| Empty-state config | One `emptyText` + built-in filter-aware "No matching rows" | AR-6 |
| Module placement / line guard | New modules; `grid.ts` thin; guard re-based `< 1300` → `< 1450` (added public surface crosses 1299), never by re-inlining | AR-7 |
| `beforeSave` composition | Extend `commitCell` with an optional post-apply/pre-`onCommit` gate | AR-9 |
| Parse-failure surfacing | Additively mark invalid + generic message (existing behavior preserved) | AR-14 |

## Acceptance Criteria (plan-local)

The RD owns AC-1…AC-8. This plan is complete when, in addition:

1. [ ] All ST-cases in [07-testing-strategy.md](07-testing-strategy.md) pass (spec-first).
2. [ ] The `grid.ts` line guard is re-based `< 1300` → `< 1450` across all three guard tests with the
       AR-7 rationale (the added irreducible public surface, not re-inlined logic); heavy logic stays in
       the new modules.
3. [ ] `@jsvision/core` gains the additive `gridInvalid` role with a CHANGELOG entry; every theme
       role-enumeration/count oracle is green (AR-18).
4. [ ] Zero RD-01…11 regression across the full datagrid + examples suites.
5. [ ] `yarn verify` green; `check-jsdoc` clean (every new public export carries an `@example`); no
       banned CodeOps IDs in `packages/*/src`.
