# Testing Strategy: Table / DataGrid

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Four tiers, spec-first. Spec oracles (ST-*) derive from RD-16 AC-1…AC-14 (AC-8 updated per AR-177), the
TV `tlstview.cpp` decode (03-01 GATE-1), and this plan's register (AR-172…AR-182) — **never** from the
implementation. Draw/colour assertions read the `ScreenBuffer` **pre-`serialize`** (the shipped pattern in
`listview.spec`/`fidelity.spec`). Coverage: every AC has ≥1 ST; edges/internals in impl tests.

## 🚨 Specification Test Cases (MANDATORY — IMMUTABLE ORACLES)

> Derived from `01-requirements.md`, `03-01`/`03-02`/`03-03`, and `00-ambiguity-register.md`. If a spec
> test fails after implementation, the **implementation** is wrong (except a TV-derived fidelity oracle
> that mis-decodes the C++ — then the source outranks it, per the fidelity directive).

### GridRows / DataGrid draw + nav + select

| #     | Input / Scenario | Expected Output / Behavior | Source |
|-------|------------------|----------------------------|--------|
| ST-1  | `DataGrid` over 100 rows × 3 cols, viewport 10 tall; render | Only 10 rows painted (window `topItem..topItem+9`), each showing all 3 cells; vbar `value===focused`, range `[0,99]` | AC-1 / AR-155 |
| ST-2  | Render a row; inspect the buffer | Cells separated by `│` (U+2502, from `\xB3`) in the `listDivider` role at each column's right edge; row bg = `listNormal` (cyan) | AC-2 / AR-159, AR-179 |
| ST-3  | Focus row 2 (list active) | Row 2 draws `listFocused` (white-on-green); other rows `listNormal`; priority focused>selected | AC-2 / `list-rows.ts:21` |
| ST-4  | Columns `[5, '1fr', 'auto']`, viewport 30, rows with cells up to 8 wide | `fixed`=5; `auto`=8 (widest+within cap); `fr` fills the remainder; `Σ(widths)+dividers` integer-correct, ≤ viewport | AC-3 / AR-153, AR-173 |
| ST-5  | Column `align:'right'`, width 5, cell `"12"` | Cell renders `"   12"` (pad-left); `align:'center'` width 5 cell `"1"` → `"  1  "` | AC-4 |
| ST-6  | Render; inspect header row (row 0) | Non-scrolling header of `title`s in the `tableHeader` role (white-on-cyan `0x3F`), same `│` dividers; header column starts align with the data column starts | AC-5 / AR-172, AR-174 |
| ST-7  | Scroll data vertically (PgDn) | Header row unchanged; data window advances | AC-5 |
| ST-8  | Click header col 1 (asc), then click col 1 again | 1st click: `sort={col:1,dir:'asc'}`, rows ascending by col 1, `▲` by the title; 2nd: `dir:'desc'`, rows descending, `▼` | AC-6 / AR-158, AR-180 |
| ST-9  | Numeric col with `compare:(a,b)=>a.n-b.n`, values `[9,10,2]`, sort asc | Order `[2,9,10]` (numeric, not lexical `"10"<"2"`); a string col sorts locale-aware by default | AC-6 / AR-158 |
| ST-10 | All-`fixed`/`auto` columns totalling 40 in a 20-wide viewport; H-scroll right (→ / hbar) | `indent` increases; columns shift left; off-screen left columns clipped; header shifts in lockstep; hbar range `[0, totalWidth-viewport]` | AC-7 / AR-156, AR-174 |
| ST-11 | All-`fr` columns | `totalWidth === viewport`; hbar range `[0,0]` (no H-scroll); `indent` stays 0 | AC-7 / AR-153 |
| ST-12 | Enter (or Space) on focused row 3 | `selected===3`, `onSelect(3,row)` called, `command` emitted once via `ev.emit` | AC-8 / AR-177 |
| ST-13 | Single mouse click on data row 4 | `focused===4` and `selected===4`; **no** command emitted (emit is Enter/Space only) | AC-8 / AR-177 |
| ST-14 | Sort asc (focused=2 → row X), then toggle to desc | `focused` stays `2` (**positional**) — now highlights whatever row sits at index 2 in the desc order (not row X) | AC-8 / AR-155, AR-177 |
| ST-15 | Replace `rows` signal with a shorter array (len 3) while `focused===7` | Visible window re-renders; `focused` clamped to `2` (`range-1`) | AC-9 / AR-155 |
| ST-16 | `rows = []` | Header draws normally; data area shows `<empty>` at (col 1, row 0); no throw / no out-of-range | AC-14 |
| ST-17 | `columns = []` (with rows) | Grid draws a blank data field + blank header; no throw | AC-14 |

### Navigation (faithful TListViewer, AR-182)

| #     | Input | Expected | Source |
|-------|-------|----------|--------|
| ST-18 | PgDn from focus 0, viewport 10 | `focused===10` (±viewportRows, `numCols≡1`); Ctrl+PgDn → `range-1`; Home → `topItem`; End → `topItem+9` | AC-1 / AR-182 |
| ST-19 | wheel down | `focused += 3` (clamped) | AC-1 / `list-rows.ts:223` |

### Theme + packaging

| #     | Input | Expected | Source |
|-------|-------|----------|--------|
| ST-20 | `defaultTheme.tableHeader` | `{ fg: white, bg: cyan }` (`0x3F`); `encode(tableHeader)` does not throw; `listNormal/Focused/Selected/Divider` bytes unchanged | AC-10 / AR-172 |
| ST-21 | Import `DataGrid`, `Column` from `@jsvision/ui`; stat `src/table/*.ts` | Symbols resolve from the barrel; every `table/` file ≤ 500 lines; `check:deps` clean | AC-11 / AR-178 |
| ST-22 | Zebra on: rows 0,1,2,3 unfocused/unselected | Even rows `listNormal` (cyan); odd rows `staticText` (lightGray); a focused/selected row is NOT striped (priority) | AR-176 |
| ST-23 | Security: cell `accessor` returns `"a\x1b[31mX"`; render | No raw ESC in the buffer — text sanitized; cell width-clipped to its column | AC-13 |

### Kitchen-sink

| #     | Input | Expected | Source |
|-------|-------|----------|--------|
| ST-24 | Mount the `data-grid` story headlessly | Unique `id:'data-grid'`, required metadata present, paints ≥1 non-blank cell | AC-12 |

> **⚠️ AUTHORING RULE:** expectations come from the spec docs + the TV decode, not imagined output. ST-8/9
> (sort), ST-12/13/14 (select) encode the AR-158/AR-177 decisions exactly.

## Test Categories

### Specification Tests (BEFORE implementation)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/ui/test/datagrid.spec.test.ts` | ST-1…ST-19, ST-22, ST-23 | DataGrid / GridRows |
| `packages/ui/test/grid-columns.spec.test.ts` | ST-4, ST-5, ST-9, ST-10, ST-11 (unit-level `measureAutoWidths`/`apportionColumns`/`alignCell`/`sortRows`) | columns.ts |
| `packages/ui/test/table-theme.spec.test.ts` | ST-20 | theme role |
| `packages/ui/test/table.packaging.spec.test.ts` | ST-21 | packaging |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` | ST-24 (extend existing) | story |

### Implementation Tests (AFTER implementation)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/ui/test/datagrid.impl.test.ts` | indent clamp, clamp-on-shrink, header/row divider-column alignment (same width `W−1`, PF-101), sort indicator on a title-width column (title clipped to `width−1`, arrow still shown, PF-103), zebra+focus interaction, click-below-last-row, Ctrl+PgUp/Dn | High |
| `packages/ui/test/grid-columns.impl.test.ts` | min/max clamp fixpoint, wide-glyph clip/align, fractional fr, zero-col/zero-row, `auto` fallback-to-title | High |

### E2E

| Test | Components | Description |
| ---- | ---------- | ----------- |
| `packages/examples/test/table-demo.e2e.test.ts` | demo:table | Headless walkthrough runs: render → navigate → sort → H-scroll (one ASCII frame/step) |

## Test Data

- **Fixtures:** an in-file `Person[]` (`{name,age,city}`) with ≥ 20 rows (enough to overflow a 10-tall
  viewport) and one wide `name` (to exercise `auto` + clip). Prefer real signals/views (no mocks) —
  `RenderRoot` headless composition is the shipped test pattern.
- **Mocks:** none — all pure objects + headless `RenderRoot` (per project standard).

## Verification Checklist
- [ ] All ST-* defined with concrete input/output pairs, each traced to an AC / AR
- [ ] Spec tests written BEFORE implementation, verified to FAIL (red)
- [ ] All spec tests pass after implementation (green); a TV-fidelity oracle that mis-decodes is corrected against the C++
- [ ] Impl tests cover edges/internals
- [ ] `yarn verify` green; no regressions; `yarn check:deps` clean; `demo:table` + smoke pass
