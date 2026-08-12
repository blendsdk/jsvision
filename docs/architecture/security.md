# Kanban security architecture

> **Last Updated**: 2026-08-12
> **Status**: Phase C contract, source, interaction, request, operation, drag, host, and testing boundaries implemented

## Trust boundary

The Kanban package is a local UI component, not an authorization or persistence service. The
application owns identity, access control, policy enforcement, records, saved views, audit storage,
and remote communication. Component capabilities control discoverability and eligibility only; the
application must authorize every dispatched request again.

## Threat model

| Asset or boundary           | Threat                                                      | Required mitigation                                                                   | Status                             |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------- |
| Terminal output             | Control-character injection or misleading text              | Sanitize untrusted display text and render safe visible fallbacks                     | Presentation boundary implemented  |
| Public adapters             | Getters, hostile prototypes, or malformed descriptors       | Descriptor-safe validation, allowlisted shapes, and strict bounds                     | Presentation boundary implemented  |
| Requests                    | Unauthorized, malformed, duplicate, or stale mutation       | Exact validation, host authorization, ID registry, and revision checks                | Phase C implemented                |
| Placement/saved-view tokens | Oversized or malicious opaque input                         | Byte, depth, array, key, and string limits before use                                 | Token/value foundation implemented |
| Diagnostics                 | Leakage of card content or personal data                    | Content-free bounded observations by default                                          | Foundation implemented             |
| Async lifecycle             | Stale completion mutates disposed or newer state            | Cancellation, generation checks, and idempotent disposal                              | Source/session layer implemented   |
| Extension callbacks         | Exception or unbounded work destabilizes board              | Failure isolation, concurrency limits, and degraded states                            | Card-render boundary implemented   |
| Grouping and custom chrome  | Resolver failure, target injection, or cache exhaustion     | Separate fallback groups, header-only shapes, complete cache keys, and a fixed bound  | Structure boundary implemented     |
| Hover scheduling            | Stale callback or failed scheduler changes collapse state   | Generation-owned temporary leases and failure-safe cancellation                       | Structure boundary implemented     |
| Scene and hit targets       | Stale/clipped geometry invokes the wrong action             | Canonical clipped targets, crop offsets, revision match, bounded hit-map shapes       | Scene boundary implemented         |
| Keyboard and pointer input  | Duplicate, stale, or post-disposal action                   | Synchronous handled gate, matching down/up evidence, quiesce before teardown          | Mounted input implemented          |
| Interaction extensions      | Hostile controller or handler corrupts state/leaks records  | Exact snapshots, exclusive ownership, serialized settlement, identity-only intents    | Interaction boundary implemented   |
| Operation lifecycle         | Duplicate dispatch, conflict, late settlement, partial bulk | Subject reservations, exactly-once dispatch, generation checks, atomic reconciliation | Phase C implemented                |
| Pointer capture and drag    | Stale capture/timer, wrong target, payload-bearing overlay  | Generation lease, semantic drop map, bounded overlay, synchronous cancellation        | Phase C implemented                |
| Testing and host evidence   | Private input/result retention or fake PTY evidence         | Sanitized collector, semantic-only envelope, real PTY/ConPTY adapters                 | Phase C implemented                |

## Input and output rules

- Validate all IDs, tokens, descriptors, saved views, adapter results, and application responses at
  the package boundary.
- Use Unicode display-cell measurement after sanitization; never pass raw control sequences through
  to the renderer.
- Reject invalid configuration atomically. Do not partially apply a saved view or multi-card move.
- Treat application callbacks as untrusted extension points: catch failures, cancel stale work, and
  avoid re-entrancy corruption.
- Keep error details useful for developers without embedding card titles, descriptions, checklist
  text, or custom field values.

Foundation snapshots reject accessors, custom prototypes, unsafe meta-properties, sparse arrays,
arbitrary thenables, Promise subclasses, Promise proxies, duplicate subjects, and values beyond the
published absolute ceilings. Native Promise settlement uses the intrinsic operation without reading
an application-owned `then` property. Semantic fingerprints are browser-safe cache hints and never
replace equality checks.

Card descriptor snapshots additionally reject terminal controls, bidirectional controls, invalid
display-cell geometry, overlapping regions, unknown semantic roles, malformed action namespaces,
oversized collections, and zero-cell mandatory fallback labels. Theme resolution ignores malformed
overrides and preserves marker, border, attribute, or text cues when color cannot carry meaning.

Workflow-structure snapshots apply the same exact-shape and bounded-text rules. Grouping resolver
failures cannot reveal card content through diagnostics, hidden membership remains detached from
visible rendering, and custom swimlane chrome cannot declare card or insertion targets. Custom
presentation caching includes every semantic and geometry input and evicts under a package limit,
preventing stale reuse and unbounded retention.

Scene snapshots contain safe presentation data, semantic identities, and final clipped geometry—not
application records. Sparse height and retained-row work is bounded, custom card action regions are
translated and clipped before target publication, and stale revisions cannot complete a pointer
press. Right-click, double-click, card-action, retry, and scoped-action paths all resolve through the
same final hit map.

Interaction-controller output is copied through exact-shape snapshot validation before publication.
One controller instance can be claimed by only one mounted board. Transitions are serialized and
late/rejected settlements cannot replace the last valid state. Application handlers receive only
identity, origin, closed scope, and bounded eligible selection; handler exceptions are contained and
observed without payloads. Input is quiesced before controller, viewport/session, and request-authority
teardown, and disposed/minimum-geometry input fails closed.

The operation coordinator validates caller proposals before assigning metadata, reserves a bounded set
of affected subjects, and publishes pending state before exactly one dispatcher invocation. It accepts
only exact native-Promise settlement, treats confirmation and inverse-building callbacks as hostile,
and rejects duplicate IDs, partial atomic results, stale placement evidence, contradictory publication,
and late work after cancellation or disposal. Undo descriptors retain bounded opaque tokens rather than
records or inverse closures.

Drag overlays retain only semantic identities and sanitized resident title/status cues. Pointer capture,
autoscroll timers, unknown-edge prefetch, collapsed-hover expansion, and insertion targets share one
generation. Focus loss, replacement, resize, policy/source invalidation, Escape, release, unmount, stop,
or disposal invalidates that generation before cleanup callbacks can affect newer state.

The public testing collector accepts unknown input but retains only bounded normalized mouse/focus
events; paste and key payloads are discarded. Browser evidence uses xterm input, and native evidence
requires a real `node-pty` PTY or ConPTY child that emits a validated semantic-only result.

## Data protection

The package stores no durable data and requires no credentials. Encryption, network transport,
backups, retention, privacy requests, and audit persistence remain application responsibilities.
Transient board state must be released on disposal and must not be serialized into saved views.

## Verification obligations

Specification tests cover hostile strings, malformed descriptors, oversized tokens/JSON, stale
results, throwing callbacks/controllers/handlers, re-entrancy, bounded selection, navigation
cancellation, mismatched pointer revisions, teardown order, and disposal. Host-level tests verify
that capability visibility cannot bypass dispatcher authorization, post-disposal input is unhandled,
and terminal output contains no untrusted escape sequences.
