# RD-07: Columns & Layout

> **Document**: RD-07-columns-layout.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

Column and layout management: interactive resize, reorder, and show/hide; frozen (pinned) columns via
a left/center/right panel model; and the sticky header. This is what makes a wide table usable on a
large terminal — pin the identity columns, scroll the rest. It builds directly on the exposed column
engine (RD-01) and the sticky-header the read-only grid already ships.

---

## Functional Requirements

### Must Have

- [ ] **Column resize** — dragging a column's right border changes its width (via the `setCapture`
      pointer-capture seam); a double-click on the border auto-fits to content (Should below); widths
      clamp to a per-column min.
- [ ] **Column reorder** — dragging a header moves the column; reorder is constrained **within its
      panel** (frozen vs scrolling) — a column cannot be dragged across the freeze boundary (AR-22).
- [ ] **Show / hide columns** — `grid.setColumnVisible(columnId, visible)`; hidden columns are omitted
      from layout, sort/filter still addressable by id but not shown.
- [ ] **Frozen / pinned columns (pinned-panel model)** — a body split into **left-pinned | center-
      scrolling | right-pinned** panels sharing one row cursor, vertical scroll, and selection; only
      the center panel applies the horizontal scroll offset; a `│` divider marks each freeze boundary.
      API: `freezeLeft?: string[]`, `freezeRight?: string[]`, or `freeze?: number` (first-N).
- [ ] **Sticky header** — the header row stays fixed while the body scrolls vertically (reused), and
      each panel's header aligns with its body columns.
- [ ] **Column model API** — `grid.columnOrder()`, `grid.setColumnOrder(ids)`, `grid.columnWidth(id)`,
      `grid.setColumnWidth(id, w)`, `grid.frozen()` — all reactive so RD-13 can persist them.

### Should Have

- [ ] **Auto-fit** — double-click a border, or `grid.autoFitColumn(id)` / `autoFitAll()`, sizes to the
      widest visible cell (bounded by a max), reusing `measureAutoWidths`.
- [ ] **Frozen rows / freeze panes** — pin the first N data rows (the horizontal mirror of frozen
      columns). *Phase B.*
- [ ] **Density / compact mode** — drop dividers/padding for a denser view. *Phase C.*

### Won't Have (Out of Scope)

- Grouped / multi-level headers — Phase C.
- Split into independent scroll panes beyond the pinned model — out of scope (terminal constraint).

---

## Technical Requirements

### Pinned-panel layout

- The body is three `EditableGridRows` panels over the same source/cursor/selection: `left`
  (freezeLeft columns), `center` (the rest, horizontally scrollable), `right` (freezeRight columns).
  Widths: left+right are intrinsic (sum of their column widths); center takes the remainder and owns
  the horizontal `indent`.
- The shared model (row cursor, vertical scroll offset, selection) lives on the `EditableDataGrid`;
  each panel binds to it so a row highlight/cursor spans all three. A `│` in the `frozen-divider` role
  separates panels.
- Cursor movement across the freeze boundary: `→` from the last center column does not enter a pinned
  panel (pinned columns are navigable but the horizontal scroll is independent); precise cross-panel
  cursor rule documented and tested.
- Guard: total frozen width must be < viewport width; over-pinning is clamped and a dev warning is
  emitted (never a blank center).

### Resize / reorder gestures

- Resize and reorder use the existing `setCapture`/`releaseCapture` pointer-capture seam (the same
  mechanism as `Window` resize grips). Reorder shows a drop indicator; dropping outside the source
  panel is rejected (AR-22).

---

## Integration Points

### With RD-01
- Operates on the exposed `columns.ts` geometry (`apportionColumns`, `measureAutoWidths`) and column
  order/width/visibility state.

### With RD-06 (filtering) / RD-09 (footer)
- The filter funnel and header sort indicators render within each panel's header; footer aggregate
  columns align to the same panel column geometry.

### With RD-13 (personalization)
- Column order, widths, visibility, and freeze are the reactive state RD-13 serializes into a layout
  variant.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Freeze architecture | Single-view clip / pinned panels | Pinned panels (L/C/R) | Composes with Group; AG-Grid/SAP model | AR #8 |
| Reorder across freeze | Allowed / constrained | Constrained (separate pin/unpin) | Avoids silent frozen-width change | AR #22 |
| Frozen rows | v1 / P2 | P2 | Frozen columns first | AR #8 |
| Auto-fit | v1 / Should | Should | Resize first | AR #10 |

---

## Security Considerations

- **Data sensitivity**: layout operations reorder/resize/hide columns; no data exposure change (a
  hidden column's data is still in memory, just unrendered — documented, not a security control).
- **Input validation**: `columnId`/order arrays are validated against known columns; unknown ids
  ignored.
- **Injection risks**: none new — layout is presentational; all rendered header/cell text passes
  `sanitize` (RD-04).
- **Encryption / rate limiting / infrastructure**: N/A.

---

## Acceptance Criteria

1. [ ] Dragging a column's right border widens/narrows it live; the width clamps at the column's min
       and the neighbouring columns reflow.
2. [ ] Dragging a header within its panel reorders the columns; `grid.columnOrder()` reflects the new
       order; a drag that would cross the freeze boundary is rejected (order unchanged).
3. [ ] `setColumnVisible(id, false)` removes the column from the rendered layout while `sortBy(id)`
       still functions (state addressable by id).
4. [ ] With `freeze: 2`, the first two columns render in a left panel that does NOT move when the
       center scrolls horizontally; a `│` divider separates them; the cursor row highlight spans all
       panels.
5. [ ] The header stays fixed during vertical scroll and each panel's header aligns to its body
       columns.
6. [ ] Over-pinning (frozen width ≥ viewport) is clamped and emits a dev warning; the center panel is
       never blank.
7. [ ] `autoFitColumn(id)` sizes the column to the widest visible cell bounded by the max (Should).
8. [ ] A `datagrid` kitchen-sink story shows frozen columns + resize/reorder and passes the smoke test.
9. [ ] Security verified: unknown `columnId` in order/width/visibility calls is ignored; header/cell
       text remains sanitized after any layout change.
