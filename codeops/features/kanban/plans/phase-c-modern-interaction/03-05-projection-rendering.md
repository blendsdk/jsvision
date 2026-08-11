# Projection and Rendering: Kanban Phase C Modern Interaction

> **Document**: 03-05-projection-rendering.md
> **Parent**: [Index](00-index.md)

## Overview

Rendering consumes the authoritative scene plus at most one active drag overlay and the bounded set of
unrelated pending operation overlays. Overlay composition is immutable and pure: it removes moving
descriptors from their visual source, retains placeholders, inserts semantic gaps or pending blocks, and
projects final clipped rectangles without changing source data (AR-C04/C05/C12/C16).

## Overlay model

```ts
export interface KanbanDragOverlay {
  readonly generation: number;
  readonly movedCardKeys: readonly CardKey[];
  readonly source: readonly KanbanSourcePlaceholder[];
  readonly ghost: KanbanGhostDescriptor;
  readonly target?: KanbanDropTarget;
}

export interface KanbanPendingOverlay {
  readonly operationId: KanbanOperationId;
  readonly requestKind: KanbanRequest['kind'];
  readonly state: 'pending' | 'accepted';
  readonly projection: KanbanPendingProjection;
}
```

The semantic coordinator owns pending overlay content; the viewport owns the rectangle projection. A
current authoritative card descriptor may supply bounded ghost/pending content. If unavailable, render a
safe identity/count marker without retaining or fabricating a record (AR-C04/C20).

## Card drag composition

1. Remove each moved descriptor from normal target-stack calculations.
2. Retain one source placeholder per original position so the source does not collapse unexpectedly.
3. Insert at most one target gap sized by density: existing gutter in comfortable/spacious; one expanded
   row only at the active compact slot.
4. Reflow only affected visible cells/stacks and recompute current target geometry.
5. Draw one ghost last, clipped to viewport and offset from the pointer so the insertion target remains
   readable.

The ghost is one recognizable framed card fragment with title/status cues and a bounded selected count.
It cannot exceed the viewport or descriptor row/column limits. No stale trail may remain after pointer
movement, scroll, target change, cancellation, or release (AR-C05/C07/C14/C20).

## Pending composition

After release, the drag ghost/gap disappears only after the coordinator publishes a pending overlay in
the same tick. The ordered moved block appears at its semantic target with `operation.pending` and a
non-color marker; source placeholders remain only when needed to prevent layout ambiguity. Conflicting
actions on affected subjects are disabled, while unrelated cells/cards remain interactive
(AR-C04/C12/C13).

Matching publication removes the overlay without a false completion animation. Rejection/cancellation
restores authoritative layout with bounded feedback. Contradictory publication immediately paints the
authoritative scene and marks the operation superseded (AR-C12).

## Structural composition

Column/swimlane drag projects one bounded header ghost, one source placeholder, and one sibling insertion
marker. Reflow changes visible column widths/order or swimlane row order only in the overlay; source
metadata remains unchanged. Responsive focused-column mode keeps the ghost/marker within the visible
axis and autoscrolls/reveals siblings rather than overflowing the board (AR-C05/C14).

## Damage tracking

For each frame calculate the clipped union of:

- old and new ghost rectangles;
- old and new source placeholders;
- old and new active gap/structural marker;
- old and new affected-stack bounds;
- old and new pending projection bounds;
- scroll-exposed/sticky regions already owned by the viewport.

Unchanged target plus pointer-only ghost movement damages only the old/new ghost union unless the ghost
overlap exposes/repaints underlying cells. Region count remains bounded; overflow degrades to one whole-
viewport damage request. A settled cancellation/rejection frame must equal an authoritative no-drag frame
cell-for-cell (AR-C05/C16).

## Theme and non-color cues

Existing reserved roles become active: `card.grabbed`, `card.source-placeholder`, `card.ghost`,
`drop-target.valid`, `drop-target.warning`, `drop-target.invalid`, `operation.pending`, and
`operation.rejected`. Unavailable/loading uses the nearest state role plus explicit localized text/marker;
no new role is added unless contrast/fallback analysis proves it necessary (AR-C19).

| State | Required non-color evidence |
|---|---|
| Grabbed/source | Heavy/dashed placeholder border or stable source glyph |
| Ghost | Distinct border/attribute and offset; never color-only |
| Allowed target | Insertion glyph/line plus gap geometry |
| Warning target | Warning prefix/glyph plus localized reason |
| Blocked/invalid | Invalid glyph/border plus reason |
| Unavailable/loading | Progress/unavailable text marker; pointer-up no-ops |
| Pending/accepted | Pending glyph/prefix on projected block |
| Rejected/superseded | Rejection/conflict feedback outside card body |

ASCII mode uses `+|-=`/safe text equivalents; Unicode uses existing box-drawing capability. All text is
sanitized and cell-cropped without partial wide glyphs. Ghost/background/span surfaces stay coherent with
the selected semantic surface role (AR-C19/C20).

## I18n

Add a Phase C overlay catalog rather than changing exact Phase A/B inventories. Phase 5 owns the canonical
English contract and consumption for grab count, move pending, allowed/warning/blocked/unavailable reasons,
release/cancel/reject/conflict, sorted/filtered placement, stale placement, WIP/transition/DoD outcomes, and
structural reorder. Every parameter has a placeholder manifest entry. Phase 7 adds the nine translated
overlays, translation factory/aggregator, generated exports, and digest-bound review evidence so the
existing ten-locale inventory moves together. The repository locale generator/configuration is generalized
from one optional overlay prefix to an ordered `overlaySymbolPrefixes` array and the Kanban entry lists
Phase B then Phase C. The locale updater, review checker, generated API index, and their i18n/docs tests all
consume that array, preserving deterministic additive wrapper exports (AR-C19/C20).

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Overlay references absent/unloaded descriptor | Render bounded identity/count fallback; never fabricate record content | AR-C05/C20 |
| Overlay geometry exceeds finite region budget | Whole-viewport damage and bounded fallback marker | AR-C16/C20 |
| Ghost text contains ANSI/control/wide boundary | Sanitize, cell-crop, and emit no control/partial glyph | AR-C20 |
| Theme role/contrast unavailable | Existing fallback chain plus required non-color cue | AR-C19 |
| Overlay composition throws | Cancel/supersede affected operation, restore authoritative projection, observe safe code | AR-C12/C20 |

## Testing Requirements

- Cell-level Unicode/color and ASCII/monochrome frames for every drag/target/pending/rejected state.
- Old/new damage union and no-stale-trail tests, including ghost-only motion and whole-viewport fallback.
- Responsive direct-surface/window resize, maximize, restore, focused-column, tiny viewport, and scroll
  cases.
- ANSI/control, wide/combining text, long translated reasons, and multi-card count bounds.
