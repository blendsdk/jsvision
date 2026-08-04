# Interaction Model: Kanban Phase B Core Board

> **Document**: 03-05-interaction-model.md
> **Parent**: [Index](00-index.md)

## Overview

This specification owns pure focus, navigation, selection, reconciliation, acquisition, feedback, and
transient cancellation behavior. One controller serializes transitions and publishes immutable
snapshots; geometry/source adapters supply bounded current evidence (PAR-B06/PAR-B13/PAR-B14).

## Controller lifecycle

The board creates the default controller, or invokes `interactionFactory` once at mount with a bounded
`KanbanInteractionEnvironment` adapter for reveal, acquisition, visible targets, revisions, feedback
localization keys, and invalidation. The returned controller never receives application card records or
host handles; ownership transfers to that board and reuse rejects. A stable board-owned facade exists
before mount and owns serialization, subscriptions, intents, and disposal ordering. It disposes
cancellation/timer/subscription resources and the controller before the viewport session
(PAR-B06/PAR-B17).

Factory/controller setup is an atomic fail-closed mount transaction. Cleanup is registered immediately
after each source/scene acquisition. Factory throws, invalid controller shape, invalid/throwing initial
snapshot, or throwing subscription dispose the partial controller when present, then scene/cache and
source/session resources; the facade becomes permanently unavailable, input never enables, and one
payload-free observation is emitted. Transition throws/rejections settle as typed unavailable/error
results behind generation checks and cannot escape the event loop or emit an intent.

Transitions are serialized synchronously until an explicit bounded acquisition is required. Each async
transition owns generation, source/query revision, and `AbortController`; a newer transition, query
replacement, unmount, or caller cancellation prevents late focus movement. Snapshot revisions increase
only for semantic changes, and one transition emits at most one invalidation.

## Initial focus and target eligibility

After the first usable scene:

1. first visible enabled card in source scene order;
2. first visible workflow header;
3. board/no-results/minimum state.

Collapsed/hidden card regions are ineligible; a collapsed header remains eligible. Focus painting
requires a currently visible target, but a retained unloaded card identity may own pending acquisition
without painting a hidden target. Minimum-size mode focuses the board state and restores the prior
eligible stable identity after usable geometry returns only when that identity never became hidden or
deleted.

## Spatial navigation

Pure navigation functions consume `KanbanNavigationSnapshot` rather than reading the live view:

- up/down move previous/next visible card in the same semantic cell; boundaries reach the owning
  header or adjacent swimlane according to scene order;
- left/right choose the visible card in the adjacent workflow column and same swimlane whose visual
  center is nearest `preferredCenterRow`, then its column header when no card is eligible;
- Home/End select first/last visible loaded card in the cell;
- board-edge transitions select the first/last visible board target programmatically; mounted semantic
  Primary+Home/End remains open until RD-12 preserves and normalizes host modifiers;
- PageUp/PageDown shift by viewport content height and resolve the closest stable target;
- focused-column previous/next changes the visible column while preserving preferred center row.

Every successful card move minimally reveals its final rectangle. Navigation never infers an unloaded
logical card from array index. When a known range can satisfy the command, the controller starts one
bounded acquisition, retains current focus and pending feedback, then recomputes against the current
generation. Unsupported/failed acquisition clears pending state, retains focus, and exposes localized
retry/error feedback (PAR-B13).

## Focus reconciliation

On filter, grouping, visibility, collapse, source publication, resize, or deletion, the controller
reconciles once in this order:

1. next visible card in the same cell;
2. previous visible card in the same cell;
3. nearest card in next then previous visible workflow column at preferred row;
4. containing/nearest eligible header;
5. board/no-results/minimum state.

Clearing a filter does not restore an old hidden focus. Authoritative deletion applies fallback once.
Cursor unload retains identity and attempts bounded reveal/acquisition before fallback. Hidden
swimlanes never auto-reveal (PAR-B13/PAR-B27).

## Ordered selection model

The controller owns a type-preserving ordered key sequence plus membership map (PAR-B14). Public
snapshots freeze the sequence and never expose the map. Operations are:

- `replace`: exactly the focused card;
- `toggle`: add/remove without changing other membership;
- `range`: contiguous visible loaded keys between explicit anchor and destination inside one cell;
- `select-loaded-visible-matching`: exactly the bounded resident/matching scene keys in deterministic
  cell/card order;
- `clear-multiple`: clear multi-selection while retaining focus and the implicit focused action target.

Range navigation cannot cross a cell; crossing performs ordinary focus movement and ends extension.
The anchor remains explicit and type-preserving. View/filter/hide changes prune invisible membership and
report removed count; cursor unload alone prunes zero. Selection is bounded by central limits and never
claims server-wide/logical membership. An optional application server-wide selection token is opaque
and separate from the key model, with explicit set/clear transitions; it never expands loaded keys.
Before select-loaded-visible-matching commits, the controller counts deterministic candidates. When the
count exceeds the resolved selected-key ceiling, it atomically retains the prior selection and returns
localized `selection-limit-exceeded` feedback rather than truncating a bulk target.

`snapshotEligibleSelection` captures a frozen ordered list with current key/address/entity revisions and
source/query revisions. Later selection changes cannot alter it. This snapshot is used by interaction
intents and later bulk requests.

## Pointer selection transitions

Phase B supports only click-family transitions through bounded pending-press state:

- primary-button down focuses and records the prior eligible selection, target, button, scene revision,
  and framework click count; matching up commits single-click replacement;
- Ctrl-click toggles on hosts where Ctrl is the currently deliverable Primary equivalent; Command-click
  remains explicitly open for RD-12 because current Core/UI events do not preserve Meta;
- double-click commits the second click and emits one open intent on its matching second up, not two;
- right-click focuses first, preserves a currently eligible multi-selection containing that card, or
  replaces selection otherwise, then emits one context intent;
- clicking a capable header focuses and emits a scoped collapse intent; collapse changes only after
  application policy republication;
- checklist/descriptor action targets emit their semantic action and never mutate card content.

The pending press cancels on target/button mismatch, intervening input, focus loss, stale scene revision,
or disposal. Mouse down does not start capture, evaluate a drag threshold, or create insertion geometry.
RD-07 later extends the controller at the movement threshold while reusing the pre-threshold selection
snapshot (PAR-B18).

## Transient cancellation

At most one transient owner registers a bounded idempotent cancel function and priority. Escape first
invokes/removes it. With none registered, Escape clears multi-selection but retains focus. Actual drag
and menu owners arrive later; Phase B tests a deterministic synthetic owner and never advertises those
features as present (SPEC-B-TRANSIENT-CANCEL).

## Feedback and inspection

Feedback uses typed codes plus localized safe labels and bounded counts, never card values. Inspection
returns focus target, selection keys/count/scope, range anchor, pending-navigation kind, last prune
count, active transient kind, and the bounded sanitized focused-detail snapshot. Diagnostics record only
identities/revisions/counts and already-redacted reason codes (PAR-B16/PAR-B17/PAR-B22).

## Testing requirements

- Pure navigation at uneven heights, every boundary, focused-column mode, page/home/end, and headers.
- Initial focus and every reconciliation step across filter/hide/collapse/unload/delete/resize.
- Bounded acquisition success/failure/cancellation/late completion and one invalidation per transition.
- Replace/toggle/range/select-all/prune/unload semantics, selection ceiling, numeric/string key
  distinction, immutable ordered snapshots, and separate server-wide token.
- Single/Ctrl-equivalent/double/right click transitions, pending-press cancellation, explicit deferred
  Command evidence, and synthetic transient Escape ordering.
