# Technical specification: cards, descriptors, theme, and i18n

> **Document**: 03-04-cards-descriptors-theme-i18n.md
> **Parent**: [Index](00-index.md)
> **Decision sources**: PAR-13–PAR-16, PAR-23–PAR-24
> **CodeOps Artifact Schema**: 1

## Generic adapter and standard model

`KanbanCardAdapter<TCard>` is the required presentation seam. It has pure bounded getters for stable
key, non-empty title, status, and optional presentation revision. It may accept a renderer/resolver
registry, but no consumer record must implement or extend a package model.

`StandardCard` is a convenience interface containing stable identity, placement/order, title, status,
and the optional description/type/priority/assignees/labels/dates/estimate/value/checklist/summary/
custom-data shapes already defined by RD-04. Phase A publishes this durable TypeScript shape but its
standard renderer consumes only title and status. Documentation must distinguish a declared data shape
from a currently visible standard section.

Dates remain opaque application values until an injected formatter handles them. No timezone
conversion, locale loading, host resource, record cloning, or mutation occurs.

Runtime validation is deferred to RD-10, which introduces the Kanban-owned Zod adapter together with
the standard editor/schema protocol and Forms integration. Phase A validates bounded values at the
adapter and renderer boundaries without a Zod dependency.

## Descriptor contract

A renderer receives only bounded values:

- card and stable key;
- available width/row budget and density/degradation state;
- focused/selected/read-only/operation semantic flags (later states may be false in Phase A);
- immutable `KanbanTheme` projection and terminal capabilities;
- presentation policy and formatting context; and
- a revision seam suitable for reactive invalidation.

It returns a `KanbanCardDescriptor` containing sanitized terminal-cell rows, semantic style roles,
bounded regions/actions, measured height, and degradation metadata. Validation rejects non-integer/
non-finite/negative/out-of-budget geometry, more than 32 rows, unsafe text/role IDs, duplicate action
IDs, overlapping invalid regions, and any region outside the card. Phase A emits no active card action
hit region.

Renderer/resolver exceptions create one local observation and a bounded fallback descriptor. Neighbor
cards and the last valid source snapshot remain usable. Diagnostics identify the card key only; they do
not include title/status/custom data or raw exception text.

## Phase A standard rendering

For every width from 18 through 32 cells, the standard descriptor preserves:

1. one-cell non-color state/focus marker plus a non-empty sanitized title;
2. a sanitized status row/token; and
3. stable card boundary/background treatment.

Text clips/ellipsizes by terminal display cells and never splits a wide glyph. A missing/empty title or
status is invalid adapter output and receives a localized bounded fallback rather than a blank semantic
row. Comfortable/spacious stacks receive their inter-card blank row from layout, not descriptor height.

The descriptor types include section priority and future optional section variants so Phase B can add
metadata, summaries, and checklists without replacing the renderer protocol. Phase A tests must assert
that these declared optional values do not unexpectedly render.

## Descriptor projection cache

The viewport retains descriptors only for visible and finite-overscan cards. A key includes:

- board session generation, canonical cell address, and cursor revision;
- `CardKey` without string coercion;
- renderer/presentation revision;
- assigned width, height/degradation inputs, and density;
- theme/capability revision; and
- interaction-state revision.

Each entry owns its reactive scope. A dependency change damages only the affected visible descriptor.
When an entry leaves the retained projection, dispose its scope and release the card reference
immediately. On generation replacement, dispose all descriptor scopes before cursors/session. A source
that mutates presentation data in place without changing its cursor/presentation revision violates the
public source contract and may yield a development observation.

## Kanban theme contract

Publish an exhaustive `KanbanThemeRole` union and immutable `KanbanTheme`. Stable role families cover:

| Family | Roles declared in Phase A contract |
|---|---|
| Surfaces | board, column, swimlane, separators, focused header/group |
| Cards | normal, focused, selected, focused+selected, disabled/read-only |
| Operations | grabbed, source placeholder, ghost, valid/warning/invalid target, pending, rejected |
| Policy/state | WIP warning/error, DoD, loading, partial, empty, error, retry |
| Content | title, status, metadata, labels, summaries, checklist complete/incomplete/progress |

`createKanbanTheme(coreTheme, overrides?)` validates known roles and returns a complete package-local
palette. Phase A actively maps board, column/header/separator, card normal/focused, title, status,
loading/partial/empty/error/retry roles. Remaining roles are stable, documented mappings ready for
later behavior; they are not evidence that those states are implemented.

Resolution follows application status override → explicit Kanban override → mapped Core role →
`listNormal` for ordinary content or `dangerText` for errors. Mandatory title/status/focus receive a
non-color cue. The contract exposes the RD-13 contrast resolver/fallback types durably; Phase A verifies
safe malformed-input rejection and basic color-depth/monochrome mappings, while the full quantized
contrast matrix and every later state remain Phase E completion evidence.

## Catalog contract

Authored locale source follows the repository generator contract: `src/i18n/catalog.ts` owns the schema,
English fallback, and composition helpers; `src/i18n/locales.ts` owns the ten typed catalog values. The
generator alone owns `src/locales/*.ts` wrappers. The main entry exports the catalog schema/type and
English default catalog. Locale subpaths export type-compatible named constants:

```text
kanbanEn, kanbanNl, kanbanDe, kanbanFr, kanbanEs,
kanbanIt, kanbanPtPT, kanbanPl, kanbanRo, kanbanSv
```

Phase A vocabulary covers every visible/error/help value implemented now: board label, no columns,
loading, refreshing, partial, empty, error, retry, minimum size, unknown/truncated count qualifiers,
focused-column previous/next/position, invalid card fallback, and safe source/renderer reason labels.
Applications compose the chosen catalog through existing `I18n`; English is the fallback. Locale
modules register no global state.

All nine non-English catalogs receive disclosed digest-bound review evidence in the same change that
adds Kanban to `tools/i18n-locale-exports.json`. Reviews cover the complete Phase A catalog, not only
changed strings. Future vocabulary makes the catalog digest stale and requires renewed review. Do not
weaken or exempt the repository review checker.

## Sanitization and measurement

All application text crosses Core's sanitizer before measurement and drawing. Bounds use UTF-8 bytes
for contract limits and terminal display cells for geometry. Sanitized text, not raw text, determines
width. Tabs/newlines retained by the generic sanitizer are normalized to safe single-line card/header
content before descriptor construction. ANSI/control input cannot influence geometry, neighboring
cells, logs, or theme role selection.
