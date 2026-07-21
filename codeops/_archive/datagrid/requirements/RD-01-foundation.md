# RD-01: Foundation & Grid-Engine Exposure

> **Document**: RD-01-foundation.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: —
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

This requirement establishes the `@jsvision/datagrid` package and the load-bearing contracts every
later requirement builds on: the reusable grid engine promoted from `@jsvision/ui`, the
`value`/`format`/`parse` column model, the row-identity and data-source abstractions, the
per-cell commit sink, and the cell-aligned editor-overlay helper. Nothing here is user-visible on
its own — it is the substrate. Getting these interfaces right is the whole point of doing
Foundation first: RD-02…RD-14 consume them, so an ambiguity here propagates everywhere.

The package is a new, dedicated monorepo workspace (`packages/datagrid`) depending on
`@jsvision/core` + `@jsvision/ui`, private until `@jsvision/ui` publishes, sharing the repo's
lockstep version. The editable grid deeply reuses the shipped virtual-scroll/column engine
(`GridRows`/`GridHeader` + the pure `columns.ts` math) rather than reimplementing it, so this RD
also promotes that engine to `@jsvision/ui`'s public API.

---

## Functional Requirements

### Must Have

- [ ] **Package scaffold** — `packages/datagrid` as an ESM-only, zero-runtime-dependency workspace
      (`@jsvision/datagrid`, `private: true`) with `build` / `typecheck` / `test` / `check:deps` /
      `check:docs` scripts wired into turbo, a `tsconfig.json` extending `tsconfig.base.json`, a
      per-package `vitest.config.ts` (unit + e2e projects), and a single public barrel
      `src/index.ts`. `private: true` keeps it out of lockstep publishing until `@jsvision/ui` is
      public; it then joins the lockstep version set (and `scripts/sync-package-versions.mjs` if it
      exports a `VERSION` constant).
- [ ] **Grid-engine exposure from `@jsvision/ui`** — `GridRows`, `GridHeader`, and the pure
      `columns.ts` helpers (`apportionColumns`, `alignCell`, `sortRows`, `measureAutoWidths`) plus
      their types (`Column`, `ColumnWidth`, `ColumnAlign`, `SortState`, `ColumnGeometry`) are
      re-exported from `@jsvision/ui`'s public barrel, each carrying a JSDoc `@example` so
      `check:docs` passes. `@jsvision/datagrid` consumes them by name; the spike's relative-path
      `dist/` reach is gone.
- [ ] **`value` / `format` / `parse` column model** — a `GridColumn<T>` descriptor separating the
      underlying value from its display string and its edit round-trip (contract below). Sorting and
      filtering operate on `value`; the cell shows `format(value)` (or `String(value)` when no
      formatter); editing round-trips through `parse`.
- [ ] **Row identity** — a required `rowKey(row): string | number` accessor on the grid config.
- [ ] **Data-source abstraction** — an in-memory source over `Signal<T[]>` **and** a windowed
      `GridDataSource<T>` interface (contract below), both satisfying the same read shape so the
      grid body is source-agnostic.
- [ ] **Commit sink** — an `onCommit(change): boolean | Promise<boolean>` contract (defined here,
      consumed by RD-02/RD-12).
- [ ] **Cell-overlay helper** — a `@jsvision/datagrid` no-frame, cell-rect-aligned editor mount built
      from **public** `@jsvision/ui` primitives (an absolutely-positioned `Group` child + `loop.focusView`
      + `add`/`remove` — the spike-proven mechanism), **not** `openAnchoredPopup` (which is ui-internal
      and not on the package's public surface). It mounts a `View` at a body-local cell rectangle inside
      an owned reactive root and disposes it on close.
- [ ] **Test + story harness** — the package's vitest unit/e2e projects run; a placeholder
      kitchen-sink story registration point exists so RD-02+ can add `datagrid` stories under the
      mandated smoke test.

### Should Have

- [ ] A `defineColumns<T>(...)` authoring helper for type-inferred column arrays.
- [ ] A `fromRows<T>(signal, { rowKey })` convenience constructor for the in-memory source.

### Won't Have (Out of Scope)

- The editable cell cursor, editors, sorting, filtering, columns UI, footer, validation — RD-02…RD-14.
- Concrete server/PG adapters for `GridDataSource` — Phase B (RD-11); the PG binding is the separate
  Data Studio app, not this package.
- Publishing `@jsvision/datagrid` to npm — deferred until `@jsvision/ui` is public.

---

## Technical Requirements

### Column model (`value` / `format` / `parse`)

```ts
/** A displayed, sortable, editable column over row type T. */
export interface GridColumn<T, V = unknown> {
  /** Stable column id — used for sort/filter state, commit targeting, persistence. */
  readonly id: string;
  /** Header title. */
  readonly title: string;
  /** The underlying typed value — the sort/filter key (NOT the display string). */
  readonly value: (row: T) => V;
  /** Display string when NOT editing. Default: String(value). */
  readonly format?: (value: V, row: T) => string;
  /** Text → value on edit commit. Required for editable non-string columns. */
  readonly parse?: (text: string) => V;
  readonly width?: ColumnWidth;        // reused from @jsvision/ui
  readonly align?: ColumnAlign;        // reused from @jsvision/ui
  // editor / filter / sort hooks are added by RD-03 / RD-06 / RD-05 respectively.
}
```

- `format` and `parse` are inverse where a column is editable: committing `parse(format(v))` must
  equal `v` for the built-in formatters. A read-only column may define `format` without `parse`.
- `value` is the single source of truth for sort (RD-05) and filter (RD-06). No consumer sorts or
  filters the formatted string.

### Column adaptation (`GridColumn` → the engine's `Column`)

The reused engine renders and measures via `@jsvision/ui`'s `Column<T>`, whose `accessor(row)` returns
a **string** and whose ordering is `accessor`-string-based unless a `compare` is supplied. `GridColumn`
is therefore **adapted** to an engine `Column` — this adapter is the seam that makes "reuse the engine"
work, and it is where the value/format split becomes correct rendering + ordering:

```ts
// Conceptual adapter (internal): GridColumn<T,V> → @jsvision/ui Column<T>
function toEngineColumn<T, V>(c: GridColumn<T, V>): Column<T> {
  return {
    title: c.title,
    accessor: (row) => c.format ? c.format(c.value(row), row) : String(c.value(row)),
    width: c.width ?? 'auto',
    align: c.align,
    // value-aware default comparator; the display string is NEVER the sort key
    compare: (a, b) => defaultCompare(c.value(a), c.value(b)),
  };
}
```

- The engine's promoted `sortRows` stays a **single-key string/`compare` sort**. The datagrid's own
  value-aware ordering (numeric/date/locale, multi-key, nulls) is RD-05's `sortRowsMulti`, which reads
  `value` directly; the adapter's `compare` is only the engine-render fallback for single-column engine
  sorting. In other words: value-aware sorting is the **datagrid's**, not a behavior of the reused
  `sortRows`.

### Row identity & data source

```ts
/** Read/mutate contract the grid body binds to. In-memory and windowed both satisfy it. */
export interface GridDataSource<T> {
  rowKey: (row: T) => string | number;   // required (AR-15)
  length(): number;                       // total row count (or best-known for windowed)
  rowAt(index: number): T | undefined;    // display-ordered; undefined if not yet loaded
  ensureRange?(start: number, end: number): void | Promise<void>; // windowed prefetch
  setSort?(keys: SortKey[]): void;        // push-down (RD-05); omit → client-side
  setFilter?(model: FilterModel<T>): void;// push-down (RD-06); omit → client-side
  distinct?(columnId: string): Promise<string[]>; // value-list enumeration (RD-06)
}

/** In-memory source: client-side sort/filter/slice over a reactive array. */
export function fromRows<T>(rows: Signal<T[]>, opts: { rowKey: (row: T) => string | number }): GridDataSource<T>;
```

- The in-memory source implements `length`/`rowAt` over the (sorted/filtered) array and computes
  `distinct` client-side. A windowed source implements `ensureRange` + server push-down and returns
  `undefined` from `rowAt` for not-yet-loaded rows (the body renders a loading placeholder — RD-11).
- `rowKey` uniqueness is the caller's contract; the grid keys its reactive reconcile, selection, and
  dirty map by it.

### Commit sink

```ts
export interface CellCommit<T, V = unknown> {
  readonly rowKey: string | number;
  readonly columnId: string;
  readonly value: V;           // parsed new value
  readonly previous: V;        // prior value
  readonly row: T;
}
/** Returning false / rejecting vetoes: the editor stays open and the value reverts. */
export type OnCommit<T> = (change: CellCommit<T>) => boolean | Promise<boolean>;
```

- The in-memory record updates immediately on commit (AR-02); `onCommit` governs *persistence* and is
  the per-cell veto seam. The per-row validation gate + BeforeSave veto (RD-12) layer above it.

### Cell-overlay helper

- Mounts a supplied `View` at a body-local cell rectangle `{ x, y, width, height }` translated to an
  absolute overlay position, inside a fresh reactive root owned by the overlay so binding effects
  dispose on close. No frame/border chrome (unlike the dropdown popup). Focus routes to the mounted
  view; Esc/commit disposes it. It is composed from **public** `@jsvision/ui` primitives (an
  absolutely-positioned `Group` child of the grid + `loop.focusView` + `add`/`remove`), not the
  internal `openAnchoredPopup`; an editor's own dropdown (`DatePicker`/`ComboBox`) opens its popup
  internally through the public widget, so the overlay helper never needs the internal popup seam.

### Package wiring

- `dependencies`: `@jsvision/core`, `@jsvision/ui` at the repo's fixed lockstep version (e.g. `"0.2.0"`,
  matching sibling packages — not `workspace:*`). No third-party / native deps (`check:deps` guard).
- `type: module`, NodeNext, `strict`; `.js` import specifiers on `.ts` sources.
- Single entry `src/index.ts`; files target 200–500 lines.

---

## Integration Points

### With `@jsvision/ui`
- Adds public re-exports (`GridRows`, `GridHeader`, `columns.ts` helpers/types) — additive, ui's
  read-only `DataGrid` unchanged (AR-12/AR-13). Each new export gets a JSDoc `@example`.

### With `@jsvision/core`
- Reuses `ScreenBuffer`, `sanitize`, `Signal`/reactivity (via ui), and the Theme model. RD-14 adds
  the additive `core` Theme roles (AR-24).

### With RD-02…RD-14
- RD-02 (editing) consumes `GridColumn`, `GridDataSource`, `rowKey`, `OnCommit`, and the overlay
  helper. RD-05/06 extend `GridColumn` with sort/filter hooks and use `setSort`/`setFilter`/`distinct`.
  RD-11 provides windowed `GridDataSource` implementations.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Package boundary | New package / fold into ui / couple to PG | New `@jsvision/datagrid` | Independent versioning, clean boundary, PG stays downstream | AR #1 |
| Engine reuse | Export from ui / move table into datagrid | Export from ui | Additive; moving it inverts layering → cycle | AR #12 |
| ui.DataGrid overlap | Keep / consolidate | Keep as-is | Ships today; additive is lower-risk | AR #13 |
| Value vs display | Formatted-string accessor / split value+format+parse | Split | Correct type-aware sort/filter/edit | AR #31 |
| Row identity | `rowKey` accessor / index | Required `rowKey` | Selection/edits/reconcile survive reordering | AR #15 |
| Data source | Array-only / two-tier | In-memory + windowed `GridDataSource` | One body, both scales | AR #14 |
| Commit contract | Direct mutation / `onCommit` sink | `onCommit` veto sink | Per-cell veto + persistence seam | AR #16 |

---

## Security Considerations

- **Data sensitivity**: the grid renders arbitrary caller data; treat all cell text as untrusted for
  rendering.
- **Input validation**: `parse` output and any editor input are validated by the column validator
  (RD-03/RD-12) before commit; this RD defines the seam, RD-12 enforces it.
- **Authentication & authorization**: N/A at the widget layer — the host app owns auth; the grid
  never bypasses a caller's `onCommit`.
- **Injection risks**: control-byte / escape-sequence injection via cell values or pasted content is
  the real threat in a TUI. **All text written to the `ScreenBuffer` passes the core `sanitize`
  boundary** (AR-25/26); no column value, `format` output, or custom-renderer output reaches the
  terminal unsanitized.
- **Encryption needs**: N/A (in-process library; no transport/storage).
- **Rate limiting**: N/A.
- **Infrastructure**: zero runtime dependencies (`check:deps`); no `eval`, no dynamic require.

---

## Acceptance Criteria

1. [ ] `yarn workspace @jsvision/datagrid build` emits `dist/` with exactly one entry point
       (`index.js` + `index.d.ts`); `yarn check:deps` for the package reports zero native runtime
       dependencies.
2. [ ] `@jsvision/ui`'s public barrel exports `GridRows`, `GridHeader`, `apportionColumns`,
       `alignCell`, `sortRows`, `measureAutoWidths`, and the types `Column`, `ColumnWidth`,
       `ColumnAlign`, `SortState`, `ColumnGeometry`; `yarn check:docs` passes (each has an
       `@example`); ui's existing `DataGrid` export and its tests are unchanged.
3. [ ] A `GridColumn` with `value: r => r.balance` and no `format` renders `String(r.balance)` in a
       non-editing cell; the same column with `format: v => eur(v)` renders the formatted string; and
       for a numeric column, the datagrid orders rows by the numeric `value` — via the synthesized
       value-comparator (see §Column adaptation) / RD-05 `sortRowsMulti` — never the formatted text
       (e.g. `"$1.000,00"` sorts below `"$9,00"` numerically → 9 before 1000). The promoted engine
       `sortRows` remains a single-key string/`compare` sort; value-aware ordering is the datagrid's.
4. [ ] `fromRows(signal, { rowKey })` returns a `GridDataSource` whose `length()` equals
       `signal().length` and whose `rowAt(i)` returns `signal()[i]` in display order; a hand-written
       windowed source satisfying the same interface drives the identical body code path (proven by a
       shared spec that runs against both).
5. [ ] Constructing a grid without `rowKey` is a TypeScript compile error (the field is required).
6. [ ] Committing a cell calls `onCommit` with `{ rowKey, columnId, value, previous, row }`; when
       `onCommit` returns `false` (or a rejected Promise) the value reverts to `previous` and the
       editing state is retained; when it returns `true` the new value is displayed.
7. [ ] The cell-overlay helper mounts a supplied `View` at a given body-local cell rect, the mounted
       view receives focus, and closing it disposes the reactive root (no leaked effects — verified by
       an owner-disposal assertion).
8. [ ] A value containing a control byte (e.g. `"\x1b[31m"` or `"\x07"`) supplied as a cell value or
       via `format` is rendered through `sanitize`, so the serialized frame contains no raw ESC/BEL
       byte from that value.
9. [ ] The package's vitest unit + e2e projects run under `yarn test` / `yarn test:e2e`, and a
       `datagrid` kitchen-sink story registration point exists and passes the headless smoke test.
10. [ ] Security requirements verified: sanitize-boundary test (AC-8), no native deps (AC-1), no
        `eval`/dynamic-require in the package source.
