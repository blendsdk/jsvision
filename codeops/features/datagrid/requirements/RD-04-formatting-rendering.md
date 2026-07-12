# RD-04: Formatting & Cell Rendering

> **Document**: RD-04-formatting-rendering.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

How a cell *looks* when it is not being edited: locale-aware value formatting (display ≠ underlying
value), the edit round-trip back to the value, a custom cell-renderer escape hatch, and
value-driven conditional styling. This is where `10000.25` becomes `"$10.000,25"` while sorting and
filtering still use the number `10000.25`. Formatting is opt-in per column and built on `Intl`
(pure-JS, zero dependency); every string a cell paints — built-in, custom, or raw — passes the core
`sanitize` boundary.

---

## Functional Requirements

### Must Have

- [ ] **Opt-in column formatter** — a column with no `format` renders `String(value)`; a column with
      `format(value, row)` renders that string. Built-in formatter factories return a `format`
      function: `number`, `currency`, `percent`, `date`, `datetime`, `boolean`, `enumLabel`,
      `lookupLabel`.
- [ ] **Locale-aware, overridable (AR-23)** — number/currency/percent/date formatters use `Intl`
      with the host default locale unless a `locale` (and, for currency, `currency`) option is given;
      no implicit currency styling is applied to a bare number column.
- [ ] **Parse round-trip** — each editable built-in formatter ships an inverse `parse` so
      `parse(format(v)) === v` for in-range values (used by RD-01/RD-02 on commit).
- [ ] **Custom cell renderer** — `GridColumn.render?(ctx, cell): void` where `cell = { x, y, width,
      value, row, state }`; the escape hatch for traffic-lights, badges, glyph indicators, inline
      bars. All `ctx.text` writes go through `sanitize`.
- [ ] **Conditional styling** — `GridColumn.cellStyle?(value, row): ThemeRoleName | Style` resolving a
      cell's colour by value (e.g. negative balances red). Applies under a fixed precedence:
      **cursor > dirty > selected-row > cellStyle > zebra > normal**.
- [ ] **Width-correct rendering** — all display strings pass through the engine's `alignCell` so wide
      glyphs, currency symbols, and ellipsis truncation never split a wide glyph or overflow the
      column.

### Should Have

- [ ] **Conditional-format rules engine** — declarative rules producing **data bars** (sub-cell
      eighth-block fill, reusing the `ProgressBar` fill math), **icon sets** (value → glyph), and
      **colour scales** (value → interpolated role). *Phase B.*

### Won't Have (Out of Scope)

- Multi-line / word-wrapped cells and variable row height — not feasible in the cell grid (1 line per
  cell); long values truncate with ellipsis or use the row dialog (RD-02 Should).
- Images / raster charts in cells — approximate with glyphs / data bars only.

---

## Technical Requirements

### Formatter registry

```ts
export interface NumberFormatOptions { locale?: string; minimumFractionDigits?: number; maximumFractionDigits?: number; }
export interface CurrencyFormatOptions extends NumberFormatOptions { currency: string; }

export const fmt = {
  number:   (o?: NumberFormatOptions)   => (v: number) => string,   // Intl.NumberFormat
  currency: (o: CurrencyFormatOptions)  => (v: number) => string,   // e.g. nl-NL EUR → "€ 10.000,25"
  percent:  (o?: NumberFormatOptions)   => (v: number) => string,
  date:     (o?: { locale?: string; style?: 'short'|'medium'|'long' }) => (v: CalendarDate) => string,
  // datetime, boolean(labels), enumLabel(map), lookupLabel(items) …
};
```

- Formatters are pure and side-effect-free; `Intl.*` is created once per factory call, not per cell.
- The inverse `parse` for `number`/`currency`/`percent` strips the locale group separators, decimal
  mark, currency symbol, percent sign, and sign using the same locale, then `Number(...)`; a
  non-parseable string is a validation failure (RD-12), not a silent `NaN`. Because `Intl` provides
  **no** parser, each *editable* built-in formatter must ship a **matched, tested** inverse (the
  `parse(format(v)) === v` round-trip asserted across the locales it supports); a format with no
  reliable inverse marks its column read-only (RD-01 permits `format` without `parse`).

### Render hook & styling

- `render(ctx, cell)` receives a clipped, cell-local draw context; the default renderer is
  `ctx.text(x, y, alignCell(format(value), width, align), roleStyle)`.
- A throwing custom renderer is isolated (draw-error isolation, AR-25): the cell paints an error glyph
  in the error role and the rest of the frame renders normally.
- `cellStyle` returns a `ThemeRoleName` (resolved via the theme) or an explicit `{fg,bg}` `Style`;
  precedence is fixed and documented so RD-02 (dirty) and RD-08 (selection) compose predictably.

---

## Integration Points

### With RD-01
- Implements `GridColumn.format`/`parse`; sorting (RD-05) and filtering (RD-06) read `value`, never the
  formatted string.

### With RD-02 / RD-08 / RD-14
- Shares the cell-paint precedence with the cursor/dirty (RD-02) and selected-row (RD-08) states; the
  `cellStyle`, dirty, selected, cursor, error roles are the additive core Theme roles from RD-14 (AR-24).

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Value vs display | Formatted accessor / value+format+parse | Split | Type-correct sort/filter/edit | AR #31 |
| Locale default | Fixed en-US / host locale / require explicit | Host locale, overridable, opt-in | No surprise currency; caller controls | AR #23 |
| Renderer errors | Propagate / isolate | Isolate per cell | A bad renderer can't crash the frame | AR #25 |
| Data bars / icon sets | v1 / P2 | P2 | Nice-to-have; core formatting first | AR #10 |

---

## Security Considerations

- **Data sensitivity**: formats caller values only; no storage.
- **Input validation**: `parse` rejects non-numeric/malformed input (→ RD-12 validation failure), never
  emits `NaN` silently.
- **Injection risks**: **all** rendered strings — built-in `format` output, custom `render` output, raw
  `String(value)` — pass the core `sanitize` boundary (AR-25); a value or format result containing an
  escape sequence cannot reach the terminal raw.
- **Custom-renderer trust**: caller-supplied `render`/`format`/`cellStyle` are trusted TS but run under
  draw-error isolation so a throw degrades one cell.
- **Encryption / rate limiting / infrastructure**: N/A.

---

## Acceptance Criteria

1. [ ] A column with `format: fmt.currency({ locale: 'nl-NL', currency: 'EUR' })` renders `10000.25`
       as `"€ 10.000,25"` (per `Intl.NumberFormat`), right-aligned within the column; the same column
       with no `format` renders `"10000.25"` (`String(value)`).
2. [ ] For that currency formatter, `parse("€ 10.000,25")` returns the number `10000.25`
       (`parse(format(v)) === v`); `parse("abc")` is reported as invalid (not `NaN`).
3. [ ] Sorting the currency column orders rows by the numeric `value` (9 before 1000), independent of
       the formatted text.
4. [ ] A `render` hook drawing `"●"` in a status role paints that glyph at the cell rect; a `render`
       hook that throws paints an error glyph and the other cells in the row/frame still render.
5. [ ] A value or `format` result containing `"\x1b[31m"` renders sanitized — the serialized frame
       contains no raw ESC byte originating from the cell value.
6. [ ] `cellStyle` colour applies only when no higher-precedence state is active: a cell that is both
       `cellStyle`-red and cursor-focused paints in the cursor role (cursor > cellStyle).
7. [ ] A formatted string wider than the column is truncated by `alignCell` without splitting a wide
       glyph and without overflowing into the neighbouring column.
8. [ ] A `datagrid` kitchen-sink story shows a currency-formatted column + a conditional-style column
       and passes the smoke test.
9. [ ] Security verified: sanitize-boundary test (AC-5) and renderer draw-error isolation (AC-4).
