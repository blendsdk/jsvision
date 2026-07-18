# RD-03: Cell Editors & Value Help

> **Document**: RD-03-cell-editors.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01, RD-02
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

The concrete editors a cell mounts: a typed built-in set (text, integer, decimal, boolean, date,
enum, lookup, read-only), a custom-editor escape hatch, and F4 value help (lookup dropdowns) for
foreign-key-style columns. Each editor is a `@jsvision/ui` widget bound to the cell's edit field
through a typed adapter — this is the generalized, Postgres-free version of the spike's
`editor-spec.ts` (`createCellEditor` + the bool/date/enum/lookup bridges). RD-02 owns *when* an
editor mounts; this RD owns *which* editor and how it binds.

---

## Functional Requirements

### Must Have

- [ ] **Editor descriptor on the column** — `GridColumn.editor?: CellEditorSpec | ((row: T) =>
      CellEditorSpec)`; absent → the column is read-only.
- [ ] **Built-in typed editors** — `text`, `integer`, `decimal`, `boolean`, `date`, `enum`, `lookup`,
      `readonly`, each mapping to a shipped `@jsvision/ui` widget bound to the edit field via a typed
      adapter:
      - `text`/`integer`/`decimal` → `Input` (with the kind's keystroke filter validator).
      - `boolean` → `CheckGroup` over a `boolean ⟷ 'true'/'false'` field bridge.
      - `date` → `DatePicker` over a `CalendarDate ⟷ ISO string` bridge.
      - `enum` → non-editable `ComboBox<string>` over the spec's value set.
      - `readonly` → `null` (no editor; RD-02 rejects begin-edit).
- [ ] **Custom-editor factory** — `{ kind: 'custom', create: (field: Signal<string>, host:
      CellEditorHost) => View }` returning any `View` that binds to `field` and honors the RD-02
      Enter=commit / Esc=cancel protocol.
- [ ] **F4 value help / lookup** — `{ kind: 'lookup', items }` where `items` is a provider
      (`LookupItem[]` or `() => Promise<LookupItem[]>`); mounts the public `ComboBox<LookupItem>`
      (which opens its own dropdown internally — no direct use of the ui-internal popup seam);
      selecting an item writes its **key** to the field (not the label). `F4` opens it.
- [ ] **Field binding correctness** — every editor reads/writes the single `Signal<string>` edit
      field; the typed adapters keep the string field authoritative so RD-02's `parse` produces the
      right typed value on commit. Adapter effects are created inside the overlay's reactive root.

### Should Have

- [ ] **Per-row conditional editor** — the function form `editor: (row) => CellEditorSpec` selecting
      editor/read-only by row state (the union already supports it; this is the wired UX). *Phase B.*
- [ ] **`datetime`** (composite date+time) and **structured** (`json`/`array`) rich editors. *P3 —
      until then these edit raw text.*

### Won't Have (Out of Scope)

- Deriving editors from a database schema (`resolveEditors`/introspection) — that PG layer lives in
  the separate Data Studio app, not this package.
- The keystroke-filter/range/lookup **validator** model itself — reused from `@jsvision/ui`
  `validators/`; enforcement/surfacing is RD-12.

---

## Technical Requirements

### Editor spec & factory

```ts
export type CellEditorKind =
  | 'text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'enum' | 'lookup' | 'readonly' | 'custom';

export interface CellEditorSpec {
  readonly kind: CellEditorKind;
  readonly validator?: Validator;                 // from @jsvision/ui
  readonly values?: readonly string[];            // enum
  readonly items?: LookupProvider;                // lookup
  readonly create?: (field: Signal<string>, host: CellEditorHost) => View; // custom
}
export interface LookupItem { readonly key: string; readonly label: string; }
export type LookupProvider = readonly LookupItem[] | (() => Promise<LookupItem[]>);
export interface CellEditorHost { /* overlay/loop seams the editor may need */ }

/** Returns the editor View for a cell, or null for read-only/unsupported. */
export function createCellEditor(spec: CellEditorSpec, field: Signal<string>, host: CellEditorHost): View | null;
```

### Typed adapters (string field ⟷ typed control)

- `boolBridge(field)` → `Signal<boolean[]>` for `CheckGroup` over `'true'/'false'`.
- `dateBridge(field)` → `Signal<CalendarDate|null>` over an ISO string, using core `toISO`/`parseISO`.
- `enumBridge(field)` / `lookupBridge(field, items)` → the ComboBox `value` signal (`'' ⟷ null`; the
  lookup bridge maps key ⟷ selected `LookupItem`).
- Each bridge is a pair of `untrack`-guarded effects (write only on change) to avoid feedback loops —
  the spike-proven pattern.

---

## Integration Points

### With RD-02
- RD-02 calls `createCellEditor(column.editor, field, host)` at begin-edit and mounts the returned
  `View`; `null` rejects the edit.

### With RD-01
- Binds to the `Signal<string>` edit field; `parse` (RD-01) turns the committed string into the typed
  value.

### With RD-12
- The editor's `validator` feeds RD-12's per-cell validation + the `Input.valid()` gate; a failing
  validator blocks commit.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Editor selection | Fixed per column / spec+custom | Spec union + custom factory | Built-ins cover the common types; custom is the escape hatch | AR #10 |
| Lookup commit value | key / label | Key | Stores the FK key, shows the label | AR #32 |
| Schema-derived editors | Include / exclude | Exclude (Data Studio) | Keeps the package backend-agnostic | AR #1 |
| Per-row editor | v1 / P2 | P2 | Function form is the seam; wired UX later | AR #10 |

---

## Security Considerations

- **Data sensitivity**: editors hold caller values in memory only.
- **Input validation**: each editor applies its keystroke filter live and its `validator` at commit
  (RD-12); non-conforming input is rejected before `parse`/commit.
- **Authentication & authorization**: a `lookup` provider's query is the caller's responsibility and
  MUST be parameterized server-side (the grid never builds SQL); the grid only consumes
  `LookupItem[]`.
- **Injection risks**: editor text and lookup labels pass the core `sanitize` boundary before render
  (AR-25/26); a malicious label cannot inject control bytes.
- **Encryption / rate limiting / infrastructure**: N/A.

---

## Acceptance Criteria

1. [ ] A column with `editor: { kind: 'boolean' }` mounts a `CheckGroup` whose toggle flips the
       committed value between the boolean's `'true'`/`'false'` string; a `date` editor mounts a
       `DatePicker` whose commit yields an ISO `YYYY-MM-DD` string.
2. [ ] An `enum` editor mounts a non-editable `ComboBox` listing exactly `spec.values` in order;
       selecting the 3rd value commits that string.
3. [ ] A `lookup` editor with `items: async () => [{key:'7',label:'Ada'}]` loads asynchronously,
       displays `"Ada"`, and on select writes `"7"` (the key) to the field — verified by the committed
       value being the key, not the label.
4. [ ] `{ kind: 'custom', create }` returns the caller's `View`; pressing `Enter` in it commits via the
       RD-02 protocol and `Esc` cancels.
5. [ ] `createCellEditor` returns `null` for `{ kind: 'readonly' }`, and RD-02 rejects begin-edit for
       that column.
6. [ ] `F2`/`Enter` open the type-appropriate editor; `F4` on a `lookup` cell opens the lookup popup.
7. [ ] The typed bridges do not loop: setting the field programmatically updates the control once and
       does not re-trigger a field write (asserted via effect-run counts).
8. [ ] `datagrid` kitchen-sink stories cover the built-in editor kinds and pass the smoke test.
9. [ ] Security verified: a lookup `label` containing a control byte renders sanitized; editor input is
       validator-gated before commit.
