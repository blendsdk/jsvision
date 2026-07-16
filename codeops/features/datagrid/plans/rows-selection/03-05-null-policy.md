# Null Policy (per-column null vs empty): Rows, Records & Selection

> **Document**: 03-05-null-policy.md
> **Parent**: [Index](00-index.md)

## Overview

A per-column policy that lets a column hold and display a **null** value distinctly from an empty
string, and lets an editor **clear a cell to null**. Sorting of nulls is already handled (`nulls?:
'first' | 'last'` + `defaultCompare`, `column.ts:91`/`:195`) — this adds only **rendering** and
**editing** of null.

## Architecture

### Current Architecture

`toEngineColumn`'s accessor (`column.ts:171`) is `c.format ? c.format(v, row) : String(v)`. When
`value(row)` is `null`/`undefined`, `String(null)` renders the literal `"null"` — wrong. The edit path
parses text via `parse(text): V | ParseFailed`; there is no way to commit a null.

### Proposed Changes

Add two flat fields to `GridColumn` (AR-15), render `nullDisplay` for a null value, and commit `null`
for an empty editor value on a nullable column (AR-3).

## Implementation Details

### New fields (`GridColumn`)

```ts
/** Allow this cell to hold `null`: an editor that commits an empty value stores `null` (not ''). */
readonly nullable?: boolean;
/** Text shown for a null/undefined value (default `''`), distinct from an empty string. */
readonly nullDisplay?: string;
```

### Rendering (`toEngineColumn`, `column.ts`)

The accessor renders `nullDisplay` **before** `format`/`String` when the value is nullish:

```ts
accessor: (row) => {
  const v = c.value(row);
  if (v === null || v === undefined) return c.nullDisplay ?? '';   // ← new
  return c.format ? c.format(v, row) : String(v);
},
```

So a null renders `nullDisplay` (default `''`), a real value renders as before. This flows through
every render path (the engine cell, the datagrid body's `format` echo) uniformly. The `nullDisplay`
string still passes the `sanitize` boundary like any rendered text (RD AR-25).

### Editing (the begin-edit / commit path, `editable-grid-rows.ts` → `commitCell`)

On commit, the edited text is turned into a value:

- **`nullable` column + empty text (`''`)** → the committed value is **`null`** (bypasses `parse`);
  `set(row, null)` writes it; `nullDisplay` renders it (AR-3).
- **non-nullable column** → unchanged: `parse('')` runs (a text column yields `''`; a numeric column
  yields `PARSE_FAILED`, which the commit path already rejects).
- **`nullable` column + non-empty text** → `parse(text)` as usual.

Consequence (AR-3, accepted): a nullable column cannot also store a literal empty string distinct from
null — empty means null there. A caller who needs literal `''` leaves the column non-nullable.

The editor's initial text for a null value is empty (it shows nothing to edit), so clearing an
already-null cell and re-committing keeps it null.

## Integration Points

- **With RD-04 formatting:** `nullDisplay` is resolved in the accessor, upstream of `format`, so a
  custom `render` still runs for non-null values; a null value shows `nullDisplay` (the render hook is
  for value glyphs, not the null placeholder).
- **With RD-05 sorting:** null ordering stays governed by `nulls?`/`defaultCompare` — unchanged.
- **With `04` CRUD:** an inserted row may carry null fields; they render via `nullDisplay`.
- **With `onCommit` (RD AR-16):** a null commit goes through `commitCell` like any edit; the sink can
  veto it.

## Code Examples

```ts
column({
  id: 'dept', title: 'Dept',
  value: (r: Emp) => r.dept,          // r.dept: string | null
  set: (r, v) => { r.dept = v; },
  parse: (t) => t,
  nullable: true,
  nullDisplay: '—',                   // a null renders '—', not '' and not 'null'
});
// editing the cell to empty → commits null → renders '—'
// editing to 'Ops' → commits 'Ops'
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `value(row)` is null on a column with no `nullable`/`nullDisplay` | Renders `''` (the default `nullDisplay`) — never the literal `"null"` | AR-3/AR-15 |
| Empty commit on a **non**-nullable text column | Stores `''` as today (not null) | AR-3 |
| Empty commit on a **non**-nullable numeric column | `parse('')` → `PARSE_FAILED` → commit rejected, editor stays open (existing behavior) | RD-04 |
| `nullDisplay` containing control chars | Passes the `sanitize` boundary like all rendered text | RD AR-25 |

> **Traceability:** cites AR-3/AR-15 and RD AR-16/25.

## Testing Requirements

- Spec (ST-19…ST-20): a null value renders `nullDisplay` and round-trips distinct from `''`; an empty
  commit stores null on a nullable column, `''` on a non-nullable one.
- Impl: null renders `''` when `nullDisplay` is omitted; a non-null value is unaffected; a numeric
  non-nullable empty commit still rejects.
