# ADR 0002: Use immutable revision identity around transactional document state

- Status: Accepted
- Date: 2026-07-24

## Decision

Keep exact source text in a document model whose mutations are validated transactions. Every
snapshot carries lineage and revision identity.

## Consequences

Undo, redo, selection, line endings, and dirty state share one source of truth. Parser and
language-server results can be rejected deterministically when their identity is stale.
