# RD-10: Navigation & Interaction

> **Document**: RD-10-navigation-interaction.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-02, RD-07 (panel split for mouse → cell mapping)
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

The complete input surface — the consolidated keyboard map, mouse handling (click, header-click,
wheel, scrollbar, drag), and the synthesized double-click. A TUI grid's keyboard story is its
competitive edge, so this RD defines the full default keymap (customizable) and the precise mouse →
cell/row mapping. Individual behaviors live in their capability RDs (edit in RD-02, selection in
RD-08, resize/reorder in RD-07, sort/filter in RD-05/06); this RD unifies dispatch and fills the
interaction gaps (double-click, context menu, tooltips).

---

## Functional Requirements

### Must Have

- [ ] **Consolidated default keymap** — one documented table covering navigation (`↑↓←→`, `Tab`/
      `Shift-Tab`, `Home`/`End`, `Ctrl+Home`/`Ctrl+End`, `PgUp`/`PgDn`), editing (`F2`, `Enter`, `Esc`,
      type-to-edit), selection (`Space`, `Shift+↑↓`), and value help (`F4`). Every binding is remappable
      via a `keymap` option (merge-over-default).
- [ ] **Mouse** — single-click focuses the cell and its row (and selects per RD-08), header-click
      sorts (RD-05), the funnel opens the filter popup (RD-06), the wheel scrolls rows (± step), the
      scrollbar drags, and border/header drags resize/reorder (RD-07). Clicks map to a cell via the
      exposed engine geometry (1-based → 0-based normalize).
- [ ] **Synthesized double-click (AR-20)** — two `down`s on the same cell within a configurable
      threshold (default 400 ms, via the injectable timer seam) synthesize a double-click → begin cell
      edit. A single click never begins edit.
- [ ] **Scroll-into-view** — activating (keyboard or click) a partially/next-page row scrolls it into
      view; the cursor never sits off-screen.

### Should Have

- [ ] **Context menu** — right-click (or a menu key) opens a context `MenuPopup` scoped to the cell /
      row / header with caller-supplied actions. *Phase B.*
- [ ] **Cell tooltips** — hovering a truncated cell shows its full value in a small overlay (mouse
      motion events + a hover delay). *Phase B.*
- [ ] **Global quick-search + match highlight** and **hotspot cells** (navigate on click). *Phase B.*

### Won't Have (Out of Scope)

- Native OS double-click / right-click semantics — the terminal doesn't report them; both are
  synthesized/emulated (AR #11).

---

## Technical Requirements

### Keymap

```ts
export type GridAction =
  | 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight'
  | 'nextCell' | 'prevCell' | 'rowStart' | 'rowEnd' | 'gridStart' | 'gridEnd'
  | 'pageUp' | 'pageDown'
  | 'beginEdit' | 'commit' | 'cancel'
  | 'toggleSelect' | 'extendUp' | 'extendDown'
  | 'valueHelp';
export type Keymap = Record<string /*chord*/, GridAction>;
// The default keymap is exported and frozen; a caller's `keymap` merges over it.
```

- Dispatch: a key is resolved to a `GridAction` via the merged keymap, then routed to the owning
  subsystem (edit → RD-02, select → RD-08, …). An unmapped chord falls through to the base view.

### Double-click synthesis

- The grid tracks `(lastDownCell, lastDownAt)`; a second `down` on the same cell within the threshold
  (default 400 ms, injectable timer for testability) fires `beginEdit`. The threshold and the
  "double-click opens row dialog vs edit" choice are options.

### Mouse → cell mapping

- Reuse the exposed column geometry (`apportionColumns` starts/widths) + the panel split (RD-07) to map
  a click `(x,y)` to `(columnId, rowIndex)`; clicks in the checkbox column / gutter route to selection
  (RD-08); clicks in a frozen panel don't apply the center scroll offset.

---

## Integration Points

- Routes into RD-02 (edit), RD-05 (sort), RD-06 (filter), RD-07 (resize/reorder), RD-08 (selection).
- Uses the `@jsvision/ui` event-loop dispatch, `setCapture` (drag), and the injectable timer seam
  (double-click); nothing here bypasses the loop.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Double-click | native / synthesized | Synthesized, 400 ms, → edit | Terminals don't report it | AR #20 |
| Keymap | fixed / remappable | Remappable (merge-over-default) | Enterprise/localization needs | AR #10 |
| Context menu / tooltips | v1 / P2 | P2 | Core nav first | AR #10 |

---

## Security Considerations

- **Data sensitivity**: input handling only; no data exposure change.
- **Input validation**: keymap chords are validated (unknown chords ignored, not thrown); context-menu
  actions are caller-supplied and dispatched as commands, never `eval`'d.
- **Injection risks**: tooltip text (a truncated cell value) passes `sanitize` (RD-04) before render.
- **Encryption / rate limiting / infrastructure**: N/A.

---

## Acceptance Criteria

1. [ ] Each default binding performs its action: e.g. `Ctrl+End` moves to the last cell of the last
       row, `PgDn` pages down, `F4` opens value help on a lookup cell.
2. [ ] A `keymap` option remapping a chord (e.g. `Ctrl+e` → `beginEdit`) takes effect and the original
       still works unless overridden; an unknown chord is ignored (no throw).
3. [ ] Two clicks on the same cell within 400 ms begin editing; two clicks separated by > 400 ms do
       not (verified with the injectable fake timer); a single click only selects/focuses.
4. [ ] Clicking a cell focuses that cell and its row and applies the selection gesture (RD-08); a click
       in a frozen panel maps to the correct column without the center scroll offset.
5. [ ] The wheel scrolls the body by the configured step; the scrollbar thumb drags the view.
6. [ ] Activating an off-screen row (via `Ctrl+End` or a click on a partially visible row) scrolls it
       fully into view; the cursor is never rendered off-screen.
7. [ ] A `datagrid` kitchen-sink story demonstrates keyboard + mouse + double-click-to-edit and passes
       the smoke test.
8. [ ] Security verified: unknown keymap chords are ignored; tooltip/rendered text is sanitized.
