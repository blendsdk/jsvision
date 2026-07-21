# Header & Container Wiring: Sorting

> **Document**: 03-02-header-and-wiring.md
> **Parent**: [Index](00-index.md)

## Overview

Three things live here: (1) the **Phase-1 core prerequisite** that lets a header see `Ctrl`+click;
(2) the from-scratch **`SortHeader`** View that renders arrows + priority digits and turns clicks into
sort intent; and (3) the **container wiring** in `grid.ts` — the single-source-of-truth `Signal<SortKey[]>`,
the pure client `display`, the guarded push-down effect, cursor re-anchor by row-key, and the public
sort API. The container is the one place the header-click state machine (AR #5) lives, so the API and
the header share it by construction.

## Architecture

### Current Architecture

`EditableDataGrid` suppresses sorting: `ReadonlyGridHeader` swallows clicks, `signal<SortState>(null)` is
hard-wired, `display` is source-order (`grid.ts:37,126,132`). See [02](02-current-state.md).

### Proposed Changes

Replace `ReadonlyGridHeader` with `SortHeader`; make `sortKeys: Signal<SortKey[]>` the source of truth;
route `display` through `sortRowsMulti` on the client path; delegate to `source.setSort` on the push-down
path via a separate guarded effect. No `@jsvision/ui` change; the only core change is Phase 1.

## Implementation Details

### Phase 1 — core `MouseEvent` modifiers (AR #16)

Two additive edits to `@jsvision/core`, plus a decoder spec test.

```ts
// packages/core/src/engine/input/events.ts — MouseEvent gains OPTIONAL modifier flags.
export interface MouseEvent {
  readonly type: 'mouse';
  readonly kind: 'down' | 'up' | 'move' | 'drag';
  readonly button: number;
  readonly x: number;
  readonly y: number;
  readonly ctrl?: boolean;   // held Ctrl during the report (from the SGR button byte)
  readonly alt?: boolean;    // held Alt/Meta
  readonly shift?: boolean;  // held Shift
}
```

```ts
// packages/core/src/engine/input/mouse.ts — populate them in buildEvent's mouse branch (the bits are
// already parsed for the wheel branch: SHIFT_BIT/ALT_BIT/CTRL_BIT).
return {
  type: 'mouse', kind, button, x, y,
  ctrl: (b & CTRL_BIT) !== 0,
  alt: (b & ALT_BIT) !== 0,
  shift: (b & SHIFT_BIT) !== 0,
};
```

**Optional (not required)** — deliberately (AR #16): 109 sites construct `type: 'mouse'` literals
(≈85 test files across core/ui/files/examples); required fields would break every one under `strict`.
Optional keeps them compiling while the decoder always sets the flags on real events. A consumer reading
`inner.ctrl` on a synthetic (unset) event sees `undefined` → falsy → a plain click, which is correct.
Warrants a core `CHANGELOG.md` line (minor, additive). Caveat to document: some terminals intercept
Ctrl+click; the modifier is best-effort per terminal.

**Reviewed, intentionally unchanged — `packages/core/src/engine/safety/redact.ts`.** `redactEvent`
(`redact.ts:53`) rebuilds a `MouseEvent` field-by-field as `{ type, kind, button, x, y }` (`redact.ts:63`),
and its `RedactedEvent` mouse variant (`redact.ts:23`) omits modifiers. This is a **log-redaction helper
only** (not on the dispatch path), so the header still receives the raw modifiers on the real decoded
event; and it already drops the wheel event's modifiers (`redact.ts:65`), so omitting the mouse ones is
self-consistent. Left as-is. (Optional future parity: surface `ctrl`/`alt`/`shift` there — and on the
wheel branch — so a debug log matches `KeyEvent`'s modifier logging.)

### New: `SortHeader` (`sort-header.ts`)

```ts
export interface SortHeaderConfig<T> {
  columns: Column<T>[];                 // engine columns — titles + geometry
  columnIds: readonly string[];         // parallel to columns; index → columnId
  autoWidths: () => (number | null)[];  // shared with the body (identical geometry)
  indent: Signal<number>;               // shared H-scroll offset
  sort: Signal<SortKey[]>;              // the container's source of truth (read to render)
  onHeaderClick: (columnId: string, additive: boolean) => void; // additive = Ctrl held
}

export class SortHeader<T> extends View {
  override focusable = false;           // passive chrome; the body owns keys
  // …fields from cfg…
  protected geometry(width: number): ColumnGeometry {
    return apportionColumns(this.columns, this.autoWidths(), width); // shared helper
  }
  override draw(ctx: DrawContext): void;   // arrows + priority digits
  override onEvent(ev: DispatchEvent): void; // columnId hit-test → onHeaderClick
}
```

**Imports** (`sort-header.ts`, all from `@jsvision/ui`): the `View` base, the geometry helpers
`apportionColumns` / `alignCell` / `stringWidth`, and the `Column` / `ColumnGeometry` / `DispatchEvent` /
`DrawContext` / `Signal` types. Note `alignCell(text, width, align, measure)` takes a **required** 4th
`measure` argument — pass `stringWidth` (as the engine header does at `grid-rows.ts:428`).

**`draw()`** — mirrors `GridHeader.draw` geometry (`grid-rows.ts:412`) but multi-key:
- Compute `geom`, clamp `indent`; `keys = this.sort()`; build `Map<columnId, {priority, dir}>`;
  `multi = keys.length >= 2`.
- Blank in `tableHeader`. For each column `c` (`id = columnIds[c]`, `w = geom.widths[c]`, `x = starts[c]-indent`):
  - If `id` is sorted and `w > 0`: `reserve = min(multi ? 2 : 1, w)`; draw `alignCell(title, max(0, w-reserve), 'left', stringWidth)`;
    draw the arrow (`▲`/`▼` — reuse the engine glyphs, `grid-rows.ts:38-39`) at `x+w-1`; when `multi && w >= 2`
    draw the 1-based priority digit `String(priority+1)` at `x+w-2`. (AR #10: single-sort reserves 1 cell,
    multi reserves 2, title clips but the indicator is never truncated.)
  - Else: `alignCell(title, w, 'left', stringWidth)` at `x`.
  - Divider `│` at `x+w` in `listDivider`.
- Register the repaint deps in `onMount`: `this.bind(() => this.sort())` and `this.bind(() => this.indent())`.

**`onEvent()`** — mouse-down only (mirrors `grid-rows.ts:443`):
- Guard `inner.type === 'mouse' && inner.kind === 'down'`, `ev.local` present.
- `c = columnAtX(geom, local.x + clampedIndent)` — a small module-private hit-test (the ui `columnAt` is
  unexported, `grid-rows.ts:45`): return the `k` where `starts[k] <= x < starts[k]+widths[k]`, else `-1`.
- If `c >= 0`: `this.onHeaderClick(columnIds[c], inner.ctrl === true)`; `ev.handled = true`.

### Container wiring (`grid.ts`)

**Remove:** the `ReadonlyGridHeader` class, `signal<SortState>(null)`, and the `SortState`/`GridHeader`
imports. **Add:** `SortHeader`, `sortRowsMulti`, `SortKey`, `SortDir`.

```ts
// `source`, `columnMap`, and `display` are promoted to instance FIELDS (not constructor `const`s) so
// the sort API methods below — `applySort`/`sortBy`/`addSort`, which are class methods — can read them.
// Today `grid.ts:121` destructures `const { source } = opts` and `grid.ts:126` declares `const display`
// as constructor locals; both (and the new `columnMap`) move to fields.
private readonly sortKeys = signal<SortKey[]>([]);              // single source of truth
private readonly source: GridDataSource<T>;                     // was `const { source } = opts`
private readonly columnMap: ReadonlyMap<string, GridColumn<T>>; // for sortRowsMulti + validation
private readonly display: () => T[];                            // the derived view (assigned in the ctor)

// …in the constructor:
this.source = opts.source;
this.columnMap = new Map(opts.columns.map((c) => [c.id, c]));

// Client path is pure; a push-down source owns its own ordering (already re-queried), so don't re-sort it.
this.display = this.derived(() => {
  this.version();
  const rows = materialize(this.source);
  return this.source.setSort ? rows : sortRowsMulti(rows, this.sortKeys(), this.columnMap);
});

// Push-down: delegate ordering whenever the model changes — a SEPARATE, guarded effect (AR #7), never
// inside `display`, so `display` stays pure and a re-query can't loop through the computed.
this.onMount(() => {
  if (this.source.setSort) this.bind(() => this.sortKeys(), (keys) => this.source.setSort!(keys));
});

const header = new SortHeader<T>({
  columns: engineCols,
  columnIds: opts.columns.map((c) => c.id),
  autoWidths, indent: this.indent, sort: this.sortKeys,
  onHeaderClick: (columnId, additive) => (additive ? this.addSort(columnId) : this.sortBy(columnId)),
});
```

**The sort API + click state machine (AR #5).** `applySort` is the one mutator; it re-anchors the cursor
(AR #3) on the client path:

```ts
private applySort(next: SortKey[]): void {
  const before = this.display();
  const n = before.length;
  const fIdx = Math.max(0, Math.min(this.focused(), n - 1));
  const anchor = n ? this.source.rowKey(before[fIdx]) : undefined;
  const sIdx = this.selected();
  const selAnchor = sIdx >= 0 && sIdx < n ? this.source.rowKey(before[sIdx]) : undefined;

  this.sortKeys.set(next);

  // Push-down re-queries asynchronously (RD-11 territory) — synchronous re-anchor only makes sense on
  // the in-memory client path, where display() already reflects the new order.
  if (this.source.setSort) return;
  const after = this.display();
  if (anchor !== undefined) {
    const i = after.findIndex((r) => this.source.rowKey(r) === anchor);
    if (i >= 0) this.focused.set(i);
  }
  if (selAnchor !== undefined) {
    this.selected.set(after.findIndex((r) => this.source.rowKey(r) === selAnchor)); // -1 if gone
  }
}

sortBy(columnId: string, dir?: SortDir): void {          // plain click / API
  if (!this.columnMap.has(columnId)) return;                  // AR #14
  if (dir) return this.applySort([{ columnId, dir }]);
  const cur = this.sortKeys();
  const sole = cur.length === 1 && cur[0].columnId === columnId;
  this.applySort(sole ? cycleSole(cur[0]) : [{ columnId, dir: 'asc' }]); // toggle/cycle sole; else reset to single
}
addSort(columnId: string, dir?: SortDir): void {         // Ctrl+click / API
  if (!this.columnMap.has(columnId)) return;
  const cur = this.sortKeys();
  const idx = cur.findIndex((k) => k.columnId === columnId);
  if (dir) return this.applySort(withKeyDir(cur, columnId, dir)); // set-or-append explicit
  if (idx < 0) return this.applySort([...cur, { columnId, dir: 'asc' }]); // append asc
  this.applySort(cycleAt(cur, idx));                     // toggle/cycle the existing key
}
clearSort(): void { this.applySort([]); }
sort(): SortKey[] { return this.sortKeys(); }            // reactive readout (RD-05 §Must)
```

Tri-state cycle helpers (AR #4=A includes tri-state; a header click cycles asc → desc → none):
- `cycleSole(k)`: `k.dir==='asc'` → `[{...k, dir:'desc'}]`; else → `[]` (none → clear).
- `cycleAt(keys, idx)`: the key at `idx`: `asc` → set `desc` (keep the rest); `desc` → remove it.
- `withKeyDir(keys, id, dir)`: replace that key's dir if present, else append `{id, dir}` (explicit-dir API).

Update the `EditableDataGrid` class JSDoc: it currently says click-to-sort is "deliberately suppressed"
and "the body renders in source order" — reword to describe live sorting (header click + the API drive
`sortKeys`; the body reflects it).

## Integration Points

- **Header ⇄ container:** the header only reads `sortKeys` and reports clicks; all state transitions are
  the container's `sortBy`/`addSort` (one home for AR #5). A later frozen-panel split (RD-07) constructs
  several `SortHeader`s bound to the same `sortKeys` — no retrofit (AR #1).
- **Body:** unchanged. It already binds the shared `display`/`focused`/`selected`/`indent`; re-anchoring
  writes those same container signals.
- **Push-down (RD-11):** the `bind`-driven `setSort` effect is the seam a real windowed/server source
  uses; v1 verifies it with a spy source (ST for AC-4).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Click lands on a divider / past the last column | `columnAtX` returns `-1`; no-op, event not marked handled | AR #5 |
| `Ctrl` unset on a synthetic mouse event | `inner.ctrl === true` is `false` → treated as a plain click | AR #16 |
| Unknown `columnId` via `sortBy`/`addSort` | Early-return, no state change (never forwarded to a query) | AR #14 |
| Re-sort drops the anchored/selected row (push-down removed it) | `findIndex` → `-1`; selection clears, cursor stays clamped | AR #3 |
| Push-down source + client sort both run | Prevented: `display` returns unsorted rows when `source.setSort` exists; `sortRowsMulti` runs only on the client path | AR #6/#7 |

> **Traceability:** every strategy above traces to the register (AR #1, #3, #5, #6, #7, #14, #16).

## Testing Requirements

- Header render: single-sort shows one arrow; multi-sort shows digit+arrow per key; unsorted shows
  nothing; title clip preserves the indicator.
- Click machine: plain → single/toggle-sole/reset-from-multi; Ctrl → append/toggle-existing; tri-state
  none.
- Wiring: client `display` orders via `sortRowsMulti`; push-down spy `setSort` fires and `sortRowsMulti`
  does **not** run client-side (AC-4); cursor re-anchors by row-key across a re-sort; unknown id ignored.
- See [07-testing-strategy.md](07-testing-strategy.md) ST-cases.
