# Scene and Geometry: Kanban Phase B Core Board

> **Document**: 03-04-scene-geometry.md
> **Parent**: [Index](00-index.md)

## Overview

This specification owns the normalized scene, sparse variable-height model, variant geometry, clipped
targets, drawing, scrolling, and damage behavior. It preserves the one-viewport topology and separates
semantic structure from presentation strategy (PAR-B05/PAR-B07/PAR-B10).

## Canonical semantic scene

`buildKanbanScene` consumes one validated source snapshot, resolved structure/presentation policies,
interaction snapshot, and bounded resident descriptors. It returns immutable source-ordered columns,
visible swimlanes, semantic cells, header/count/summary/state nodes, cards, and detached hidden/collapsed
evidence. Every card node carries its type-preserving key, cell address, cursor index/revision, descriptor,
and interaction/workflow flags.

The scene contains no terminal rectangles and is identical across hybrid/separator/band/rail/custom
variants. It never creates absent cursor cells merely because the Cartesian coordinate exists. Visible
and overscan retention is derived from a bounded preliminary axis projection, then refined after
measurements without opening unrelated cells (PAR-B07/PAR-B27).

For grouped windowed sessions, the preliminary projection consumes optional bounded row-layout hints
bound to the active session revision and query generation. A hint supplies only aggregate row extents/
quality for the requested axis window. With no compatible hint, projection advances through known rows
only and exposes unknown extent/distant-reveal unavailability; it never opens preceding Cartesian cells
to manufacture an exact offset.

## Sparse height and anchor index

`KanbanSparseHeightIndex` is owned per retained semantic cell (PAR-B26). It stores:

- bounded exact `{cardKey, logicalIndex, height}` anchors for resident descriptors and explicit reveal
  ownership;
- compact run summaries containing start/end index, measured cumulative height, and estimate revision;
- the resolved presentation estimate for unknown/unloaded spans;
- source/cursor/presentation revisions that invalidate incompatible runs.

It exposes bounded conversions between logical index and estimated content row, exact corrections for
resident cards, total extent quality, and nearest stable anchor. It never allocates an array sized by
logical length. All arithmetic saturates at safe cell limits.

When a measured height differs from its estimate, correction keeps the prior stable card/key and its
relative viewport row. If no stable card remains, correction uses the nearest retained run boundary and
reports estimated quality. Source deletion, reorder, query replacement, density/policy revision, and
cursor disposal prune incompatible measurements in cancellation-first order. Page unload alone may
discard measurements but does not delete interaction identity.

## Two-pass bounded projection

One draw/refresh cycle performs at most:

1. axis solve using visible columns, swimlane chrome budgets, current scroll offsets, and sparse extent
   estimates;
2. bounded cursor retention/`ensureRange` for intersecting visible+overscan cells;
3. descriptor projection for resident requested cards;
4. measurement correction and one reproject when the correction changes visible geometry;
5. clipped draw/hit/damage output.

A correction cannot loop indefinitely: one pass records the new exact heights and the second pass uses
them. Any remaining uncertainty is carried as extent quality into the next invalidation. Visible work is
bounded by central cursor/card/`retainedDescriptors`/region limits, never logical card count. Demand
above descriptor capacity clips deterministically in semantic source order and adds a non-actionable
partial/limit state; clipped or formerly retained cards expose no stale descriptor or target
(PAR-B13/PAR-B26).

## Variant geometry strategies

Each strategy consumes the same canonical scene and returns `KanbanSceneGeometry` with column headers,
swimlane chrome, cell/card rectangles, sticky rows/rails, state surfaces, and scroll extents:

- hybrid/separator/band share one horizontal swimlane header row but differ in fill/separator roles;
- rail reserves validated left width, pins the current row label, and automatically delegates to hybrid
  when remaining columns violate their effective minimum;
- custom consumes the validated chrome descriptor and may not change semantic cell/card placement.

Workflow headers stay vertically sticky. The active swimlane header/rail stays sticky within its
semantic row without covering cards. Horizontal scrolling moves workflow columns together; vertical
scrolling moves swimlane/card content under sticky workflow headers. Focused-column mode keeps exactly
one column but preserves the same swimlane axis and preferred-row semantics.

Collapsed swimlanes/columns retain header geometry but allocate no card region. Hidden structures have
no geometry. Separators and card gaps are non-actionable resting regions; insertion gutters remain
absent until RD-07 (PAR-B18/PAR-B27).

## Hit projection

Phase B expands `KanbanActionTarget` with bounded discriminators for workflow header, swimlane header,
card, descriptor card action, scoped application state/header action, and scoped source retry. Each
target includes a closed semantic scope, stable IDs/address, and clipped viewport-local geometry but no
application card value. Z-order is descriptor action → card → header → state action → retry; card gaps/
separators never target the adjacent card. Retry invokes only the owning cursor seam; application state/
header targets emit scoped intents and wait for authoritative republication.

Targets are recomputed from the final clipped geometry and capped. A clipped region that loses positive
area is non-actionable. Inspection geometry remains detached from the active hit map. There are no
insertion, drop, ghost, or drag-hover targets in Phase B (PAR-B18).

## Drawing and damage

Drawing consumes only `KanbanSceneProjection`. It paints semantic board/column/swimlane/cell/card/state
roles, safe headers/count qualifiers, descriptors, focus/selection cues, and sticky chrome. ASCII and
no-color fallbacks come from resolved theme tokens. No drawing helper invokes application callbacks.

Damage fingerprints include semantic scene/geometry revision, descriptor identity, style roles, cues,
sticky chrome, and state codes. Card-local changes damage the card/overlapping sticky region only;
structure/presentation changes damage affected rows/columns; exceeding the finite region cap falls back
to whole viewport (PAR-B15/PAR-B16).

## Scroll, reveal, and resize

Offsets clamp against exact/lower-bound/unknown sparse extents. Wheel and imperative scroll remain
independent in both axes. `revealCard` uses source location, bounded acquisition, the sparse height
index, and final geometry; it reports honest found/unloaded/unavailable/cancelled results. Resize,
column reorder, swimlane presentation change, locale change, and policy change preserve stable card or
header anchors and relative row where eligible.

The minimum remains derived from 18-cell card columns plus active DSL chrome. Rail never makes the
minimum larger because it degrades to hybrid. Translated header/chrome text ellipsizes within measured
cells instead of forcing raw coordinates (PAR-B19/PAR-B22).

## Testing requirements

- Pure scene equality across variants; bounded cursor/cell creation; source/order/revision semantics.
- Sparse height round trips, estimate correction, deletion/reorder, saturation, 100,000 logical cards,
  and no logical-length allocation.
- Sticky headers/swimlanes, rail degradation, focused-column mode, collapsed/hidden geometry, long
  translations, Unicode wide cells, resize/maximize/restore, scroll/reveal anchors, and unknown extents.
- Hit z-order/clipping/caps and explicit absence of insertion/drop/drag targets.
- Targeted damage and whole-viewport fallback at the finite ceiling.
