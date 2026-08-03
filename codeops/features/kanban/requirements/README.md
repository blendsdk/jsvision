# JSVision Kanban — Requirements Documents

> **Project**: `@jsvision/kanban` — a terminal-native, application-controlled Kanban component and
> standard interaction/dialog toolkit for JSVision
> **Status**: Complete
> **Created**: 2026-08-03
> **Architecture**: Node 22+, ESM TypeScript, Yarn workspaces, JSVision UI/Forms/i18n, responsive
> layout DSL, bounded exact-cell viewport
> **CodeOps Artifact Schema**: 1

---

## Overview

`@jsvision/kanban` is a standalone public SDK package for sophisticated Kanban boards in terminal
applications. It gives third-party and first-party applications the same foundation: configurable
workflow columns, optional horizontal swimlanes, readable and reactive cards, keyboard and modern
mouse interaction, package-provided editors and configuration dialogs, saved views, eager and
windowed data, internationalization, and comprehensive documentation and examples.

The application remains authoritative. It owns records, persistence, authorization, history,
network work, and every accepted mutation. The component renders application data, collects user
intent, projects bounded pending feedback, dispatches typed atomic requests, and reconciles the next
authoritative publication by stable identity and revision. It never silently manufactures ranks,
counts, permissions, or committed state.

The design is responsive by construction. `KanbanBoard<TCard>` uses JSVision's public layout DSL for
ordinary composition and contains one measured exact-cell `KanbanViewport<TCard>` for virtualization,
scrolling, hit testing, sticky regions, and drag projection. The complete long-term requirements are
defined now, while the implementation order below permits independently verified delivery phases.

## Confirmed Scope

### In scope

- A standalone `@jsvision/kanban` package with public models, helpers, component, standard renderers,
  editors, configuration dialogs, locale catalogs, and testing utilities.
- Application-controlled eager and revisioned windowed data sources, typed atomic request dispatch,
  pending projections, lifecycle states, and deterministic reconciliation.
- Workflow columns and one optional horizontal swimlane dimension, including WIP policies,
  definitions of done, ordering, grouping, collapse, hide, configuration, and summaries.
- Generic card records plus an optional `StandardCard` adapter, configurable bounded presentation,
  reactive semantic styling, checklists, summaries, and custom render descriptors.
- Complete keyboard operation and flagship pointer drag-and-drop with visible ghosts, insertion
  gutters, live reflow, capture, cancellation, and edge autoscroll.
- Search, filters, sorting, saved views, personalization, commands, events, capability/read-only
  behavior, application undo integration, and programmatic operations.
- Standard modal editors, an optional application-controlled modeless inspector, column/swimlane
  dialogs, confirmations, validation, isolated drafts, and replacement seams.
- Responsive layout, official locale family, theme/color-depth/Unicode/ASCII fallbacks, terminal
  accessibility requirements, security boundaries, scale and performance evidence.
- A complete component documentation course with live labs, a general kitchen-sink story, and a
  separate Reddit-ready `packages/examples/kanban-showcase/` application.

### Out of scope

- Authentication or an authorization store; applications enforce security and expose UI capabilities.
- Persistence, database access, network synchronization, offline queues, conflict storage, backup, or
  disaster recovery.
- Comment/activity storage, attachment storage or graphical covers, notification delivery,
  automation engines, analytics dashboards, or cross-board orchestration.
- Nested swimlane grouping, split-column primitives, a component-owned backlog, a second slicing
  primitive, inline card editing, or component-owned cross-board transfer.
- Browser DOM accessibility claims, mobile/touch UI, server endpoints, filesystem, clipboard, shell,
  or implicit host-resource access.

## Domain Glossary

| Term | Definition |
|---|---|
| Application | The consumer that owns authoritative data, policy, persistence, authorization, and mutation outcomes. |
| Board | The complete Kanban component state and surface. |
| Workflow column | A vertical workflow stage such as To Do or Done. Public APIs use `column`, never ambiguous bare `lane`. |
| Swimlane | An optional horizontal group derived from exactly one configured dimension in a view. |
| Cell | One workflow-column×swimlane intersection; without grouping, a column has one implicit cell. |
| Card | An application record projected into one cell at one ordered position. |
| `CardKey` | A stable runtime `string | number` identity; numeric and string keys remain distinct. |
| Structural ID | A bounded string identifying a column, swimlane, field, view, registry entry, checklist entity, or operation. |
| Rank | Application-owned durable ordering semantics; not necessarily a property named `rank` on a consumer record. |
| Placement anchor | Stable before/after card identities plus explicit start/end/window-edge intent describing a proposed position. |
| `PlacementToken` | A bounded opaque branded string issued by a source for a revision-scoped position the component cannot derive. |
| Query | The active filtering, grouping, sorting, and saved-view projection definition. |
| Query session | A revisioned board-wide read context that supplies metadata and sparse cell cursors. |
| Cell cursor | A lazy eager/windowed reader for one visible or prefetched cell, including counts, ranges, state, and placement seams. |
| Authoritative publication | Application data/revision that confirms, rejects, or supersedes a projected request outcome. |
| Pending projection | Bounded visual intent shown while the application has not yet published authoritative data. |
| Descriptor renderer | A bounded, terminal-cell-aware card projection consumed by the virtualized viewport without mounting one live view per card. |
| Standard card | The optional mainstream card adapter and editor schema supplied by the package. |
| Summary section | A bounded ordered card region that shows compact derived metadata; only checklists may preview child rows. |
| Durable saved view | Versioned semantic JSON configuration persisted by the application; it excludes session/transient state. |
| Capability | Application-supplied synchronous UI eligibility for an action; it is not authorization enforcement. |
| Density | `compact`, `comfortable` (default), `spacious`, or a bounded custom presentation policy. |
| Logical edge | The authoritative start or end of a cell, distinguished from a loaded-window boundary. |

## Document Index

| # | Document | Description | Depends On |
|---|---|---|---|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Forty-three resolved product and technical decisions | — |
| **RD-01** | [Package and public architecture](RD-01-package-public-architecture.md) | Package boundaries, ownership, component topology, shared identities, API conventions | — |
| **RD-02** | [Data sources and query model](RD-02-data-sources-query-model.md) | Eager/windowed sessions, sparse cell cursors, counts, revisions, placement tokens | RD-01 |
| **RD-03** | [Responsive layout and viewport](RD-03-responsive-layout-viewport.md) | DSL composition, exact-cell leaf, sizing, scrolling, sticky regions, responsive degradation | RD-01, RD-02 |
| **RD-04** | [Cards and presentation](RD-04-cards-presentation.md) | Standard/generic cards, descriptors, fields, checklists, summaries, semantic styling | RD-01, RD-03 |
| **RD-05** | [Columns, swimlanes, and workflow policy](RD-05-columns-swimlanes-workflow.md) | Structure, grouping, WIP, DoD, collapse/hide, summaries, structural states | RD-02, RD-03, RD-04 |
| **RD-06** | [Focus, navigation, and selection](RD-06-focus-navigation-selection.md) | Keyboard and pointer focus, spatial navigation, ranges, bulk selection, reconciliation | RD-03, RD-05 |
| **RD-07** | [Pointer drag and drop](RD-07-pointer-drag-drop.md) | Capture, ghost, gutters, hit testing, live reflow, autoscroll, cancellation | RD-03, RD-04, RD-06 |
| **RD-08** | [Requests, placement, and operation lifecycle](RD-08-requests-placement-lifecycle.md) | Atomic dispatcher, rank proposals, transitions, pending/commit/reject, undo integration | RD-02, RD-05, RD-06, RD-07 |
| **RD-09** | [Search, filters, sorting, and saved views](RD-09-search-filters-saved-views.md) | View pipeline, honest counts, personalization, durable schema, migrations | RD-02, RD-05, RD-06, RD-08 |
| **RD-10** | [Card schema and editor dialogs](RD-10-card-schema-editor-dialogs.md) | Generic fields, `StandardCard`, forms, validation, drafts, stale conflicts, inspector | RD-04, RD-08 |
| **RD-11** | [Board configuration APIs and dialogs](RD-11-board-configuration-dialogs.md) | Column/swimlane programmatic requests, staged dialogs, deletion/reassignment policies | RD-05, RD-08, RD-09, RD-10 |
| **RD-12** | [Commands, events, capabilities, and history](RD-12-commands-events-capabilities.md) | Public actions, keymap, menus, observability, read-only behavior, app history | RD-06, RD-08, RD-09, RD-11 |
| **RD-13** | [Internationalization, theming, and accessibility](RD-13-i18n-theme-accessibility.md) | Locales, accelerators, semantic roles, color fallbacks, Unicode/ASCII, terminal access | RD-03, RD-04, RD-10, RD-12 |
| **RD-14** | [Quality, scale, security, and resilience](RD-14-quality-scale-security.md) | Non-functional requirements, performance, failures, bounded work, verification matrices | RD-01–RD-13 |
| **RD-15** | [Documentation, examples, and distribution](RD-15-docs-examples-distribution.md) | Component course, live labs, kitchen sink, flagship showcase, plugin/release parity | RD-01–RD-14 |

## Dependency Graph

```text
RD-01 → RD-02, RD-03, RD-04, RD-14, RD-15
RD-02 → RD-03, RD-05, RD-08, RD-09, RD-14, RD-15
RD-03 → RD-04, RD-05, RD-06, RD-07, RD-13, RD-14, RD-15
RD-04 → RD-05, RD-07, RD-10, RD-13, RD-14, RD-15
RD-05 → RD-06, RD-08, RD-09, RD-11, RD-14, RD-15
RD-06 → RD-07, RD-08, RD-09, RD-12, RD-14, RD-15
RD-07 → RD-08, RD-14, RD-15
RD-08 → RD-09, RD-10, RD-11, RD-12, RD-14, RD-15
RD-09 → RD-11, RD-12, RD-14, RD-15
RD-10 → RD-11, RD-13, RD-14, RD-15
RD-11 → RD-12, RD-14, RD-15
RD-12 → RD-13, RD-14, RD-15
RD-13 → RD-14, RD-15
RD-14 → RD-15
```

No implementation phase may claim a later behavior without implementing and verifying its upstream
contracts. Documentation and accessibility evidence accompany every phase even though RD-13 and
RD-15 consolidate the final cross-cutting obligations.

## Suggested Implementation Order

| Phase | Documents | Deliverable |
|---|---|---|
| **A: Foundation** | RD-01 → RD-02 → RD-03, whose ownership is limited to foundational package/source/viewport behavior, then the explicitly foundational RD-04 generic-and-standard basic-card rendering slice (AC 1–2) and RD-05 zero/populated ordered-column rendering slice (AC 1 and AC 18) | Publishable package skeleton, pure contracts, eager source, responsive read-only board, bounded viewport, representative basic column/card rendering, and scrolling. Later editor/command/drag/swimlane/docs behavior remains with its owning RD; this phase proves only the named RD-04/RD-05 slices. |
| **B: Core board** | Complete RD-04 → complete RD-05 → RD-06 | Complete standard/generic cards, workflow columns, optional swimlanes, focus/navigation, selection, states, WIP/DoD presentation. |
| **C: Modern interaction** | RD-07 → RD-08 | Flagship pointer and keyboard moves, semantic placement, application dispatcher, atomic pending/recovery lifecycle. |
| **D: Productivity and editing** | RD-09 → RD-10 → RD-11 → RD-12 | Views, filters, saved-state compatibility, editors, configuration, commands, events, capabilities, and app history integration. |
| **E: Hardening** | RD-13 → RD-14 | Complete locales/themes/accessibility, scale, security, resilience, host evidence, and controlled performance proof. |
| **F: Showcase and release** | RD-15 | Complete teaching course and labs, global kitchen sink, Reddit-ready showcase, plugin synchronization, and release evidence. |

Each phase ends with requirements-derived specification tests, relevant package/docs checks,
`yarn verify:local`, source-impact review, `yarn plugin:update` when mapped, and
`yarn plugin:check`. CI owns the full `yarn verify` gate.

## Key Architecture Decisions

| Decision | Choice | Rationale | AR Ref |
|---|---|---|---|
| Package | Standalone `@jsvision/kanban` | Matches Data Grid and Code Editor specialist-package precedent | AR-1, AR-2 |
| Authority | Application-owned records and mutations | Keeps persistence, policy, and authorization outside a reusable view | AR-3, AR-27 |
| Main component | DSL-composed `KanbanBoard<TCard>` around one measured viewport leaf | Maximizes responsive JSVision composition while retaining bounded exact-cell rendering | AR-41, AR-42 |
| Data access | Revisioned query session with sparse cell cursors | Supports eager/windowed parity without an N×M object graph | AR-10, AR-32, AR-42 |
| Mutation | One discriminated atomic dispatcher | Unifies UI, programmatic, command, dialog, async, undo, and observability behavior | AR-3, AR-8, AR-9, AR-42 |
| Axes | Workflow columns plus zero/one swimlane dimension | Adds meaningful grouping without nested TUI clutter | AR-6, AR-7 |
| Cards | Generic adapters plus optional `StandardCard` | Strong defaults without imposing storage shape | AR-4, AR-16, AR-25, AR-26, AR-35 |
| Editing | Dialogs only; optional modeless inspector | Preserves card readability and supports generic validated forms | AR-5, AR-20 |
| Pointer UX | Captured ghost, live reflow, gutters, autoscroll, cancellation | Meets modern Kanban expectations for mouse users | AR-39, AR-40 |
| Saved views | Application-stored versioned durable semantic JSON | Makes compatibility explicit while excluding stale transient state | AR-30, AR-36 |
| Responsive widths | Measured 18/24/32 defaults plus focused-column fallback | Keeps mandatory cues readable without permanent navigation chrome | AR-24, AR-34 |
| Verification | Layered spec-first semantic, visual, host, scale, and docs evidence | Avoids brittle snapshot-only or manual-only acceptance | AR-38 |
| Defaults and limits | One exported conservative manifest plus conflict-validated keymap | Removes plan-time guesses and bounds public extension work | AR-43 |

## Commonly Forgotten Requirements — Final Check Map

| Concern | Disposition | Owner |
|---|---|---|
| Audit/activity trail | Component emits bounded events; durable activity storage is application-owned | RD-12, RD-14 |
| Data export | Board data export is application-owned; saved-view JSON codec is included | RD-09 |
| API/schema versioning | Public semver and saved-view version/migrations required | RD-01, RD-09, RD-15 |
| Rate limiting | N/A to a local component; async request concurrency is bounded | RD-14 |
| Empty/loading/error/optimistic states | Required and distinct | RD-02, RD-05, RD-08 |
| Accessibility/responsiveness | Terminal-specific keyboard, non-color, geometry, host-boundary requirements | RD-03, RD-06, RD-13 |
| Backup/DR, auth sessions, infrastructure, encryption | Application/host responsibility; component owns no storage/server/infrastructure | RD-01, RD-14 |
| Notifications, uploads, attachments | Delivery/storage out of scope; bounded summary seams only | RD-04, RD-14 |
| Search and pagination/windowing | Search plus bounded eager/windowed range acquisition | RD-02, RD-09 |
| Delete semantics | Requests only; no cascade; non-empty structure blocked or atomically reassigned | RD-11 |
| Dates/timezones | Typed field adapters and application formatters; no implicit timezone conversion | RD-10, RD-13 |
| i18n | Ten catalogs plus injected fallback, layout evidence, and digest-bound review before non-English catalogs are called official | RD-13 |
| GDPR/retention/privacy | No component persistence; diagnostics exclude sensitive payloads | RD-14 |
| Offline behavior | Application-owned; component displays published source/request states honestly | RD-02, RD-08, RD-14 |
| Configuration/feature flags | Typed options, capabilities, view settings, renderer/editor registries | RD-09, RD-11, RD-12 |
| Input validation and injection | Bounded/sanitized text and strict saved-state/request validation; no implicit host execution | RD-09, RD-10, RD-11, RD-14 |
| Security testing | Hostile text, schema, callbacks, revisions, IDs, diagnostics, and resource-bound tests | RD-14 |

## How to Use These Documents

1. Select one RD whose dependencies are implemented.
2. Run the CodeOps make-plan workflow for that RD and its named phase boundary.
3. Derive `*.spec.test.ts` cases directly from every acceptance criterion before implementation. These
   tests are normative oracles: change one only with an accepted requirement or ambiguity-register
   update, updated traceability, and review evidence explaining the semantic change. Git history records
   that the specification test preceded its implementation.
4. Execute the plan in dependency order and keep docs/plugin artifacts synchronized in the same work.
5. Do not interpret a later RD as permission to bypass application authority or a phase gate.
