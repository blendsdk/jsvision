# ADR-014: Use generation-bound pointer-capture leases

> **Date**: 2026-08-11
> **Status**: Accepted
> **Source**: Modern interaction architecture

## Context

JSVision's original pointer-capture API stored a nullable target view. Existing controls could query
or clear that target, but a gesture could not reliably learn why capture ended outside its normal
pointer-up path. Modern drag interactions may own timers, auto-scroll, previews, and transient state
that must stop in the same frame when capture is replaced, a modal opens, the host loses input, the
target unmounts, or the event loop stops.

Polling capture state on later input is too late for those resources. Registering unrelated cleanup
at each call site also makes lifecycle coverage inconsistent and risks retaining a dead view through
a stale public handle.

## Options considered

### Poll the existing capture target

- **Pros**: No public API addition.
- **Cons**: Cleanup waits for another event, provides no loss reason, and cannot reliably cover host,
  modal, unmount, stop, and disposal paths.

### Register cleanup independently for each captured gesture

- **Pros**: Each control can tailor its own lifecycle hooks.
- **Cons**: Duplicates event-loop knowledge, invites missing teardown paths, and makes ordering
  inconsistent across controls.

### Centralize a generation-bound lease in the event loop

- **Pros**: One loss transition covers every lifecycle path, stale owners cannot release a newer
  capture, and cleanup receives a bounded reason synchronously.
- **Cons**: Adds a supported public protocol and requires careful reentrancy and retention rules.

## Decision

The UI event loop owns one monotonically generated capture record. `acquireCapture(view, onLost)`
returns a lease tied to that exact generation. Releasing or replacing capture first detaches the
lease, then invokes `onLost` once with a bounded reason. A stale lease is harmless and retains only a
small detached state cell, not the event loop or view.

Every capture-loss path uses the same transition: replacement, explicit release, modal entry and
exit, host lifecycle loss, target unmount, loop stop, and disposal. The unmount boundary remains
active through reactive-owner disposal, and modal entry revalidates the loop after the callback, so
reentrant cleanup cannot install capture into a dying lifecycle.

The legacy `setCapture()`, `hasCapture()`, and `releaseCapture()` surface remains available for
compatible controls. New cleanup-sensitive gestures should use the lease API and check `active()`
after acquisition before starting gesture-owned work.

**Chosen option**: A centralized generation-bound lease, because immediate cleanup, stale-owner
safety, and complete lifecycle coverage are prerequisites for reliable mouse dragging.

## Consequences

### Positive

- Drag controllers receive same-frame capture-loss notification without polling.
- An old gesture cannot release a newer gesture's capture.
- All event-loop lifecycle boundaries share one tested cleanup protocol.
- Existing controls can migrate incrementally without a breaking API removal.

### Negative

- Capture-loss callbacks run synchronously and therefore need isolation from lifecycle progress.
- The event loop must preserve ordering and reentrancy invariants across every teardown path.
- The legacy and lease APIs coexist until existing controls are deliberately migrated.

### Risks

- A callback may throw or attempt reentrant acquisition. The event loop detaches state before the
  callback, isolates observer failures where lifecycle teardown requires progress, and rejects
  acquisition while terminal, modal, host-loss, or unmount boundaries are active.
- A consumer may assume successful return means the lease stayed active through a reentrant
  replacement. Gesture setup must check `active()` before starting owned resources.
- Capture is infrastructure rather than Kanban policy. Kanban supplies its own thresholds, previews,
  insertion targets, accessibility parity, and move requests on top of the shared lease contract.
