# Ambiguity Register — Filter Entry Point

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Implements**: datagrid/RD-06
> **Status**: ✅ GATE PASSED
> **Last Updated**: 2026-07-16 01:53
> **CodeOps Skills Version**: 3.8.0

The Zero-Ambiguity Gate for the filter-entry-point plan (GitHub issue #92). This work makes the
condition-filter popup + value-list reachable on an as-yet-unfiltered column. The register records
(A) the user-confirmed decisions taken at the gate, (B) design decisions grounded in the actual code
(single viable path each, cited to `file:line`), and (C) the concrete RD-06 revision this plan folds
in (the "funnel only on filtered columns" rule is a documented RD-06 requirement + acceptance
criterion, so changing it is a requirements change, not a silent edit).

**Same-session note:** ⚠️ This plan was authored in the same session that discovered the defect.
A fresh-session preflight is recommended for review independence before exec_plan.

---

## A. User-confirmed decisions (Zero-Ambiguity Gate)

| #    | Ambiguity | Options considered | ✅ Decision | Status |
| ---- | --------- | ------------------ | ---------- | ------ |
| AR-1 | Entry point to open the popup on an unfiltered column | (a) always-visible funnel · (b) keyboard only · (c) **both** | **Both** — an always-visible funnel on every filterable column *and* an `Alt+Down` keyboard opener. Maximizes discoverability (mouse) and accessibility (keyboard). | ✅ Resolved |
| AR-2 | How to handle the RD-06 requirement this contradicts | (a) **fold the RD-06 revision into this plan** · (b) separate requirements pass first | **Fold in** — this register records the requirements change and a plan task revises RD-06 §Funnel + AC#4 alongside the ST-19 re-spec (see §C). | ✅ Resolved |
| AR-3 | Which columns show the funnel / opener | (a) **only filterable columns** · (b) every column | **Only filterable columns.** Since `resolveFilterType` never fails today (`filter.ts:220` defaults to `'text'`), give "filterable" real meaning via a new opt-out flag (AR-8). | ✅ Resolved |
| AR-4 | What the three broken showcase stories demonstrate after the fix | (a) **keep quick-filter + new entry point** · (b) new entry point only | **Keep both** — the stories retain the quick-filter row *and* gain the new entry point; hints reworded to match the final interaction. | ✅ Resolved |
| AR-5 | Keyboard opener key | (a) **Alt+Down** · (b) Ctrl+Shift+F | **Alt+Down**, from the *non-editing* grid body, opens the focused column's popup. Excel's open-filter-dropdown convention. (Preflight PF-001: Alt+Down is *repurposed* from the base's modifier-agnostic row-down, not filling a void — see AR-9.) | ✅ Resolved |
| AR-6 | Funnel active/inactive visual distinction | (a) **muted vs normal, same ▽** · (b) different glyphs | **Same ▽ glyph**, drawn in the muted divider tone (`listDivider`) when unfiltered and the normal header tone (`tableHeader`) when a filter is active. Existing theme roles, no new role. | ✅ Resolved |
| AR-7 | Funnel's interaction with column width | (a) **always reserve, drop-first when narrow** · (b) reserve only when it fits | **Always reserve** one cell for the funnel on each filterable column (title 1 cell narrower); when a column is too narrow the funnel is dropped **before** the sort arrow (today's precedence). The `Alt+Down` opener still works when the glyph is dropped. | ✅ Resolved |
| AR-8 | How "filterable" is determined | (a) **add `filterable?: boolean` (default true)** · (b) all columns filterable | **Add `filterable?: boolean`** to `GridColumn` (default `true`); the funnel + `Alt+Down` opener appear only when `col.filterable !== false`. New public-API field (JSDoc + `@example` required). | ✅ Resolved |

---

## B. Grounded design decisions (single viable path — cited to code)

These have one sensible realization given the existing seams; each is recorded with its grounding
(no strawman alternatives per the grounded-options rule). Open to revisit at preflight.

| #     | Decision | Realization & grounding | Status |
| ----- | -------- | ----------------------- | ------ |
| AR-9  | Keyboard-opener wiring & key-freedom | `EditableGridRows` handles `Alt+Down` **only when not editing** (guard on `this.controller.isEditing()`, `editing.ts:154,304`) and **before `super.onEvent`**, reporting it up through a new optional `onOpenFilter?(globalCol, ev)` config callback; `grid.ts` maps the focused global column → `columnId` + its owning header panel and calls `openFilterPopup` with the header's funnel-cell anchor, **forwarding the live `ev`** so the popup inherits `ev.focusView`/`ev.popupHost` (mirrors the mouse path wiring `grid.ts:380` + `openFilterPopup` `grid.ts:821` and the RD-06 preflight PF-001 seam). Grounds: `Alt+Down` is synthesized *inside* an open editor (`editing.ts:235`) and `F4` is the cell value-help key (`editable-grid-rows.ts:312`). **Correction (preflight PF-001):** the non-editing body does **not** leave `Alt+Down` unbound — `EditableGridRows` doesn't handle it, so it falls through to the base `GridRows.handleKey`, whose `case 'down'` ignores modifiers (`ui/src/table/grid-rows.ts:278`) and **moves the row cursor down** today. FR-3 therefore *repurposes* that binding: intercepting **before `super.onEvent`** is what prevents the base row-down. Reaching the owning header requires `grid.ts` to **retain `parts.headers`** and refresh them in `rebuildBody` (preflight PF-002). | ✅ Resolved |
| AR-10 | Open on an unfiltered column ⇒ blank popup | Opening with no active filter presents the type's default operator with empty operands. Grounds: `FilterPopup` already accepts `current?` undefined (`filter-popup.ts` config), and `openFilterPopup` reads `this.filters().get(columnId)` which is `undefined` when unfiltered (`grid.ts:854`). No new behavior. | ✅ Resolved |
| AR-11 | Frozen panels | The funnel + opener need no panel-specific logic: each panel already owns its own `SortHeader` bound to the shared filter signal (columns-layout AR-11), and `Alt+Down` targets the single global focused column in whichever panel holds it. Grounds: per-panel headers (`grid-panels.ts:236`). | ✅ Resolved |
| AR-12 | Verify command | `yarn verify` (lint → turbo typecheck/build/test/check:docs). Grounds: project CLAUDE.md → Commands. | ✅ Resolved |
| AR-13 **(runtime)** | Where the per-column filterability seam lives | Plan 1.2.2 called for a `filterableOf(id)` predicate added to `GridBodyDeps`. During exec (Phase 1) this was realized instead as a `sliceFilterable(ids)` helper **inside `buildGridBody`** (`grid-panels.ts`), deriving from the already-threaded `columnMap` dep (`grid-panels.ts:52,228`) exactly like the sibling `sliceTyped`. Same behavior + same per-slice intent (PF-005), but no redundant dep duplicating `columnMap`, so `grid.ts` is untouched and the change stays consistent with the existing slice-helper pattern. Headers consume `sliceFilterable(ids)` in Phase 2 (SortHeader gains `filterable` in 2.2.1). | ✅ Resolved |

---

## C. RD-06 revision folded into this plan (per AR-2)

The current RD-06 text and acceptance criteria mandate the buggy behavior. This plan revises them.
The revision is a **task** in the execution plan (Phase 4), not an assumption — the exact edits:

| RD-06 location | Current text | Revised text (this plan) |
| --- | --- | --- |
| §Feature Overview (line ~15) | "a funnel indicator **on filtered columns** and a 'N of M rows' footer" | "a funnel indicator **on every filterable column** (muted when unfiltered, emphasized when a filter is active) and a 'N of M rows' footer" |
| §Condition filters (line ~27) | "a header funnel opens an anchored popup…" | "a header funnel (**always present on filterable columns**) — **or `Alt+Down` on the focused column** — opens an anchored popup…" |
| §Funnel indicator (line ~34) | "a **filtered** column's header shows a funnel glyph" | "**every filterable column's** header shows a funnel glyph — **muted when unfiltered, emphasized when a filter is active**" |
| Technical §Funnel + count (line ~83) | "The header renders a funnel glyph **on any column with an active filter**" | "The header renders a funnel glyph **on every filterable column — muted when unfiltered, emphasized when a filter is active**" |
| Acceptance #4 (line ~139) | "A filtered column's header shows the funnel glyph; clearing its filter removes the glyph." | "Every **filterable** column's header shows a funnel glyph at all times — muted when unfiltered, emphasized when filtered; clearing a filter **mutes** the glyph (it is not removed). A funnel click **or `Alt+Down`** opens the column's condition popup **regardless of current filter state**." |
| Acceptance (new) | — | "A **non-filterable** column (`filterable: false`) shows no funnel, **omits its quick-filter input**, and `Alt+Down` is a no-op on it." |

> **Preflight PF-003:** the Feature-Overview (line ~15) and Technical §Funnel + count (line ~83) rows
> were added at preflight — they also encoded the old "funnel only on filtered columns" rule, so
> without them the revised RD-06 would contradict itself (the exact failure AR-2 folds this in to
> prevent). All five spots + the new AC must land together (Phase 2 task for the three §/AC funnel
> edits; see the execution plan).

**ST-19 re-spec (allowed, documented here):** `sort-header.spec.test.ts` ST-19 ("nothing filtered
→ no funnel", `:287-293`) faithfully encodes the *old* RD-06 rule. Because this plan deliberately
revises that rule, ST-19 is replaced by the new spec cases in `07-testing-strategy.md` (ST-1…ST-4).
This is the narrow, documented exception to spec-immutability — the spec changes *because the
requirement changed*, recorded here and in the RD-06 edit above.

---

## Gate status

- All items Status = ✅ Resolved · zero deferred · user confirmed the register (three decision rounds).
- **✅ GATE PASSED** — plan documents may be written.
