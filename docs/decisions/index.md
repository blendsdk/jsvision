# Architecture Decision Records

This log tracks accepted architectural decisions for JSVision. ADRs describe design intent; observed
implementation must not silently supersede them.

The [Kanban architecture overview](/architecture/kanban) maps ADR-006 through ADR-014 to the
implemented Phase C board. The implementation preserves package authority, responsive exact-cell
projection, sparse sessions, one optional swimlane axis, generic bounded cards, semantic atomic
requests, bounded degradation, and generation-bound capture. Phase C adds card and structural drag,
placement/eligibility, one operation coordinator, pending/publication/undo lifecycle, reviewed locale
overlays, host evidence, and the standalone kitchen sink. Commands, packaged editors, saved-view
codecs/UI, and consumer component labs remain later work.

## Decision log

| #                                                      | Date       | Decision                                                  | Status   |
| ------------------------------------------------------ | ---------- | --------------------------------------------------------- | -------- |
| [0001](/adr/0001-code-editor-package-boundary)         | 2026-07-24 | Isolate Code Editor as a public package                   | Accepted |
| [0002](/adr/0002-code-editor-document-state)           | 2026-07-24 | Keep exact document state transactional                   | Accepted |
| [0003](/adr/0003-code-editor-language-services)        | 2026-07-24 | Separate language-service boundaries                      | Accepted |
| [0004](/adr/0004-code-editor-theme-model)              | 2026-07-24 | Use semantic Code Editor theme roles                      | Accepted |
| [0005](/adr/0005-code-editor-bounded-degradation)      | 2026-07-24 | Bound Code Editor degradation                             | Accepted |
| [ADR-006](ADR-006-kanban-package-authority.md)         | 2026-08-03 | Isolate Kanban while retaining application authority      | Accepted |
| [ADR-007](ADR-007-kanban-responsive-viewport.md)       | 2026-08-03 | Compose responsively around one exact-cell viewport       | Accepted |
| [ADR-008](ADR-008-kanban-query-sessions.md)            | 2026-08-03 | Use revisioned query sessions and sparse cell cursors     | Accepted |
| [ADR-009](ADR-009-kanban-atomic-requests.md)           | 2026-08-03 | Route mutation intent through one atomic dispatcher       | Accepted |
| [ADR-010](ADR-010-kanban-board-axes.md)                | 2026-08-03 | Model columns plus one optional swimlane dimension        | Accepted |
| [ADR-011](ADR-011-kanban-card-schema.md)               | 2026-08-03 | Combine generic cards with package-owned schema dialogs   | Accepted |
| [ADR-012](ADR-012-kanban-saved-views.md)               | 2026-08-03 | Persist versioned semantic saved views in the application | Accepted |
| [ADR-013](ADR-013-kanban-bounded-degradation.md)       | 2026-08-03 | Centralize limits and progressive terminal degradation    | Accepted |
| [ADR-014](ADR-014-generation-bound-pointer-capture.md) | 2026-08-11 | Use generation-bound pointer-capture leases               | Accepted |

## How to read ADRs

Each decision records its context, viable alternatives, selected option, rationale, consequences,
and risks. A later change must create a superseding ADR instead of rewriting accepted history.

## When to add an ADR

Add an ADR for a hard-to-reverse package boundary, public protocol, ownership rule, architecture
pattern, compatibility contract, or significant performance/security trade-off. Routine implementation
details belong in source documentation and plans.
