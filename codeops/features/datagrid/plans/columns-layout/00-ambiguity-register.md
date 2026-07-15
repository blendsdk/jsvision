# Ambiguity Register — Columns & Layout

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Implements**: datagrid/RD-07
> **Status**: ✅ GATE PASSED
> **Last Updated**: 2026-07-15 20:15
> **CodeOps Skills Version**: 3.7.0

The Zero-Ambiguity Gate for the columns-layout plan. RD-07 is a preflighted requirement whose
top-level architecture is already locked (pinned L/C/R panels, within-panel reorder, staged
extras); this register records (A) the four plan-level decisions the user confirmed at the gate,
(B) the design decisions grounded in the actual code (single viable path each — no strawman
alternatives), and (C) the decisions inherited verbatim from RD-07's own register.

**Same-session note:** ⚠️ This plan was authored in the same session that will review it at
preflight. A fresh-session preflight is recommended for review independence.

---

## A. User-confirmed decisions (Zero-Ambiguity Gate)

| #    | Ambiguity                                    | Options considered                                                                 | ✅ Decision                                                                                                                                                     | Status |
| ---- | -------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AR-1 | Plan scope boundary                          | (a) Must-Haves + auto-fit · (b) Must-Haves only · (c) **Everything**               | **Everything** — all Must-Haves + auto-fit (Should) + frozen ROWS + density/compact. One plan, phased data-plane-first. **Pulls frozen-rows & density forward from RD-07's Phase B/C staging.** | ✅ Resolved |
| AR-2 | Cross-panel keyboard cursor rule             | (a) **Linear left→center→right** · (b) arrows stay within panel                     | **Linear** — visible columns are one logical sequence; `←`/`→` cross freeze boundaries, `Home`/`End`/`Ctrl+Home`/`Ctrl+End` span the whole grid. **Overrides RD-07's literal "→ from last center does not enter a pinned panel"** (which conflated cursor with H-scroll). | ✅ Resolved |
| AR-3 | Showcase coverage                            | (a) **Story + showcase-app upgrade** · (b) kitchen-sink story only                 | **Both** — mandatory `columns-layout.story.ts` kitchen-sink story **and** replace the datagrid-showcase RD-07 "coming soon" placeholder (`placeholders.ts:42`) with a live demo cluster. | ✅ Resolved |
| AR-4 | Column width limits — API + defaults         | (a) **Per-column `minWidth?`/`maxWidth?` + defaults** · (b) global constants only  | **Per-column** — add optional `minWidth?`/`maxWidth?` to `GridColumn`, threaded via `toEngineColumn` to the engine `Column` (which already honors them in `measureAutoWidths`/`apportionColumns`). Global defaults: **min = 3**, **auto-fit max = 60**. | ✅ Resolved |

---

## B. Grounded design decisions (single viable path — cited to code)

These have one sensible realization given the existing seams; each is recorded with its grounding
(no strawman alternatives per the grounded-options rule). Open to revisit at preflight.

| #     | Decision                        | Realization & grounding                                                                                                                                                                                                                                                                          | Status |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AR-5  | Panel implementation            | **3 sliced `EditableGridRows` panels** (left / center / right), one per freeze group, over the same source/cursor. **Built only when freeze is configured**; no-freeze keeps today's single-body path → zero regression for RD-01…06. Grounds: RD-07 AR#8 (pinned panels); each body already computes geometry over any column subset against its own width (`grid-rows.ts:160`). | ✅ Resolved |
| AR-6  | Shared cursor / vertical scroll | Container owns `focused` (row), `selected`, and a **shared vertical-scroll position**; each panel is driven from the one `focused` signal with **identical heights** so their virtual windows stay in lockstep. **One global `focusedCol`**; each panel renders/moves the cursor only when the global index falls in its column slice. Grounds: seam hazards — `focusedCol` is one global `Signal<number>` (`editable-grid-rows.ts:89`), `topItem` is per-instance (`grid-rows.ts:105`). | ✅ Resolved |
| AR-7  | Horizontal indent ownership     | **Only the center panel binds the scrollable `indent` signal**; frozen L/R panels pin `indent = 0`. The horizontal `ScrollBar` ranges over the center panel's content only. Grounds: `indent` is shared + clamped per-view (`editable-grid-rows.ts:287-289`); RD-07 "center panel owns the horizontal indent". | ✅ Resolved |
| AR-8  | Module split (700-line cap)     | New pure **`column-model.ts`** (order / width / visibility / freeze-partition state + pure ops) — the data-plane twin of `sort.ts`/`filter.ts`. The L/C/R assembly + shared-signal binding lives in `grid.ts`; if `grid.ts` would exceed the cap, extract a **`grid-panels.ts`** builder. Grounds: `grid.ts` is already 653 lines; `sort.ts`/`filter.ts` precedent. | ✅ Resolved |
| AR-9  | Over-pinning guard              | When total frozen width ≥ viewport, **clamp so the center is never blank** and emit a **single `devWarn`** (reuse the `NODE_ENV`-gated `console.warn` at `packages/ui/src/shared/warnings.ts`). Grounds: RD-07 tech-req + acceptance #6. | ✅ Resolved |
| AR-10 | Editor overlay panel-awareness  | The in-cell editor overlay mount resolves the **owning panel's** absolute origin so an edit in a frozen cell (which does not scroll) places correctly. Grounds: overlay is a grid-local `fill` layer today (`grid.ts:258`, `overlay.ts` `absoluteRect`). | ✅ Resolved |
| AR-11 | Sticky header per panel         | Each panel gets its own `SortHeader` bound to the **shared** sort/filter signals; sort arrows + filter funnel render within each panel's header. Grounds: `SortHeader` is `columnId`-keyed and its doc anticipates binding several headers to one signal (`sort-header.ts:11-13`). | ✅ Resolved |
| AR-12 | Resize / reorder gesture home   | `SortHeader` gains **divider-grip hit-zones** (resize) and **header-drag** (reorder) via `ev.setCapture?.(this)` / `ev.releaseCapture?.()`, mirroring `Desktop.beginResize`/`onEvent` (`desktop.ts:220-271`) and `ScrollBar` thumb-drag. Resize is **live** (AC-1); reorder shows a **drop indicator** and **commits on drop**, rejecting a cross-panel drop (RD-07 AR#22). Double-click a grip → auto-fit via the live `ev.clickCount` (`view/types.ts:130`). Grounds: capture seam exists (`event-loop.ts:458`, exposed on `DispatchEvent`); the **gestures** need no core/ui change. **Amended (preflight PF-001):** the ONE ui touch in this plan is AR-17's additive `apportionColumns` param for density — the gesture layer itself is still core/ui-free. | ✅ Resolved |
| AR-13 | Column-state model shape        | `columnOrder` = `Signal<string[]>` (column ids in visible order); `columnWidths` = `Signal<Map<string, number>>` (explicit overrides; absent → engine default); `hidden` = `Signal<Set<string>>`; `freeze` derived from construction `freezeLeft?`/`freezeRight?`/`freeze?`. All container-owned, injected into panels — mirrors the `sortKeys`/`filters` signal pattern (`grid.ts:199,203`). Read API is reactive (`columnOrder()`/`columnWidth(id)`/`frozen()`), write funnels through one mutator each. | ✅ Resolved |
| AR-14 | Frozen-rows realization         | Pin the first **N data rows** as a non-scrolling band **above** the virtual body, sharing the same per-panel column geometry (the horizontal mirror of frozen columns). Construction option `freezeRows?: number`. The pinned rows never enter the vertical virtual window. Grounds: RD-07 Should (frozen rows / freeze panes). | ✅ Resolved |
| AR-15 | Density / compact mode          | A grid-level `density?: 'normal' \| 'compact'` (default `'normal'`). `'compact'` drops the inter-column `│` divider (reclaiming its 1 cell/column) and is reflected in header + all panels. No row-height change (rows are already 1 cell). Grounds: RD-07 Should (density/compact); divider is `DIVIDER` at `editable-grid-rows.ts:32`. | ✅ Resolved |
| AR-16 | Verify command                  | `yarn verify` (from CLAUDE.md — `yarn lint` then `turbo run typecheck build test check:docs`). Fills every Verify line. | ✅ Resolved |
| AR-17 | Density divider mechanism (**preflight PF-001**, user-decided) | Compact mode drops the inter-column divider via an **additive optional param on `apportionColumns`** in `@jsvision/ui` (e.g. `dividers?: boolean` / a divider-cell count), gating BOTH hardcoded reservation spots (`columns.ts:126` `- numCols`, `:157` `+ 1`). Additive/optional → existing callers unaffected. This is the plan's **one** ui touch (the earlier "forward `solveTrack`'s `gap`" idea was refuted — `solveTrack`'s gap is unrelated inter-item spacing, not the divider reservation). | ✅ Resolved |
| AR-18 | Column-order contract (**preflight PF-003**, user-decided) | `columnOrder()` returns the **visible** order; `setColumnOrder(ids)` accepts a **permutation of the currently-visible ids** and splices them back into the full order, **hidden columns keeping their anchor slots**. `columnOrderSig` remains the full order internally. | ✅ Resolved |
| AR-19 | Body build timing — construction vs reactive rebuild (**runtime**, Phase 3) | `buildGridBody` builds the panels **once at construction** from a width-independent partition (raw freeze split + over-freeze→single-body guard, `grid.ts` `initialPartition()`). The Phase-3-scoped clause of task 3.2.4 — *"rebuilt in an effect on `partitionSig`"* — is **deferred to a dedicated follow-up task (3.2.7)**: a post-mount rebuild that re-runs `buildGridBody` when the partition key changes (live `setColumnVisible`/`setColumnOrder`/`setColumnWidth`, and width-based over-pin once bounds settle). Grounds: (a) no Phase-3 spec oracle (ST-14…19) exercises a post-mount re-partition — all construct with static freeze; (b) it is **not a regression** — the single body never consumed `visibleIds` reactively pre-change either (Phase 2 added only the model API); (c) a correct live rebuild needs view-scope disposal + focus re-homing + child-order preservation, and is **cross-cutting** with the Phase 4–5 resize/reorder gestures (which also mutate width/order and need the body to reflect it), so it is best built where a gesture first exercises it. **User-decided (2026-07-15): fold 3.2.7 into Phase 4** — the resize gesture is the first model mutation that needs the body to reflect it, so the reactive rebuild + the gesture share one mechanism and one verify pass; live hide/show/reorder begin working when Phase 4 lands. | ✅ Resolved |

---

## C. Inherited from RD-07 (already user-decided at requirements time — cite, don't re-litigate)

| RD-07 AR | Decision                                                                                  |
| -------- | ----------------------------------------------------------------------------------------- |
| RD AR#8  | Freeze architecture = pinned L/C/R panels (over single-view clip). Frozen rows = staged (now pulled forward by AR-1). |
| RD AR#22 | Reorder is **constrained within its panel**; a cross-freeze-boundary drag is rejected.     |
| RD AR#10 | Auto-fit = Should (now in scope by AR-1); sizes to widest visible cell, bounded by max.    |

---

## Gate status

✅ **GATE PASSED** — all items Resolved. Section A confirmed by the user at the plan gate
(2026-07-15). Sections B/C are grounded design decisions / inherited requirements decisions. Zero
items deferred.
