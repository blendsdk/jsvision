# Drag Interaction: Kanban Phase C Modern Interaction

> **Document**: 03-04-drag-interaction.md
> **Parent**: [Index](00-index.md)

## Overview

The viewport-local drag controller owns only one pointer gesture, its capture lease, target proposal,
timers, bounded prefetch, temporary collapsed-swimlane expansion, and immutable render-neutral overlay
evidence. Phase 4 proves those semantics without drawing frames; Phase 5 alone owns visual composition and
damage, and Phase 6 alone owns structural/cross-input parity. The controller never dispatches directly:
valid release transfers one proposal atomically to the board operation coordinator
(AR-C03/C04/C09/C12).

## State machine

```text
idle → pressed → dragging → proposed → released
  ↑        └────────────── cancellation ──────────────┘
  └──────────────── settled cleanup ←─────────────────
```

- `pressed` is owned by the pointer router and remains click-compatible below threshold.
- `dragging` owns one capture lease and one source placeholder/ghost snapshot.
- `proposed` is a dragging substate with one current semantic drop target and insertion gap.
- `released` exists only for the atomic coordinator handoff; it immediately settles to idle.
- Cancellation is legal and idempotent from every non-idle state (AR-C03/C04).

The snapshot retains initiating button, generation, origin point/card/header, source address/placements,
board/query/entity/cursor revisions, ordered selection, density, and current geometry generation. It never
retains application records (AR-C05/C13/C20).

## Dragged set

- Dragging an unselected card moves that card only.
- Dragging a selected card resolves the entire eligible selection in deterministic source order.
- A server-wide/opaque selection is unavailable unless the application supplies a bounded concrete move
  proposal; the component never expands an unbounded token into records.
- The selected block is validated atomically against limits, revisions, transitions, and target policy.
- The ghost shows one bounded identity/title/status fragment and `+N`/localized selected count; it does not
  render every selected card (AR-C14/C20).

## Semantic drop map

The drop map is a pure immutable projection from the current post-layout/post-scroll scene geometry,
source placement evidence, density, collapsed state, policy/capabilities, and dragged set. It is separate
from the ordinary action hit map so card buttons and retry/header actions keep their existing z-order
(AR-C04/C07).

### Target kinds

| Target | Geometry | Semantic result |
|---|---|---|
| Resting gutter | Full content width, one row in comfortable/spacious | Between adjacent cards; wins over card halves |
| Card upper/lower half | Visible clipped card half | Before/after fallback when no gutter contains point |
| Cell leading/trailing zone | Bounded first/last card region | Logical start/end only with source completeness; otherwise window-edge/unavailable |
| Post-swimlane leading gap | Separate row below header/chrome | First card slot; header itself never dispatches |
| Empty cell | Large card content region | Logical start only when source says empty/complete and policy allows |
| Compact active gap | One row created only for current proposal | Reflows stack; removed on target change/cancel/release |
| Unknown loaded-window edge | Bounded edge zone | Unavailable; may trigger one current-revision prefetch and become valid only after evidence arrives |

Targets carry `allowed`, `warning`, `blocked`, or `unavailable/loading` eligibility and a localized reason
key/parameters. Invalid and unavailable release dispatch nothing (AR-C06/C07/C20).

## Hysteresis

The current target remains active while the pointer stays within its one-cell inner hysteresis band. A
new target wins immediately when the pointer enters a different semantic card/cell/structure owner or
crosses the current boundary by more than the band. Hysteresis compares semantic slot identity, not only
rectangle coordinates, so scroll/reflow does not retain a stale placement (AR-C08/C13).

## Autoscroll

Four edge zones are measured inside the current viewport after sticky chrome:

- outer one cell: two-cell fast step every 50 ms;
- next two cells inward: one-cell slow step every 50 ms;
- zones clamp and do not overlap in small viewports;
- corners may advance both axes in one tick;
- each axis clamps independently and a no-movement tick stops that axis.

The controller receives an injected `now`, schedule, and cancel seam. One timer/generation exists per
drag. After each successful scroll, the viewport rebuilds sticky geometry, scene/drop map, placement, and
hysteresis before painting. A tick never dispatches a request. Leaving zones, decoded/explicit host loss,
modal,
explicit cancellation, resize cancellation, and disposal stop timers synchronously (AR-C09/C13).

## Prefetch and collapsed swimlanes

Unknown edge hover may start one bounded `ensureRange` using the target’s source prefetch hint. It stays
unavailable until current generation/revision placement arrives. Moving away aborts it; late completion is
inert (AR-C09/C13).

A visible collapsed swimlane starts the existing transient hover controller. After 500 ms it temporarily
expands for target discovery, never changes saved/application collapse state, and restores on leave,
release, cancellation, or source/policy change. Hidden swimlanes never auto-reveal (AR-C09).

## Structural drag

Column and explicit-swimlane headers use the same threshold, capture lease, bounded ghost, source
placeholder, insertion marker, hysteresis, two-axis autoscroll, cancellation generation, and exactly-one
release handoff. Type-specific resolvers permit only sibling order slots; a header is never a card slot.
Derived swimlanes without reorder capability remain blocked. Structural requests are atomic and share the
operation coordinator (AR-C14).

## Keyboard and programmatic parity

The interaction facade adds move/reorder methods that accept a target address/semantic position or a
direction resolved through the current scene. Mounted keyboard gestures invoke these methods through the
existing input router and are fully reachable without mouse. They reuse eligibility and the coordinator;
they do not synthesize drag ghosts, but pending projection and feedback are identical. RD-12 later owns
configurable command names/keymaps and menus (AR-C15).

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Capture lost or generation stale | Cancel synchronously; clear timers/prefetch/hover/overlay; no request | AR-C03/C13 |
| Resize during drag | Cancel and settle one clean frame; do not reinterpret old coordinates | AR-C03/C13 |
| Unknown edge prefetch fails | Stay unavailable with safe feedback; no request | AR-C09/C20 |
| Relevant source/policy revision changes | Cancel pre-release or supersede operation; unrelated data does not cancel | AR-C13 |
| Pointer-up outside/blocked/unavailable | Cancel and restore focus/source scene in one settled frame | AR-C07/C13 |
| Structural capability absent | Block with non-color/localized reason; no capture when known at press | AR-C06/C14 |

## Testing Requirements

- Pure drop-map table tests for every target kind, priority, clipping, density, swimlane header, empty cell,
  unknown edge, hysteresis, and source completeness combination.
- Fake-clock autoscroll, prefetch, hover expansion, cancellation, corner, small viewport, and clamp tests.
- Card/single-selection/bulk and column/swimlane gesture state-machine tests.
- Phase 4 card tests assert render-neutral gesture/proposal semantics; Phase 5 owns frame assertions and
  Phase 6 owns structural plus pointer/keyboard/programmatic semantic-proposal equivalence.
