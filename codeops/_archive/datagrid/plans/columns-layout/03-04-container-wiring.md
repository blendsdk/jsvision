# 03-04 — Container Wiring (`grid.ts`)

> **Parent**: [Index](00-index.md) · **AR**: AR-13, AR-10, AR-9, AR-4, AR-8

The container owns the column-layout state as signals (mirroring `sortKeys`/`filters`), exposes the
reactive API, assembles the panels, and keeps the overlay panel-aware. If `grid.ts` would exceed the
700-line cap, the panel-assembly + slice-derivation moves to a new **`grid-panels.ts`** helper the
container composes (AR-8).

## New construction options (`EditableDataGridOptions`)

```ts
readonly freezeLeft?: string[];
readonly freezeRight?: string[];
readonly freeze?: number;              // first-N left shorthand
readonly freezeRows?: number;          // pinned data-row band (03-05)
readonly density?: 'normal' | 'compact'; // divider on/off (03-05)
```

`GridColumn` gains `readonly minWidth?: number;` and `readonly maxWidth?: number;` (AR-4), threaded
in `toEngineColumn` (`column.ts:158`): `minWidth: c.minWidth, maxWidth: c.maxWidth`.

## New container signals (AR-13)

```ts
private readonly columnOrderSig = signal<string[]>(opts.columns.map((c) => c.id)); // FULL order (all ids, incl. hidden)
private readonly columnWidths = signal<Map<string, number>>(new Map());            // explicit width overrides
private readonly hidden = signal<Set<string>>(new Set());                          // hidden ids
private readonly freezeSpec: FreezeSpec = { freezeLeft, freezeRight, freeze };      // static (from options)
```

Derived computeds (the layout projection, recomputed only on a structural change):

```ts
private readonly visibleIds = derived(() => visibleOrder(this.columnOrderSig(), this.hidden()));
private readonly partitionSig = derived(() => {
  const part = partition(this.visibleIds(), this.freezeSpec);
  const over = overPinnedIds(part, (id) => this.resolvedWidth(id), this.viewportWidth());
  return applyOverPin(part, over); // moves over-pinned ids to center + devWarn once (AR-9)
});
```

The engine columns / typed columns / autoWidths for a panel are sliced from these ids (03-02).

## Reactive API (AR-13, AC-3, AC-9)

Every mutator guards unknown ids against the column map (like `sortBy`, `grid.ts:399`) — an unknown
id is a **no-op**, never added to state (AC-9).

```ts
columnOrder(): string[]                 // reactive read of the VISIBLE order (= visibleIds())
setColumnOrder(ids: string[]): void     // a permutation of the currently-VISIBLE ids (AR-18)
columnWidth(id: string): number         // resolved width (override → engine default)
setColumnWidth(id: string, w: number): void // clampWidth(w, col.minWidth, col.maxWidth) → override
setColumnVisible(id: string, visible: boolean): void // add/remove from hidden
frozen(): { left: string[]; right: string[] } // reactive read from partitionSig
autoFitColumn(id: string): void         // clampWidth(autoWidth ?? title, min, max ?? 60) → override
autoFitAll(): void
```

`setColumnVisible(id, false)` removes the column from `visibleIds` → the panels omit it → but
`sortBy(id)`/`setFilter(id)` still hit the column map, so sort/filter state stays addressable
(AC-3). A hidden, sorted column keeps sorting the data; it just isn't drawn.

**Order contract (AR-18, PF-003).** `columnOrderSig` is the **full** order (every id, hidden
included); `columnOrder()` returns the **visible** projection (`visibleIds()`). `setColumnOrder(ids)`
takes a permutation of the **currently-visible** ids and splices them back into the full order **in
place** — each hidden column keeps its anchor slot (the position it holds in `columnOrderSig`), and
the visible ids fill the remaining slots in the caller's new order. So a caller only ever reasons
about the columns it can see, and unhiding a column later restores it to its anchor position. A
`setColumnOrder` argument that is not a permutation of the visible ids (unknown id, wrong length,
duplicate) is ignored (AC-9).

## Panel assembly (03-02)

`buildBody()` reads `partitionSig()`:
- **no left & no right** → one `EditableGridRows` over `visibleIds` + one `SortHeader` (today's path,
  AR-5). `bodyRow = [body | vbar]`, `topRow = [header | corner]` — unchanged.
- **frozen** → three panels + three headers + freeze dividers, assembled per 03-02. The center panel
  binds `this.indent`; frozen panels bind constant `signal(0)`.

The body is rebuilt (dispose old panels, add new) inside an effect on `partitionSig` — a structural
layout change only (reorder that crosses nothing, show/hide, freeze/over-pin change), never per draw.
Resize (a width override) does **not** rebuild — it flows through the shared `columnWidths` signal and
the panels re-apportion on the next draw.

## Overlay panel-awareness (H4, AR-10)

Today `mountCellOverlay` places the editor at `origin = absoluteRect(body)` + the body-local
`cellRect` (`grid.ts` editing path via `editable-grid-rows.ts:201-210`). With panels, the panel that
owns `focusedCol` computes the rect in **its** geometry and the mount uses **that panel's**
`absoluteRect`. Since each panel already runs its own `EditController` (the controller is created per
`EditableGridRows`, `editable-grid-rows.ts:118`), an edit begun in a frozen cell naturally mounts
through that panel's controller → its overlay origin. The container's single `overlay` group stays
the mount host (a `fill` layer over the whole grid); only the **origin** differs per panel, which the
per-panel `absoluteRect` already yields. **No new coordination** beyond routing begin-edit to the
focused panel (which the shared-cursor design already does — only the owning panel handles the key).

- *Filter popup* (PF-002 — real gap, fixed here). Today `openFilterPopup` anchors on a **single
  retained** header (`grid.ts:210,542` `absoluteRect(this.header)`) and `onFunnelClick(columnId,
  anchor, ev)` carries **no** header (`sort-header.ts:51`). With three panel headers the container
  cannot tell which header's `absoluteRect` to use. **Fix:** extend `onFunnelClick` to pass the
  **clicked `SortHeader`** (or its absolute origin), so `openFilterPopup` anchors on that panel's
  header. Small signature extension; the funnel routing is otherwise unchanged. *(This is a genuine
  change, unlike the editor overlay — H4/AR-10 — which needs nothing because each panel already owns
  its `EditController` + per-body `absoluteRect`.)*

## Barrel

Export `minWidth`/`maxWidth` are on `GridColumn` (no new export). Export from `column-model.ts`
(03-01) the public types/ops. Extend `EditableDataGridOptions` docs with the freeze/freezeRows/
density options + `@example`.

## Testing hooks

Spec (03-07): the full API surface (`setColumnOrder`/`columnWidth`/`setColumnVisible`/`frozen`/
`autoFit*`) with unknown-id no-ops (AC-3, AC-9); a hidden sorted column still sorts (AC-3); over-pin
clamps + devWarn (AC-6). Security spec: unknown ids never enter state; text stays sanitized after a
layout change (AC-9).
