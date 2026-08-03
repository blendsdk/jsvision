# Kanban security architecture

> **Last Updated**: 2026-08-03
> **Status**: Accepted design; implementation pending

## Trust boundary

The Kanban package is a local UI component, not an authorization or persistence service. The
application owns identity, access control, policy enforcement, records, saved views, audit storage,
and remote communication. Component capabilities control discoverability and eligibility only; the
application must authorize every dispatched request again.

## Threat model

| Asset or boundary           | Threat                                                | Required mitigation                                               | Status  |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- | ------- |
| Terminal output             | Control-character injection or misleading text        | Sanitize untrusted display text and render safe visible fallbacks | Planned |
| Public adapters             | Getters, hostile prototypes, or malformed descriptors | Descriptor-safe validation, allowlisted shapes, and strict bounds | Planned |
| Requests                    | Unauthorized or stale mutation                        | Host authorization plus expected-revision checks                  | Planned |
| Placement/saved-view tokens | Oversized or malicious opaque input                   | Byte, depth, array, key, and string limits before use             | Planned |
| Diagnostics                 | Leakage of card content or personal data              | Content-free bounded observations by default                      | Planned |
| Async lifecycle             | Stale completion mutates disposed or newer state      | Cancellation, generation checks, and idempotent disposal          | Planned |
| Extension callbacks         | Exception or unbounded work destabilizes board        | Failure isolation, concurrency limits, and degraded states        | Planned |

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

## Data protection

The package stores no durable data and requires no credentials. Encryption, network transport,
backups, retention, privacy requests, and audit persistence remain application responsibilities.
Transient board state must be released on disposal and must not be serialized into saved views.

## Verification obligations

Specification tests cover hostile strings, malformed descriptors, oversized tokens/JSON, stale
results, throwing callbacks, re-entrancy, cancellation, and disposal. Host-level tests verify that
capability visibility cannot bypass dispatcher authorization and that terminal output contains no
untrusted escape sequences.
