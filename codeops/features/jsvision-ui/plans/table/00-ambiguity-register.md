# Ambiguity Register: Table / DataGrid (RD-16)

> **Status**: ✅ GATE PASSED — all 11 items resolved
> **Last Updated**: 2026-07-03
> **Feature**: jsvision-ui · **Implements**: jsvision-ui/RD-16
> **Scope**: plan-time decisions only. The requirement-level decisions (AR-151…AR-171) live in the
> feature register [`../../requirements/00-ambiguity-register.md`](../../requirements/00-ambiguity-register.md)
> and the [RD-16 preflight report](../../requirements/00-preflight-report-RD-16.md); this register
> numbers **continuously** from there (AR-172…AR-182) and records the four items the RD explicitly
> deferred to *plan GATE-1* plus the ambiguities surfaced while grounding the plan in the real code.

The RD (`RD-16-table.md`) resolved the feature-level design (AR-151…AR-171). Planning surfaced the
GATE-1 decodes it deferred and two feasibility gaps against the actual `@jsvision/core` input model
and `solveTrack`. All were presented with grounded options and resolved by explicit user decision on
2026-07-03.

| #      | Category            | Ambiguity / Gap | Options Presented | User Decision | Status |
|--------|---------------------|-----------------|-------------------|---------------|--------|
| AR-172 | UX & presentation / Fidelity | The **one new additive header theme role**'s colour (TV has no table header — an admitted extension; a design choice among faithful DOS-16 bytes). | A: white-on-cyan `0x3F` · B: black-on-lightGray `0x70` (staticText) · C: white-on-lightGray `0x7F` (labelSelected) | **A — white-on-cyan `0x3F`** (a new `tableHeader` role; bright white on the same cyan field as the rows — cohesive, distinct from black-on-cyan normal + yellow-on-cyan selected). | ✅ Resolved |
| AR-173 | Data & state        | `auto` column has no `solveTrack` kind (`apportion.ts:17-19` = `fixed\|flex`), so it must pre-measure to a `fixed` track item — over **which rows**, capped how? | A: widest over ALL current rows, `maxWidth`-or-uncapped, recompute on data change · B: all rows, default cap 40 · C: visible window only | **A** — widest cell over all current rows, clamped by the optional `maxWidth` (else uncapped), recomputed on the `rows` signal change (predictable, no scroll jitter). | ✅ Resolved |
| AR-174 | Integration points  | The `DataGrid` `Group` must compose a sticky header + data rows + vertical + horizontal bar (a 2-D layout). How do the vbar and header relate? | A: header over data-width only, vbar in the body only (`[header 1][body fr][hbar 1]`, body `[rows fr \| vbar 1]`) · B: vbar spans full height incl. the header row | **A** — header spans the data width only (scrolls H, fixed V); vbar spans the data rows only; hbar spans the data width; the bottom-right corner cell is blank. _(Realization refined by PF-101: header + hbar each nest in a `[content fr \| corner 1]` row so all three fr-bands resolve to the same width `W−1` and align — a bare full-width header child would drift by one cell under `align:'stretch'`.)_ | ✅ Resolved |
| AR-175 | Scope               | Which Should-Have items are in this plan vs. a tracked follow-up? | sortBy() · min/maxWidth clamps · zebra striping (each independently selectable) | **All three in scope** — `sortBy(col,dir)`, per-column `minWidth?`/`maxWidth?` clamps, and `zebra?` striping. | ✅ Resolved |
| AR-176 | UX & presentation   | Zebra striping's alternate-row colour (the RD wanted "an existing decoded list role variant", no new role, cyan default). | A: reuse `staticText` (black-on-lightGray `0x70`) · B: a new `listZebra` core role · C: ink-only via `listDivider` (blue-on-cyan `0x31`) | **A** — odd (striped) rows reuse the already-decoded `staticText` byte (`0x70` black-on-lightGray); even rows stay `listNormal` (`0x30` black-on-cyan). Readable cyan/grey stripes, **no new role** beyond the header. | ✅ Resolved |
| AR-177 | Behavioral / Feasibility | AC-8's mouse **double-click select** is infeasible — `@jsvision/core` `MouseEvent.kind` is `down\|up\|move\|drag` only (`events.ts:30`), no click-count (`list-rows.ts:16` deferred it for the same reason). | A: mirror `ListRows` — single click focuses+selects (no emit), Enter/Space select+emit, double-click deferred · B: click focuses only, keyboard-only select · C: add double-click to the core input decoder (new cross-package primitive) | **A** — a single click focuses + sets `selected` (no command emit); **Enter/Space** select + emit the command; **double-click select is deferred + tracked**; header click sorts. Mirrors the shipped `ListRows` exactly. **AC-8 is updated accordingly.** | ✅ Resolved |
| AR-178 | Naming & structure  | The exact `src/table/` file split (RD AR-160 said "confirmed at plan time"). | Follow the shipped `ListView`/`Tree` shape | **Resolved (pattern-determined):** `data-grid.ts` (the `DataGrid<T>` `Group` + `Column<T>`/`ColumnWidth` types), `grid-rows.ts` (the focusable multi-column `View` renderer + sticky-header draw), `columns.ts` (width apportion + `auto` pre-measure + min/max clamps + cell-extract/sanitize + the sort comparator), `index.ts` (barrel). Each ≤ 500 lines. | ✅ Resolved |
| AR-179 | UX & presentation / Fidelity | Column-divider placement (TV draws `\xB3` at each column's right edge; heterogeneous grid could draw between-columns-only). | Faithful per-column vs. between-columns-only | **Resolved (source-determined):** draw the `│` (`\xB3`) divider at the **right edge of every column** in the `listDivider` role, faithful to `TListViewer::draw` (`tlstview.cpp:130` `moveChar(curCol+colWidth-1,'\xB3',getColor(5))`). Each column region = `width` content cells + 1 divider cell. | ✅ Resolved |
| AR-180 | UX & presentation   | The `▲`/`▼` sort-indicator glyphs + placement. | — | **Resolved (design/consistency):** `▲` U+25B2 (asc) / `▼` U+25BC (desc) — the same unambiguous-narrow glyphs the `ScrollBar` already uses (`scroll-bar.ts:49-50`) — drawn at the **right edge of the active sort column's header cell** (over the last content cell, before the divider) so the title text does not shift. _(Refined by PF-103: on the active sort column the title is clipped to `width−1` and the indicator takes the last cell, so a title-width column still shows the arrow instead of overwriting the last character.)_ | ✅ Resolved |
| AR-181 | Integration points  | Are the V/H bars always reserved, and what fills the bottom-right corner? | Always-reserved (like `Scroller`) vs. conditional | **Resolved (pattern-determined):** both bars are **always reserved** (vbar = 1 fixed column, hbar = 1 fixed row) — a stable grid frame like the `ListView`/`Scroller` idiom; the bottom-right **corner cell** (vbar column × hbar row) is blank, drawn in the dialog/background role. | ✅ Resolved |
| AR-182 | Behavioral / Fidelity | The faithful navigation key set + the TV `size.y*numCols` paging reconciliation (RD-16 PF-009). | — | **Resolved (source-determined, GATE-1):** ↑/↓ ±1, PgUp/PgDn ±viewportRows, Home = `topItem` / End = `topItem+viewportRows-1` (window-relative), Ctrl+PgUp = `0` / Ctrl+PgDn = `range-1` (list-absolute), ←/→ horizontal-scroll on overflow, wheel ±3 rows — faithful `TListViewer::handleEvent` (`tlstview.cpp:213-320`). TV pages by `size.y*numCols`; this grid is **one row per item** (`numCols≡1`), so `±viewportRows` **is** the faithful decode. | ✅ Resolved |

### Resolution Notes

- **AR-172 (header colour).** Because Turbo Vision has no table/grid class, there is no `getColor` chain
  to mis-decode here — the header is a documented extension (RD AR-151), so its colour is a *design
  choice among valid `cpAppColor` bytes*, not a transcription. The user chose `0x3F` (bg cyan `3`, fg
  white `F`) — white ink (TV's title convention) on the list's own cyan field. It lands as ONE additive
  core role `tableHeader`, the same additive/non-breaking pattern as every prior control role
  (AR-97/112/122/139/149). **Confidence: High** (bounded palette choice, grounded in the shipped
  `theme.ts` `list*` bytes). **Hardening:** reframed the "fidelity decode" as an explicit extension so it
  is not mistaken for a decode that could be "wrong"; the row/divider roles remain the faithful decode.
- **AR-176 (zebra).** The RD's "existing decoded list role variant" is honoured literally — `staticText`
  (`0x70`) is already in `defaultTheme`; reusing it means zebra adds **zero** new roles. Even/odd both use
  black ink, so data stays readable; the alternation is bg cyan ↔ lightGray.
- **AR-177 (mouse select).** The infeasibility is real and pre-existing (`list-rows.ts:16`). Mirroring the
  shipped `ListRows` keeps the two list-family widgets behaviourally consistent and keeps the additive-only
  surface intact. This **supersedes** the RD's AC-8 "double-click selects" wording — 07-testing-strategy.md
  and 03-01 encode the mirrored behaviour; the RD's double-click stays in the Deferred register.
- **AR-179/AR-182 (GATE-1 decodes).** Recorded here so a spec author transcribes the *faithful* facts and
  does not copy TV's `size.y*numCols` (newspaper-flow) paging or omit the per-column divider. The
  `03-01-data-grid.md` "TV decode (GATE 1)" section cites the exact `tlstview.cpp` lines.
