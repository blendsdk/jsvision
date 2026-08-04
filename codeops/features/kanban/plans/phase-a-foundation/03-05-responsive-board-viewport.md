# Technical specification: responsive board and viewport

> **Document**: 03-05-responsive-board-viewport.md
> **Parent**: [Index](00-index.md)
> **Decision sources**: PAR-02–PAR-04, PAR-12–PAR-14, PAR-21–PAR-23
> **CodeOps Artifact Schema**: 1

## Component tree

`KanbanBoard<TCard>` extends `Group` and owns one public readonly `viewport`. Its outer content uses
the public layout DSL for every ordinary band and conditional surface:

```text
KanbanBoard (Group, col/grow)
├─ optional responsive status/help/filter/action bands (not active in Phase A)
├─ optional focused-column navigator row
└─ KanbanViewport (single exact-cell leaf, grow)
```

The board responds to its assigned rectangle; it does not position itself, create a window, or draw a
shadow/frame. Embedding it directly on a surface or inside a window with the same content rectangle
must yield identical content, metrics, scrolling, and hit behavior.

Only `KanbanViewport` is a sanctioned absolute-geometry module. Repository guard tests reject raw
absolute placement in ordinary Kanban or future dialog content. The viewport honestly implements
measurement, clips every draw/damage/hit region to its assigned bounds, and contains no host resource
authority.

## Width solver

Each visible column contributes validated minimum/preferred/maximum widths for its surface, excluding
the one-cell separator. Defaults are 18/24/32. Effective minimum is the maximum of configured minimum,
mandatory non-color chrome, and bounded renderer hint, clamped to maximum.

The pure solver:

1. validates widths/counts and computes minimum sum plus separators with overflow-safe arithmetic;
2. if fewer than two effective minima plus a separator fit, returns focused-column mode;
3. otherwise starts every column at its effective minimum;
4. distributes cells through minimum→preferred by choosing the lowest normalized tier fulfillment,
   with exact integer comparison and source-order ties;
5. repeats through preferred→maximum; and
6. leaves further width unused/host-owned after every maximum is met.

The allocation is deterministic and monotone: increasing available width by one cannot reduce any
column. If the minimum sum exceeds the viewport, preserve minima and expose horizontal overflow rather
than shrinking columns. Three default preferred columns plus two separators use 74 cells at 80-cell
availability; remaining cells distribute without exceeding 32.

## Focused-column mode

When two minima cannot fit, render exactly one column and one DSL-composed compact navigator row with
previous affordance, ellipsized sanitized name, position/count, and next affordance. Unavailable ends
remain visibly disabled; there is no permanent side rail and no clipped second interactive column.

Phase A does not implement keyboard focus navigation. Optional identity input seeds focused and
selected keys; the board maintains a reconciled projection without mutating application state. The
initial visible column is the focused card's known column or the first valid source column, and
imperative reveal/scroll may change the active containing column. The anchor model preserves the
focused key across resize to narrow and back, while authoritative deletion events prune it/selected
keys and mere page unload does not.

## Vertical projection

For each retained column/cell, compute only the visible card rectangles plus finite vertical overscan:

- sticky workflow header consumes rows before card projection and is never a card hit target;
- descriptor height is bounded and determines card extent;
- comfortable/spacious density inserts exactly one full-width blank row between cards;
- compact density inserts no resting blank row;
- unloaded slots/state surfaces receive bounded placeholder geometry; and
- zero columns use one localized board-level state with zero card/header hit regions.

Phase A keeps non-actionable board/header/card rectangles in a separate inspection-geometry snapshot for
tests and diagnostics. Its pointer hit map contains no actionable card, insertion, drop, or card-action
target. Future insertion gutters and active swimlane chrome remain outside the pointer map.

## Descriptor reads and cache projection

The viewport obtains one cursor per retained address from the generation coordinator, requests a
half-open visible+overscan range, and calls `cardAt` only within that range. It projects descriptors via
the bounded cache from 03-04. No path enumerates total logical length merely to determine vertical
scroll extent; exact, estimated, or unknown length produces an honest metric/state.

The mounted `View` topology is board shell + bounded bands + one viewport regardless of card count.
Testing may expose safe topology/geometry snapshots, but not internal map or reactive-scope instances.

## Scrolling, imperative viewport methods, and metrics

Expose immutable viewport metrics including assigned rectangle, mode, horizontal/vertical offsets,
known extents/quality, visible column IDs, visible card range by cell, sticky rows, overscan, and current
generation/revisions. Imperative viewport methods:

- `scrollBy({ x?, y? })` and `scrollTo({ x?, y? })` use finite integer cells and clamp to live extents;
- wheel input maps independently to horizontal/vertical cell deltas and never changes focus/selection;
- `revealCard(key, alignment?)` uses the optional abort-aware session locator, validates its originating
  revision, and performs the smallest bounded scroll; unsupported/unknown/unloaded results never trigger
  a full scan; and
- geometry/source changes re-clamp offsets so they never become negative or beyond-end.

Vertical anchoring records a stable card key plus preferred relative row when available; otherwise it
uses the nearest retained visual anchor. Horizontal anchoring records the containing column ID and
offset. Resize, source reorder, locale, density, theme, and renderer-hint changes invalidate the nearest
DSL container once and recompute the viewport inside the parent clip. Replacing the reactive `I18n`
service invalidates localized measurement and presentation through the same single-reflow path.

## Minimum geometry and state surfaces

If mandatory board chrome cannot fit, render one bounded localized minimum-size message, expose zero
partial header/card/action targets, and remain focusable at board level. Loading, refreshing, partial,
empty, no-columns, and error/retry states use distinct codes and visible non-color evidence. One cell's
error does not replace ready neighboring cells.

## Damage and lifecycle

Damage is the union of changed visible descriptors, sticky header/state rows, and scroll-exposed areas,
clipped to the viewport. A whole-board redraw is allowed for resize/theme/locale/generation replacement
but still reads only retained projection. Viewport unmount first invalidates the source generation and
aborts owned asynchronous work. It then disposes reactive descriptor scopes, guarded cursor state, raw
cursors, and the session idempotently in that order, as resolved by PAR-37. Board unmount first disposes
its board-only request/publication bindings, then disposes its one owned viewport; it never separately
disposes viewport read resources. Board and viewport instances are terminal one-mount resource owners;
hosts create a fresh instance after unmount instead of reviving disposed reactive scopes.

## Responsive test matrix

Minimum deterministic geometry coverage includes 80×24 standard, each one-cell boundary around
focused-column mode, impossible geometry, horizontal overflow, long/wide Unicode headers, three
densities, surface/window equal rectangles, resize/maximize/restore, locale/theme/capability changes,
column removal/reorder, unknown lengths, and visible-plus-overscan instrumentation.
