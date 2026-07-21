# Requirements — Columns & Layout

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-07](../../requirements/RD-07-columns-layout.md)
> **CodeOps Skills Version**: 3.7.0

Scope delta over RD-07. RD-07 owns the canonical requirement text; this plan restates only the
in/out boundary and the acceptance criteria it commits to, with the gate decisions folded in.

## In scope (this plan — AR-1: "Everything")

### Must-Have (RD-07)
- **Column resize** — drag a header divider grip; live width change; clamp to the column's
  `minWidth` (AR-4). Double-click the border auto-fits (below).
- **Column reorder** — drag a header to move the column; constrained **within its panel**
  (RD-07 AR#22); a cross-freeze-boundary drop is rejected; a drop indicator shows the target slot.
- **Show / hide columns** — `setColumnVisible(id, visible)`; hidden columns are omitted from layout
  but remain addressable by id for sort/filter.
- **Frozen / pinned columns** — the L/C/R pinned-panel model; construction `freezeLeft?: string[]`,
  `freezeRight?: string[]`, or `freeze?: number` (first-N). Shared row cursor / vertical scroll /
  selection; only the center panel scrolls horizontally; `│` freeze-divider.
- **Sticky header** — header stays fixed during vertical scroll; each panel's header aligns to its
  body columns (per-panel `SortHeader`, AR-11).
- **Column model API** — `columnOrder()`, `setColumnOrder(ids)`, `columnWidth(id)`,
  `setColumnWidth(id, w)`, `frozen()`, `setColumnVisible(id, visible)` — all reactive (AR-13).

### Should-Have (RD-07) — pulled into scope by AR-1
- **Auto-fit** — double-click a border, or `autoFitColumn(id)` / `autoFitAll()`, sizes to the widest
  visible cell bounded by `maxWidth ?? 60` (AR-4), reusing `measureAutoWidths`.
- **Frozen rows** — pin the first N data rows (`freezeRows?: number`); the horizontal mirror of
  frozen columns (AR-14).
- **Density / compact mode** — `density?: 'normal' | 'compact'` drops the inter-column divider for a
  denser view (AR-15).

### Cross-cutting
- **Per-column width limits** — optional `minWidth?` / `maxWidth?` on `GridColumn`, threaded to the
  engine `Column` (AR-4).
- **Over-pinning guard** — frozen width ≥ viewport is clamped (center never blank) + a single
  `devWarn` (AR-9).
- **Linear cross-panel cursor** — `←`/`→` cross freeze boundaries; `Home`/`End`/`Ctrl+Home`/
  `Ctrl+End` span the whole grid (AR-2).
- **Kitchen-sink story** + **datagrid-showcase upgrade** (AR-3).
- **Security** — unknown column ids ignored in every layout call; header/cell text stays sanitized
  after any layout change.

## Out of scope

- **Grouped / multi-level headers** — RD-07 Phase C; not pulled forward.
- **Independent scroll panes beyond the pinned model** — RD-07 out of scope (terminal constraint).
- **Column virtualization** (rendering only on-screen columns) — RD-11 (data at scale); the current
  draw-all-then-clip H-scroll is unchanged.
- **Layout persistence / variants** — RD-13; this plan only exposes the reactive state RD-13 will
  serialize.
- **Any core/ui engine change** — the capture seam and geometry engine already exist (AR-12).

## Acceptance criteria (from RD-07, committed here)

1. Dragging a column's right border widens/narrows it live; the width clamps at the column's
   min and neighbouring columns reflow. *(AC-1 → Phase 4)*
2. Dragging a header within its panel reorders columns; `columnOrder()` reflects it; a drag that
   would cross the freeze boundary is rejected (order unchanged). *(AC-2 → Phase 5)*
3. `setColumnVisible(id, false)` removes the column from the rendered layout while `sortBy(id)`
   still functions. *(AC-3 → Phase 2/3)*
4. With `freeze: 2`, the first two columns render in a left panel that does NOT move when the center
   scrolls horizontally; a `│` divider separates them; the cursor row highlight spans all panels.
   *(AC-4 → Phase 3)*
5. The header stays fixed during vertical scroll and each panel's header aligns to its body columns.
   *(AC-5 → Phase 3)*
6. Over-pinning (frozen width ≥ viewport) is clamped and emits a dev warning; the center panel is
   never blank. *(AC-6 → Phase 3)*
7. `autoFitColumn(id)` sizes the column to the widest visible cell bounded by the max. *(AC-7 →
   Phase 4)*
8. A `columns-layout` kitchen-sink story shows frozen columns + resize/reorder and passes the smoke
   test. *(AC-8 → Phase 7)*
9. Security: unknown `columnId` in order/width/visibility calls is ignored; header/cell text remains
   sanitized after any layout change. *(AC-9 → Phase 2 + Phase 7)*

Plus (from AR-1's pulled-forward extras): frozen-rows band renders and stays pinned during vertical
scroll; `density: 'compact'` drops the divider across header + panels.
