# ADR 0005: Bound hostile input and degrade features independently

- Status: Accepted
- Date: 2026-07-24

## Decision

Apply one controller-owned limits policy to document, language-service, assistance, and
observability resources. Validate untrusted objects without invoking accessors and keep
degradation notices bounded and content-free.

## Consequences

Malformed, excessive, slow, or stale input cannot grow retained state without bound or escape as
terminal control output. Optional features can suspend or truncate while safe core editing
continues.
