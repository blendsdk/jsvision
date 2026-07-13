# Requirements: Color family (`ColorSwatch` + `ColorPicker`)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-21](../../requirements/RD-21-color-family.md)

## Feature Summary

A color-selection family for `@jsvision/ui`: a **`ColorSwatch`** grid view (pick a color from a palette
of cells) and a **`ColorPicker`** dropdown (a chip showing the current color that opens the grid, with
an optional hex field for arbitrary truecolor). `ColorSwatch` is a **decode** of Turbo Vision's
`TColorSelector`; `ColorPicker` is a documented **extension** compressing the heavy `TColorDialog`
palette editor into a form-field dropdown.

## In Scope

- **`ColorSwatch`** — a focusable `View` drawing a grid of 3-column color cells over a generic
  `colors: Color[]` (default `ANSI16_ORDER`), configurable `columns` (default 4), the `◘` selection
  marker (+ the near-black forced-contrast rule), wrap-around arrow nav, and click/drag select. Binds
  a two-way `value: Signal<Color>`; internal **cursor index** is the nav+marker source of truth (PA-9).
- **`ColorPicker`** — a `Group`: a trigger chip (current color block + optional label/hex/`nameFor`
  caption) + a `▐↓▌` button opening a `ColorSwatch` in the RD-14 anchored popup, plus an optional hex
  `Input` (`allowCustom`, default `true`) parsed via `toRgb()`. Open on Down/Alt+Down/`▐↓▌`-click;
  commit-on-release over a cell (or Enter, or a complete hex) sets `value` and closes; Esc/outside
  cancels.
- **One additive core theme role** — `colorMarker` = `0x70` (black-on-lightGray) for the dark-cell
  marker (PA-1). Cells themselves are raw `Color`s (no role).
- **Two additive core re-exports** — `ANSI16_ORDER` + `toRgb` on the public `@jsvision/core` entry
  (PA-3).
- **Kitchen-sink** — `ColorSwatch` + `ColorPicker` stories (category `Color`) + a headless `demo:color`.
- **Should-Have** — `ColorSwatch.select(color)`, `onChange(color)`, the pure `nameFor?: (c) => string`
  accessor (PA-13).

## Out of Scope

- All **date components** (`Calendar`/`DatePicker`) — the sibling RD-20 (done).
- The full **`TColorDialog`** palette editor (group/item lists + fg/bg dual selectors + preview +
  OK/Cancel) — a theme-editing tool for a later RD.
- A built-in **fg/bg dual selector** — the single generic grid is the model; compose two swatches.
- **HSV/RGB slider mixing** — the hex field covers arbitrary truecolor.
- **Alpha / opacity** — the terminal color model has no alpha.

### Deferred (tracked)

| Deferred item | From | Target | Rationale |
|---------------|------|--------|-----------|
| Recent-colors MRU strip | AR-214 / DEF-26 | later (post-set) | Needs its own color-MRU store + persistence (like RD-14 `History`). |
| Full `TColorDialog` editor | out-of-scope | later | A theme-editing tool on RD-11 `Dialog`/`ListView`. |
| HSV/RGB slider mixer | out-of-scope | later | A distinct color-mixing surface. |

## Acceptance Criteria (from RD-21)

The 15 immutable oracles the spec tests encode (ST-n ↔ AC-n). The `ColorSwatch` fidelity ACs (AC-2
geometry, AC-3 marker, AC-4 nav, AC-5 drag) diff against the `TColorSelector` decode
(`colorsel.cpp:120-237`); the extension ACs encode generic-palette / hex / picker behavior.

- **AC-1** — color model + binding: a `ColorSwatch` over `ANSI16_ORDER` binds `value: Signal<Color>`;
  setting `value` to a member marks that cell; a `#rrggbb` truecolor value is accepted and renders as
  its nearest ANSI-16 on a 16-color cap via `encode()` without error; a `value ∉ colors` marks no cell.
- **AC-2** — grid geometry (faithful): `columns: 4` ⇒ cells **3 columns wide** (grid width 12), each
  painted in its cell's `Color`, in `ceil(colors.length/4)` rows; asserted pre-`serialize` vs
  `colorsel.cpp:124-141`.
- **AC-3** — selection marker (faithful): the cell equal to `value` shows `◘` (U+25D8) at its centre;
  a near-black cell's marker uses the forced-contrast style (`colorMarker`/`0x70`); no other cell shows
  a marker.
- **AC-4** — wrap-around keyboard nav: `→` +1 with wrap; `←` −1 with wrap; `↑`/`↓` ∓/±`columns` with
  the edge-wrap decode; **Enter/Space** commits the focused cell.
- **AC-5** — click + drag select: click moves the cursor to the cell; drag tracks across cells; hit
  math `row*columns + floor(localX/3)`; a drag **outside the grid** reverts to the pre-drag cell
  (faithful), a pointer **past the last cell of a partial row** clamps to `colors.length-1`.
- **AC-6** — generic palette + columns: a custom `colors` (e.g. 8 truecolor hex) with `columns: 8`
  renders one row of 8 three-wide cells; defaults `columns=4`, `colors=ANSI16_ORDER`.
- **AC-7** — `ColorPicker` chip + open/commit/cancel: chip shows `value` as a block; Down/Alt+Down or
  `▐↓▌`-click opens the popup (no-op with no `PopupHost`); a swatch pick **commits on release** over a
  cell (drag previews; down alone doesn't close), or Enter on the cursor, sets `value` **and closes**;
  Esc/outside-down closes **without** changing `value`.
- **AC-8** — optional hex entry: `allowCustom: true` (default) shows a hex `Input`; a complete valid
  `#rrggbb` + commit sets `value` (parsed via `toRgb()`); invalid hex is rejected (`filter`/`toRgb`)
  and does not change `value`; `allowCustom: false` shows the grid only.
- **AC-9** — popup generalization consumed: the picker hosts the non-list `ColorSwatch` via the
  **generalized** `openAnchoredPopup` (landed by RD-20); the `History`/`ComboBox`/`DatePicker` popup
  tests stay green; RD-21 does not edit `dropdown/`.
- **AC-10** — theme roles: cells render as raw `Color`s (no role); frame/hex/chip reuse existing
  roles; **exactly one** additive `colorMarker` role exists, `encode()` of it does not throw, no
  existing role changes.
- **AC-11** — packaging: `packages/ui/src/color/` with explicit named re-exports from `src/index.ts`;
  `check:deps` passes; files ≤ 500 lines. The additive core re-exports (`ANSI16_ORDER`, `toRgb`) are on
  the public `@jsvision/core` entry; no existing core export changes.
- **AC-12** — stories + demo: `ColorSwatch` + `ColorPicker` stories (category `Color`) pass smoke;
  `demo:color` runs headless with an ASCII frame per step (render → arrow-nav → pick → open popup →
  hex → commit).
- **AC-13** — security: every color block/marker/caption is sanitized; the hex field is `filter`-gated
  + parsed by `toRgb()` (invalid never commits); all grid/cell/drag indexing is bounds-checked for any
  palette size, column count, empty set, or drag beyond the grid edge.
- **AC-14** — empty / single-color state: `colors: []` renders an empty grid, no marker, no crash /
  out-of-range indexing; a single-color palette renders one cell, arrow-nav is a no-op (no infinite
  wrap loop).
- **AC-15** — cursor vs `value` state model: internal cursor drives nav + marker; `value` a derived
  two-way bind; init `indexOf(value)` when present else `0`; `value ∉ colors` ⇒ no marker yet
  Enter/Space commits `colors[cursor]`; setting `value` to a member re-homes the cursor.

## Dependencies

RD-01 (reactive), RD-02 (layout), RD-03 (view/group + `DrawContext`), RD-04 (event loop: focus,
keymap, mouse hit-test + drag), RD-05 (app shell: `PopupHost`/overlay), RD-06 (`Input` + `filter`
validator), RD-14 (anchored popup) **generalized by RD-20** (done — the AR-204 dependency is
satisfied), and `@jsvision/core` (the `Color` model, `ANSI16_ORDER`, `toRgb`, `encode()` downsampling).
