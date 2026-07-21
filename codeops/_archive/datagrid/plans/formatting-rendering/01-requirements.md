# Requirements: Formatting & Cell Rendering

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-04](../../requirements/RD-04-formatting-rendering.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- **RD-04 R1 — Opt-in column formatter.** The `fmt` registry factories (`number`, `currency`, `percent`,
  `date`, `datetime`, `boolean`, `enumLabel`, `lookupLabel`) returning a `format` function; a column with
  no `format` still renders `String(value)`. Built-in formatting already paints via the `toEngineColumn`
  accessor — this plan supplies the factories. See `03-01`.
- **RD-04 R2 — Locale-aware, overridable.** `Intl`-backed number/currency/percent/date/datetime with host
  default locale unless a `locale` (and, for currency, `currency`) option is given; no implicit currency
  on a bare number column. See `03-01`.
- **RD-04 R3 — Parse round-trip.** A matched, tested inverse `parse` for `number`/`currency`/`percent`
  (`parse(format(v)) === v` across supported locales); the other kinds are display-only and edit through
  the RD-03 typed widgets (AR-4). See `03-01 §Inverse parsers`.
- **RD-04 R4 — Custom cell renderer.** `GridColumn.render?(ctx, cell)` with a cell-local, cell-clipped
  ctx and per-cell draw-error isolation. See `03-02`.
- **RD-04 R5 — Conditional styling.** `GridColumn.cellStyle?(value,row): ThemeRoleName | Style` under the
  fixed precedence cursor>dirty>selected>cellStyle>zebra>normal. See `03-02`.
- **RD-04 R6 — Width-correct rendering.** All display strings pass through `alignCell`; a custom
  renderer's cell-local clip prevents overflow (AR-3). See `03-02`.

### Deferred / out of this plan

- **RD-04 Should — conditional-format rules engine** (data bars / icon sets / colour scales): deferred
  (AR-10, named), Phase B — revisit after RD-05/RD-06.
- **RD-04 Won't** — multi-line/word-wrapped cells, variable row height, images/raster charts: out of
  scope per the RD.
- A **dedicated grid error theme role**: not added — no `danger`/error role exists today (`danger`/
  `warning`/`info`/`success` are `ThemeColors` aliases, not `Theme` roles — PF-001), so AC-4 paints the
  `⚠` in `gridDirty` fg over the row bg and `cellStyle` "red" returns an explicit `Style` (AR-2). A
  dedicated semantic role and any theme-format change belong to RD-14.

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Paint-path integration for render/cellStyle | Self-contained `EditableGridRows.draw()` override; no `@jsvision/ui` change | AR #1 |
| Error glyph + `cellStyle` red (AC-4/R5) | Explicit `Style` / `gridDirty` fg — no `danger` role exists | AR #2 (PF-001) |
| `parse` contract | `GridColumn.parse` widened to `(text)=>V \| PARSE_FAILED`; commit rejects the sentinel | AR #13 (PF-002) |
| `render` draw context | Cell-local, cell-clipped `DrawContext` | AR #3 |
| Invertible built-in formatters | number/currency/percent only; rest display-only | AR #4 |
| `fmt` registry surface | Namespace object in `format.ts`; invertible kinds return `{ format, parse }` | AR #5 |
| `fmt.datetime` input | JS `Date` (Intl date+time); `fmt.date` takes `CalendarDate` | AR #6 |
| enumLabel/lookupLabel signatures | Record map / `LookupItem[]` reverse-lookup; display-only | AR #7 |
| `fmt.boolean` default labels | `{ true: 'Yes', false: 'No' }`, overridable | AR #8 |
| cellStyle precedence forward-compat | Full precedence implemented now; selected band dormant until RD-08 | AR #9 |

> **Traceability:** Every plan-local decision above references its Ambiguity Register entry. RD-04 owns
> its own functional requirements, technical requirements, and acceptance criteria; this document only
> records the delta.

## Acceptance Criteria (plan-local)

The RD owns AC-1…AC-9 (`RD-04 §Acceptance Criteria`); the ST cases in `07-testing-strategy.md` encode
them. Plan-local completion adds:

1. [x] `fmt` and the cell-render/cellStyle types are exported from the `@jsvision/datagrid` barrel with
       `@example`-bearing JSDoc (`check:docs` green).
2. [x] No `@jsvision/ui` source changes (AR-1) — the feature is self-contained in `@jsvision/datagrid`.
3. [x] `yarn verify` green (AR-11), no regressions in the RD-01/02/03 suites.
