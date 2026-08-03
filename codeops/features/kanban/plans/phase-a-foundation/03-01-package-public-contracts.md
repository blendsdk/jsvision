# Technical specification: package and public contracts

> **Document**: 03-01-package-public-contracts.md
> **Parent**: [Index](00-index.md)
> **Decision sources**: PAR-09, PAR-12–PAR-18
> **CodeOps Artifact Schema**: 1

## Package topology

Create `packages/kanban` as an independently publishable ESM package following the Data Grid package
shape. The package manifest exposes only:

- `.` — all production types, pure helpers, render contracts, sources, and UI components;
- `./testing` — deterministic fixtures, instrumentation, and headless harness helpers; and
- `./locales/{en,nl,de,fr,es,it,pt-PT,pl,ro,sv}` — side-effect-free catalog exports.

No internal path, `/model`, or `/dialogs` export is introduced. `sideEffects: false`, Node `>=22`,
public publish metadata, declarations, README, changelog, license, and package-local build/typecheck/
unit/E2E/dependency/JSDoc scripts are mandatory.

Runtime dependencies are the smallest actually imported set among `@jsvision/core`, `@jsvision/ui`,
and `@jsvision/i18n`, aligned to the workspace version. Phase A publishes TypeScript card shapes but no
runtime schema adapter. RD-10 introduces the Kanban-owned Zod adapter, `zod: ^4` peer/development
dependency, and `@jsvision/forms` when its editor/schema APIs consume them. Testing-only dependencies
stay dev-only.

## Source module boundaries

```text
src/
├── contract/       identities, semantic values, limits, states, errors, observations
├── source/         query/session/cursor contracts, coordinator, eager source, validation
├── card/           adapters, StandardCard, descriptor, formatter, renderer, theme
├── layout/         width solver, vertical projection, metrics, hit-map model
├── board/          board state, KanbanViewport, KanbanBoard
├── i18n/           authored catalog schema, ten locale values, translation modules
├── locales/        generator-owned locale entry wrappers
├── testing/        deterministic eager/windowed fixtures and instrumentation
├── index.ts        production barrel
└── testing.ts      testing barrel
```

Leaf modules import leaf modules. Production modules never import `testing.ts` or `src/testing/`.
Public barrels re-export symbols without re-declaring type identities.

## Identity contract

```ts
export type CardKey = string | number;
export type KanbanColumnId = string;
export type KanbanSwimlaneId = string;
export type KanbanFieldId = string;
export type KanbanViewId = string;
export type KanbanChecklistId = string;
export type KanbanExtensionId = string;
export type KanbanOperationId = string;
export type KanbanRevision = string | number;

declare const placementTokenBrand: unique symbol;
export type PlacementToken = string & { readonly [placementTokenBrand]: true };
```

Semantic IDs remain ergonomic string aliases but every package boundary validates them by declared
kind. The placement token is created only by a validating factory and is never decoded, logged, or
serialized. Revisions support equality only. Card maps preserve JavaScript key identity, so `1` and
`'1'` are distinct.

All IDs reject empty values, C0/C1/DEL/control and escape content, invalid namespace form where a
namespace is required, and more than 256 UTF-8 bytes. Tokens reject more than 2 KiB. Duplicate IDs are
validated within their semantic namespace before publication. Errors identify only safe kind/code and
sanitized ID when permitted.

## Limits manifest

Export one deeply immutable `KANBAN_LIMITS` manifest with every RD-14 row and its safe default,
standard ceiling, and absolute maximum. Immutable rows repeat the same value in all classes. Public
options select `safe`, `standard`, or explicit `advanced` values, and may lower limits. A validator
rejects non-integer, negative, inverted, overflowed, over-class, and over-absolute values before any
allocation or callback.

Phase A consumes these rows directly:

- ID 256 bytes; placement token 2 KiB;
- semantic JSON: 256 KiB encoded, depth 16, 4,096 array entries, 256 object keys, 16 KiB strings;
- 64 columns; 64 retained cursors; 256-card `ensureRange`; 32 custom descriptor rows;
- eight concurrent cell loads; 256 retained observations;
- one viewport vertical overscan and one column per horizontal side.

The remaining manifest rows are exported now as the durable cross-phase safety contract but are not
advertised as active features.

## Errors and observations

Public programmer/configuration failures use documented subclasses of `KanbanError` with stable
codes, for example invalid ID, invalid query, invalid range, invalid source publication, invalid
descriptor, invalid geometry, and disposed resource. Error messages are bounded and sanitized.

Runtime application callback/source/renderer failures do not unwind drawing. They produce a bounded
`KanbanObservation` containing safe code, scope, optional structural/card key, counts, and a redacted
message. It never contains card bodies, custom data, query values, raw exceptions, or placement
tokens. Observation delivery failure cannot break the board. The buffer evicts oldest entries at its
configured limit.

## Public construction

```ts
export interface KanbanViewportOptions<TCard> {
  readonly source: KanbanDataSource<TCard>;
  readonly query: () => KanbanQuery;
  readonly card: KanbanCardAdapter<TCard>;
  readonly i18n?: () => I18n;
  readonly density?: () => KanbanDensity;
  readonly theme?: () => KanbanTheme;
  readonly limits?: KanbanLimitOptions;
  readonly overscan?: KanbanOverscanOptions;
  readonly observe?: (observation: KanbanObservation) => void;
  readonly capabilities?: () => KanbanCapabilities;
  readonly identity?: () => KanbanIdentityInput;
}

export interface KanbanBoardOptions<TCard> extends KanbanViewportOptions<TCard> {
  readonly dispatcher?: KanbanRequestDispatcher;
}

export class KanbanViewport<TCard> extends View {
  constructor(options: KanbanViewportOptions<TCard>);
}

export class KanbanBoard<TCard> extends Group {
  readonly viewport: KanbanViewport<TCard>;
  constructor(options: KanbanBoardOptions<TCard>);
}
```

Each independently constructed `KanbanViewport` owns exactly one read-projection coordinator, query
session, and cursor lifecycle. `KanbanBoard` constructs and delegates read behavior to one viewport and
separately owns the application-authority request seam; it never creates a second read coordinator.
The viewport exposes read-only metrics plus `scrollBy`,
`scrollTo`, and `revealCard`. `revealCard` may acquire only bounded source ranges and reports a typed
result when a card is unknown/unloaded; it uses the optional revision-bound locator specified in 03-02
and never silently scans the source. Each viewport normalizes an omitted `i18n` getter to an isolated
English service. Replacing the service through the getter invalidates localized layout and descriptor
inputs once; a board passes the shared read option through to its owned viewport rather than creating
another localization owner.
Phase A has no public
component-generated mutation, selection command, pointer-drag, editor, or configuration UI.

## Application-authority request seam

The main entry publishes a namespaced extensible `KanbanRequest` discriminated contract, bounded
request/result/error types, and `KanbanRequestDispatcher`. Programmatic requests and future component,
command, or dialog requests all use this one function boundary. `board.request(request)` validates and
forwards the request when a dispatcher is configured; it never mutates source objects or treats an
accepted result as committed data.

The board records only bounded request identity/revision metadata needed to reconcile the next source
publication. Matching authoritative publication clears the pending metadata; contradictory publication
also clears it and renders the application value. No Phase A optimistic card/column visual is applied.
Capabilities are a reactive UX description only: a raw request remains constructible and reaches the
dispatcher even when a capability is denied, so the application remains the authorization boundary.

## Public documentation rule

Every exported entity receives durable JSDoc in junior-readable language, including invariants,
ownership, disposal obligations, failure behavior, and a practical example where useful. Comments
must not mention plan/RD/AR identifiers. The package README teaches the source → query → board path,
generic adapter use, application authority, responsive hosting, locale composition, limits, and Phase
A exclusions. The changelog records the initial unreleased surface.

## Compatibility rules

- Use discriminated unions with an explicit package-owned `kind` and a documented extension strategy.
- Never narrow `CardKey` by stringification.
- Do not expose internal cache/session-coordinator types.
- Do not reserve arbitrary unnamespaced consumer extension IDs.
- New optional fields may be added compatibly; required public fields or union member removals require
  semver-major policy after initial release.
- Packed consumer tests, not workspace resolution, prove the export map, declarations, runtime imports,
  and blocked private paths.
