# Capture and Input: Kanban Phase C Modern Interaction

> **Document**: 03-01-capture-input.md
> **Parent**: [Index](00-index.md)

## Overview

Phase C first closes the framework-level lifecycle gap that prevents a drag owner from learning that
capture disappeared while it is no longer receiving events. The UI event loop remains the sole pointer
capture owner and adds a generation-scoped lease; Kanban then extends its pending-press router into a
gesture owner without duplicating UI capture state (AR-C03/C04).

## UI capture lease

### Public contracts

```ts
export type PointerCaptureLossReason =
  | 'replaced'
  | 'released'
  | 'modal'
  | 'unmounted'
  | 'host-lost'
  | 'stopped'
  | 'disposed';

export interface PointerCaptureLease {
  readonly generation: number;
  active(): boolean;
  release(): void;
}

export type PointerCaptureLostHandler = (reason: PointerCaptureLossReason) => void;
```

`EventLoop.acquireCapture(view, onLost)` and the corresponding optional `DispatchEvent.acquireCapture`
return a lease. A decoded `focus: false` report passes through the central `host-lost` transition before
ordinary dispatch, then remains available to normal focus routing. `EventLoop.notifyCaptureLost()` is the
explicit fallback ingress for transport/OS loss that has no decoded focus report. Exact final naming follows
the established UI `setCapture` vocabulary; the behavior and ownership are fixed here (AR-C03).

### Internal transition

One private loop transition owns every capture change:

1. invalidate the current generation and detach its target/callback;
2. install the replacement generation when acquisition is requested;
3. invoke the detached callback synchronously once with the bounded reason;
4. catch/log callback failure without exposing it to routing or skipping installation;
5. repaint through the current tick only when the callback dirtied a view.

A lease release carries its generation. It releases only when that generation still owns capture; a late
release from an earlier drag is an inert no-op. Reentrant callback acquisition therefore replaces only
the just-installed/current owner through the same transition rather than corrupting a newer lease.

### Synchronous subtree unmount seam

One permanent optional `RenderRootOptions.onViewUnmounting(view)` seam flows through `RenderRootImpl` and
`ViewHost`. `View.unmount()` invokes it at the start of unmount, before scope disposal, user cleanup, or
parent-link clearing. EventLoop checks whether its capture target is the notified view or a descendant while
ancestry is still intact, then routes `unmounted` through the central loss transition. No callback is
registered per capture, so repeated capture/release cannot accumulate view-cleanup closures.

`RenderRoot.unmount()` and the remount path call `rootView.unmount()` before disposing the outer root owner;
group removal and dynamic reconciliation already converge through child `unmount()`. All paths remain
idempotent and notify once per mounted subtree transition (AR-C03/C20).

### Compatibility

- `setCapture(view)` acquires an anonymous lease and preserves replace-current behavior.
- `releaseCapture()` releases the current capture through the central transition.
- `hasCapture(view)` remains an equality query over the active target.
- Current Slider, ScrollBar, Input selection, Desktop, Window, and status controls require no source
  migration. New implementation tests run their existing drag suites unchanged.
- The addition is source-compatible. Active capture now receives a reasoned loss callback on `stop()` and
  `dispose()`, while legacy anonymous captures are simply cleared through the same transition; packed public
  API tests prove the new contract and old trio together (AR-C03).

### Loss sources and ordering

| Source | Loss reason | Required ordering |
|---|---|---|
| New owner acquires | `replaced` | Old generation invalidated before old callback; replacement stays current unless reentrantly replaced |
| Explicit current release | `released` | Invalidate, detach, callback once |
| Modal begin/end | `modal` | Lose capture before modal focus/scope changes |
| Captured target or ancestor subtree unmounted | `unmounted` | Permanent ViewHost notification fires before scope/user cleanup and parent-link clearing; no later input is required |
| Decoded `focus: false` | `host-lost` | Lose capture before ordinary focus-event routing; queued pointer-up sees the invalid generation |
| Explicit host-loss ingress | `host-lost` | Fallback for transport/OS loss with no decoded focus report; notify synchronously inside the host’s loop tick |
| Direct `stop()` | `stopped` | A private `stop(reason)` transition invalidates capture before painter/async ingress stops |
| Direct `dispose()` | `disposed` | Calls the private stop transition with `disposed`; a prior direct stop makes later disposal inert and emits no second callback |

## Kanban pointer input

`KanbanPointerInput` gains validated viewport-local `point`, Shift/Alt evidence, and ephemeral event-loop
capture acquisition. Coordinates must be finite safe integers inside the loop-provided local coordinate
domain; invalid/additional button transitions cancel the current generation (AR-C03/C07/C13/C20).

### Press compatibility

Primary down on a draggable card/header:

1. snapshots target, point, scene/query/entity revisions, selection, button/modifiers, and a monotonically
   increasing gesture generation;
2. runs the existing focus admission behavior;
3. remains a click candidate until Manhattan movement meets the configured threshold;
4. does not capture, create a ghost, or dispatch while below threshold.

Primary up below threshold retains existing matching down/up click/double-click selection and activation.
Movement below threshold may change the pointer coordinate but does not cancel the click merely for being
a `move`/`drag` report. A target/revision/button mismatch still cancels it (AR-C03).

### Threshold crossing

The distance is `abs(x - originX) + abs(y - originY)`. The validated default threshold is one cell, so
the first cell transition begins dragging. At crossing, the router resolves the final dragged set,
acquires a capture lease, invalidates click completion, and hands one immutable pressed snapshot to the
drag controller. Failure to acquire or resolve leaves no drag and no request.

### Cancellation generation

Capture loss first invalidates the gesture generation, then synchronously clears target/ghost/gap,
autoscroll, hover expansion, prefetch, and timers. Queued reports carry the old generation and cannot
revive or release the cancelled drag. Escape, resize, source change, explicit cancellation, and disposal
use the same idempotent cancellation path (AR-C03/C09/C13).

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Loss callback throws | Log bounded framework diagnostic, continue transition, never retain callback | AR-C03/C20 |
| Stale lease releases | No-op; generation mismatch cannot clear current owner | AR-C03 |
| Invalid pointer coordinate/button | Cancel generation, emit bounded payload-free observation, no request | AR-C13/C20 |
| Capture acquisition unavailable in a synthetic test envelope | Drag does not start; click behavior remains testable | AR-C03 |
| Modal/host loss during threshold crossing | Generation validation after acquisition prevents ghost publication | AR-C03/C13 |

## Testing Requirements

- UI specification tests for every loss reason, direct stop/dispose precedence, immediate target/ancestor
  subtree unmount without later input, decoded `focus: false`, explicit host-loss fallback, exactly-once
  callbacks, reentrancy, stale release, repeated capture/release bounded retention, and old API compatibility.
- Kanban specification tests for threshold zero/one transitions, click preservation, capture generation,
  modal/unmount/host-loss/disposal cancellation, and queued-up suppression.
- Existing UI control drag suites run as regression coverage after the capture refactor.
