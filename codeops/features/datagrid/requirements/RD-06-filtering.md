# RD-06: Filtering

> **Document**: RD-06-filtering.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01, RD-04, RD-07 (pinned-panel header geometry)
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

Excel-class filtering: an always-visible quick-filter row, per-column condition filters, the Excel
value-list (distinct-value checkbox picker with search), a funnel indicator (shown emphasized on a
filtered column, and opt-in as an always-visible muted glyph per column via `showFunnel`) and a
"N of M rows" footer, multi-column AND combination, and server-side push-down. The condition popup is
reachable on any filterable column via `Alt+Down` regardless of funnel visibility, is kept within the
viewport (never rendered off-screen), and is replaceable through a `filterPopup` customization seam.
Like sorting, filters evaluate the column `value` (RD-01), not the formatted string.

---

## Functional Requirements

### Must Have

- [ ] **Quick-filter row** — an optional always-visible row beneath the header, one inline `Input`
      per filterable column doing live case-insensitive contains-match on the column's display/value.
- [ ] **Condition filters** — a header funnel (shown on a filtered column, or on any column that opts
      in via `showFunnel`) — or `Alt+Down` on the focused column (always available on a filterable
      column, regardless of funnel visibility) — opens an anchored popup offering type-appropriate
      operators: text (`contains` / `startsWith` / `endsWith` / `equals`), number
      (`>` / `<` / `between` / `=`), date (before/after/between/on). The popup is kept within the
      viewport and can be replaced via a `filterPopup` factory.
- [ ] **Excel value-list** — the same popup offers a distinct-value checkbox list with a type-ahead
      search and "Select All"; checking a subset keeps only rows whose value is in the set.
- [ ] **Distinct enumeration seam** — value-list values come from `source.distinct(columnId)` (client
      computes them for an in-memory source; a windowed source runs `SELECT DISTINCT … LIMIT`).
- [ ] **Funnel indicator + "N of M"** — a filtered column's header shows an emphasized funnel glyph;
      by default an unfiltered column shows none (clean header), and a column may opt into an
      always-visible funnel (`showFunnel`, muted when unfiltered, emphasized when filtered). A
      footer/status area shows the filtered row count vs total (`"37 of 1,204 rows"`).
- [ ] **Multi-column AND** — active filters across columns combine with AND.
- [ ] **Push-down** — when `source.setFilter(model)` exists, filtering re-queries the source; otherwise
      an in-memory source filters client-side.
- [ ] **Filter model API** — `grid.setFilter(columnId, filter)`, `grid.clearFilter(columnId?)`, and a
      reactive `grid.filterModel(): FilterModel<T>` readout.

### Should Have

- [ ] **Global quick-search** across all columns with match highlighting. *Phase B.*
- [ ] **Top-N number filter** and relative date filters (today / last 7 days). *Phase B.*

### Won't Have (Out of Scope)

- Saved filter sets — that is layout variants (RD-13).
- Grouping-scoped filters — grouping is out of scope (AR #5).

---

## Technical Requirements

### Filter model

```ts
export type ColumnFilter<V = unknown> =
  | { kind: 'set'; selected: ReadonlySet<string> }                              // Excel value-list
  | { kind: 'text'; op: 'contains'|'startsWith'|'endsWith'|'equals'; value: string }
  | { kind: 'number'; op: 'gt'|'lt'|'between'|'eq'; a: number; b?: number }
  | { kind: 'date'; op: 'before'|'after'|'between'|'on'; a: CalendarDate; b?: CalendarDate }
  | { kind: 'custom'; predicate: (value: V, row: unknown) => boolean };

export type FilterModel<T> = ReadonlyMap<string /*columnId*/, ColumnFilter>;
```

- A predicate is derived per `ColumnFilter` and evaluated against `column.value(row)`; the quick-filter
  row is sugar producing a `{ kind: 'text', op: 'contains' }` filter.
- Client-side path: `rows.filter(row => everyActiveFilter(row))`, memoized as a `computed` so the body
  and the "N of M" count react together. Push-down path: `setFilter(model)` re-queries; `length()`
  reflects the filtered count.

### Distinct enumeration

- `source.distinct(columnId): Promise<string[]>` returns the formatted labels for the value-list;
  in-memory computes `[...new Set(rows.map(format∘value))]` sorted; a windowed source bounds the query
  (`LIMIT`) and the popup notes truncation if the cap is hit (no silent truncation).

### Funnel + count

- The header renders an emphasized funnel glyph on a column that has an active filter; an unfiltered
  column shows none unless it opts in with `showFunnel` (then a muted glyph is always drawn, going
  emphasized while filtered). A non-filterable column (`filterable: false`) never draws one. The count
  ("N of M") renders in the footer band (RD-09) or, absent a footer, the status area — driven by the
  reactive filtered length vs `source.length()` pre-filter.

### Popup placement + customization

- The condition popup anchors under the column's funnel cell but is clamped into the grid viewport —
  when it would overflow the right edge it right-aligns, and when it would overflow the bottom it
  clamps up — so it is never rendered off-screen. A `filterPopup?: (ctx) => View` factory replaces the
  built-in popup; the context carries the column, filter type, current filter, the apply/clear/close
  sinks, and a `defaultPopup()` that builds the built-in popup for wrapping or reuse. The returned view
  is mounted anchored + clamped at its own size (or the default size when it sets none).

---

## Integration Points

### With RD-01 / RD-04
- Filters evaluate `value`; the value-list *displays* `format(value)` labels but filters on identity.

### With RD-09 (footer)
- The "N of M" count and any filter-clear affordance render in the footer band.

### With RD-11 (data at scale)
- `setFilter` + `distinct` are the windowed-source seams; large datasets never scan client-side for
  distinct values.

### With RD-05 (sorting)
- Filter then sort; both push down through the same source when supported.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Value-list in v1 | v1 / defer | v1 (kept) | Excel-signature feature | AR #6 |
| Filter key | display / value | value | Correct identity/number/date match | AR #31 |
| Distinct on large data | client scan / source seam | `source.distinct` | Can't scan 100k client-side | AR #14, #17 |
| Truncated distinct | silent / disclosed | Disclosed (no silent cap) | Honest UX | AR #10 |
| Global search | v1 / P2 | P2 | Per-column first | AR #10 |

---

## Security Considerations

- **Data sensitivity**: filtering narrows the visible rows; `distinct` may surface distinct values —
  the source (caller) governs what columns expose distinct values.
- **Input validation**: filter operator and kind are enums; filter text is treated as a literal match
  value, never interpolated into a query by the grid.
- **Injection risks**: push-down passes a structured `FilterModel` (columnId + kind + operator enum +
  literal operands) to `setFilter`; the source MUST parameterize the resulting `WHERE`/`SELECT
  DISTINCT` (caller responsibility, documented — the grid never builds SQL).
- **Encryption / rate limiting / infrastructure**: N/A.

---

## Acceptance Criteria

1. [ ] Typing `"ali"` in a column's quick-filter input keeps only rows whose value contains `"ali"`
       (case-insensitive) and updates the footer count to the matched total.
2. [ ] A number condition filter `{ op: 'between', a: 100, b: 500 }` keeps only rows with
       `100 ≤ value ≤ 500`, evaluated on the numeric `value` (not the formatted `"$250,00"` text).
3. [ ] The value-list popup lists the column's distinct values from `source.distinct(columnId)`;
       checking two of them keeps only rows whose value is one of the two; "Select All" restores all.
4. [ ] By default an unfiltered column shows no funnel (clean header); a column with an active filter
       shows an emphasized funnel glyph. `Alt+Down` on a focused filterable column opens its condition
       popup regardless of whether a funnel is currently drawn.
5. [ ] Two active column filters combine with AND (a row must satisfy both to remain).
6. [ ] With a source exposing `setFilter`, filtering calls `setFilter(model)` and does not filter
       client-side (spy-verified); `length()` returns the filtered count and the footer shows "N of M".
7. [ ] When a windowed `distinct` hits its `LIMIT`, the popup discloses the list is truncated (no
       silent cap).
8. [ ] A `datagrid` kitchen-sink story demonstrates the quick-filter row + a value-list filter and
       passes the smoke test.
9. [ ] A non-filterable column (`filterable: false`) shows no funnel, omits its quick-filter input, and
       `Alt+Down` is a no-op on it.
10. [ ] A `showFunnel: true` column shows a muted funnel while unfiltered, an emphasized one while
        filtered, and returns to muted (still present) when the filter clears — the click routes to the
        popup whether or not a filter is active.
11. [ ] Opening a condition popup on a column near the right edge of a full-width grid keeps the popup
        fully within the viewport (right-aligned/clamped), never clipped off-screen.
12. [ ] A `filterPopup` factory replaces the built-in popup (the built-in `FilterPopup` is not mounted);
        a factory that returns `ctx.defaultPopup()` reuses the built-in one through the seam.
13. [ ] Security verified: filter operands are passed as structured literals to `setFilter`, never
        concatenated into a query by the grid; an unknown `columnId` filter is ignored.
