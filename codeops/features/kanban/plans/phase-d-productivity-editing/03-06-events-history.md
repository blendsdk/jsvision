# Events and History: Phase D

> **Document**: 03-06-events-history.md
> **Parent**: [Index](00-index.md)

## Overview

Public events describe user-visible state and lifecycle; observations remain diagnostic. History is an
application integration, not a component snapshot store (AR-D10/D11).

## Event model

`KanbanEvent` is a discriminated immutable union for focus, selection, view, action/command, request
lifecycle, source state, errors, and degradation. Every event has a bounded sequence, injected-clock
timestamp, board ID, stable entity/action IDs, relevant revision/state/code, and counts. It excludes
records, editor drafts, sensitive filter values, placement/undo tokens, raw errors, and arbitrary
application payloads.

Ordering for mutations is action intent → request proposed → pending → dispatcher outcome →
authoritative commit/supersede. Focus, selection, and view events publish only after subscribers can
read the new public state. Request events derive from existing operation snapshots/publication rather
than creating another lifecycle. String card key `'1'` remains distinct from numeric `1`.

## Hub lifecycle

`KanbanEventHub` owns a bounded monotonic sequence, current subscriber set, optional bounded last-state
snapshot/counters, and disposal. Subscriber exceptions isolate and produce one redacted diagnostic.
Nested publication queues breadth-first in call order; sequence numbers allocate when dequeued. Queue
capacity is configurable, defaults to 256, and has hard maximum 4,096. Publishing the next event above
capacity returns `event-queue-overflow`, emits one redacted observation per drain cycle, and enqueues no
partial event. Disposal
clears queued work/subscriptions and invalidates generations so late work cannot emit (AR-D23).

## History integration

Applications provide reactive `canUndo`/`canRedo` descriptions and callback/request builders. The
action router exposes availability in menus/status/help. Invocation captures current revisions and
creates a normal fresh proposal/token path through the authority coordinator. Rejection/staleness emits
feedback and events; the component never stores card snapshots, mutates data, or emits committed before
authoritative publication.

## Observations versus events

| Surface | Audience | Payload | Failure policy |
|---|---|---|---|
| `KanbanEvent` | Application workflows/UI/testing | Ordered public semantic state/lifecycle | Subscriber isolated; no raw error |
| `KanbanObservation` | Diagnostics/support | Coarse payload-free reason/counters/duration | Sink isolated; never affects behavior |

Existing observation APIs remain compatible. New event-to-observation bridges are one-way and only for
safe failure classification; diagnostics never drive state.

## Target modules

`src/event/types.ts`, `validation.ts`, `hub.ts`, `publisher.ts`, `operation-events.ts`,
`history.ts`, plus board/facade/controller publication hooks.

## Testing requirements

ST-DH-01…DH-10 cover exact ordering, observable-state timing, key identity, subscriber failure,
redaction, terminal outcomes, history availability/rejection, no component snapshots, reentrancy bound,
custom action lifecycle, observation separation, cancellation, disposal, and late settlements.
