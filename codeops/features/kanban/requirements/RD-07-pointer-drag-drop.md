# RD-07: Pointer Drag and Drop

> **Document**: RD-07-pointer-drag-drop.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-03, RD-04, RD-06
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Mouse users expect a modern Kanban drag experience even in a terminal. The board must make the card
feel lifted, preserve a visible source, reflow the target stack around a substantial insertion gap,
autoscroll at edges, and cancel without damage. Pointer and keyboard movement share the same placement
and request rules; drag visuals never become authoritative state.

---

## Functional Requirements

### Must Have — Complexity XL

- [x] Start card drag only after a configurable default one-cell movement threshold from primary-button
  pointer-down; ordinary click remains selection/open behavior.
- [x] Capture the pointer for the drag lifetime and recover safely from capture loss, host blur, modal
  opening, source deletion/change, resize, disposal, Esc, and explicit cancellation.
- [x] Render one bounded recognizable lifted-card ghost, a source placeholder, target insertion gap,
  and live stack reflow without stale trails or screen damage.
- [x] Use full-width resting card gutters as primary comfortable/spacious targets, card upper/lower halves
  as forgiving before/after fallback, and one-row expanded active gaps in compact density.
- [x] Expose leading/trailing positions, a separate first gap below swimlane headers, and large empty-cell
  targets.
- [x] Apply target hysteresis so small pointer movement does not flicker between adjacent positions.
- [x] Display allowed, warning, invalid, unavailable/loading, and pending target states with non-color cues
  and localized reasons.
- [x] Provide two-speed four-edge autoscroll while captured and recompute placement after each step.
- [x] Dispatch exactly one move request on valid pointer-up; invalid/outside pointer-up cancels with no
  request.
- [x] Drag one card or the complete selected set atomically, with a bounded stacked-count ghost.
- [x] Apply the same quality principles to column and explicit-swimlane reordering.

### Should Have — Complexity L

- [x] Prefetch an unknown window-edge target during hover while keeping it unavailable until resolvable.
- [x] Temporarily expand a visible collapsed swimlane after a bounded hover delay and restore it on leave.
- [x] Expose deterministic drag-frame/geometry evidence through the testing subpath.

### Won't Have (Out of Scope)

- OS/native GUI drag data, touch gestures, drag outside the JSVision host, or component-owned cross-board
  transfer.
- Hover-only required actions; every operation has keyboard/menu parity.
- Dropping on a swimlane header or inferring an unloaded logical end.

---

## Technical Requirements

### Pointer state machine — Complexity XL

The state machine is idle → pressed → dragging → proposed → released/cancelled. JSVision has one terminal
pointer, so `pressed` stores the initiating button, a monotonically increasing gesture-generation token,
origin card/address/revisions, selection snapshot, origin cell, and threshold origin. Manhattan distance
is `abs(currentX - originX) + abs(currentY - originY)`; dragging begins when it is greater than or equal
to the configured threshold. The default threshold of one therefore starts on the first cell transition.
Crossing the threshold acquires capture, resolves the dragged set, and creates one drag projection.
Pointer-up before threshold is a click and creates no move request.

Only primary-button card/header handles begin a drag. Secondary button opens context actions. Additional
button transitions, invalid coordinates, or capture loss cancel safely. Cancellation is idempotent and
clears ghost, insertion gap, temporary expansion, timers, autoscroll, prefetch, and capture in one frame.

Capture uses a UI-owned lease that synchronously notifies its holder when capture is replaced, a modal is
entered, the target unmounts, the host loses capture/focus, or the event loop is disposed. Loss invalidates
the gesture generation before clearing projection state, so a same-frame late pointer event cannot revive
or release the cancelled drag. This reusable UI notification seam is an implementation prerequisite; the
current set/release/has-capture API alone cannot satisfy the recovery guarantee.

### Ghost and source placeholder — Complexity L

The ghost is clipped to the viewport, follows the pointer-relative grab offset without covering the active
target, and contains one compact framed title plus a selected count when multiple. It has no blank trailing
row and never duplicates status or other card content. The source position retains a placeholder/non-color
marker so the user sees origin and the stack does not collapse unexpectedly. Theme/capability fallbacks
preserve a recognizable border/marker in monochrome/ASCII. This compact form supersedes the earlier
title/status-fragment design after native visual review (AR-44).

### Drop target geometry — Complexity XL

- Comfortable/spacious gutters are one full-width row and primary hit regions.
- A card's upper/lower half maps before/after only when no gutter wins.
- Hysteresis retains the current slot until the pointer crosses a documented inner boundary or moves to
  a different card/cell.
- Leading/trailing slots use bounded top/bottom target regions; an empty cell's card region is one large
  legal target subject to capability/policy.
- A swimlane header is never a slot; its first slot begins below the header.
- Compact density expands only the currently proposed slot to one visible row and reflows cards around it.
- Target lookup consumes current post-scroll/post-layout geometry and source placement semantics.

### Live reflow and damage — Complexity XL

The drag projection removes the moving descriptor(s) from their visual source, retains a placeholder,
and inserts one gap at the proposed target without changing source data. Reflow recalculates only
affected visible cells/regions. The damage tracker invalidates union(old ghost/gap, new ghost/gap,
affected stack) so no stale pixels remain. Pointer movement with unchanged target may repaint only the
ghost/damage region.

### Eligibility and unknown data — Complexity L

Every target invokes the pure synchronous eligibility pipeline using current revisions, WIP/transition,
capabilities, selection, and `placementAt`. Warning is distinguishable from allowed and may require
application confirmation at request time. Unknown window edges may trigger bounded prefetch; until a
token/anchors arrive, the target is unavailable and pointer-up cancels/no-ops with feedback.

### Edge autoscroll — Complexity L

Four edge zones exist inside the viewport. By default the outermost one cell at each scrollable edge is
the fast zone (two cells per 50 ms tick); the next two cells inward are the slow zone (one cell per
50 ms tick). Zones clamp without overlap in very small viewports. A deterministic fake-clock-friendly
controller advances one bounded step per tick, clamps at extent, and stops when the pointer leaves,
capture ends, modal opens, or no movement is possible. Target hysteresis is one cell and visible
collapsed-swimlane hover expansion begins after 500 ms. The controller
recomputes sticky/hit/placement geometry after every successful scroll. Simultaneous corner proximity
may scroll both axes without issuing duplicate requests.

### Release and reconciliation — Complexity M

On valid pointer-up, freeze the latest selection/order, source/target, placement anchors/token,
revisions, and operation ID and dispatch exactly once through RD-08. Release capture immediately; replace
the drag ghost/gap with the pending projection. Invalid, unchanged disallowed, outside, stale, or
cancelled release dispatches nothing and restores source layout/focus in one settled frame.

---

## Integration Points

- **RD-03** owns viewport geometry, scrolling, clipping, and damage boundaries.
- **RD-05** owns WIP/transitions/collapse and swimlane header semantics.
- **RD-06** supplies focus/selection snapshots and pointer click behavior.
- **RD-08** consumes the final semantic proposal and manages pending outcomes.
- **RD-14** verifies deterministic traces, host behavior, performance, and cleanup.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Pointer quality | Outline / modern ghost+reflow | Modern flagship | Contemporary Kanban expectation | AR #39 |
| Targets | Card-only / gutter / density hybrid | Density hybrid | Large precise TUI targets | AR #40 |
| Hover | Required / optional enhancement | Optional | Terminal hosts vary | AR #39 |
| Unknown edge | Guess / block/prefetch | Block and prefetch | Prevent wrong rank | AR #32, #31 |
| Bulk | One / selection | Atomic selection | Productivity without partial state | AR #15, #31 |
| Timing | Deferred / fixed safe defaults | 50 ms zones, 500 ms expansion | Deterministic modern feedback | AR #43 |
| Ghost content | Title/status fragment / compact title-only | Compact framed title plus multi-count | Native visual review found the extra row unnecessarily large | AR #44 |

---

## Security Considerations

- Pointer coordinates, button/modifier data, gesture-generation tokens, renderer hit regions, and operation IDs are
  validated before lookup/dispatch.
- A drag never bypasses application capability or dispatcher authorization.
- Placement tokens are treated as secrets/opaque capabilities for the revision: no display, logging,
  persistence, or reuse.
- Timers, capture, prefetch, and callbacks are bounded and disposed to prevent resource exhaustion.
- Ghost text is sanitized and bounded; it cannot draw outside the viewport clip or spoof global UI.

---

## Acceptance Criteria

1. [x] With the one-cell default, zero Manhattan movement produces click selection and zero move requests;
   the first cell transition (`abs(dx) + abs(dy) >= 1`) starts exactly one captured drag for the active
   button/generation.
2. [x] A drag frame contains one compact title-only ghost (plus bounded selected count when multiple), one
   source placeholder, and at most one active insertion gap; it has no blank trailing row, and moving
   between targets leaves no old ghost/gap cells in the settled frame.
3. [x] Comfortable/spacious gutter coordinates win over card-half fallback and map to the correct
   between anchors.
4. [x] Moving one cell inside the configured hysteresis band retains the target; crossing its boundary
   changes target once without oscillation.
5. [x] Compact mode expands the active gap to one row only while dragging and removes it on cancellation.
6. [x] A swimlane header coordinate never yields a card slot; the coordinate immediately below its
   separate leading gap can.
7. [x] An empty writable cell exposes a larger target and produces logical start only when the source
   declares the cell empty/complete.
8. [x] Slow/fast edge zones advance their configured bounded steps under a fake clock, clamp at extents,
   and stop on leave/cancel/capture loss.
9. [x] After each autoscroll step, hit testing uses the new scroll offset; pointer-up dispatches the newly
   visible placement, not the pre-scroll slot.
10. [x] Unknown window-edge hover starts at most the configured bounded prefetch, remains unavailable,
    and becomes valid only after a current-revision token/anchor arrives.
11. [x] Pointer-up on one valid target emits exactly one request; pointer-up on invalid/outside/stale
    target emits zero.
12. [x] Capture loss, Esc, modal opening, relevant source revision, disposal, and resize cancellation each
    synchronously invalidate the gesture, clear ghost/gap/timers/capture, and restore a damage-free frame;
    a same-frame queued pointer-up cannot dispatch.
13. [x] Dragging an unselected card moves only it; dragging one of four selected cards creates one four-card
    atomic proposal and a bounded count ghost.
14. [x] Column/swimlane reorder drags use capture, ghost/placeholder, insertion marker, autoscroll,
    cancellation, and one-request release semantics equivalent to cards.
15. [x] A real Unix PTY harness and platform-scoped Windows ConPTY-equivalent harness, plus browser/xterm,
    deliver the same semantic pointer trace and final proposal for the standard fixture, allowing
    host-specific raw byte differences; pipe-backed tests remain a lower integration layer and are not
    labeled PTY evidence.
16. [x] ANSI text in a dragged title is neutralized in the ghost and absent from observations.
