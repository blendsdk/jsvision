# 03-01 — Editor Spec & Factory

> **Document**: 03-01-editor-spec-and-factory.md
> **Parent**: [Index](00-index.md)
> **Owns**: the public `CellEditorSpec`/`CellEditorKind`/`LookupItem`/`LookupProvider` types, the
> `column.editor` field, `resolveSpec(column, row)`, and the `createCellEditor` widget switch (this doc is the
> single owner of the spec/factory surface; 03-02 owns the bridges, 03-03 owns lookup/F4/showcase).

## 1. The public types (`cell-editor.ts`)

```ts
import type { Signal, Validator, View } from '@jsvision/ui';

/** The concrete editor a cell mounts. `readonly` yields no editor; `custom` is the escape hatch. */
export type CellEditorKind =
  | 'text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'enum' | 'lookup' | 'readonly' | 'custom';

/** One row of a value-help lookup: the stored `key`, the shown `label`. */
export interface LookupItem { readonly key: string; readonly label: string; }

/** A lookup editor's rows: a static list, or an async provider (loaded once on mount). */
export type LookupProvider = readonly LookupItem[] | (() => Promise<LookupItem[]>);

/** The declarative editor descriptor a column carries. Every field beyond `kind` is optional. */
export interface CellEditorSpec {
  readonly kind: CellEditorKind;
  /** Live keystroke filter (default per kind; overrides the built-in default when set). */
  readonly validator?: Validator;
  /** The value set for `kind: 'enum'` (rendered in order; a selection commits the chosen string). */
  readonly values?: readonly string[];
  /** The rows for `kind: 'lookup'` (static array or async provider). */
  readonly items?: LookupProvider;
  /** The factory for `kind: 'custom'` — returns a View bound to `field`, honoring Enter=commit/Esc=cancel. */
  readonly create?: (field: Signal<string>, host: CellEditorHost) => View | null;
}
```

- `CellEditorHost` already exists (`cell-editor.ts:18`, `{ overlay: Group }`) — unchanged; `custom.create`
  receives it so a caller's editor can mount its own popup into the grid overlay.
- `datetime`/`json`/`array` are deliberately **absent** from `CellEditorKind` (AR #4).

## 2. The column field (`column.ts`)

```ts
export interface GridColumn<T, V = unknown> {
  // …existing id/title/value/format/parse/set/width/align…
  /** The cell editor to mount (a literal spec, or a per-row function). Absent ⇒ default text Input when the
   *  column is editable (has parse+set); a read-only column ignores it. */
  readonly editor?: CellEditorSpec | ((row: T) => CellEditorSpec);
}
```

- Purely additive; `column<T, V>()` infers `V` unchanged. `isEditable` (`column.ts:96`) is **not** touched —
  editability stays "parse && set" (AR #1).

## 3. `resolveSpec(column, row)` (`cell-editor.ts`, internal)

Turns the descriptor into a concrete spec, defaulting the RD-02 backward-compatible case:

```ts
function resolveSpec<T>(column: GridColumn<T>, row: T | undefined): CellEditorSpec {
  const e = column.editor;
  if (e === undefined) return { kind: 'text' };                  // editable + no editor → today's text Input
  if (typeof e === 'function') {
    if (row === undefined) return { kind: 'text' };              // no row to resolve against → safe default
    return e(row);
  }
  return e;
}
```

- **Backward-compat (AR #1):** an editable column with no `editor` resolves to `{ kind: 'text' }`, so
  `createCellEditor` returns the same text `Input` RD-02 shipped — the immutable ST-15 (`createCellEditor →
  Input` for an editable column, `null` for read-only) stays green with no oracle edit.
- **Per-row form (AR #4):** the function is called with the row `editing.ts` already has; when `row` is
  absent (a direct API call like ST-15's) it falls back to text.

## 4. The factory switch (`cell-editor.ts`)

```ts
export function createCellEditor<T>(
  column: GridColumn<T>, field: Signal<string>, host: CellEditorHost, row?: T,
): View | null {
  if (!isEditable(column)) return null;                          // parse+set gate unchanged (AC-5 read-only cols)
  const spec = resolveSpec(column, row);
  switch (spec.kind) {
    case 'text':
    case 'integer':
    case 'decimal':
      return new Input({ value: field, validator: spec.validator ?? defaultValidator(spec.kind) });
    case 'boolean':
      return new CheckGroup({ labels: [column.title], value: boolBridge(field) });      // 03-02
    case 'date':
      return new DatePicker({ value: dateBridge(field) });                              // 03-02
    case 'enum': {
      const items = signal<string[]>([...(spec.values ?? [])]);
      return new ComboBox<string>({ items, getText: (s) => s, value: enumBridge(field), editable: false });
    }
    case 'lookup':
      return buildLookupEditor(spec, field);                                            // 03-03
    case 'custom':
      return spec.create ? spec.create(field, host) : null;
    case 'readonly':
    default:
      return null;                                              // AC-5: explicit read-only opt-out
  }
}
```

- `host` is the existing `CellEditorHost`; the `_host` underscore is dropped now that `custom`/`lookup` use it.
- **AR #1 invariant:** the `isEditable` guard is first, so a column without parse/set is always `null` (the
  read-only rule wins over any `editor`); `editor: { kind: 'readonly' }` is the explicit opt-out for a
  parse/set column.
- **Reactive-ownership requirement.** The typed cases build bridges (`boolBridge(field)` etc.) that create
  `effect()`s **eagerly** at this call. So `createCellEditor` MUST be invoked **inside** the overlay's
  `createRoot` (see 03-02 "Ownership" + the `mountCellOverlay` build-callback restructure in 02-current-state
  and Phase 2) — otherwise those effects are unowned and leak. The `text`/`readonly` cases have no factory-time
  effects, but the invocation-site restructure is uniform for all kinds.

## 5. Keystroke filters (`cell-editor.ts`, internal) — AR #3

```ts
function defaultValidator(kind: CellEditorKind): Validator | undefined {
  if (kind === 'integer') return filter('0-9-');
  if (kind === 'decimal') return filter('0-9.-');
  return undefined;                                             // text and non-Input kinds
}
```

- Wired only as the `Input` **keystroke** filter — an invalid character never enters the buffer, so the
  committed value is filter-conformant (AC-9 clause 2). The commit-time `valid()` **gate** is RD-12 (AR #3).
- `spec.validator` overrides the default, so a caller can supply a stricter `range('1', '99')`.

## 6. Barrel exports (`index.ts`)

Add: `export type { CellEditorKind, CellEditorSpec, LookupItem, LookupProvider } from './cell-editor.js';`
(the `createCellEditor` value + `CellEditorHost` type are already exported). The bridges (`editor-bridges.ts`)
are **not** exported — internal (AR #5).

## Documentation & guard notes

- `createCellEditor`, `CellEditorSpec`, `LookupItem`, `LookupProvider` are public → each carries a plain-language
  JSDoc lead + `@param`/`@returns` + a copy-pasteable `@example` (an editable column with a typed `editor`).
- No `codeops/`/`plans/`/`RD-`/`AR-`/spike references in shipped JSDoc or code comments — `check-jsdoc.mjs` gates
  this. The behaviors an AR annotates are restated in plain language (e.g. "absent editor on an editable column
  mounts a text input").
