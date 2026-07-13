# Testing Strategy: Formatting & Cell Rendering

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Formatter registry (`format.ts`) — pure business logic | 90% |
| Cell paint / draw-error isolation (`cell-draw.ts`, `draw()` override) | 85% |
| Kitchen-sink story (glue) | 60% (smoke only) |

- Test names state behavior: `should [expected] when [condition]`.
- Specification tests (`*.spec.test.ts`) are immutable oracles derived from RD-04 + the `03-*` specs +
  the register — a failing spec test means the implementation is wrong. Implementation tests
  (`*.impl.test.ts`) cover edges/internals.
- In-code traceability comments quote the behavior in **plain language** — never an `ST-`/`AC-`/`AR #`
  id or a `codeops/` path (the standards' Documentation ban).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

### Formatter registry (`fmt`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `fmt.currency({ locale:'nl-NL', currency:'EUR' }).format(10000.25, row)`; and a column with no `format` on the same value | `"€ 10.000,25"` (per `Intl.NumberFormat`); the no-format column renders `"10000.25"` (`String(value)`) | RD-04 AC-1 / R1 |
| ST-2 | Same formatter: `.parse("€ 10.000,25")`, then `.parse("abc")` | `10000.25`; `PARSE_FAILED` (a sentinel — **not** `NaN`) | RD-04 AC-2 / R3, AR #4 |
| ST-3 | `fmt.number({ locale:'en-US' })`: `parse(format(v))` for `v ∈ {0, -5, 1234.5, 1000000}` (all representable at the default fraction-digits) | Each equals the original `v` (round-trip); the identity is asserted only for values representable at the configured precision (PF-004) | RD-04 R3, AR #4 |
| ST-4 | `fmt.percent()`: `format(0.25)`, then `parse` of that string | `"25%"` (host locale); `parse` returns `0.25` | RD-04 R1/R3 |
| ST-5 | `fmt.enumLabel({ open:'Open', paid:'Paid' }).format('paid', row)`; then `.format('void', row)` | `"Paid"`; unknown key → `"void"` (`String(value)`) | RD-04 R1, AR #7 |
| ST-6 | `fmt.boolean().format(true/false)`; then `fmt.boolean({true:'On',false:'Off'})` | `"Yes"`/`"No"`; then `"On"`/`"Off"` | RD-04 R1, AR #8 |
| ST-7 | `fmt.lookupLabel([{ key:'7', label:'Ada' }]).format('7', row)`; then `.format('9', row)` | `"Ada"`; unknown key → `"9"` (`String(value)`) | RD-04 R1, AR #7 |
| ST-8 | `fmt.date({ locale:'nl-NL' }).format(cal)` for a `CalendarDate`; `fmt.datetime()` on a JS `Date`. Neither exposes a `parse` property | A non-empty locale date string / date+time string; `'parse' in fmt.date(...)` is `false` (display-only) | RD-04 R1/R2, AR #4/#6 |
| ST-9 | `toEngineColumn(currencyColumn).compare(rowWith9, rowWith1000)` | `< 0` (9 orders before 1000 by **numeric value**, independent of the formatted text) | RD-04 AC-3 / R1 |

### Parse contract & commit rejection (AR-13)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-20 | An editable currency column (`...fmt.currency({...})` + `set`); begin-edit, replace the text with `"abc"`, press Enter to commit | The commit is **rejected**: `parse` returns `PARSE_FAILED`, the record's value is unchanged (no sentinel / `NaN` written), and the editor stays open — `GridColumn.parse` is `(text)=>V \| typeof PARSE_FAILED` and `editing.ts:263` guards it | RD-04 AC-2, AR #13 |

### Cell rendering & styling

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-10 | A column with `cellStyle: v => v<0 ? { fg:'brightRed', bg:'cyan' } : 'listNormal'`; a negative-value cell that is **not** the cursor/selected cell | The cell paints in that explicit `Style` (fg `brightRed`, bg `cyan`) — no `danger` role exists (PF-001) | RD-04 AC-6 / R5 |
| ST-11 | The same `cellStyle`-red cell **is** the cursor (focused body) cell | The cell paints in `gridCursor`, **not** `danger` (cursor > cellStyle) | RD-04 AC-6, AR #1 |
| ST-12 | The `cellStyle`-red cell is in the **selected** row (`selected` set to its row) | The cell paints in `listSelected`, **not** `danger` (selected > cellStyle) | RD-04 R5, AR #9 |
| ST-13 | A column with `render: (ctx) => ctx.text(0,0,'●', { fg:'brightGreen', bg:'cyan' })` | `'●'` is painted at the cell's top-left in the `brightGreen` fg (explicit `Style`; no `success` role) | RD-04 AC-4 / R4 |
| ST-14 | A column whose `render` **throws**, beside a normal column in the same row | The throwing cell shows `'⚠'` in `gridDirty` fg over the row bg (no `danger` role, PF-001); the sibling cell and the other rows still render their content | RD-04 AC-4, AR #2 |
| ST-15 | A `render` that writes `"XXXXXXXX"` (wider than its 3-wide cell); separately, a default formatted string wider than its column | Neither paints into the neighbouring column: the renderer is cell-clipped; the default path truncates via `alignCell` without splitting a wide glyph | RD-04 AC-7 / R6, AR #3 |
| ST-16 | A column with **neither** `render` nor `cellStyle` | The `draw()` override paints byte-identically to the pre-RD-04 base path (no regression) | RD-04 R1 (default preserved) |

### Security

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-17 | A `format` result containing `"\x1b[31mX\x07"` painted into a cell | The serialized frame contains no raw ESC/BEL; no buffer cell holds `\x1b`/`\x07` | RD-04 AC-5 / AC-9 |
| ST-18 | A `render` hook that writes a control-byte string | Same — sanitized at the frame; no raw ESC/BEL in buffer or serialized output | RD-04 AC-5 / AC-9 |

### Kitchen-sink

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-19 | The `datagrid` formatting story (currency column + `cellStyle` column + `render` cell) mounted headlessly | Mounts, paints something, unique id, required metadata — passes the smoke test | RD-04 AC-8 |

> **⚠️ AUTHORING RULE:** Expectations derive from RD-04 + `03-01`/`03-02` + the register — not from
> imagined implementation output. ST-1/ST-2 use the exact `Intl` exemplar RD-04 AC-1/AC-2 name.

## Test Categories

### Specification Tests (from ST-cases above)
> Written BEFORE implementation. Filed as `*.spec.test.ts`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `format.spec.test.ts` | ST-1 … ST-9 | Formatter registry |
| `parse-commit.spec.test.ts` | ST-20 | Widened `parse` contract + commit rejection (AR-13) |
| `cell-rendering.spec.test.ts` | ST-10 … ST-16 | Cell paint / render / cellStyle |
| `security.spec.test.ts` (additions) | ST-17, ST-18 | Sanitize boundary for format/render |
| `kitchen-sink.smoke.spec.test.ts` (existing) | ST-19 | Story smoke |

### Implementation Tests (edge cases, internals)
> Written AFTER implementation. Filed as `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `format.impl.test.ts` | Negative/zero/large numbers, fraction-digit options, `nl-NL` group/decimal symbols, percent scaling, unknown enum/lookup keys, date/datetime styles, `PARSE_FAILED` on partial/garbage input | High |
| `cell-rendering.impl.test.ts` | Full precedence matrix (cursor/dirty/selected/cellStyle/zebra/normal), empty grid, wide-glyph cell, `cellStyle` returning a bare `Style` vs a role name, dirty-marker survival over a cellStyle cell, scrolled (indented) cell clip | High |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| currency column end-to-end | `fmt` + `toEngineColumn` + body paint | A currency column renders `"€ 10.000,25"`, right-aligned, and the adapter orders by value (ST-1 + ST-9 together) |

## Test Data

### Fixtures Needed
- A small `Account`-like row set with numeric (balance), string (name), enum (status), and boolean fields.
- The `nl-NL` and `en-US` locales are assumed present in the Node ICU build (LTS 22/24 ship full ICU).

### Mock Requirements
- None — real `Intl`, real event loop / render root (as the RD-02/03 tests already do).

## Verification Checklist
- [ ] All ST-* defined with concrete input/output pairs
- [ ] Every ST case traces to an RD-04 AC / R or an AR entry
- [ ] Spec tests written BEFORE implementation; verified RED first
- [ ] All spec tests pass after implementation (GREEN)
- [ ] Impl tests written for edges/internals
- [ ] No regressions in the RD-01/02/03 suites (116 datagrid tests baseline)
- [ ] `check:docs` green (barrel exports carry `@example`)
- [ ] Coverage meets goals
