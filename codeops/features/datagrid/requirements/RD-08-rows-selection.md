# RD-08: Rows, Records & Selection

> **Document**: RD-08-rows-selection.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01, RD-02, RD-07 (left-pinned panel hosts the checkbox/gutter)
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

Record-level interaction: row-oriented selection (single and multi), a selection checkbox column and a
row-number gutter, row CRUD (insert / delete / duplicate), and null-vs-empty handling. This is the
v1 selection paradigm — whole records, not cells (cell/range selection is the deferred Phase-B fork,
AR-29). Selection state is keyed by `rowKey` (RD-01) so it survives sort/filter/reorder.

---

## Functional Requirements

### Must Have

- [ ] **Row-oriented selection** — single and multi selection of whole records, keyed by `rowKey`;
      `grid.selectedKeys(): ReadonlySet<Key>` reactive; a `selectionMode: 'single' | 'multi'` option.
- [ ] **Selection gestures (AR-21)** — `Space` toggles the focused row; `Ctrl`+click toggles a row;
      `Shift`+click and `Shift`+`↑`/`↓` extend a contiguous range from the anchor; clicking the
      checkbox column toggles; the header checkbox selects/clears all loaded rows.
- [ ] **Selected-row highlight** — selected rows paint in the `selected` role; precedence with the
      cell cursor and dirty marker is fixed (**cursor > dirty > selected > cellStyle > zebra > normal**,
      shared with RD-04).
- [ ] **Selection checkbox column** — an optional leading column with a per-row `[ ]`/`[x]` box and a
      tri-state header box (none / some / all).
- [ ] **Row-number gutter** — an optional leading gutter showing 1-based display row numbers (right-
      aligned, reserved width).
- [ ] **Row CRUD** — `grid.insertRow(row, at?)`, `grid.deleteRows(keys)`, `grid.duplicateRow(key)`,
      each routed through the data-source mutation seam (in-memory splices the `Signal<T[]>`; a source
      persists via caller callbacks). Deleting rows clears them from the selection.
- [ ] **Null policy** — a per-column `null?: { nullable: boolean; display?: string }`; a null value
      renders `display` (default `''`), distinct from an empty string, and editors respect nullability.

### Should Have

- [ ] **New-record append row** — an optional trailing `*` row that, when edited, inserts a new record
      (Access/Paradox convention). *Phase B.*
- [ ] **Record navigator** — a footer widget `|◄ ◄ n of N ► ►|` + go-to-record bound to the row cursor
      (RD-09 hosts it). *Phase B.*
- [ ] **Row drag-reorder** and **drag rows between grids**. *Phase C.*

### Won't Have (Out of Scope)

- Cell / range selection and range copy/paste/fill — deferred (AR-29).
- Undo of deletes/inserts — deferred (AR-30).

---

## Technical Requirements

### Selection model

```ts
export type Key = string | number;
export interface SelectionModel {
  readonly mode: 'single' | 'multi';
  keys(): ReadonlySet<Key>;      // reactive
  toggle(key: Key): void;
  selectRange(anchorKey: Key, toKey: Key): void;  // by display order
  selectAllLoaded(): void;
  clear(): void;
}
```

- A range extends from a stored **anchor** (the last non-shift selection) to the target in current
  display order; re-sorting/filtering keeps the selected *keys*, not indices.
- `single` mode replaces the selection on each select; `multi` accumulates.

### Row CRUD seam

```ts
export interface RowMutations<T> {
  insert?(row: T, at?: number): void | Promise<void>;
  remove?(keys: readonly Key[]): void | Promise<void>;
}
```

- In-memory source implements these by splicing the array signal; a windowed/server source provides
  callbacks that persist and then refresh. `duplicateRow` = `insert(structuredCloneOf(row), at+1)`
  with a fresh key the caller assigns (documented: the caller owns key generation).

### Checkbox column & gutter

- Both are synthetic leading columns the grid manages (not caller `GridColumn`s); they live in the
  left-pinned panel (RD-07) so they never scroll away. The checkbox column's clicks map to
  `selection.toggle`; the header box reflects none/some/all.

---

## Integration Points

### With RD-02 (editing)
- The cell cursor and selection coexist: the cursor is for editing/navigation, selection is the record
  set; both key by `rowKey`.

### With RD-09 (footer)
- Selection count and the record navigator render in the footer; range-selection aggregate stats are a
  Phase-B footer feature.

### With RD-10 (mouse)
- Click / Ctrl+click / Shift+click gestures are dispatched by RD-10's mouse handling into this model.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Selection paradigm | Row / cell-range / both | Row-oriented (v1) | SAP/Access record model; cell-range is P2 | AR #3, #29 |
| Selection identity | index / rowKey | rowKey | Survives sort/filter/reorder | AR #15 |
| Row CRUD persistence | direct / seam | `RowMutations` seam | Caller owns persistence + keys | AR #16 |
| New-record row | v1 / P2 | P2 | Core CRUD first | AR #27 |

---

## Security Considerations

- **Data sensitivity**: selection and CRUD operate on caller rows in memory; persistence only via the
  caller's `RowMutations`.
- **Input validation**: inserted/duplicated rows go through the same per-column validation/commit path
  (RD-12) before persistence; `rowKey` uniqueness is the caller's contract (documented).
- **Injection risks**: none new; rendered gutter/checkbox glyphs are static; row data renders via
  `sanitize` (RD-04).
- **Authorization**: delete/insert are only as permitted as the caller's `RowMutations` allow — the
  grid never deletes/persists on its own.
- **Encryption / rate limiting / infrastructure**: N/A.

---

## Acceptance Criteria

1. [ ] `Space` toggles the focused row's membership in `selectedKeys()`; in `single` mode a new
       selection replaces the prior; in `multi` mode it accumulates.
2. [ ] `Shift`+`↓` from an anchor selects the contiguous range in display order; after re-sorting, the
       same row *keys* remain selected (not the same indices).
3. [ ] The header checkbox shows none/some/all tri-state and toggles all loaded rows; per-row checkbox
       clicks toggle individual rows and stay in the left-pinned panel while the body scrolls.
4. [ ] A selected row paints in the `selected` role except where the cursor/dirty take precedence.
5. [ ] `insertRow(row, 2)` inserts at display index 2 via the source mutation seam; `deleteRows([k])`
       removes the row and clears `k` from the selection; `duplicateRow(k)` inserts a copy adjacent.
6. [ ] A null value renders the column's `null.display` (default `''`) and is distinguishable from an
       empty string in the model (a round-trip preserves null vs `""`).
7. [ ] The row-number gutter shows 1-based display numbers, right-aligned, and re-numbers after
       sort/filter.
8. [ ] A `datagrid` kitchen-sink story demonstrates multi-row selection + a checkbox column and passes
       the smoke test.
9. [ ] Security verified: no delete/insert occurs except through the caller's `RowMutations`; inserted
       rows are validated before persistence.
