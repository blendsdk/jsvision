# 03-02 — Frozen Panels & Sticky Header

> **Parent**: [Index](00-index.md) · **AR**: AR-5, AR-6, AR-7, AR-9, AR-11, AR-2

The pinned-panel model: the body splits into left / center / right `EditableGridRows` panels sharing
one row cursor, one vertical scroll, one selection, and one global column cursor. This is the plan's
central refactor (hazards H1–H5).

## Panel-only-when-frozen (AR-5)

When the resolved partition has **no** left and **no** right ids, the container keeps **today's
single-body path** unchanged (one `EditableGridRows` over all columns, one `SortHeader`). Panels are
built only when `left.length > 0 || right.length > 0`. This guarantees zero behavioral/perf change
for RD-01…06's non-frozen grids — the spec suite for those stays green untouched.

## Panel column slicing (H1)

Each panel is an `EditableGridRows` constructed over a **slice** of the engine columns / typed
columns / autoWidths / columnIds, matching its partition ids:

```
leftPanel   = EditableGridRows(columns[left ids],   autoWidths[left],   indent = signal(0))
centerPanel = EditableGridRows(columns[center ids], autoWidths[center], indent = this.indent) // scrollable
rightPanel  = EditableGridRows(columns[right ids],  autoWidths[right],  indent = signal(0))
```

`apportionColumns` accepts any column array against any width, so each panel computes correct
geometry over its own slice + its own `bounds.width` — no engine change (H1). The container recomputes
the slices whenever `columnOrder`/`hidden`/`freeze` changes (a derived computed, 03-04); a change
rebuilds the panels (dispose + re-add) — cheap, and only on a structural layout change, never per
draw.

## Shared cursor & vertical scroll (H2, H5, AR-6)

- **Row cursor + selection + vertical position** are the container's existing `focused`/`selected`
  signals, injected into all three panels (already the constructor shape). Because every panel binds
  the same `focused` and lays out at the **same height**, their inherited `updateTop()`/`topItem`
  compute the **same** virtual window — vertical scroll stays in lockstep without sharing `topItem`
  state (H5). *(Impl test asserts the three `topItem`s agree after a scroll.)*
- **Column cursor** stays **one global `focusedCol`** over the whole visible order (AR-6). A new
  protected seam on `EditableGridRows` gives each panel its **column-slice range** `[startCol,
  endCol)` in global-index space. The panel:
  - paints the cursor cell / dirty-in-cursor only when `startCol ≤ focusedCol() < endCol`, mapping to
    the local index `focusedCol() − startCol`;
  - `moveCol`/`colFirst`/`colLast`/`gridStart`/`gridEnd` operate in **global** space (see navigation).
- **Linear cross-panel navigation (AR-2):** the arrow/Home/End handlers move the global `focusedCol`
  across the whole visible column count `[0, totalCols)`, so `→` off the last center column enters the
  right panel and `←` off the first center column enters the left panel — one logical sequence.
  `Ctrl+Home`/`Ctrl+End` jump to the first/last cell of the whole grid. **Only the panel that owns
  the current `focusedCol` handles begin-edit / cursor paint**; the others are read-only mirrors.
  - *Auto-scroll:* when the global cursor lands in the **center** panel, the container nudges `indent`
    so the focused center column is visible (reuses the existing indent-clamp math; the frozen panels
    never scroll).

### Where the keys live

Today `EditableGridRows.handleColKey` owns the column keys (`editable-grid-rows.ts:218-263`). With
panels, key routing must act on the **global** cursor, not a panel-local one. Two options, decided:
the **container** focuses a single "active" panel (the one the loop routes keys to) but the cursor
math is global. Cleanest: keep the key handlers on `EditableGridRows` but have them read/write the
**shared global `focusedCol`** and the **shared total column count** (injected), so whichever panel
is focused moves the one global cursor; the container re-focuses the panel that now owns the cursor
after a cross-boundary move (a leaf-focus call, mirroring the RD-03 Group-editor focus rule). *(This
keeps all navigation logic in one place and off the container.)*

## Horizontal indent (H3, AR-7)

Only the center panel binds the scrollable `this.indent`; left/right panels bind a fresh constant
`signal(0)` so their per-draw clamp (`editable-grid-rows.ts:287-289`) is a no-op. The horizontal
`ScrollBar` ranges over the **center panel's** `totalWidth − width` only (the frozen widths are fixed
and never scroll).

## Sticky header per panel (AR-11)

Each panel gets its own `SortHeader` over the same column slice, bound to the **shared** `sortKeys`/
`filters` signals (`SortHeader` is already `columnId`-keyed and multi-header-ready, `sort-header.ts:11`).
The header band becomes a row of `[leftHeader | centerHeader | rightHeader]` with the freeze-divider
between, aligned exactly to the body panels because each shares its panel's `columns`/`autoWidths`/
`indent`. Sort-click and funnel-click on any panel's header drive the one shared model — unchanged
routing, just replicated per panel.

## Layout assembly

The container's `bodyRow` (`grid.ts:332-336`) changes from `[body | vbar]` to:

```
bodyRow = [ leftPanel | divider | centerPanel | divider | rightPanel | vbar ]   // when frozen
        = [ body | vbar ]                                                        // when not (unchanged)
```

- Left/right panels are **fixed-width** (`fr`→`fixed` sized to their partition's `totalWidth`), the
  center panel is `fr`, the vbar is the fixed 1-cell it already is.
- The `divider` is a fixed-1-cell `Group` in the `frozen-divider` role, drawn as `│` full-height
  (header + body + any frozen-rows band + hbar corner), so the freeze boundary reads as one line.
- The header band (`topRow`), the optional quick-filter band, and the hbar band all mirror the same
  `[left | divider | center | divider | right | corner]` split so every band's columns align (the
  same "same-data-width" invariant the current band layout relies on, `grid.ts:297-304`).

## Over-pinning guard (H-guard, AR-9)

Before building panels, the container resolves the partition then calls `overPinnedIds` (03-01)
against the current viewport width and resolved widths. Any returned id is **moved to the center**
(un-frozen for this layout) and a **single `devWarn`** fires:
`devWarn('datagrid', 'frozen columns exceed the viewport; un-pinning <ids> to keep the grid usable')`.
The center panel is therefore never blank (AC-6). The guard re-runs when the viewport or widths
change (a derived computed), but the `devWarn` is de-duplicated per distinct over-pin set so a resize
storm doesn't spam.

## Editor overlay panel-awareness (H4 — see 03-04)

The in-cell editor overlay must mount over the **owning** panel's cell. The panel that owns the
current `focusedCol` computes the cell rect in **its** local geometry, and the overlay mount adds
**that panel's** absolute origin (not the grid's). Detailed in 03-04.

## Testing hooks

Spec (03-07): `freeze: 2` → a left panel of 2 columns that does not shift under center H-scroll +
a `│` divider (AC-4); the cursor row highlight spans all panels (AC-4); header stays fixed on
vertical scroll + panel headers align (AC-5); over-pin clamps + one devWarn + non-blank center
(AC-6); linear `←`/`→` crosses freeze boundaries; `Ctrl+Home`/`End` span the grid (AR-2). Impl: the
three panels' `topItem` agree after a scroll (H5); no-freeze keeps the single-body path (AR-5
regression).
