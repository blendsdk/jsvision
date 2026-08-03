# Requirements: Kanban Phase A Foundation

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1

## Source requirements

This plan references rather than restates the approved requirements:

| Source | Phase A ownership |
|---|---|
| [RD-01 Package and public architecture](../../requirements/RD-01-package-public-architecture.md) | Complete all 15 acceptance criteria |
| [RD-02 Data sources and query model](../../requirements/RD-02-data-sources-query-model.md) | Complete all 17 acceptance criteria |
| [RD-03 Responsive layout and viewport](../../requirements/RD-03-responsive-layout-viewport.md) | Complete all 15 acceptance criteria |
| [RD-04 Cards and presentation](../../requirements/RD-04-cards-presentation.md) | Only AC 1–2 |
| [RD-05 Columns, swimlanes, and workflow policy](../../requirements/RD-05-columns-swimlanes-workflow.md) | Only AC 1 and AC 18 |
| [Requirements phase map](../../requirements/README.md#suggested-implementation-order) | Defines the Phase A deliverable and later-phase boundary |
| [Requirements preflight](../../requirements/00-preflight-report.md) | Passed quality gate for the source set |

## Plan-local slice specifications

### SPEC-A-CARD-SLICE — foundational generic and standard cards

Phase A proves exactly RD-04 AC 1 and AC 2:

- a generic application record with application-specific property names renders through typed
  adapters without conversion to or inheritance from `StandardCard`; and
- the Phase A standard renderer always presents a non-empty sanitized title, status, and non-color
  focused marker for widths 18 through 32 cells.

The full descriptor, theme, formatting, and standard model types are designed durably now so later
phases extend behavior without replacing the public contract. Reactive style repaint, custom renderer
fallback, optional metadata/summaries/checklists, operation state, editor actions, complete contrast
evidence, and every remaining RD-04 criterion are excluded from completion claims.

### SPEC-A-COLUMN-SLICE — foundational workflow columns

Phase A proves exactly RD-05 AC 1 and AC 18:

- a zero-column source renders a valid localized no-columns surface with no card/header hit regions
  and the board itself remains focusable; and
- a populated source renders three non-empty workflow columns in source order, uses stable column IDs
  and authoritative card cells, reacts to a published column reorder without changing card identity,
  and never mounts one `View` per logical card.

WIP, definition-of-done, transitions, grouping/swimlanes, collapse, structural requests, full empty
state action policy, and every remaining RD-05 criterion stay in later phases.

## Cross-cutting obligations included now

These are evidence needed to ship Phase A, not claims that RD-13 through RD-15 are complete:

| Concern | Phase A obligation |
|---|---|
| Security | Validate identities, semantic JSON, ranges, source publications, renderer outputs, geometry, and text; redact records/tokens from observations |
| i18n | Export all required locale subpaths, translate the bounded Phase A vocabulary, and add current digest-bound reviews |
| Theming | Publish the durable package-local semantic role contract and provide safe Phase A mappings/fallbacks |
| Accessibility | Keep title, status, non-color focus, minimum-size state, and board focusability visible within the slice |
| Scale | Exercise 5,000 eager and 100,000 logical windowed fixtures with deterministic bounded-read assertions |
| Documentation | Complete public JSDoc, package README/changelog, focused architecture reference, API inventory, and canonical plugin reference |
| Distribution | Verify dependency declarations, native-dependency exclusion, and packed consumer runtime/types/exports; RD-10 owns Zod peer behavior |

## Exclusions

Phase A must not accidentally implement or advertise:

- focus navigation or selection commands beyond identity inputs/reconciliation and the non-color marker;
- pointer hit targets for cards, insertion, or drag/drop;
- component-generated mutation UI, optimistic visuals, undo/history, authorization, or persistence;
- active swimlane grouping/presentation, WIP enforcement, DoD, transition policy, or collapse;
- editors, lane/column configuration dialogs, confirmations, or modeless inspectors;
- saved views, search UI, filter UI, command/event surfaces, or application history;
- full component docs, `template1` live examples, the separate Kanban kitchen sink, or showcase; or
- a complete RD-13, RD-14, or RD-15 claim.

Public contract placeholders are allowed only where the requirements explicitly demand a durable
Phase A type surface. They must have honest documentation stating which behavior becomes active later.
RD-01's raw request/dispatcher/capability contract is active and tested now: a programmatic caller may
submit a typed request, but the board does not generate card/column requests and never treats a
capability as authorization. Acceptance changes no authoritative record until a source publication.

## Decision references

All plan-local choices are controlled by the [Ambiguity Register](00-ambiguity-register.md). In
particular, PAR-08 prevents partial RDs from being marked complete; PAR-09 through PAR-19 define public
contract details; PAR-20 through PAR-24 define auto-designed internal mechanisms and i18n integration.
