# 03-01 — Additive Surface: write seam, editor factory, theme roles

> **Parent**: [Index](00-index.md) · **Phase**: 1
> **Refs**: AR #1, #2, #3, #11 (plan)

The three small additions every later part of RD-02 builds on: the column **write** path, the editor **seam**,
and the two **theme roles**. All additive; nothing existing changes shape.

## 1. Column write seam — `column.set` + `isEditable` (`packages/datagrid/src/column.ts`)

Add an optional `set` to `GridColumn`, typed against `V` exactly as `parse` is:

```ts
export interface GridColumn<T, V = unknown> {
  readonly id: string;
  readonly title: string;
  readonly value: (row: T) => V;
  readonly format?: (value: V, row: T) => string;
  readonly parse?: (text: string) => V;
  readonly set?: (row: T, value: V) => void;   // NEW: writes the parsed value into the record
  readonly width?: ColumnWidth;
  readonly align?: ColumnAlign;
}
```

`column<T,V>()` is unchanged in body (it already erases `V` on return) — but because `set` is part of
`GridColumn<T, V>`, authoring `set: (r, v) => { r.x = v; }` is **type-checked against the inferred `V`** (a
mismatch is a compile error), the same guarantee `parse`/`format` already get.

Add the editability predicate (the single source of truth used by the factory + the engine):

```ts
/**
 * Whether a column can be edited: it round-trips text through both `parse` (text -> value) and `set`
 * (value -> record). A column missing either is read-only — the cursor lands on it, but begin-edit is
 * a no-op.
 */
export function isEditable<T>(col: GridColumn<T>): boolean {
  return typeof col.parse === 'function' && typeof col.set === 'function';
}
```

**Public exports** (from `index.ts`): the `GridColumn` change is transparent (already exported); add
`isEditable`.

**JSDoc note** (shipped-code rule): `set`'s doc explains it writes the parsed value into the record and pairs
with `parse`; the `@example` shows `set: (r, v) => { r.name = v; }`. No CodeOps/TV refs.

## 2. Editor seam — `createCellEditor` + default text `Input` (`packages/datagrid/src/cell-editor.ts`, new)

The factory RD-03 will extend; RD-02 ships one default (a text `Input`). It returns `null` for a non-editable
column, which is how begin-edit is rejected.

```ts
import { Input, type View, type Signal } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import { isEditable } from './column.js';

/** What an editor needs to open its own sub-UI later (RD-03); RD-02's text Input ignores it. */
export interface CellEditorHost {
  /** The grid's absolute overlay group — an editor with a dropdown mounts its popup here. */
  readonly overlay: import('@jsvision/ui').Group;
}

/**
 * Build the editor View for a cell, two-way-bound to `field`. Returns `null` when the column is
 * read-only (no `parse`/`set`) — the caller treats `null` as "reject begin-edit". RD-02 always
 * returns a single-line text `Input`; typed editors arrive behind this same signature later.
 */
export function createCellEditor<T>(
  column: GridColumn<T>,
  field: Signal<string>,
  _host: CellEditorHost,
): View | null {
  if (!isEditable(column)) return null;
  return new Input({ value: field });
}
```

The **field↔value round-trip** (owned by the controller in 03-02, specified here for cohesion):
- **Seed** `field` from `format(value)` when a formatter exists, else `String(value)`. For a **printable**
  begin-edit, seed `field` from the typed character instead (content replaced, req AR-19).
- **Commit** parses `field()` back with `parse` before `column.set`/`onCommit`.

**Public exports** (from `index.ts`): `createCellEditor`, `CellEditorHost`.

## 3. Core theme roles — `gridCursor`, `gridDirty` (`packages/core/src/engine/color/theme.ts`)

Add two roles (byte-frozen). Values chosen against the real palette and the neighboring roles
(`listFocused` = white-on-green is the focused **row**; the cursor must pop **inside** it):

```ts
/** The focused CELL box, drawn over the focused row so the cursor cell reads distinctly. */
gridCursor: { fg: PALETTE.black, bg: PALETTE.brightWhite },
/** The pending-commit marker color (a bullet on a not-yet-confirmed cell). */
gridDirty:  { fg: PALETTE.brightRed, bg: PALETTE.black },
```

- **`gridCursor`** — a filled black-on-brightWhite box (the `calendarCursor` filled-reverse idea, brightWhite so
  it separates from the green focused row and the cyan normal rows). Drawn as-is over the focused cell.
- **`gridDirty`** — provides the **marker foreground**; like `colorMarker`, it is **composed at draw time** over
  the cell's own background (`{ fg: gridDirty.fg, bg: <row's resolved bg> }`) so the `•` never punches a hole in
  a colored row. Its stored `bg` (black) is nominal and only asserted by the byte-freeze; the compositing is
  asserted by the overpaint spec (ST-8).

**JSDoc** (shipped-code rule): each role gets a plain-language doc (what it colors, the compositing note for
`gridDirty`) with no CodeOps/TV references. `ThemeRole` already carries only `{ fg, bg, hotkey? }`.

### Theme integration — the inventory tripwire (must-handle)

Adding roles trips the full-inventory theme specs that carry a sanctioned `LATER_ADDITIVE_ROLES` allowlist
(`packages/ui/test/{tabs,editor,feedback,date,color}-theme.spec.test.ts`). Phase 1 **adds `'gridCursor'`,
`'gridDirty'` to each allowlist** — the in-code comment designates this as the extension point and confirms it
does not weaken the guarantee (every pre-existing byte stays asserted). This is **not** a spec-oracle edit; it is
the same additive registration every prior tier (RD-18/20/21) made.

The **byte-for-byte guard** for the new roles is owned datagrid-side in a new
`packages/datagrid/test/grid-theme.spec.test.ts` (ST-16), mirroring how each tier owns its roles' bytes
(`table-theme.spec`/`feedback-theme.spec`/`color-theme.spec`): `toStrictEqual` the two roles + an `encode()`
non-throw across all four color depths. The core `theme-roles.spec.test.ts` uses a scoped subset, so it is
unaffected; the full `yarn verify` in Phase 1 catches any other tripwire.

## Spec coverage (see [07](07-testing-strategy.md))

- **ST-15** — `column.set` writes; `isEditable` true only when both `parse` && `set` present; `createCellEditor`
  returns an `Input` for an editable column and `null` for a read-only one.
- **ST-16** — `gridCursor`/`gridDirty` are byte-frozen and `encode()` at every depth without throwing.
- **ST-17** — the `format`-seed / printable-replace / `parse`-commit field round-trip (unit, controller-level).
