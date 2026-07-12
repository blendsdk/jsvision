# RD-09: Footer, Aggregation & Master-Detail

> **Document**: RD-09-footer-aggregation-master-detail.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01, RD-08, RD-07 (pinned-panel column alignment for aggregates)
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

The footer band and record relationships. The footer is a reserved bottom band — another layout band
like the header — that hosts **both** column-aligned aggregates (totals) **and** free-form widget
slots (totals text, action buttons, a pager, a record navigator). Master-detail links a child grid to
the master's selected record via reactivity — nearly free given the reactive core, and the highest-
value relationship pattern for a terminal (inline tree-grids are out of scope, AR-5).

---

## Functional Requirements

### Must Have

- [ ] **Footer band** — an optional reserved bottom band composed like the header/scrollbar bands;
      holds column-aligned aggregate cells and/or a free-form widget row.
- [ ] **Free-form widget slots** — the footer accepts any `View`s (`Label` totals text, `Button`s
      emitting commands, and later a pager/navigator); buttons dispatch through the event loop exactly
      as the app-shell status line does.
- [ ] **Column aggregates** — a per-column aggregate `{ fn: 'sum'|'avg'|'min'|'max'|'count', format?,
      label? }` rendered aligned under its column; computed over the **loaded/in-memory** rows (AR-17).
- [ ] **Sticky footer** — the footer stays visible while the body scrolls (mirrors the sticky header).
- [ ] **Aggregate honesty** — when the source is windowed and not fully loaded, a loaded-set aggregate
      is labelled as such (e.g. `"Σ (loaded)"`) and never presented as a whole-dataset grand total
      unless a server aggregate is supplied.
- [ ] **Master-detail** — a documented pattern + helper linking a child `EditableDataGrid` to the
      master's focused/selected row via a reactive `computed`, so selecting a master row updates the
      detail rows.

### Should Have

- [ ] **Server aggregate hook** — `source.aggregate(columnId, fn): Promise<value>` for true whole-
      dataset totals over a windowed source. *Phase B.*
- [ ] **Record navigator** widget `|◄ ◄ n of N ► ►|` + go-to (hosts RD-08's Should) and the **pager**
      control (RD-11). *Phase B.*
- [ ] **Top toolbar band** — a symmetric top band for search/filter/actions. *Phase B.*
- [ ] **Drill-in** — double-click a master row to open the child grid full-screen with a breadcrumb.
      *Phase B.*

### Won't Have (Out of Scope)

- Inline nested / tree-grid rows and pivot — out of scope (AR #5, #11).

---

## Technical Requirements

### Footer band

```ts
export interface GridFooter<T> {
  sticky?: boolean;
  aggregates?: Record<string /*columnId*/, {
    fn: 'sum' | 'avg' | 'min' | 'max' | 'count';
    format?: (v: number) => string;
    label?: (v: number) => string;
  }>;
  widgets?: View[];   // free-form, span the band
}
```

- Aggregates fold over `column.value` across the loaded rows (a reactive `computed`, so edits/filters
  update the totals). `count` counts rows; numeric folds skip null.
- The band participates in the width-matched panel layout (RD-07), so aggregate cells align to their
  columns across the frozen/scrolling split; widget slots occupy a separate row of the band.

### Master-detail

```ts
// Pattern — the child rows are a computed over the master's selection.
const detail = new EditableDataGrid<Line>({
  rowKey: l => l.id,
  source: fromRows(computed(() => linesFor(master.focusedRow())), { rowKey: l => l.id }),
});
```

- The grid exposes `focusedRow(): T | undefined` and `selectedKeys()` (RD-08) as reactive readouts a
  detail grid binds to. A small `masterDetail(master, buildDetail)` helper wires the common case and
  disposes the detail's reactive scope with the master.

---

## Integration Points

### With RD-07 (columns/layout)
- Aggregate cells align to the pinned-panel column geometry; the footer band spans all panels.

### With RD-06 (filtering) / RD-08 (selection)
- The "N of M" filtered count (RD-06) and selection count render as footer widgets; aggregates react to
  the filtered/loaded set.

### With RD-11 (data at scale)
- The pager control is a footer widget; `source.aggregate` is the windowed-total seam.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Totals surface | totals row only / footer band | Footer band (aggregates + widgets) | Hosts totals, buttons, pager, navigator | AR #10 |
| Aggregate scope | whole-dataset / loaded-set | Loaded-set in v1 (+ server hook P2) | Can't fold 100k client-side | AR #17 |
| Grand-total honesty | silent / labelled | Labelled when partial | No misleading totals | AR #17 |
| Child grids | master-detail / inline tree | Master-detail (+ drill-in P2) | Terminal-friendly; tree is out | AR #5 |

---

## Security Considerations

- **Data sensitivity**: aggregates summarize caller data already on screen; the detail grid shows
  related caller data via the caller's own `computed`.
- **Input validation**: aggregate `fn` is an enum; `columnId` validated against known columns.
- **Injection risks**: footer widget text (labels/totals) passes `sanitize` (RD-04); a footer `Button`
  only emits the command the caller wired.
- **Encryption / rate limiting / infrastructure**: N/A.

---

## Acceptance Criteria

1. [ ] A footer aggregate `{ fn: 'sum' }` on a numeric column renders, aligned under that column, a
       total equal to the sum of the loaded rows' `value`; editing a cell updates the total reactively.
2. [ ] A footer `Button` widget dispatches its command through the event loop when clicked/activated.
3. [ ] The footer stays visible (sticky) while the body scrolls vertically; aggregate cells stay
       aligned to their columns across a frozen/scrolling split.
4. [ ] With a windowed source not fully loaded, a loaded-set aggregate is labelled as partial (e.g.
       `"Σ (loaded)"`) and not shown as a grand total; supplying `source.aggregate` yields the true
       total (Should).
5. [ ] Selecting/focusing a master row updates the linked detail grid's rows (reactive `computed`);
       the `masterDetail` helper disposes the detail scope with the master.
6. [ ] A filtered "N of M" count and a selection count render as footer widgets and update reactively.
7. [ ] A `datagrid` kitchen-sink story shows a totals footer + master-detail and passes the smoke test.
8. [ ] Security verified: footer label/total text is sanitized; aggregate `fn`/`columnId` are validated.
