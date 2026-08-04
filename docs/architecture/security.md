# Kanban security architecture

> **Last Updated**: 2026-08-04
> **Status**: Contract, source/session, adapter, descriptor, theme, and catalog boundaries implemented; mounted component controls remain planned

## Trust boundary

The Kanban package is a local UI component, not an authorization or persistence service. The
application owns identity, access control, policy enforcement, records, saved views, audit storage,
and remote communication. Component capabilities control discoverability and eligibility only; the
application must authorize every dispatched request again.

## Threat model

| Asset or boundary           | Threat                                                | Required mitigation                                               | Status                             |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| Terminal output             | Control-character injection or misleading text        | Sanitize untrusted display text and render safe visible fallbacks | Presentation boundary implemented  |
| Public adapters             | Getters, hostile prototypes, or malformed descriptors | Descriptor-safe validation, allowlisted shapes, and strict bounds | Presentation boundary implemented  |
| Requests                    | Unauthorized or stale mutation                        | Host authorization plus expected-revision checks                  | Foundation implemented             |
| Placement/saved-view tokens | Oversized or malicious opaque input                   | Byte, depth, array, key, and string limits before use             | Token/value foundation implemented |
| Diagnostics                 | Leakage of card content or personal data              | Content-free bounded observations by default                      | Foundation implemented             |
| Async lifecycle             | Stale completion mutates disposed or newer state      | Cancellation, generation checks, and idempotent disposal          | Source/session layer implemented   |
| Extension callbacks         | Exception or unbounded work destabilizes board        | Failure isolation, concurrency limits, and degraded states        | Card-render boundary implemented   |

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

## Data protection

The package stores no durable data and requires no credentials. Encryption, network transport,
backups, retention, privacy requests, and audit persistence remain application responsibilities.
Transient board state must be released on disposal and must not be serialized into saved views.

## Verification obligations

Specification tests cover hostile strings, malformed descriptors, oversized tokens/JSON, stale
results, throwing callbacks, re-entrancy, cancellation, and disposal. Host-level tests verify that
capability visibility cannot bypass dispatcher authorization and that terminal output contains no
untrusted escape sequences.
