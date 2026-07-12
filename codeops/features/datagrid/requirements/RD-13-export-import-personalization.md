# RD-13: Export, Import & Personalization

> **Document**: RD-13-export-import-personalization.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-05, RD-06, RD-07
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

The Phase-B data-movement and personalization layer: exporting the current view (CSV/HTML/JSON/TSV),
importing rows (CSV / paste-append), and saving/restoring layout **variants** (column order, widths,
visibility, freeze, sort, filter) in the SAP-variant tradition. This whole RD is Phase B — none of it
gates the v1 enterprise datasheet — but it is the enterprise-parity follow-up.

---

## Functional Requirements

### Must Have (Phase-B baseline)

- [ ] **Export CSV** — export the current view (visible columns in display order, `format`ted values,
      the filtered + sorted rows) to CSV, with correct quoting/escaping.
- [ ] **Export HTML** — the same view as an HTML `<table>` (formatting + column order preserved).
- [ ] **Layout variants** — serialize the current column order, widths, visibility, freeze, sort, and
      filter model to a named JSON variant, and restore it exactly (`grid.saveVariant(name)` /
      `grid.applyVariant(variant)`; the variant store is caller-provided).

### Should Have

- [ ] **Export JSON** and **TSV-to-clipboard** (pastes into a spreadsheet via `setClipboard`).
- [ ] **Import CSV / paste-append** — parse rows and append them through the RD-08 row-mutation seam;
      every imported value passes `sanitize` + the destination column's validator before commit
      (AR-26).
- [ ] **xlsx export** — via a pure-JS library; because that adds a dependency, it lives in a consumer
      app or an optional peer, never in the zero-dependency package core.
- [ ] **Personalization dialog** — a `Dialog` UI for column show/hide/reorder + variant management.

### Won't Have (Out of Scope)

- Printing / page setup — not possible in a terminal (AR #11); export is the substitute.

---

## Technical Requirements

### Exporter

- One `exportView(grid, format)` walks the current display order + filtered/sorted row window, applies
  each column's `format`, and serializes. CSV uses RFC-4180 quoting (quote fields containing `,`,`"`,
  or newlines; double embedded quotes).
- **CSV formula-injection escaping (security-critical):** a field whose formatted value begins with
  `=`, `+`, `-`, `@`, tab, or CR is prefixed with a `'` (or wrapped) on CSV/TSV export so a downstream
  spreadsheet does not execute it as a formula.

### Variant schema

```ts
export interface GridVariant {
  readonly name: string;
  readonly columns: { id: string; width?: number; visible: boolean }[]; // order = array order
  readonly freeze: { left: string[]; right: string[] };
  readonly sort: SortKey[];
  readonly filter: Array<{ columnId: string; filter: ColumnFilter }>;
}
```

- Applying a variant validates each `columnId` against the current columns (unknown ids skipped, not
  thrown) and reproduces order/width/visibility/freeze/sort/filter.

### Import

- Parse (CSV → rows), map columns by header/position, then for each value: `sanitize` → column
  `parse` → column `validator` → `RowMutations.insert`. A value failing parse/validation is reported
  per-row and not inserted (no partial-silent corruption).

---

## Integration Points

- Reads the RD-07 column state + RD-05/RD-06 sort/filter models; imports via RD-08 `RowMutations` +
  RD-12 validation; TSV-to-clipboard uses `@jsvision/web`'s `setClipboard` seam where available.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Export scope | raw data / current view | Current view (format+order+filter+sort) | WYSIWYG export | AR #10 |
| xlsx | core / app-level | App-level / optional peer | Preserves zero-dep core | AR #11 |
| Variant store | built-in / caller | Caller-provided store | Grid stays stateless re: persistence | AR #10 |
| CSV formula injection | ignore / escape | Escape leading `= + - @` | Prevents spreadsheet formula injection | AR #26 |

---

## Security Considerations

- **Data sensitivity**: export writes caller data to a string/clipboard the host handles; the grid does
  not choose a destination.
- **Input validation**: **imported** values are the key ingress — each passes `sanitize` + `parse` +
  the column validator before insertion (AR-26); invalid rows are rejected, never silently coerced.
- **Injection risks**: **CSV/formula injection** — leading `= + - @ \t \r` fields are escaped on export
  (a genuine, commonly-missed vector); all rendered/exported text is sanitized of control bytes.
- **Encryption / rate limiting / infrastructure**: N/A (in-process; transport is the host's concern).

---

## Acceptance Criteria

1. [ ] CSV export reproduces the visible columns in display order with `format`ted values and only the
       filtered + sorted rows; a field containing `,` or `"` is RFC-4180 quoted.
2. [ ] A cell whose formatted value is `=SUM(A1)` is exported as an escaped literal (e.g. `'=SUM(A1)`)
       so a spreadsheet does not execute it (formula-injection prevention).
3. [ ] `saveVariant('mine')` then `applyVariant` on a freshly-constructed grid reproduces the exact
       column order, widths, visibility, freeze, sort, and filter; an unknown `columnId` in a variant
       is skipped without throwing.
4. [ ] (Should) Import/paste-append parses rows and inserts them via `RowMutations`; a value failing
       `parse`/validation is reported and that row is not inserted (no partial-silent insert).
5. [ ] (Should) TSV-to-clipboard produces tab-separated rows that paste into a spreadsheet as columns.
6. [ ] Imported values containing control bytes are sanitized before insertion.
7. [ ] A `datagrid` kitchen-sink story demonstrates CSV export + a saved variant and passes the smoke
       test.
8. [ ] Security verified: CSV formula-injection escaping (AC-2) and import sanitize+validate (AC-6).
