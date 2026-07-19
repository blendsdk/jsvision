# Split-View Migration: S1 proof

> **Document**: 03-05-split-view-migration.md
> **Parent**: [Index](00-index.md)
> File: `packages/ui/src/split/split-view.ts`

## Overview

Migrate `split-view.ts`'s pane/splitter sizing to the new `grow(v, w, { min })` / `fixed(v, 1)`
builders as the real-world proof that S1 (R1) works end-to-end (R9, AR-9). The observable split
behavior is **preserved** — the `split.spec.test.ts` oracle must stay green unchanged.

> **One deliberate semantic delta (additive-merge, not replace).** The current sites *replace* the
> pane layout (`pane.layout = { size: … }`); `grow()` *merges* (`pane.layout = { ...pane.layout,
> size }`). For the panes SplitView builds against (bare tracks with no pre-set layout) the result is
> identical. The only difference: a pane handed in with pre-existing non-size `.layout` props now has
> them **preserved** rather than dropped. This is the more-correct behavior (the split should own only
> pane *sizing*, not clobber the pane's own config), but callers **must not** pre-set `position` on a
> pane — a retained `position:'absolute'/'fill'` would pull the pane out of the track's flex flow.
> ST-16 pins the preservation so the merge is exercised, not assumed.

## Architecture

### Current
The constructor builds the track imperatively (interleaved panes + splitters), sizing each by hand:

```ts
// ctor loop
pane.layout = { size: { kind: 'fr', weight: Math.max(0, initial[i]), min: this.mins[i] } };  // :153
this.track.add(pane);
// ...
splitter.layout = { size: { kind: 'fixed', cells: 1 } };                                      // :157
this.track.add(splitter);
// reactive re-weight
pane.layout = { size: { kind: 'fr', weight: Math.max(0, fixed[i]), min: this.mins[i] } };     // :185
```

### Proposed
```ts
this.track.add(grow(pane, Math.max(0, initial[i]), { min: this.mins[i] }));   // :153
// ...
this.track.add(fixed(splitter, 1));                                            // :157
// reactive re-weight
grow(pane, Math.max(0, fixed[i]), { min: this.mins[i] });                      // :185
```

## Implementation Details

### Scope of the migration (precise)
- **Port:** the three pane/splitter sizing sites (`:153`, `:157`, `:185`) → `grow`/`fixed` with `min`.
- **Do NOT port:** `this.track.layout = { position:'fill', direction: this.direction, gap: 0 }`
  (`:147`) — the track configures **itself** with a **runtime-chosen** direction (the deferred S6
  case, AR-1). It stays a direct `this.track.layout = …` assignment.
- `grow()` merge-preserves and returns the same instance, so the reactive `:185` re-weight keeps its
  effect (it rewrites `pane.layout.size`) — now merging over, rather than replacing, the pane's other
  layout props (see the additive-merge note above).

## Integration Points
- Depends on R1 (`grow` with `min`) landing first (Phase 2). Imports `grow`/`fixed` from
  `../view/index.js`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A pane's `min` no longer reaches the solver | `split.spec.test.ts` (drag-against-min, container-shrink-honors-min) is the immutable oracle; if it fails, the migration is wrong — fix the code | AR-9 |
| Reactive re-weight loses reactivity | `grow()` is a plain `.layout` set (same as before) inside the existing computation — no scope change | AR-9 |

> **Traceability:** references AR-9. See `00-ambiguity-register.md`.

## Testing Requirements
- The `split.spec.test.ts` + `split.impl.test.ts` + `split.packaging.spec.test.ts` +
  `split-grabmark.*` suites must pass **unchanged** (behavior-preserving refactor).
- Add two impl assertions: after construction, each pane's resolved `layout.size` is `{ kind:'fr',
  weight, min }` with the expected `min` (proves `grow`'s `min` reached the pane); and a pane handed
  in with a pre-set non-size `.layout` prop keeps it after construction (proves `grow`'s additive
  merge, not a replace). See ST-16 in `07`.
