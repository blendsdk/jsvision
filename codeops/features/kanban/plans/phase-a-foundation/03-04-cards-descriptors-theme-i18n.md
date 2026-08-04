# Technical specification: cards, descriptors, theme, and i18n

> **Document**: 03-04-cards-descriptors-theme-i18n.md
> **Parent**: [Index](00-index.md)
> **Decision sources**: PAR-13–PAR-16, PAR-23–PAR-24, PAR-32–PAR-34
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

The exact durable adapter and convenience model are:

```ts
export interface KanbanCardAdapter<TCard> {
  keyOf(card: TCard): CardKey;
  titleOf(card: TCard): string;
  statusOf(card: TCard): string;
  presentationRevisionOf?(card: TCard): KanbanRevision | undefined;
}

export interface StandardCard<TDate = unknown, TCustom = unknown> {
  readonly key: CardKey;
  readonly columnId: KanbanColumnId;
  readonly swimlaneId?: KanbanSwimlaneId;
  readonly rank?: string | number;
  readonly presentationRevision?: KanbanRevision;
  readonly title: string;
  readonly status: string;
  readonly description?: string;
  readonly type?: string;
  readonly priority?: string;
  readonly assignees?: readonly StandardCardAssignee[];
  readonly labels?: readonly StandardCardLabel[];
  readonly startDate?: TDate;
  readonly dueDate?: TDate;
  readonly estimate?: string;
  readonly value?: string;
  readonly checklists?: readonly StandardCardChecklist[];
  readonly summaries?: readonly StandardCardSummary[];
  readonly custom?: TCustom;
}

export interface StandardCardAssignee { readonly id: string; readonly label: string }
export interface StandardCardLabel { readonly id: string; readonly label: string }
export interface StandardCardChecklist {
  readonly checklistId: KanbanChecklistId;
  readonly title?: string;
  readonly items: readonly StandardCardChecklistItem[];
}
export interface StandardCardChecklistItem {
  readonly itemId: string;
  readonly text: string;
  readonly completed: boolean;
}
export interface StandardCardSummary {
  readonly fieldId: KanbanFieldId;
  readonly label: string;
  readonly value: string;
}
```

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

The exact render and descriptor surface is:

```ts
export type KanbanCardDensity = 'compact' | 'comfortable' | 'spacious';
export type KanbanCardOperationState = 'idle' | 'grabbed' | 'pending' | 'rejected';
export interface KanbanCardTerminalCapabilities {
  readonly colorDepth: ColorDepth;
  readonly widthMode: WidthMode;
  readonly boxDrawing: boolean;
  readonly ambiguousWide: boolean;
}
export interface KanbanCardFormattingContext {
  readonly locale: string;
  readonly formatNumber: (value: number | bigint) => string;
  readonly formatDate: (value: unknown) => string | undefined;
}
export interface KanbanCardRenderContext {
  readonly cardKey: CardKey;
  readonly presentationRevision?: KanbanRevision;
  readonly width: number;
  readonly rowBudget: number;
  readonly density: KanbanCardDensity;
  readonly focused: boolean;
  readonly selected: boolean;
  readonly readOnly: boolean;
  readonly operation: KanbanCardOperationState;
  readonly theme: Readonly<KanbanTheme>;
  readonly capabilities: Readonly<KanbanCardTerminalCapabilities>;
  readonly formatting: Readonly<KanbanCardFormattingContext>;
}
export interface KanbanCardRenderer<TCard> {
  render(card: TCard, context: KanbanCardRenderContext): KanbanCardDescriptor;
}

export type KanbanCardSectionKind =
  | 'title' | 'status' | 'metadata' | 'labels' | 'summary'
  | 'checklist-progress' | 'checklist-preview' | 'feedback' | 'custom';
export type KanbanCardCue = 'focused' | 'selected' | 'read-only' | 'grabbed' | 'pending' | 'rejected';
export interface KanbanCardSpan {
  readonly column: number;
  readonly text: string;
  readonly role: KanbanThemeRole;
}
export interface KanbanCardRow {
  readonly section: KanbanCardSectionKind;
  readonly spans: readonly KanbanCardSpan[];
}
export interface KanbanCardMarker {
  readonly row: number;
  readonly column: number;
  readonly glyph: string;
  readonly role: KanbanThemeRole;
  readonly cues: readonly KanbanCardCue[];
}
export interface KanbanCardSection {
  readonly id: string;
  readonly kind: KanbanCardSectionKind;
  readonly startRow: number;
  readonly rowCount: number;
  readonly priority: number;
}
export interface KanbanCardAction {
  readonly actionId: KanbanExtensionId;
  readonly label: string;
  readonly enabled: boolean;
}
export interface KanbanCardRegion {
  readonly regionId: string;
  readonly kind: 'section' | 'action';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly actionId?: KanbanExtensionId;
}
export interface KanbanCardDegradation {
  readonly level: 'none' | 'reduced' | 'minimum' | 'fallback';
  readonly omittedSections: readonly KanbanCardSectionKind[];
}
export interface KanbanCardDescriptor {
  readonly cardKey: CardKey;
  readonly presentationRevision?: KanbanRevision;
  readonly width: number;
  readonly measuredHeight: number;
  readonly surfaceRole: KanbanThemeRole;
  readonly borderRole: KanbanThemeRole;
  readonly marker: KanbanCardMarker;
  readonly rows: readonly KanbanCardRow[];
  readonly sections: readonly KanbanCardSection[];
  readonly actions: readonly KanbanCardAction[];
  readonly regions: readonly KanbanCardRegion[];
  readonly degradation: KanbanCardDegradation;
}
```

The pure and guarded entry points are:

```ts
export function createStandardKanbanCardAdapter<TDate = unknown, TCustom = unknown>():
  KanbanCardAdapter<StandardCard<TDate, TCustom>>;
export function renderStandardKanbanCard<TCard>(
  card: TCard,
  adapter: KanbanCardAdapter<TCard>,
  context: KanbanCardRenderContext,
): KanbanCardDescriptor;
export function validateKanbanCardDescriptor(
  descriptor: KanbanCardDescriptor,
  context: KanbanCardRenderContext,
): void;
export function createFallbackKanbanCardDescriptor(
  context: KanbanCardRenderContext,
  labels: KanbanCardFallbackLabels,
): KanbanCardDescriptor;
export function renderKanbanCardSafely<TCard>(
  card: TCard,
  renderer: KanbanCardRenderer<TCard>,
  context: KanbanCardRenderContext,
  options: KanbanSafeRenderOptions,
): KanbanCardDescriptor;
```

`KanbanCardFallbackLabels` contains only bounded localized `invalidCardTitle` and `unknownStatus`
strings. `KanbanSafeRenderOptions` contains those labels plus an optional observation sink. The safe
wrapper validates, detaches, and freezes renderer output. It alone catches renderer/validation errors,
emits one `card-render-failed` renderer-scoped observation carrying only the already-validated card key,
and returns the package fallback. Identity extraction happens before rendering; a failing `keyOf`
cannot synthesize an index-based identity.

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

Publish the following exhaustive ordered tuple and derived union. The dotted values are package-local
semantic identities, not Core `Theme` property names or an open extension namespace.

```ts
export const KANBAN_THEME_ROLES = Object.freeze([
  'board.surface',
  'column.surface', 'column.header', 'column.header.focused', 'column.separator',
  'swimlane.surface', 'swimlane.header', 'swimlane.header.focused', 'swimlane.separator',
  'card.normal', 'card.focused', 'card.selected', 'card.focused-selected', 'card.read-only',
  'card.grabbed', 'card.source-placeholder', 'card.ghost',
  'drop-target.valid', 'drop-target.warning', 'drop-target.invalid',
  'operation.pending', 'operation.rejected',
  'wip.warning', 'wip.error', 'dod.indicator',
  'state.loading', 'state.refreshing', 'state.partial', 'state.empty', 'state.error', 'state.retry',
  'content.title', 'content.status', 'content.metadata', 'content.label', 'content.summary',
  'checklist.complete', 'checklist.incomplete', 'checklist.progress',
] as const);
export type KanbanThemeRole = (typeof KANBAN_THEME_ROLES)[number];
```

The inventory covers these stable role families:

| Family | Roles declared in Phase A contract |
|---|---|
| Surfaces | board, column, swimlane, separators, focused header/group |
| Cards | normal, focused, selected, focused+selected, read-only |
| Operations | grabbed, source placeholder, ghost, valid/warning/invalid target, pending, rejected |
| Policy/state | WIP warning/error, DoD, loading, refreshing, partial, empty, error, retry |
| Content | title, status, metadata, labels, summaries, checklist complete/incomplete/progress |

The exact durable palette and resolution surface is:

```ts
export type KanbanNonColorCue =
  | { readonly kind: 'marker'; readonly glyph: string }
  | { readonly kind: 'border'; readonly style: 'single' | 'double' | 'heavy' | 'dashed' }
  | { readonly kind: 'attribute'; readonly attrs: AttrMask }
  | { readonly kind: 'text'; readonly prefix: string };

export interface KanbanThemeToken {
  readonly style: ThemeRole;
  readonly mappedFallback: ThemeRole;
  readonly terminalFallback: ThemeRole;
  readonly cues: readonly [KanbanNonColorCue, ...KanbanNonColorCue[]];
}
export interface KanbanTheme {
  readonly contractVersion: 1;
  readonly roles: Readonly<Record<KanbanThemeRole, KanbanThemeToken>>;
}
export type KanbanThemeOverrides = Readonly<
  Partial<Record<KanbanThemeRole, Readonly<Partial<ThemeRole>>>>
>;
export interface KanbanThemeResolutionReport {
  readonly rejected: readonly string[];
  readonly adjustments: readonly {
    readonly path: string;
    readonly reason: 'minimum-contrast' | 'capability-fallback' | 'unknown-role';
  }[];
}
export interface ResolvedKanbanTheme {
  readonly theme: KanbanTheme;
  readonly report: KanbanThemeResolutionReport;
}
export interface KanbanResolvedThemeRole {
  readonly role: KanbanThemeRole;
  readonly style: ThemeRole;
  readonly cues: readonly [KanbanNonColorCue, ...KanbanNonColorCue[]];
  readonly fallback: 'none' | 'mapped-core' | 'family' | 'emergency';
  readonly contrastRatio?: number;
}

export function resolveKanbanTheme(
  coreTheme: Theme,
  overrides?: KanbanThemeOverrides,
): ResolvedKanbanTheme;
export function createKanbanTheme(coreTheme: Theme, overrides?: KanbanThemeOverrides): KanbanTheme;
export function resolveKanbanThemeRole(
  theme: KanbanTheme,
  requestedRole: unknown,
  fallbackRole: KanbanThemeRole,
  capabilities: Pick<CapabilityProfile, 'colorDepth'> & { readonly noColor?: boolean },
): KanbanResolvedThemeRole;
```

`createKanbanTheme` returns exactly `resolveKanbanTheme(...).theme`. Resolution reads only the fixed
schema, invokes no accessors, never retains caller-owned objects, and deeply freezes the result. Unknown
or malformed overrides are named only by bounded semantic path in `report.rejected`, do not partially
apply, and fall back safely instead of throwing. A dynamic status style resolver returns only a
`KanbanThemeRole | undefined`; an unknown value or exception is observed locally by its caller and uses
the required allowlisted `fallbackRole`. Theme revision belongs to the reactive board projection and is
not caller-controlled palette data.

`KanbanThemeResolutionReport.adjustments` records only palette-level repairs made while the immutable
theme is created; it is empty when no such repair occurs in Phase A. Later capability-specific role
selection reports its own effective fallback stage and optional contrast ratio through
`KanbanResolvedThemeRole`, so it does not mutate or retroactively annotate the creation report.

Phase A actively consumes board, column/header/separator, card normal/focused, title, status,
loading/refreshing/partial/empty/error/retry roles. Remaining roles are stable, documented mappings ready
for later behavior; they are not evidence that those states are implemented.

Resolution follows application status semantic role → explicit Kanban token override → mapped Core
role → terminal/family fallback. Exact Core mapping is surfaces/content → `listNormal`; headers →
`tableHeader`; focused → `listFocused`; selected → `listSelected`; read-only → `buttonDisabled`;
separators → `listDivider`; pending/progress → `progressFill`/`progressTrack`; warning/WIP warning →
`warningText`; rejected/invalid/error/WIP error → `dangerText`; grabbed/source-placeholder/ghost →
`splitterDragging`; and status feedback → `statusBar`. Focused-selected tries `listFocused` then
`listSelected`.

Every token carries at least one non-color cue. Truecolor, 256-color, and 16-color mandatory text uses
the effective-depth 4.5 chain already fixed by RD-13 and ends at canonical black-on-white when every
theme-derived pair is unsafe. Monochrome/`noColor` retains mapped attributes and cues and omits
`contrastRatio`; it never claims a numeric ratio. Phase A verifies safe malformed-input handling, role
allowlisting, basic color-depth mappings, and monochrome cues. The complete quantized contrast matrix and
every later rendered state remain Phase E completion evidence.

## Catalog contract

Authored locale source follows the repository generator contract: `src/i18n/catalog.ts` owns the schema,
English fallback, and composition helpers; `src/i18n/locales.ts` owns the ten typed catalog values. The
generator alone owns `src/locales/*.ts` wrappers. The main entry exports the catalog schema/type and
English default catalog. Locale subpaths export type-compatible named constants:

```text
kanbanEn, kanbanNl, kanbanDe, kanbanFr, kanbanEs,
kanbanIt, kanbanPtPT, kanbanPl, kanbanRo, kanbanSv
```

The exact Phase A catalog surface is:

```ts
export interface KanbanMessageMap {
  readonly 'kanban.board.label': Message;
  readonly 'kanban.board.no-columns': Message;
  readonly 'kanban.state.loading': Message;
  readonly 'kanban.state.refreshing': Message;
  readonly 'kanban.state.partial': Message;
  readonly 'kanban.state.empty': Message;
  readonly 'kanban.state.error': Message;
  readonly 'kanban.action.retry': Message;
  readonly 'kanban.layout.minimum-size': Message;
  readonly 'kanban.count.unknown': Message;
  readonly 'kanban.count.truncated': Message;
  readonly 'kanban.focused-column.previous': Message;
  readonly 'kanban.focused-column.next': Message;
  readonly 'kanban.focused-column.position': Message;
  readonly 'kanban.card.invalid-title': Message;
  readonly 'kanban.card.unknown-status': Message;
  readonly 'kanban.reason.source-unavailable': Message;
  readonly 'kanban.reason.renderer-unavailable': Message;
}

export const KANBAN_PLACEHOLDER_MANIFEST: PlaceholderManifest;
export const KANBAN_ACCELERATOR_MANIFEST: AcceleratorManifest;
export const KANBAN_ENGLISH_MESSAGES: KanbanMessageMap;
export const KANBAN_ENGLISH_CATALOG: Catalog;
export function createEnglishKanbanI18n(): I18n;
```

English values are respectively `Kanban board`, `No columns`, `Loading…`, `Refreshing…`, `Some cards
are unavailable`, `No cards`, `Could not load the board`, `Retry`, `Kanban needs at least ${width} ×
${height} cells`, `Count unknown`, `${count} or more`, `Previous column`, `Next column`, `Column
${current} of ${total}`, `Invalid card`, `Unknown status`, `Source unavailable`, and `Card unavailable`.
The placeholder manifest contains only minimum size (`width`, `height`), truncated count (`count`), and
focused-column position (`current`, `total`). The Phase A accelerator manifest has an empty frozen scope
list because this slice has no translated mnemonic-bearing control group.

Applications compose the chosen catalog through existing `I18n`; English is the fallback. The main
entry exports the typed schema, manifests, English messages/catalog, and English factory but does not
eagerly import the nine non-English catalogs. `src/i18n/locales.ts` owns all ten complete typed catalog
values. Each explicit generated locale subpath exports exactly its named constant, with no default export
or global registration. Locale modules perform no filesystem, network, or host work.

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
