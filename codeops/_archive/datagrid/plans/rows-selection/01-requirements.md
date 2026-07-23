# Requirements — Rows, Records & Selection

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-08](../../requirements/RD-08-rows-selection.md) — the OWNING requirements doc
> **CodeOps Skills Version**: 3.7.0

Scope delta over RD-08. RD-08 owns the canonical requirement text; this plan restates only the
in/out boundary and the acceptance criteria it commits to, with the gate decisions folded in.

## In scope (this plan — RD-08 Must-Have)

- **Row-oriented selection** — single + multi selection of whole records, keyed by `rowKey`;
  reactive `selectedKeys(): ReadonlySet<Key>`; a `selectionMode: 'single' | 'multi'` option
  (default `'multi'`, AR-2). [RD-08 Must; AR-1/AR-2/AR-9]
- **Selection gestures** — `Space` toggles the focused row **on a read-only cell** (on an editable cell
  `Space` keeps its begin-edit meaning; AR-19); `Ctrl`+click toggles a row; `Shift`+click and
  `Shift`+`↑`/`↓` extend a contiguous range from the anchor; a checkbox-column click toggles; the header
  checkbox selects/clears all **displayed** rows. A plain click is cursor-only (AR-17). [RD AR-21; AR-7]
- **Selected-row highlight** — selected rows paint the `selected` role under the fixed precedence
  **cursor > dirty > selected > cellStyle > zebra > normal** (shared with RD-04). [RD-08 Must; AR-13]
- **Selection checkbox column** — optional (`checkboxColumn?`, default off) leading `[ ]`/`[x]` box +
  a tri-state header box (none / some / all of the displayed rows). [RD-08 Must; AR-5/AR-7]
- **Row-number gutter** — optional (`rowNumbers?`, default off) leading gutter of 1-based **display**
  row numbers, right-aligned, that re-numbers after sort/filter. [RD-08 Must; AR-5]
- **Row CRUD** — `insertRow(row, at?)`, `deleteRows(keys)`, `duplicateRow(key)`, routed through a
  data-source mutation seam; `fromRows` splices the signal in-memory; deleting rows clears them from
  the selection; the caller owns key generation (`assignKey` hook for duplicate). [RD-08 Must;
  AR-4/AR-12]
- **Null policy** — per-column flat fields `nullable?: boolean` + `nullDisplay?: string` (AR-15, a
  plan-local rename of the RD's literal `null?:{…}` to avoid the `nulls?` collision); a null value
  renders `nullDisplay` (default `''`), distinct from an empty string; an editor on a nullable column
  commits `null` for an empty value. [RD-08 Must; AR-3]
- **Kitchen-sink story** + **datagrid-showcase cluster** replacing the RD-08 placeholder. [AR-8]
- **Security** — CRUD/selection never mutate outside the caller's `RowMutations`; all rendered text
  stays `sanitize`d after insert/duplicate/select; inserted values pass the validator. [RD-08 §Security;
  RD AR-25/26]

## Out of scope

- **New-record append (`*`) row** and **record navigator** (`|◄ ◄ n of N ► ►|`) — RD-08 Should,
  Phase B; the navigator is hosted by RD-09's footer. [RD-08 Should]
- **Row drag-reorder / drag rows between grids** — RD-08 Phase C.
- **Cell / range selection + range copy/paste/fill** — deferred (RD AR-29).
- **Undo/redo of edits/inserts/deletes** — deferred (RD AR-30); v1 CRUD is not undoable.
- **Row-editor form dialog** — Phase B (RD AR-27); the inline datasheet is the v1 primary.
- **Any `@jsvision/core`/`@jsvision/ui` engine change** — selection paint reuses the datagrid body's
  own `draw()` override (AR-1); the synthetic prefix is datagrid-local (AR-5/AR-11).

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Selection state representation | `selectedKeys` set + anchor; datagrid-local set-membership paint; zero ui change | AR-1 |
| `selectionMode` default + checkbox/gutter enablement | `'multi'` default; both extras opt-in (off) | AR-2 |
| Empty-editor commit on a nullable column | commits `null` (non-nullable commits `''`) | AR-3 |
| In-memory CRUD + duplicate key generation | `fromRows` built-in splice; caller-formed keys; `assignKey` hook | AR-4 |
| Checkbox/gutter geometry + cursor | fixed-width synthetic prefix, left-pinned, not cursor-navigable | AR-5 |
| Module decomposition | new `selection.ts` + `synthetic-columns.ts`; thin `grid.ts` wrappers | AR-6 |
| Header select-all scope under a filter | current `display()` (filtered) rows | AR-7 |
| Showcase coverage | kitchen-sink story + showcase cluster | AR-8 |

> **Traceability:** every decision above traces to the Ambiguity Register (`00-ambiguity-register.md`).

## Acceptance criteria (from RD-08, committed here)

1. `Space` on a **read-only** focused cell toggles the focused row's membership in `selectedKeys()`
   (`single` mode replaces the prior selection, `multi` accumulates); on an **editable** cell `Space`
   keeps its begin-edit meaning and leaves the selection unchanged (AR-19). *(AC-1 → Phase 2)*
2. `Shift`+`↓` from an anchor selects the contiguous range in display order; after re-sorting, the
   same row **keys** remain selected (not the same indices). *(AC-2 → Phase 2)*
3. The header checkbox shows none/some/all tri-state and toggles all **displayed** rows; per-row
   checkbox clicks toggle individual rows and stay in the left-pinned panel while the body scrolls.
   *(AC-3 → Phase 3)*
4. A selected row paints the `selected` role except where the cursor/dirty take precedence. *(AC-4 →
   Phase 2)*
5. `insertRow(row, 2)` inserts at source index 2 via the mutation seam; `deleteRows([k])` removes the
   row and clears `k` from the selection; `duplicateRow(k)` inserts a copy adjacent (fresh key via
   `assignKey`). *(AC-5 → Phase 4)*
6. A null value renders the column's `null.display` (default `''`) and is distinguishable from an
   empty string in the model (a round-trip preserves null vs `""`). *(AC-6 → Phase 5)*
7. The row-number gutter shows 1-based display numbers, right-aligned, and re-numbers after
   sort/filter. *(AC-7 → Phase 3)*
8. A `rows-selection` kitchen-sink story demonstrates multi-row selection + a checkbox column and
   passes the smoke test. *(AC-8 → Phase 6)*
9. Security: no delete/insert occurs except through the caller's `RowMutations`; inserted rows are
   validated before persistence; rendered text stays sanitized after any CRUD/selection change.
   *(AC-9 → Phase 4 + Phase 6)*
