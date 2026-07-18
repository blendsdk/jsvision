# 03-02 — Windowed Rendering & Prefetch

**Owns:** the muted `…` placeholder at every window-index site (main body + synthetic band), driving
`source.ensureRange` from the visible window plus a prefetch buffer, per-frame coalescing, the
window-bounds clamp, and the read-only unloaded-focused-cell guard. Pins: ST-5…ST-10.
([AR-6](00-ambiguity-register.md), [AR-11](00-ambiguity-register.md), [AR-12](00-ambiguity-register.md), [AR-14](00-ambiguity-register.md), [AR-16](00-ambiguity-register.md))

## Placeholder rendering — the `…` per cell

The body's own draw loop already reads `const row = display[item]` per visible row
(`editable-grid-rows.ts:796`). Add an `undefined`-guard: an unloaded row paints each cell as a muted
`…` instead of `col.accessor(row)`.

- **Glyph & role:** a single `…` (U+2026, one cell wide), left-aligned, painted **fg-only** in the
  muted `inputPlaceholder` foreground — `ctx.color('inputPlaceholder').fg` composed **over the row-band
  bg** (focused / selected / zebra / normal), never the role's own bg. `inputPlaceholder`'s default bg
  is a *sunken field* bg (`backgroundSunken`); using it would paint a field-coloured cell that clashes
  with the row band, so take only the `.fg`, exactly as `input-render.ts:101` does
  ([preflight PF-007](00-preflight-report.md)). Reusing this existing role introduces **no** new core
  theme role (unlike RD-12) and needs no allowlist edit (first datagrid use of the role). The `…` is a
  **static constant** — never interpolated from row data ([AR-14](00-ambiguity-register.md)).
- **Precedence:** the row-colour priority (focused > selected > zebra > normal) still paints the row
  band; the `…` replaces only the cell *text*. The cursor / dirty / invalid overpaints
  (`paintCursorCell`/`paintDirtyMarkers`/`paintInvalidCells`) are **skipped** for an unloaded row —
  there is no committed value, dirty marker, or validation state on a placeholder.
- A `render`-column's custom painter is **not** invoked on an unloaded row (its `value`/`row` would be
  `undefined`); the cell shows the `…` placeholder instead.

The guard is a small helper so the main body and the synthetic band share it:

```ts
// editable-grid-rows.ts (and mirrored in synthetic-columns.ts)
const row = display[item];
if (row === undefined) { this.paintPlaceholderRow(ctx, i, geom, indent); continue; }
```

**Synthetic prefix band** ([AR-16](00-ambiguity-register.md)): `SyntheticBodyBand.draw`
(`synthetic-columns.ts:222-264`) is a second view indexing `display[item]`. An unloaded row there
renders a **blank checkbox** (no `[ ]`/`[x]` — the row's selection is unknown) and a **blank gutter
number** (the 1-based number is display-position derived, so it *could* still show; but to read as
'loading' and avoid a half-rendered row, the gutter also shows `…`/blank for an unloaded row). Mirror
the exact `undefined`-guard.

## Driving `ensureRange` from the window

The body computes its visible window in `draw`/`updateTop` — `top = this.topItem`, height =
`ctx.size.height` / `viewportRows()`. Add a windowed hook that, after the window is known, requests
the covering range plus a prefetch buffer:

```ts
// editable-grid-rows.ts — called from draw once `top` + visibleRows are resolved (windowed only)
private requestWindow(top: number, visibleRows: number): void {
  if (this.ensureRange === undefined) return;          // eager path — no-op
  const n = this.rowCount();                            // source.length()
  const buffer = this.prefetch;                         // rows each side (default = visibleRows; AR-11)
  const start = clamp(top - buffer, 0, n);
  const end = clamp(top + visibleRows + buffer, 0, n);  // half-open [start, end)
  this.coalesceEnsureRange(start, end);
}
```

- `ensureRange`/`rowCount`/`prefetch` are injected into `EditableGridRowsConfig` from the container
  (the body does not import the source directly — it stays behind the same injected-seam pattern as
  `display`/`rowKey`).
- **`prefetch` default is dynamic** ([preflight PF-008](00-preflight-report.md)): the `prefetch?: number`
  option carries **no static default** because the viewport height is not known at config time. When it
  is **unset**, `requestWindow` uses `buffer = visibleRows` (the current per-draw viewport row count);
  a caller-supplied `prefetch` overrides with that fixed row count. The body treats `undefined` as the
  "one viewport" sentinel.
- **Bounds clamp** ([AR-14](00-ambiguity-register.md)): `start`/`end` are clamped to `[0, length()]`
  and are integers, so the source never receives an out-of-range or fractional range even under a
  hostile scrollbar. Pinned by ST-8.

## Per-frame coalescing

Rapid scroll must collapse to ≤1 `ensureRange` per frame for the *settled* window
([AR-11](00-ambiguity-register.md), RD AC-5):

```ts
private lastRequested: { start: number; end: number } | null = null;
private pending = false;

private coalesceEnsureRange(start: number, end: number): void {
  if (this.lastRequested?.start === start && this.lastRequested.end === end) return; // identical → skip
  this.lastRequested = { start, end };
  if (this.pending) return;                 // one request scheduled this frame already
  this.pending = true;
  queueMicrotask(() => {                     // coalesce all scroll deltas within the frame
    this.pending = false;
    const r = this.lastRequested!;
    this.ensureRange!(r.start, r.end);       // fires once for the settled window
  });
}
```

- **Settled-window de-dup:** a window identical to the last requested issues **no** call (`draw` runs
  many times per settle; only a changed target re-requests). Pinned by ST-7.
- **Frame coalescing:** all intra-frame scroll deltas collapse to the final window via the microtask
  (the framework's repaint/frame cadence; `queueMicrotask` is the deterministic, test-pumpable choice
  used elsewhere in the reactive core). The design is agnostic to the exact scheduler — the invariant
  is *≤1 call per settle per frame* — and the implementer confirms the scheduler against the event
  loop at Step 2 (a `(runtime)` note if it must change).
- **Repaint is independent:** the coalescer does **not** repaint. When the source's `ensureRange`
  resolves and the source bumps `revision`, the `display` bind (03-01) repaints. A stale resolve
  arriving after the user scrolled is harmless — `draw` always re-reads the live `topItem`.

## Read-only unloaded focused cell

The cursor can land on a valid-but-unloaded index (PgDn/`gridEnd`/scroll). Every path that would read
the focused row's identity or begin an edit must no-op on a placeholder
([AR-12](00-ambiguity-register.md)):

- `editableCol()` (`editable-grid-rows.ts:609`) returns `-1` when the focused row is `undefined`, so
  `beginEdit`/`valueHelp`/`tryPrintableEdit` all no-op → the cell is read-only until it loads.
- `currentCell()` (`:636`) returns `null` when the focused row is `undefined` (no `rowKey(undefined)`).
- The container's `focusedRow()`/`focusAnchorKey()` (`grid.ts:1291,1217`) return `null`/`undefined`
  for an unloaded focused row (no `rowKey(undefined)` crash); the row-leave gate treats a `null`
  focused row as "nothing to validate".

Pinned by ST-9.

## Repaint on resolve (end-to-end)

1. Scroll changes `topItem` → `draw` computes the new window → `requestWindow` → coalesced
   `ensureRange(start,end)`.
2. Unloaded rows in the window paint `…`.
3. The source fetches, stores the page, and bumps its `revision` signal.
4. `display`'s `revision()` read (03-01) re-derives → fresh identity → the base display-bind repaints.
5. `draw` re-reads `rowAt` → the rows are now loaded → real values paint. Pinned by ST-6.

## ST coverage (see 07)

- **ST-5** — the window `[top, top+visible)` triggers `ensureRange(start,end)` covering visible +
  one-viewport buffer, clamped to `[0,length())`.
- **ST-6** — an unloaded row paints the muted `…`; on resolve + `revision` bump it repaints to real
  values.
- **ST-7** — rapid intra-frame scroll coalesces to ≤1 `ensureRange`; an unchanged settled window
  issues none.
- **ST-8** — bounds clamped to `[0,length())`, integer ranges (security).
- **ST-9** — an unloaded focused cell is read-only (no edit, no `rowKey(undefined)`).
- **ST-10** — the synthetic prefix band renders a placeholder for an unloaded row (no crash).
