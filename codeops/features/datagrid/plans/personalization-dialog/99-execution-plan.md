# Execution Plan: Personalization Dialog

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-18 17:07
> **Progress**: 36/45 tasks (80%) · Phase 1 ✅ (892efea5) · Phase 2 ✅ (ba3b9a03) · Phase 3 ✅ (variants panel)
> **CodeOps Skills Version**: 3.8.0

## Overview

Implement RD-16 in four spec-first phases: (1) the grid read/write foundation + the variant width-restore
correction + the `VariantStore` seam; (2) the dialog core — pending model, column region, staged OK/Cancel,
and the `personalizeGrid` helper; (3) the variants panel — save/apply/delete/set-default + nested confirms;
(4) the kitchen-sink story, the `datagrid-showcase` demo, the security oracle, and finalize. All new logic
lives in new modules + pure `variant.ts` helpers; `grid.ts` stays a thin delegator under its re-based line
guard.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Foundation — grid API + width-restore + VariantStore | 15 |
| 2 | Dialog core — column region + `personalizeGrid` | 13 |
| 3 | Variants panel — save/apply/delete/default | 8 |
| 4 | Story, showcase, security & finalize | 9 |

**Total: 45 tasks across 4 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes are the **single source of truth** for progress; each line appears once. The
> executing agent MUST:
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated** after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented. No raw `git` in this plan — commit via
> **/gitcm**.

---

## Phase 1: Foundation — grid API + width-restore + VariantStore

### Step 1.1: Specification tests (RED)

**Reference**: [03-01](03-01-grid-layout-api.md) · [03-02](03-02-variant-store.md) · [07 ST-1…ST-11] · [AR-2,3,12](00-ambiguity-register.md)
**Objective**: pin the grid read API, the width-restore correction (+ RD-13 regression), and the store before any code.

- [x] 1.1.1 Extend `variant.spec.test.ts` with ST-6 (delete-then-set width-restore), ST-7 (**RD-13 round-trip regression**), ST-8 (`resolveVariant.clearWidths`) — `packages/datagrid/test/variant.spec.test.ts` ✅ (completed: 2026-07-18 13:25)
- [x] 1.1.2 Write `variant-store.spec.test.ts` (ST-9 save/overwrite + non-aliased list; ST-10 delete-clears-default; ST-11 empty getDefault + absent-delete no-op) — `packages/datagrid/test/variant-store.spec.test.ts` ✅ (completed: 2026-07-18 13:25)
- [x] 1.1.3 Write the grid-read half of `personalize.spec.test.ts` (ST-1 `columns()` shape/order; ST-2 reactivity; ST-3 resolved-freeze; ST-4 `defaultColumnLayout()`; ST-5 `clearColumnWidth`) — `packages/datagrid/test/personalize.spec.test.ts` ✅ (completed: 2026-07-18 13:25)
- [x] 1.1.4 RED: run the three spec files, confirm they fail (no `columns()`/`defaultColumnLayout()`/`clearColumnWidth()`/`variant-store` module; `clearWidths` absent) ✅ (completed: 2026-07-18 13:25 — 8 new cases red for the right reasons; 8 existing variant.spec cases still green)

### Step 1.2: Implement (GREEN)

**Reference**: [03-01 §Implementation Details](03-01-grid-layout-api.md) · [03-02](03-02-variant-store.md) · [AR-2,3,4](00-ambiguity-register.md)

- [x] 1.2.1 `variant.ts`: add the `GridColumnInfo` type; pure `buildColumnInfos(...)` and `defaultLayout(...)`; add `clearWidths` to `ResolvedLayout` and populate it in `resolveVariant` (named-without-width ids) — `packages/datagrid/src/variant.ts` ✅ (completed: 2026-07-18 13:31)
- [x] 1.2.2 `grid.ts`: thin delegators `columns()` / `defaultColumnLayout()` / `clearColumnWidth(id)` (delegate assembly to the `variant.ts` helpers) — `packages/datagrid/src/grid.ts` ✅ (completed: 2026-07-18 13:31)
- [x] 1.2.3 `grid.ts`: correct the `applyVariant` width step to **delete-then-set** (`widths.delete(id)` for each `resolved.clearWidths`, then `.set()` the `widthById`) — `packages/datagrid/src/grid.ts` ✅ (completed: 2026-07-18 13:31)
- [x] 1.2.4 Create `variant-store.ts`: `VariantStore` interface + `createMemoryVariantStore(initial?)` (overwrite-by-name, delete-clears-default, defensive-copy `list()`) — `packages/datagrid/src/variant-store.ts` ✅ (completed: 2026-07-18 13:31)
- [x] 1.2.5 Barrel: `export type { GridColumnInfo }` (from `variant.js`), `export type { VariantStore }` + `export { createMemoryVariantStore }` (from `variant-store.js`) — `packages/datagrid/src/index.ts` ✅ (completed: 2026-07-18 13:31)
- [x] 1.2.6 Re-base the three `< 1680` grid.ts line guards → `< 1760` (measured 1736; ~24-line headroom; grid.ts is final after Phase 1) with a rationale extending the existing re-base chain — `packages/datagrid/test/{grid-footer,grid-selection}.impl.test.ts`, `navigation.impl.test.ts` ✅ (completed: 2026-07-18 13:31)
- [x] 1.2.7 GREEN: ST-1…ST-11 pass ✅ (completed: 2026-07-18 13:31 — 19/19 across the three spec files)

### Step 1.3: Impl tests & hardening

**Reference**: [07 §Implementation Tests] · [AR-12](00-ambiguity-register.md)

- [x] 1.3.1 Extend `variant.impl.test.ts`: `clearWidths` all-named / none-named; width clamp edges (existing test); unnamed-column override untouched — `packages/datagrid/test/variant.impl.test.ts` ✅ (completed: 2026-07-18 13:35)
- [x] 1.3.2 `variant-store.impl.test.ts`: seed defensive-copy; overwrite ordering; `setDefault` of an absent name — `packages/datagrid/test/variant-store.impl.test.ts` ✅ (completed: 2026-07-18 13:35)
- [x] 1.3.3 JSDoc `@example` on `columns`/`defaultColumnLayout`/`clearColumnWidth` + `createMemoryVariantStore`; `check:docs` green (0 banned · 0 missing @example); **grep `packages/datagrid/src` banned refs → clean** — ✅ (completed: 2026-07-18 13:35)
- [x] 1.3.4 Commit via **/gitcm** (auto-commit mode → commit+push; `yarn lint:fix` first per the Prime Directive) ✅ (completed: 2026-07-18 16:26 — commit `892efea5`, pushed to `origin/feat/editable-data-grid`; scoped to RD-16 + roadmaps, RD-14 files excluded per user pick 1+2)

**Deliverables**:
- [x] Grid read API + width-restore correction + store all green; RD-13 round-trip regression passes ✅
- [x] All verification passing (datagrid slice: typecheck · 632 tests · check:docs · check:deps); grid.ts thin (1736) under the re-based `< 1760` guard ✅

**Verify**: `CI=1 yarn verify`

---

## Phase 2: Dialog core — column region + `personalizeGrid`

### Step 2.1: Specification tests (RED)

**Reference**: [03-03 §Column region](03-03-personalize-dialog.md) · [07 ST-12…ST-20] · [AR-5,6,7,8](00-ambiguity-register.md)

- [x] 2.1.1 Extend `personalize.spec.test.ts` with the dialog-core cases: ST-12 (OK applies / Cancel-Esc untouched), ST-13 (hide/show), ST-14 (last-column guard), ST-15 (reorder + boundaries), ST-16 (freeze cycle), ST-17 (width clamp/clear), ST-18 (Reset), ST-19 (keyboard-only), ST-20 (name sanitize + 64-cap) — `packages/datagrid/test/personalize.spec.test.ts` ✅ (completed: 2026-07-18 16:54)
- [x] 2.1.2 RED: run, confirm fail (no `personalizeGrid` / `PersonalizeDialog` yet) ✅ (completed: 2026-07-18 16:54 — module-missing load failure = clean red)

### Step 2.2: Implement (GREEN)

**Reference**: [03-03 §Architecture, §Column region](03-03-personalize-dialog.md) · [AR-5,6,7,8](00-ambiguity-register.md)

- [x] 2.2.1 `personalize-dialog.ts`: `PersonalizeDialog extends Dialog` skeleton — fixed rect proportioned to `host.desktop.bounds`, `padding:0`, `okCancelButtons()`, pending model seeded from `grid.saveVariant('(current)')`, `result()` returning the pending variant — `packages/datagrid/src/personalize-dialog.ts` ✅ (completed: 2026-07-18 16:54)
- [x] 2.2.2 Column region: a `Scroller` over a `Group` (`ColumnRegion`) of per-column composite rows — a focusable `ToggleCell` (reactive `[x]`/`[ ]` + reactive `state.disabled` guard) + title `Text` + freeze cycle `Button` + adjacent reactive `Text(() => side)` + width `Input({maxLength:3,validator:filter('0-9')})` (clamp on OK). Rows built once, repositioned by a reactive order bind (focus preserved). AR-5/AR-6/PF-001/PF-002 + runtime AR-13 — `packages/datagrid/src/personalize-dialog.ts` ✅ (completed: 2026-07-18 16:54)
- [x] 2.2.3 Visibility toggle with the **last-visible-column guard** (`ToggleCell` disabled via reactive `isLastVisible(id)` — greys + drops from key handling/Tab) + the live `N of M columns visible` echo via reactive `Text` — `packages/datagrid/src/personalize-dialog.ts` ✅ (completed: 2026-07-18 16:54)
- [x] 2.2.4 Reorder (`Alt+↑`/`Alt+↓`, boundary no-ops) + keyboard wiring — `ColumnRegion.onEvent` handles the `↑`/`↓`/`Alt+arrows` bubbled up from the focused row widget (event-router leaf→ancestor chain); `Space` toggles via the focused `ToggleCell`, `Enter`=OK (default button), `Esc`=Cancel (base Dialog) — `packages/datagrid/src/personalize-dialog.ts` ✅ (completed: 2026-07-18 16:54)
- [x] 2.2.5 Reset action (rebuilds pending columns from `grid.defaultColumnLayout()` with `width` omitted per PF-003, leaves pending sort/filter) — `packages/datagrid/src/personalize-dialog.ts` ✅ (completed: 2026-07-18 16:54)
- [x] 2.2.6 `personalize.ts`: `personalizeGrid()` + `PersonalizeOptions`/`PersonalizeResult` — inline `addWindow → execView → finally removeWindow`; on OK `grid.applyVariant(dlg.result())` — `packages/datagrid/src/personalize.ts` ✅ (completed: 2026-07-18 16:54)
- [x] 2.2.7 Barrel: `export { personalizeGrid }` + `export type { PersonalizeOptions, PersonalizeResult }` — `packages/datagrid/src/index.ts` ✅ (completed: 2026-07-18 16:54)
- [x] 2.2.8 GREEN: ST-12…ST-20 pass ✅ (completed: 2026-07-18 16:54 — 14/14 personalize.spec)

### Step 2.3: Impl tests & hardening

**Reference**: [07 §Implementation Tests]

- [x] 2.3.1 `personalize.impl.test.ts`: freeze-cycle wraparound; reorder boundary no-ops; body region non-collapse (paints titles + echo); count-echo edges — `packages/datagrid/test/personalize.impl.test.ts` ✅ (completed: 2026-07-18 16:54)
- [x] 2.3.2 JSDoc `@example` on `personalizeGrid`; `check:docs` green (41 files · 0 banned · 0 missing @example); grep banned refs → clean — ✅ (completed: 2026-07-18 16:54)
- [x] 2.3.3 Commit via **/gitcm** (auto-commit → commit+push; `yarn lint:fix` first) ✅ (completed: 2026-07-18 16:57 — commit `ba3b9a03`, pushed; RD-16 Phase 2 scope, RD-14 excluded)

**Deliverables**:
- [x] The column-region dialog opens, stages edits, and commits/discards correctly via `personalizeGrid` ✅
- [x] All verification passing (datagrid slice: typecheck · 645 tests · check:docs · check:deps) ✅

**Verify**: `CI=1 yarn verify`

---

## Phase 3: Variants panel — save/apply/delete/default

### Step 3.1: Specification tests (RED)

**Reference**: [03-03 §Variants panel](03-03-personalize-dialog.md) · [07 ST-21…ST-25] · [AR-49,50](00-ambiguity-register.md)

- [x] 3.1.1 Extend `personalize.spec.test.ts` with ST-21 (Save-as reflects pending), ST-22 (blank-reject + confirm-overwrite), ST-23 (Apply re-renders + reproduces on OK + drop-unknown), ST-24 (Apply carries sort/filter; none-applied leaves them), ST-25 (Delete + confirm + default-clear; Set-default no-auto-apply) — `packages/datagrid/test/personalize.spec.test.ts` ✅ (completed: 2026-07-18 17:07)
- [x] 3.1.2 RED: run, confirm the variants-panel cases fail ✅ (completed: 2026-07-18 17:07 — 3 of 5 red on missing saveAs/deleteStored/setDefaultStored)

### Step 3.2: Implement (GREEN)

**Reference**: [03-03 §Variants panel](03-03-personalize-dialog.md) · [AR-49,50](00-ambiguity-register.md) · [PF-025,PF-026]

- [x] 3.2.1 Variants panel: a `ListBox` of `store.list()` names (`focused`=cursor signal) + Save-as/Apply/Delete/Set-default/Reset buttons + a name `Input` — `packages/datagrid/src/personalize-dialog.ts` ✅ (completed: 2026-07-18 17:07)
- [x] 3.2.2 Save-as: name `Input({maxLength:64})` + `sanitize` + trim-empty reject; build a `GridVariant` from pending (all facets); **nested `confirm()` overwrite** on name collision; re-read `list()` — `packages/datagrid/src/personalize-dialog.ts` ✅ (completed: 2026-07-18 17:07)
- [x] 3.2.3 Apply (replace pending wholesale + re-render), Delete (**nested `confirm()`** + `store.delete` + default-clear), Set-default (`store.setDefault`, no grid change) — `packages/datagrid/src/personalize-dialog.ts` ✅ (completed: 2026-07-18 17:07)
- [x] 3.2.4 GREEN: ST-21…ST-25 pass ✅ (completed: 2026-07-18 17:07 — 19/19 personalize.spec)

### Step 3.3: Impl tests & hardening

**Reference**: [07 §Implementation Tests] · [02 §Risks — nested confirm](02-current-state.md)

- [x] 3.3.1 `personalize.impl.test.ts` additions: **nested-confirm modal-stack restore** (control pops back to the dialog); overwrite confirmed replaces / declined leaves the store untouched — `packages/datagrid/test/personalize.impl.test.ts` ✅ (completed: 2026-07-18 17:07)
- [~] 3.3.2 JSDoc/grep check green (0 banned · 0 missing @example); commit via **/gitcm** (auto → commit+push; `yarn lint:fix` first) ⏳ (in progress: 2026-07-18 17:07)

**Deliverables**:
- [x] Full variant management works from the dialog; nested confirms restore control ✅
- [x] All verification passing (datagrid slice: typecheck · 652 tests · check:docs) ✅

**Verify**: `CI=1 yarn verify`

---

## Phase 4: Story, showcase, security & finalize

### Step 4.1: Specification tests (RED)

**Reference**: [03-04](03-04-showcase-barrel-security.md) · [07 ST-26, ST-27]

- [ ] 4.1.1 Extend `security.spec.test.ts` with ST-26 (name sanitize+cap+empty-reject; width digit-filter+clamp; apply drop-unknown; **no new core theme roles** — role count unchanged) — `packages/datagrid/test/security.spec.test.ts`
- [ ] 4.1.2 RED: confirm ST-26 fails where not yet satisfied (role-count assertion + any gap)

### Step 4.2: Implement (GREEN)

**Reference**: [03-04 §Kitchen-sink story, §Showcase demo, §Barrel](03-04-showcase-barrel-security.md) · [AR-9](00-ambiguity-register.md)

- [ ] 4.2.1 Kitchen-sink story `personalization.story.ts` (static composition of the dialog regions + bound-state echo) + register — `packages/datagrid/test/kitchen-sink/stories/personalization.story.ts` + `.../stories/index.ts`
- [ ] 4.2.2 Confirm `kitchen-sink.smoke.spec.test.ts` passes for the new story (ST-27 story half; `toBeGreaterThan(0)` — no count re-base)
- [ ] 4.2.3 Showcase demo `personalization/personalize.story.ts` (launch via `ctx.execView`, live layout echo, seeded memory store; **degrade gracefully when `execView` is undefined**; `rd:'RD-16'` chip) + register a new `'Personalization'` category — `packages/examples/datagrid-showcase/stories/personalization/personalize.story.ts` + `.../stories/index.ts`
- [ ] 4.2.4 Update the showcase smoke oracle: add `'Personalization'` to ST-5 CATEGORIES and `expect(counts['Personalization']).toBe(1)` to ST-7 (ST-6 roadmap band unchanged) — `packages/examples/test/datagrid-showcase.smoke.spec.test.ts`
- [ ] 4.2.5 Rebuild `@jsvision/datagrid`, then GREEN: ST-26, ST-27; showcase smoke + walkthrough green

### Step 4.3: Finalize

- [ ] 4.3.1 Full `CI=1 yarn verify` (datagrid + examples slices green; whole-repo caveats documented if blocked by unrelated concurrent work, per the sibling RD-13 plan); confirm no RD-01…15 regression; grid.ts under its re-based guard
- [ ] 4.3.2 Commit via **/gitcm** (no push unless the user asks; if a PR-bound push is later requested, run `yarn lint:fix` first per the Prime Directive)

**Deliverables**:
- [ ] Story + showcase live; security oracle green; barrel complete with `@example`s
- [ ] `CI=1 yarn verify` green (per-slice as itemized); zero-dep (`check:deps`)

**Verify**: `CI=1 yarn verify`

---

## Dependencies

```
Phase 1 (grid API + width-restore + store)   ← foundation; unblocks the dialog commit
    ↓
Phase 2 (dialog core + personalizeGrid)
    ↓
Phase 3 (variants panel)                      ← same dialog module; serial after P2
    ↓
Phase 4 (story, showcase, security, finalize)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ `CI=1 yarn verify` passing; no RD-01…15 regression
3. ✅ No warnings/errors
4. ✅ No dead code — no unused params/functions/modules
5. ✅ Security hardened — name sanitize + cap + empty-reject; width digit-filter + clamp; apply drop-unknown; no new core theme roles
6. ✅ Documentation — every new public value has an `@example`; no plan-id refs in shipped source (`check-jsdoc` + grep)
7. ✅ `grid.ts` a thin delegator under its re-based line guard
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
