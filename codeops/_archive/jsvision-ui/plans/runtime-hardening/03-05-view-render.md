# View / Render-Root Hardening: Runtime Hardening (RD-13)

> **Document**: 03-05-view-render.md
> **Parent**: [Index](00-index.md)
> **Covers**: HR-12 (Major), HR-30, HR-31, HR-32, HR-33, HR-34
> **Files**: `packages/ui/src/view/{render-root.ts,view.ts,draw-context.ts}`, `layout/measure.ts`

## Implementation Details

### HR-12 — `flush()` snapshots-and-clears first (Major) *(Decision per PA-12)*

**Defect** (`render-root.ts:255-259`, `:278`): `reflow()` runs, **then** `needsReflow = false`;
compose runs, **then** `dirty.clear()`. `reflow()` fires pending `onMount` callbacks (`reflow.ts:35`,
the documented `bind()` site) — an `onMount(() => group.add(child))` sets `needsReflow` mid-flush
and the trailing assignment clobbers it → the child composes at `{0,0,0,0}` and stays invisible
until an unrelated relayout.

**Fix spec (PA-12).** `flush()` **snapshots and clears** `needsReflow` and the dirty set *before*
doing the work; invalidations raised during reflow/compose land in the (now-empty) live sets and
schedule the **next** tick (no same-tick re-loop — the coalescing scheduler already handles the
follow-up frame). Oracles: the deferred-mount grandchild paints with non-degenerate bounds after
the flushes settle; a `draw()` that invalidates a sibling causes that sibling to recompose on the
next scheduled flush.

### HR-31 — `invalidate()` honors visibility flips *(Decision per PA-8)*

**Defect** (`render-root.ts:119-123`, `:272`): compose skips `!visible` views, so a hidden view has
no compose-cache entry — hidden→shown via `invalidate()` finds nothing to recompose; shown→hidden
leaves stale pixels.

**Fix spec (PA-8).** `invalidate()` alone must work in both directions:

- **shown→hidden**: the view's *last composed rect* (still in the cache) becomes the damage region —
  the partial path recomposes the parent subtree/background over it, then evicts the cache entry.
- **hidden→shown**: with no cache entry for the view, the partial path falls back to recomposing the
  **nearest cached ancestor** (its rect bounds the newcomer), composing the view fresh.

Mechanism note: this keeps `visible:false` = `display:none` (AR-41) — the *layout* effect of a flip
still requires reflow, and the existing reflow path already handles it; PA-8 covers the pure
repaint semantics so a flip is never silently dropped. If during implementation a flip is found to
*require* relayout to satisfy the oracle (flow-layout siblings shift), `invalidate()` on a
visibility flip internally escalates to `invalidateLayout()` — the user-facing contract (flip +
`invalidate()` = correct screen) is the oracle either way.

### HR-32 — `View.onCleanup` binds to the view scope

**Defect** (`view.ts:188-193` + `owner.ts:109-121`): called inside a running effect (a `bind`
body), `onCleanup` attaches to that **effect's** scope and fires on every re-run, contradicting its
"once on unmount" JSDoc.

**Fix spec.** `View.onCleanup` registers under the **view's owner scope** explicitly (via
`runWithOwner(viewScope, …)`), mirroring the `untrack` guard `View.mount` already uses. Fires
exactly once, at unmount.

### HR-33 — `naturalSize` excludes absolute children

**Defect** (`layout/measure.ts:49-53` counts all children; `layout.ts:73-75` excludes
`position:'absolute'` from flow): an `auto` container with a large absolute child reports the wrong
intrinsic size.

**Fix spec.** `naturalSize` filters children with `position:'absolute'` before aggregating —
exactly the flow-layout predicate. Pure data-path fix.

### HR-34 — Shadow-aware partial recompose *(Decision per PA-16)*

**Defect** (`render-root.ts:297-311,84-106`): the occlusion test uses the view's rect only;
repainting a view under a neighbor's drop-shadow wipes the shadow overhang.

**Fix spec (PA-16).** For shadow-casting views (window chrome), the occlusion/dirty rect used by
the partial-recompose walker is **expanded by the shadow margin** — `shadowSize {2,1}`: +2 columns
right, +1 row bottom (the TV shadow geometry already shipped in the fidelity pass). No separate
shadow re-cast pass. Oracle: two side-by-side windows, front casting onto back; invalidate the
back; the shadow survives.

### HR-30 — Draw-context width-aware centering + combining marks

**Defect** (`view/draw-context.ts:104,69`): `box()` centers titles by code-point count; `text()`
drops zero-width glyphs.

**Fix spec.** Same contract as core HR-25/HR-17, applied to the ui draw-context: display-width
centering + clip; combining marks composed onto the preceding cell (delegating to the underlying
`ScreenBuffer` behavior once HR-17 lands — the draw-context must stop *pre-filtering* them out).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Invalidation raised mid-flush | lands in the next tick's sets (never lost) | **PA-12** |
| `invalidate()` on a visibility flip | correct screen both directions (escalates internally if needed) | **PA-8** |
| `onCleanup` inside a reactive body | binds to the view scope, fires once | RD HR-32 (pinned) |
| Partial recompose near a shadow | rects grown by `{2,1}` margin | **PA-16** |

## Testing Requirements

- Spec oracles ST-3.c, ST-6.d–h ([07-testing-strategy.md](07-testing-strategy.md)).
- Impl tests: nested `onMount` adds (grandchild adds great-grandchild); flip-during-flush; shadow
  margin at buffer edges (clip); `naturalSize` with mixed flow+absolute at every depth.
