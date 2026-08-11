<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:update`. Source: @jsvision/* JSDoc. -->

# API — @jsvision/kanban — responsive terminal task boards

Board and viewport composition, generic sources, cards, themes, localization, and application authority.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import these symbols from `@jsvision/kanban`. For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## BuildKanbanSceneOptions

Options accepted by the canonical scene builder's untrusted pure boundary.

```ts
interface BuildKanbanSceneOptions {
  revision: KanbanRevision;   // Equality-only scene revision.
  queryGeneration: number;   // Active query generation.
  sessionRevision: KanbanRevision;   // Owning query-session revision.
  columns: readonly unknown[];   // Source-ordered workflow-column metadata.
  swimlanes: readonly unknown[];   // Source-ordered visible swimlane metadata.
  cells: readonly unknown[];   // Occupied or explicitly retained source cells.
  detached: unknown;   // Hidden and collapsed evidence retained outside visible scene nodes.
  descriptorLimit: number;   // Maximum resident descriptors allowed in the completed scene.
}
```

## CalculateKanbanSceneDamageOptions

Inputs for one bounded canonical-scene damage comparison.

```ts
interface CalculateKanbanSceneDamageOptions {
  previousScene: KanbanScene;   // Previous immutable semantic scene.
  currentScene: KanbanScene;   // Current immutable semantic scene.
  previousGeometry: KanbanSceneGeometry;   // Previous exact scene geometry.
  currentGeometry: KanbanSceneGeometry;   // Current exact scene geometry.
  bounds: Readonly<Rect>;   // Viewport-local clipping rectangle.
  maximumRegions: number;   // Finite retained region ceiling.
}
```

## CardKey

A stable application-owned card identity.

```ts
type CardKey = string | number
```

## ClampKanbanScrollOptions

Inputs for clamping a two-axis scroll position to live extents.

```ts
interface ClampKanbanScrollOptions {
  offsets: KanbanViewportPoint;   // Requested offsets in terminal cells.
  extents: KanbanViewportPoint;   // Greatest live offsets in terminal cells.
}
```

## CreateKanbanVerticalHeightProjectionOptions

Inputs for creating one bounded immutable height projection.

```ts
interface CreateKanbanVerticalHeightProjectionOptions {
  index: KanbanSparseHeightIndex;   // Mutable sparse index sampled synchronously into detached evidence.
  cards: readonly Pick<KanbanVerticalHeightProjectionRow, 'cardKey' | 'logicalIndex'>[];   // Source-ordered retained card identities and their global logical positions.
}
```

## EagerKanbanSourceOptions

Public options shared by every query session opened from one eager source.

```ts
interface EagerKanbanSourceOptions<TCard> {
  columns: () => readonly KanbanColumnMeta[];   // Reactive ordered workflow-column metadata getter.
  swimlanes?: () => readonly KanbanSwimlaneMeta[];   // Optional reactive ordered swimlane metadata getter.
  keyOf: (card: TCard) => CardKey;   // Stable application-owned card identity adapter.
  columnOf: (card: TCard) => KanbanColumnId;   // Workflow-column identity adapter.
  search?: (card: TCard, term: string) => boolean;   // Optional bounded plain-text search predicate required by non-empty search queries.
  revision?: () => KanbanRevision;   // Optional reactive application revision for in-place card-field changes.
  compare?: (left: TCard, right: TCard) => number;   // Optional stable source-order comparator used when no query sort is active.
  groupingFields?: readonly KanbanGroupingField<TCard>[];   // Optional semantic grouping adapters.
  filterFields?: readonly KanbanFilterField<TCard>[];   // Optional semantic filter adapters.
  sortFields?: readonly KanbanSortField<TCard>[];   // Optional semantic sort adapters.
  summaries?: readonly KanbanSummaryAdapter<TCard>[];   // Optional numeric header-summary adapters.
  limits?: import('../contract/limits.js').KanbanLimitOptions;   // Optional lower per-instance resource limits.
  observe?: (observation: KanbanObservation) => void;   // Optional sink for already-redacted eager-source observations.
}
```

## EvaluateKanbanMoveEligibilityInput

Complete input contract for the pure move-eligibility pipeline.

```ts
interface EvaluateKanbanMoveEligibilityInput {
  proposal: KanbanCardMoveProposal;   // Exact immutable semantic move proposal.
  current: KanbanMoveCurrentAuthority;   // Current bounded structure, revision, and placement authority.
  expected: unknown;   // Coordinator-captured equality revisions.
  capability: KanbanMoveCapability;   // Presentation-only move capability.
  selection: KanbanMoveSelection;   // Atomic local or unrepresentable server selection.
  ordering: unknown;   // Current sort/filter placement policy evidence.
  transition: unknown;   // Output from the pure transition evaluator.
  definitionOfDone: unknown;   // Output from the definition-of-done policy.
  wip: unknown;   // Output from the pure WIP evaluator.
  unchanged: boolean;   // Whether the proposal returns cards to the unchanged semantic interval.
}
```

## EvaluateKanbanWipInput

Complete immutable input to one pure WIP policy evaluation.

```ts
interface EvaluateKanbanWipInput {
  policy: KanbanWipPolicy;   // Validated min/max workflow policy.
  authoritativeCount: KanbanCount;   // Authoritative count unaffected by the active query filter.
  matchingCount: KanbanCount;   // Separately qualified count matching the active query.
  doneCount: KanbanCount;   // Authoritative completed-card count used only when done cards are excluded.
  proposedDelta: number;   // Signed count change represented by the proposed operation.
}
```

## KANBAN_ACCELERATOR_MANIFEST

Accelerator topology owned by the Phase A Kanban vocabulary.

```ts
const KANBAN_ACCELERATOR_MANIFEST: AcceleratorManifest
```

## KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH

Default maximum width of one Kanban column surface, excluding its separator.

```ts
const KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH: 32
```

## KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH

Default minimum width of one Kanban column surface, excluding its separator.

```ts
const KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH: 18
```

## KANBAN_DEFAULT_COLUMN_PREFERRED_WIDTH

Default preferred width of one Kanban column surface, excluding its separator.

```ts
const KANBAN_DEFAULT_COLUMN_PREFERRED_WIDTH: 24
```

## KANBAN_DEFAULT_SWIMLANE_RAIL_WIDTH

Default terminal-cell width reserved by the built-in swimlane rail.

```ts
const KANBAN_DEFAULT_SWIMLANE_RAIL_WIDTH: 10
```

## KANBAN_ENGLISH_CATALOG

Complete immutable English fallback catalog for `@jsvision/kanban`.

```ts
const KANBAN_ENGLISH_CATALOG: Catalog
```

## KANBAN_ENGLISH_MESSAGES

Canonical English messages used by the package catalog and safe application defaults.

```ts
const KANBAN_ENGLISH_MESSAGES: Readonly<{ 'kanban.board.label': string; 'kanban.board.no-columns': string; 'kanban.state.loading': string; 'kanban.state.refreshing': string; 'kanban.state.partial': string; 'kanban.state.empty': string; 'kanban.state.error': string; 'kanban.action.retry': string; 'kanban.layout.minimum-size': string; 'kanban.count.unknown': string; 'kanban.count.truncated': string; 'kanban.focused-column.previous': string; 'kanban.focused-column.next': string; 'kanban.focused-column.position': string; 'kanban.card.invalid-title': string; 'kanban.card.unknown-status': string; 'kanban.reason.source-unavailable': string; 'kanban.reason.renderer-unavailable': string; }>
```

## KANBAN_LIMITS

Complete deeply immutable Kanban resource-limit manifest.

```ts
const KANBAN_LIMITS: KanbanLimitManifest
```

## KANBAN_NEUTRAL_FOCUSED_DETAIL_SNAPSHOT

Frozen payload-free focused detail used when no eligible card or header is available.

```ts
const KANBAN_NEUTRAL_FOCUSED_DETAIL_SNAPSHOT: KanbanFocusedDetailSnapshot
```

## KANBAN_NEUTRAL_FOCUS_TARGET

Frozen board-state focus used before a usable scene selects a more specific target.

```ts
const KANBAN_NEUTRAL_FOCUS_TARGET: KanbanFocusTarget
```

## KANBAN_NEUTRAL_INTERACTION_SNAPSHOT

Frozen interaction snapshot used before an interaction controller publishes state.

```ts
const KANBAN_NEUTRAL_INTERACTION_SNAPSHOT: KanbanInteractionSnapshot
```

## KANBAN_OPEN_CARD_EDITOR_ACTION_ID

Stable package action emitted by read-only checklist regions to request the card editor.

```ts
const KANBAN_OPEN_CARD_EDITOR_ACTION_ID: KanbanExtensionId
```

## KANBAN_PHASE_B_ENGLISH_CATALOG

Immutable English overlay for labels first consumed by the richer board surface.

```ts
const KANBAN_PHASE_B_ENGLISH_CATALOG: Catalog
```

## KANBAN_PHASE_B_ENGLISH_MESSAGES

Canonical English messages introduced by the Phase B board surface.

```ts
const KANBAN_PHASE_B_ENGLISH_MESSAGES: Readonly<{ 'kanban.state.descriptor-limit': string; 'kanban.action.open-card-editor': string; 'kanban.card.feedback.pending': string; 'kanban.card.feedback.invalid': string; 'kanban.card.feedback.rejected': string; 'kanban.state.filtered-empty': string; 'kanban.state.collapsed': string; 'kanban.action.clear-filters': string; 'kanban.workflow.definition-of-done': string; 'kanban.workflow.wip-minimum-not-met': string; 'kanban.workflow.wip-maximum-exceeded': string; 'kanban.workflow.wip-count-unavailable': string; 'kanban.reason.transition-unavailable': string; 'kanban.swimlane.unavailable': string; 'kanban.interaction.navigation-pending': string; 'kanban.interaction.navigation-unavailable': string; 'kanban.interaction.navigation-error': string; 'kanban.interaction.selection-limit-exceeded': string; 'kanban.interaction.selection-pruned': string; 'kanban.interaction.selected-count': string; 'kanban.interaction.server-selection-active': string; 'kanban.interaction.unavailable': string; }>
```

## KANBAN_PHASE_B_PLACEHOLDER_MANIFEST

Exact placeholders accepted by first-use Phase B messages.

```ts
const KANBAN_PHASE_B_PLACEHOLDER_MANIFEST: PlaceholderManifest
```

## KANBAN_PHASE_C_ENGLISH_CATALOG

Immutable English overlay for Phase C drag, drop, pending, and outcome feedback.

```ts
const KANBAN_PHASE_C_ENGLISH_CATALOG: Catalog
```

## KANBAN_PHASE_C_ENGLISH_MESSAGES

Canonical English messages for modern pointer-drag and operation overlays.

```ts
const KANBAN_PHASE_C_ENGLISH_MESSAGES: Readonly<{ 'kanban.drag.card': "Moving card"; 'kanban.drag.cards': "Moving ${count} cards"; 'kanban.drop.allowed': "Move here"; 'kanban.drop.warning': "Move with warning"; 'kanban.drop.blocked': "Move blocked"; 'kanban.drop.unavailable': "Target unavailable"; 'kanban.operation.pending': "Move pending"; 'kanban.operation.accepted': "Awaiting board update"; 'kanban.operation.rejected': "Move rejected"; 'kanban.operation.cancelled': "Move cancelled"; 'kanban.operation.superseded': "Board changed"; 'kanban.operation.conflict': "Conflicting action unavailable"; 'kanban.operation.stale-placement': "Placement changed"; 'kanban.operation.sorted-placement': "Placed by current sort"; 'kanban.operation.filtered-placement': "Card may be filtered"; 'kanban.operation.transition-blocked': "Transition blocked"; 'kanban.operation.wip-blocked': "WIP limit blocks this move"; 'kanban.operation.definition-of-done': "Definition of done not met"; 'kanban.operation.reorder': "Reordering"; }>
```

## KANBAN_PHASE_C_PLACEHOLDER_MANIFEST

Exact placeholders accepted by Phase C drag and operation overlay messages.

```ts
const KANBAN_PHASE_C_PLACEHOLDER_MANIFEST: PlaceholderManifest
```

## KANBAN_PLACEHOLDER_MANIFEST

Exact placeholders accepted by parameterized Kanban messages.

```ts
const KANBAN_PLACEHOLDER_MANIFEST: PlaceholderManifest
```

## KANBAN_PRESENTATION_PRESETS

Canonical deeply frozen named presentation budgets.

```ts
const KANBAN_PRESENTATION_PRESETS: Readonly<Record<KanbanCardDensity, ResolvedKanbanPresentationBudget>>
```

## KANBAN_PRESENTATION_PRESET_DEFAULTS

Fixed named-preset defaults, kept separate from caller-adjustable safety ceilings.

```ts
const KANBAN_PRESENTATION_PRESET_DEFAULTS: KanbanPresentationPresetDefaultManifest
```

## KANBAN_STANDARD_CARD_FIELD_IDS

Stable field identities used by the standard-card presentation adapter.

```ts
const KANBAN_STANDARD_CARD_FIELD_IDS: Readonly<Record<StandardKanbanCardFieldName, KanbanFieldId>>
```

## KANBAN_STRUCTURE_PRESENTATION_LIMITS

Fixed additive structure/presentation budgets that preserve the original limit-manifest shape.

```ts
const KANBAN_STRUCTURE_PRESENTATION_LIMITS: KanbanStructurePresentationLimits
```

## KANBAN_THEME_ROLES

Closed ordered semantic-role inventory understood by Kanban descriptors and themes.

```ts
const KANBAN_THEME_ROLES: readonly ["board.surface", "column.surface", "column.header", "column.header.focused", "column.separator", "swimlane.surface", "swimlane.header", "swimlane.header.focused", "swimlane.separator", "card.normal", "card.focused", "card.selected", "card.focused-selected", "card.read-only", "card.grabbed", "card.source-placeholder", "card.ghost", "drop-target.valid", "drop-target.warning", "drop-target.invalid", "operation.pending", "operation.rejected", "wip.warning", "wip.error", "dod.indicator", "state.loading", "state.refreshing", "state.partial", "state.empty", "state.error", "state.retry", "content.title", "content.status", "content.metadata", "content.label", "content.summary", "checklist.complete", "checklist.incomplete", "checklist.progress"]
```

## KANBAN_TIMING_DEFAULTS

Package-owned deterministic interaction timings.

```ts
const KANBAN_TIMING_DEFAULTS: KanbanTimingDefaults
```

## KanbanActionScope

Closed semantic owner carried by one bounded pointer target.

```ts
type KanbanActionScope = | { readonly kind: 'board' }
  | { readonly kind: 'column'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'swimlane'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'cell'; readonly address: KanbanCellAddress }
  | { readonly kind: 'card'; readonly cardKey: CardKey; readonly address: KanbanCellAddress }
  | {
      readonly kind: 'state';
      readonly state: KanbanStructureStateCode;
      readonly address?: KanbanCellAddress;
    }
```

## KanbanActionTarget

Bounded actionable entry recomputed from the final clipped scene geometry.

```ts
interface KanbanActionTarget {
  kind: 'card-action' | 'card' | 'workflow-header' | 'swimlane-header' | 'state-action' | 'retry';   // Stable allowlisted target kind.
  scope: KanbanActionScope;   // Closed semantic owner containing no application record.
  zIndex: number;   // Deterministic overlap priority; larger values win.
  address?: KanbanCellAddress;   // Source cell that owns a card, state, or retry action.
  cardKey?: CardKey;   // Stable card identity for whole-card and descriptor-action targets.
  columnId?: KanbanColumnId;   // Stable column identity for workflow-header targets.
  swimlaneId?: KanbanSwimlaneId;   // Stable swimlane identity for swimlane-header targets.
  logicalIndex?: number;   // Global source position for a resident card target.
  actionId?: string;   // Bounded semantic action identity for descriptor and scoped action targets.
  regionId?: string;   // Descriptor-local region identity for a card action.
  state?: KanbanStructureStateCode;   // Structural state code for state and retry targets.
  reorder?: 'allowed' | 'blocked-derived';   // Header reorder availability; derived swimlanes remain explicitly blocked.
}
```

## KanbanActivateOptions

Options for programmatic or mounted focused-card activation.

```ts
interface KanbanActivateOptions {
  origin?: KanbanInteractionOrigin;   // Input channel; programmatic is used when omitted.
  scope?: Extract<KanbanActionScope, { readonly kind: 'card' }>;   // Explicit card scope; omission resolves the focused card after earlier queued work settles.
  actionId?: KanbanExtensionId;   // Optional descriptor action responsible for activation.
}
```

## KanbanBoard

Responsive DSL-composed Kanban shell that owns exactly one public viewport.

```ts
new KanbanBoard<TCard>(options: KanbanBoardOptions<TCard>)   // extends Group
// methods & signals:
viewport: KanbanViewport<TCard>
runPendingMounts(): void
inspection(): KanbanBoardInspection
interaction(): KanbanInteractionFacade
request(request: KanbanRequest | KanbanRequestProposal): Promise<KanbanRequestResult>
reconcilePublication(notice: KanbanPublicationNotice): void
operationSnapshot(): readonly KanbanOperationSnapshot[]
subscribeOperations(subscriber: KanbanOperationSubscriber): () => void
cancelOperation(operationId: KanbanOperationId): boolean
undo(operationId: KanbanOperationId): Promise<KanbanRequestResult>
scrollTo(target: KanbanScrollTarget): void
scrollBy(delta: KanbanScrollTarget): void
revealCard(key: CardKey, alignment?: KanbanRevealAlignment, options?: { readonly signal?: AbortSignal }): Promise<KanbanRevealResult>
dispose(): void
```

## KanbanBoardCounts

Board-wide counts published atomically by one query session.

```ts
interface KanbanBoardCounts {
  total: KanbanCount;   // Authoritative cards before local query projection.
  matching: KanbanCount;   // Cards matching the active semantic query.
  loaded: KanbanCount;   // Matching cards currently resident in memory.
  visible: KanbanCount;   // Cards currently projected into the viewport.
  selected: KanbanCount;   // Application-selected cards when that count is known.
  wip: KanbanCount;   // Authoritative work-in-progress count when supplied by the application.
}
```

## KanbanBoardInspection

Detached board-level composition, identity, and viewport evidence.

```ts
interface KanbanBoardInspection {
  label: string;   // Localized accessible board label.
  state: KanbanBoardState;   // Current localized board/source state.
  navigator: KanbanBoardNavigatorInspection;   // Conditional focused-column navigator evidence.
  viewportRect: Readonly<Rect>;   // Current parent-relative viewport rectangle.
  layoutReflows: number;   // Semantic one-reflow invalidation count for responsive/reactive binding changes.
  identity: KanbanIdentityInput;   // Detached reconciled application identity hints.
  pendingOperations: readonly KanbanPublicationExpectation[];   // Accepted operations awaiting authoritative source publication.
  clearedPublication?: KanbanPublicationNotice;   // Most recent publication notice that cleared pending metadata.
}
```

## KanbanBoardNavigatorInspection

Conditional focused-column navigator evidence.

```ts
interface KanbanBoardNavigatorInspection {
  visible: boolean;   // Whether the one-row navigator currently consumes layout space.
  columnId?: string;   // Active source column in focused mode.
  position?: number;   // One-based source-order position.
  total?: number;   // Complete visible-column count.
}
```

## KanbanBoardOptions

Construction options for the responsive board shell and application authority seam.

```ts
interface KanbanBoardOptions<TCard> {
  identity?: () => KanbanIdentityInput;   // Optional compatibility seed captured once during construction for the default controller's mount.
  dispatcher?: KanbanRequestDispatcher;   // Optional application-owned request dispatcher; read projection never depends on it.
  confirmOperation?: KanbanConfirmer;   // Optional confirmation callback for warning and destructive operation proposals.
  resolveUndo?: KanbanInverseRequestBuilder;   // Optional resolver that turns an opaque committed undo token into a fresh proposal.
  operationId?: KanbanOperationIdFactory;   // Optional application operation-ID factory for lifecycle-free standard proposals.
  operationEligibility?: (proposal: KanbanRequestProposal) => KanbanEligibility;   // Optional pure current-policy evaluator shared by programmatic proposal and confirmation paths.
  interactionFactory?: KanbanInteractionControllerFactory;   // Optional mount factory replacing the package default interaction controller.
  onInteraction?: KanbanInteractionHandler;   // Optional synchronous receiver for immutable, non-mutation semantic interaction intents.
  drag?: KanbanDragConfiguration;   // Optional bounded threshold configuration for board-owned card and structural drags.
}
```

## KanbanBoardState

Localized board-wide state shown by the board shell.

```ts
type KanbanBoardState = | { readonly kind: 'no-columns'; readonly label: string }
  | { readonly kind: 'minimum-size'; readonly label: string }
  | { readonly kind: KanbanSourceState['kind']; readonly label: string }
```

## KanbanBuiltInActionId

Package-owned scoped actions with stable semantics across hosts.

```ts
type KanbanBuiltInActionId = 'collapse' | 'clear-filters' | 'configure' | 'add-card'
```

## KanbanCapabilities

Reactive capability snapshot supplied by the host application.

```ts
interface KanbanCapabilities {
  extensions?: Readonly<Partial<Record<KanbanExtensionId, KanbanCapabilityDescription>>>;   // Per-extension UX descriptions; an absent entry is presented as allowed.
}
```

## KanbanCapabilityDescription

Immutable UX description for one application-owned extension.

```ts
interface KanbanCapabilityDescription {
  state: KanbanCapabilityState;   // Whether a component may present the action as available, disabled, or hidden.
  reasonCode?: string;   // Optional stable application reason code for diagnostics or localization.
  label?: string;   // Optional sanitized display label.
}
```

## KanbanCapabilityState

Presentation state for one application extension action.

```ts
type KanbanCapabilityState = 'allowed' | 'disabled' | 'hidden'
```

## KanbanCardAction

Declarative card command advertised by a custom renderer.

```ts
interface KanbanCardAction {
  actionId: KanbanExtensionId;   // Application-namespaced action identity.
  label: string;   // Sanitized localized label.
  enabled: boolean;   // Whether input may currently invoke the action.
}
```

## KanbanCardAdapter

Pure presentation getters that adapt an application-owned record to mandatory card semantics.

```ts
interface KanbanCardAdapter<TCard> {
  keyOf(card: TCard): CardKey;   // Returns the stable application-owned identity without string coercion.
  titleOf(card: TCard): string;   // Returns the mandatory card title.
  statusOf(card: TCard): string;   // Returns the mandatory application-formatted status.
  presentationRevisionOf?(card: TCard): KanbanRevision | undefined;   // Optionally returns an equality-only revision for presentation-affecting values.
}
```

## KanbanCardAdapterSnapshot

Detached mandatory presentation values read from one application card.

```ts
interface KanbanCardAdapterSnapshot {
  cardKey: CardKey;   // Validated card identity with number/string distinction preserved.
  title: string;   // Bounded non-empty title awaiting output sanitization.
  status: string;   // Bounded non-empty status awaiting output sanitization.
  presentationRevision?: KanbanRevision;   // Optional validated equality-only presentation revision.
}
```

## KanbanCardArchiveProposal

Archive one card through application-owned persistence.

```ts
interface KanbanCardArchiveProposal {
  kind: 'card-archive';   // Request discriminator.
  cardKey: CardKey;   // Stable identity of the card to archive.
}
```

## KanbanCardCreateProposal

Add one application-schema card to a semantic cell.

```ts
interface KanbanCardCreateProposal {
  kind: 'card-create';   // Request discriminator.
  target: KanbanCellAddress;   // Semantic destination cell for the new card.
  draft: KanbanSemanticValue;   // Bounded application-schema data used to create the card.
}
```

## KanbanCardCue

Non-color card state represented by a marker or equivalent visual cue.

```ts
type KanbanCardCue = 'focused' | 'selected' | 'read-only' | 'grabbed' | 'pending' | 'rejected'
```

## KanbanCardDegradation

Inspectable record of content omitted to fit available geometry.

```ts
interface KanbanCardDegradation {
  level: 'none' | 'reduced' | 'minimum' | 'fallback';   // Overall amount of presentation reduction.
  omittedSections: readonly KanbanCardSectionKind[];   // Semantic sections intentionally left out of this projection.
}
```

## KanbanCardDeleteProposal

Permanently delete one card through application-owned persistence.

```ts
interface KanbanCardDeleteProposal {
  kind: 'card-delete';   // Request discriminator.
  cardKey: CardKey;   // Stable identity of the card to delete permanently.
}
```

## KanbanCardDensity

Supported vertical spacing policies for a rendered card.

```ts
type KanbanCardDensity = 'compact' | 'comfortable' | 'spacious'
```

## KanbanCardDescriptor

Immutable, renderer-neutral description of one terminal card.

```ts
interface KanbanCardDescriptor {
  cardKey: CardKey;   // Stable application-owned card identity.
  presentationRevision?: KanbanRevision;   // Equality-only revision used to create this descriptor.
  width: number;   // Exact width in terminal cells.
  measuredHeight: number;   // Number of rows occupied by this descriptor.
  surfaceRole: KanbanThemeRole;   // Semantic role for the card interior.
  borderRole: KanbanThemeRole;   // Semantic role for the stable card boundary.
  marker: KanbanCardMarker;   // Non-color state marker.
  rows: readonly KanbanCardRow[];   // Styled terminal rows.
  sections: readonly KanbanCardSection[];   // Semantic section geometry.
  actions: readonly KanbanCardAction[];   // Declarative card actions.
  regions: readonly KanbanCardRegion[];   // Mouse hit-test regions.
  degradation: KanbanCardDegradation;   // Content omitted because of available geometry.
}
```

## KanbanCardDuplicateProposal

Duplicate one card into an exact semantic destination.

```ts
interface KanbanCardDuplicateProposal {
  kind: 'card-duplicate';   // Request discriminator.
  cardKey: CardKey;   // Stable identity of the source card.
  target: KanbanCellAddress;   // Semantic destination cell for the copy.
  position: KanbanMovePosition;   // Revision-bound semantic destination interval.
}
```

## KanbanCardFallbackLabels

Localized bounded labels used when a renderer cannot produce a safe descriptor.

```ts
interface KanbanCardFallbackLabels {
  invalidCardTitle: string;   // Title displayed instead of invalid or unavailable application content.
  unknownStatus: string;   // Status displayed instead of invalid or unavailable application content.
}
```

## KanbanCardField

Generic application-owned field projection understood by the standard snapshot boundary.

```ts
type KanbanCardField<TCard> = | (KanbanCardFieldBase & {
      readonly kind: 'text';
      readonly valueOf: (card: TCard) => string | undefined;
      readonly format?: (value: string, context: KanbanCardFormattingContext) => string | undefined;
    })
  | (KanbanCardFieldBase & {
      readonly kind: 'number';
      readonly valueOf: (card: TCard) => number | bigint | undefined;
      readonly format?: (value: number | bigint, context: KanbanCardFormattingContext) => string | undefined;
    })
  | (KanbanCardFieldBase & {
      readonly kind: 'date';
      readonly valueOf: (card: TCard) => unknown;
      readonly format?: (value: unknown, context: KanbanCardFormattingContext) => string | undefined;
    })
  | (KanbanCardFieldBase & {
      readonly kind: 'labels';
      readonly valueOf: (card: TCard) => readonly string[] | undefined;
      readonly format?: (
        value: readonly string[],
        context: KanbanCardFormattingContext,
      ) => readonly string[] | undefined;
    })
```

## KanbanCardFieldBase

Shared identity, label, priority, and semantic-role metadata for one field.

```ts
interface KanbanCardFieldBase {
  fieldId: KanbanFieldId;   // Stable application field identity.
  label: string;   // Display label sanitized at the snapshot boundary.
  priority: number;   // Non-negative priority used only when optional content must degrade.
  role?: KanbanThemeRole;   // Optional semantic text role.
}
```

## KanbanCardFieldKind

Supported value and formatter contracts for one optional metadata field.

```ts
type KanbanCardFieldKind = 'text' | 'number' | 'date' | 'labels'
```

## KanbanCardFieldSnapshot

Detached safe display values for one selected metadata field.

```ts
interface KanbanCardFieldSnapshot {
  fieldId: KanbanFieldId;   // Stable configured field identity.
  kind: KanbanCardFieldKind;   // Value and formatter contract used for the field.
  label: string;   // Sanitized non-empty field label.
  priority: number;   // Non-negative degradation priority.
  role?: KanbanThemeRole;   // Optional allowlisted semantic role.
  values: readonly string[];   // Detached sanitized display strings.
}
```

## KanbanCardFormattingContext

Bounded application formatting functions available to a card renderer.

```ts
interface KanbanCardFormattingContext {
  locale: string;   // Canonical application-selected locale used by the supplied formatters.
  formatNumber: (value: number | bigint) => string;   // Formats one finite number or bigint without changing its value.
  formatDate: (value: unknown) => string | undefined;   // Formats one opaque application date value, or declines it with `undefined`.
}
```

## KanbanCardKeyFor

Card-key type inferred from a conventional required `id` property.

```ts
type KanbanCardKeyFor<TCard> = TCard extends { readonly id: infer TCardKey extends CardKey }
  ? TCardKey
  : CardKey
```

## KanbanCardLocation

Revision-bound result of one optional, bounded card-identity lookup.

```ts
type KanbanCardLocation = | {
      readonly kind: 'found' | 'unloaded';
      readonly address: KanbanCellAddress;
      readonly index?: number;
      readonly placement?: KanbanPlacement;
      readonly sessionRevision: KanbanRevision;
    }
  | { readonly kind: 'unknown' | 'unsupported'; readonly sessionRevision: KanbanRevision }
```

## KanbanCardMarker

One-cell state marker retained when color is unavailable.

```ts
interface KanbanCardMarker {
  row: number;   // Zero-based descriptor row.
  column: number;   // Zero-based terminal-cell column.
  glyph: string;   // Sanitized glyph occupying exactly one terminal cell.
  role: KanbanThemeRole;   // Semantic theme role used to draw the marker.
  cues: readonly KanbanCardCue[];   // State distinctions redundantly conveyed by the marker.
}
```

## KanbanCardMovePositionInput

Caller-facing destination that is completed with current cursor revision evidence.

```ts
type KanbanCardMovePositionInput = { readonly kind: 'start' } | { readonly kind: 'end' }
```

## KanbanCardMoveProposal

Move one ordered, non-empty atomic card set to one semantic destination.

```ts
interface KanbanCardMoveProposal {
  kind: 'card-move';   // Request discriminator.
  moved: readonly KanbanMovedCardSnapshot[];   // Ordered non-empty atomic card set with captured source evidence.
  target: KanbanCellAddress;   // Semantic destination cell shared by the atomic card set.
  position: KanbanMovePosition;   // Revision-bound semantic destination interval.
  viewRevision?: KanbanRevision;   // Optional projection revision that must remain current.
}
```

## KanbanCardOperationState

Interaction or persistence state that can affect one card's presentation.

```ts
type KanbanCardOperationState = 'idle' | 'grabbed' | 'pending' | 'rejected'
```

## KanbanCardOperationSubject

Stable card identity affected or reserved by an operation.

```ts
interface KanbanCardOperationSubject {
  kind: 'card';   // Subject discriminator.
  cardKey: CardKey;   // Stable application-owned card identity.
}
```

## KanbanCardPresentationAdapter

Final-shaped generic adapter for rich standard-card presentation.

```ts
interface KanbanCardPresentationAdapter<TCard> {
  fields?: readonly KanbanCardField<TCard>[];   // Ordered configured metadata fields.
  summaries?: readonly KanbanCardSummary<TCard>[];   // Ordered configured aggregate summaries.
  checklistOf?: (card: TCard) => readonly KanbanChecklistGroup[];   // Reads ordered checklist groups once for one card snapshot.
  selectionOf?: (card: TCard) => KanbanCardPresentationSelection | undefined;   // Selects an optional reordered subset without changing numeric maxima.
  styleOf?: (card: TCard, state: KanbanCardVisualState) => KanbanCardStyleSelection;   // Resolves semantic style roles from card and detached visual state.
}
```

## KanbanCardPresentationMaximum

Validated view maximum against which one card selection is intersected.

```ts
interface KanbanCardPresentationMaximum {
  budget: ResolvedKanbanPresentationBudget;   // Resolved immutable numeric presentation budget.
  limits: KanbanResolvedLimits;   // Active immutable resource ceilings selected by the board.
  availableFieldIds: readonly KanbanFieldId[];   // Configured metadata fields available to this card.
  availableSummaryIds: readonly KanbanFieldId[];   // Configured summaries available to this card.
  availableChecklistIds: readonly KanbanChecklistId[];   // Configured checklist groups available to this card.
}
```

## KanbanCardPresentationSelection

Optional card-specific ordering and subset request.

```ts
interface KanbanCardPresentationSelection {
  fieldIds?: readonly KanbanFieldId[];   // Requested metadata field order and subset.
  summaryIds?: readonly KanbanFieldId[];   // Requested summary order and subset.
  checklistIds?: readonly KanbanChecklistId[];   // Requested checklist-group order and subset.
}
```

## KanbanCardPresentationSnapshot

Complete detached, deeply frozen standard-card presentation snapshot.

```ts
interface KanbanCardPresentationSnapshot {
  cardKey: CardKey;   // Validated application-owned card identity.
  presentationRevision?: KanbanRevision;   // Optional equality-only card presentation revision.
  title: string;   // Sanitized mandatory title.
  status: string;   // Sanitized mandatory status.
  fields: readonly KanbanCardFieldSnapshot[];   // Selected safe metadata fields.
  summaries: readonly KanbanCardSummarySnapshot[];   // Selected safe aggregate summaries.
  checklists: readonly KanbanChecklistGroup[];   // Selected safe read-only checklist groups.
  selection: ResolvedKanbanCardPresentationSelection;   // Resolved optional-section selection and unchanged numeric maxima.
  visualState: KanbanCardVisualState;   // Detached visual state used for style resolution.
  style: KanbanCardStyleSelection;   // Safe semantic style selection.
}
```

## KanbanCardPresentationSnapshotContext

Inputs required to detach one application card into safe presentation values.

```ts
interface KanbanCardPresentationSnapshotContext {
  maximum: KanbanCardPresentationMaximum;   // Resolved view maxima and configured optional-section identities.
  visualState: KanbanCardVisualState;   // Current card-local interaction state.
  formatting: KanbanCardFormattingContext;   // Application-owned locale formatting callbacks.
  observe?: (observation: KanbanObservation) => void;   // Optional payload-free observation sink.
  checklistValues?: unknown;   // Optional already-acquired checklist values used by convenience renderers to avoid a second getter call.
  selection?: KanbanCardPresentationSelection;   // Optional board-owned selection that takes precedence over the adapter's card-local selection getter.
}
```

## KanbanCardPublicationSubject

Card publication expected after an accepted application request.

```ts
interface KanbanCardPublicationSubject {
  kind: 'card';
  cardKey: CardKey;
  baselineRevision: KanbanRevision;
  expectedRevision: KanbanRevision;
}
```

## KanbanCardRegion

Bounded hit-test rectangle within a card descriptor.

```ts
interface KanbanCardRegion {
  regionId: string;   // Descriptor-local stable region identity.
  kind: 'section' | 'action';   // Semantic purpose of the rectangle.
  x: number;   // Zero-based terminal-cell column.
  y: number;   // Zero-based descriptor row.
  width: number;   // Positive width in terminal cells.
  height: number;   // Positive height in rows.
  actionId?: KanbanExtensionId;   // Action invoked by an action region.
}
```

## KanbanCardRenderContext

Bounded immutable values supplied to one pure card-render operation.

```ts
interface KanbanCardRenderContext {
  cardKey: CardKey;   // Stable application-owned card identity.
  presentationRevision?: KanbanRevision;   // Equality-only revision for presentation-affecting card data.
  width: number;   // Exact card width in terminal cells.
  rowBudget: number;   // Maximum rows the renderer may return.
  density: KanbanCardDensity;   // Requested card spacing density.
  focused: boolean;   // Whether the card owns keyboard focus.
  selected: boolean;   // Whether the card belongs to the active selection.
  readOnly: boolean;   // Whether mutation commands are disabled for this card.
  operation: KanbanCardOperationState;   // Current drag or persistence operation state.
  theme: Readonly<KanbanTheme>;   // Fully resolved semantic theme.
  capabilities: Readonly<KanbanCardTerminalCapabilities>;   // Terminal features used for deterministic rendering.
  formatting: Readonly<KanbanCardFormattingContext>;   // Application-owned locale formatters.
}
```

## KanbanCardRenderer

Pure application-supplied projection from a card to bounded terminal rows.

```ts
interface KanbanCardRenderer<TCard> {
  render(card: TCard, context: KanbanCardRenderContext): KanbanCardDescriptor;   // Produces one descriptor without mutating the card or render context.
}
```

## KanbanCardRequestProposal

Card and extension proposals implemented independently of structural editing.

```ts
type KanbanCardRequestProposal = | KanbanCardCreateProposal
  | KanbanCardUpdateProposal
  | KanbanCardDuplicateProposal
  | KanbanCardArchiveProposal
  | KanbanCardDeleteProposal
  | KanbanCardMoveProposal
```

## KanbanCardRow

One terminal row belonging to a semantic card section.

```ts
interface KanbanCardRow {
  section: KanbanCardSectionKind;   // Semantic section represented by this row.
  spans: readonly KanbanCardSpan[];   // Ordered non-overlapping styled spans.
}
```

## KanbanCardSection

Geometry and priority metadata for one semantic section.

```ts
interface KanbanCardSection {
  id: string;   // Descriptor-local stable section identity.
  kind: KanbanCardSectionKind;   // Semantic content category.
  startRow: number;   // First zero-based row occupied by the section.
  rowCount: number;   // Number of consecutive rows occupied by the section.
  priority: number;   // Lower values are retained first as space becomes constrained.
}
```

## KanbanCardSectionKind

Semantic content category used for degradation and layout decisions.

```ts
type KanbanCardSectionKind = | 'title'
  | 'status'
  | 'metadata'
  | 'labels'
  | 'summary'
  | 'checklist-progress'
  | 'checklist-preview'
  | 'feedback'
  | 'custom'
```

## KanbanCardSpan

One sanitized styled run positioned within a descriptor row.

```ts
interface KanbanCardSpan {
  column: number;   // Zero-based terminal-cell column.
  text: string;   // Sanitized single-line display text.
  role: KanbanThemeRole;   // Semantic theme role used to draw the text.
}
```

## KanbanCardStyleSelection

Optional semantic roles and glyph policy selected from card/application state.

```ts
interface KanbanCardStyleSelection {
  revision?: KanbanRevision;   // Optional equality-only style revision for descriptor caching.
  surfaceRole?: KanbanThemeRole;   // Optional card interior role.
  borderRole?: KanbanThemeRole;   // Optional card boundary role.
  markerRole?: KanbanThemeRole;   // Optional non-color marker role.
  titleRole?: KanbanThemeRole;   // Optional title role.
  statusRole?: KanbanThemeRole;   // Optional status role.
  textRole?: KanbanThemeRole;   // Optional general metadata role.
  glyphFamily?: 'automatic' | 'unicode' | 'ascii';   // Preferred safe glyph family.
}
```

## KanbanCardSummary

Generic application-owned aggregate projection for one standard card summary.

```ts
interface KanbanCardSummary<TCard> {
  summaryId: KanbanFieldId;   // Stable summary identity in the application field namespace.
  label: string;   // Display label sanitized at the snapshot boundary.
  priority: number;   // Non-negative priority used only when optional content must degrade.
  role?: KanbanThemeRole;   // Optional semantic summary role.
  valueOf: (card: TCard) => KanbanCardSummaryInput | undefined;   // Reads one bounded aggregate value without transferring card ownership.
  format?: (
    value: KanbanCardSummaryInput,
    context: KanbanCardFormattingContext,
  ) => KanbanCardSummaryValue | undefined;   // Optionally formats the unchanged aggregate input once.
}
```

## KanbanCardSummaryInput

Raw summary value accepted before optional formatting and validation.

```ts
type KanbanCardSummaryInput = string | number | bigint | KanbanCardSummaryValue
```

## KanbanCardSummarySnapshot

Detached bounded aggregate value for one selected summary.

```ts
interface KanbanCardSummarySnapshot {
  summaryId: KanbanFieldId;   // Stable configured summary identity.
  label: string;   // Sanitized non-empty summary label.
  priority: number;   // Non-negative degradation priority.
  role?: KanbanThemeRole;   // Optional allowlisted semantic role.
  text?: string;   // Optional sanitized aggregate text.
  count?: number;   // Optional non-negative safe-integer aggregate count.
}
```

## KanbanCardSummaryValue

Detached bounded summary result containing text, count, or both.

```ts
interface KanbanCardSummaryValue {
  text?: string;   // Optional application-formatted summary text.
  count?: number;   // Optional non-negative safe-integer aggregate count.
}
```

## KanbanCardTerminalCapabilities

Terminal features that affect text measurement and presentation fallback.

```ts
interface KanbanCardTerminalCapabilities {
  colorDepth: ColorDepth;   // Effective terminal color depth.
  widthMode: WidthMode;   // Width algorithm used for Unicode code points.
  boxDrawing: boolean;   // Whether box-drawing glyphs are safe to use.
  ambiguousWide: boolean;   // Whether ambiguous-width code points occupy two cells.
}
```

## KanbanCardUpdateProposal

Patch one application-schema card without exposing its record to the component.

```ts
interface KanbanCardUpdateProposal {
  kind: 'card-update';   // Request discriminator.
  cardKey: CardKey;   // Stable identity of the card to update.
  patch: KanbanSemanticValue;   // Bounded application-schema patch data.
}
```

## KanbanCardVisualState

Complete card-local interaction state available to semantic style selection.

```ts
interface KanbanCardVisualState {
  focused: boolean;   // Whether the card owns keyboard focus.
  selected: boolean;   // Whether the card belongs to the current selection.
  rangeAnchor: boolean;   // Whether the card is the range-selection anchor.
  readOnly: boolean;   // Whether mutation actions are disabled.
  invalid: boolean;   // Whether current application validation rejects the card.
  operation: KanbanCardOperationState;   // Current drag or persistence operation state.
}
```

## KanbanCellAddress

Collision-safe semantic address of one column/swimlane cell.

```ts
interface KanbanCellAddress {
  columnId: KanbanColumnId;   // Workflow column containing the cell.
  swimlaneId?: KanbanSwimlaneId;   // Optional horizontal grouping containing the cell.
}
```

## KanbanCellCounts

Counts scoped to one column/swimlane cell cursor.

```ts
interface KanbanCellCounts {
  total: KanbanCount;   // Authoritative cards assigned to the cell before local filtering.
  matching: KanbanCount;   // Cards in the cell that match the active query.
  loaded: KanbanCount;   // Matching cards from the cell that are currently resident.
}
```

## KanbanCellCursor

Sparse, independently disposable card reader for one semantic cell.

```ts
interface KanbanCellCursor<TCard> {
  state(): KanbanCellState;   // Returns the reactive cell lifecycle state.
  counts(): KanbanCellCounts;   // Returns honest reactive counts for this cell.
  length(): KanbanKnownLength;   // Returns exact, lower-bound, or unknown logical length knowledge.
  cardAt(index: number): TCard | undefined;   // Returns a resident application card or `undefined` for an unloaded slot.
  ensureRange(start: number, end: number, options?: { readonly signal?: AbortSignal }): Promise<void>;   // Acquires one bounded half-open logical range.
  revision(): KanbanRevision;   // Returns the equality-only revision governing reads and placements.
  placementAt(slot: number): KanbanPlacement;   // Returns a revision-bound semantic insertion placement for one logical slot.
  retry(): Promise<void> | void;   // Retries the cursor's scoped error, when available.
  dispose(): void;   // Releases source work and retained application card references idempotently.
}
```

## KanbanCellState

Reactive lifecycle state published by one sparse cell cursor.

```ts
type KanbanCellState = | { readonly kind: 'loading' | 'ready' | 'refreshing' | 'partial' | 'empty' }
  | {
      readonly kind: 'error';
      readonly code: string;
      readonly label?: string;
      readonly retry: 'available' | 'unavailable';
    }
```

## KanbanChecklistGroup

One ordered application-owned checklist group.

```ts
interface KanbanChecklistGroup {
  checklistId: KanbanChecklistId;   // Stable card-scoped checklist identity.
  title?: string;   // Optional group title sanitized at the snapshot boundary.
  items: readonly KanbanChecklistItem[];   // Ordered read-only item publication.
}
```

## KanbanChecklistId

A validated checklist-group identity.

```ts
type KanbanChecklistId = string
```

## KanbanChecklistItem

One application-owned checklist item snapshotted for read-only card display.

```ts
interface KanbanChecklistItem {
  itemId: KanbanChecklistItemId;   // Stable group-scoped item identity.
  text: string;   // Display text sanitized at the snapshot boundary.
  completed: boolean;   // Application-owned completion state.
}
```

## KanbanChecklistItemId

Stable item identity whose uniqueness is scoped to one checklist group.

```ts
type KanbanChecklistItemId = string
```

## KanbanChecklistMode

Checklist detail rendered by the standard card pipeline.

```ts
type KanbanChecklistMode = 'hidden' | 'progress' | 'preview'
```

## KanbanCollapsedHoverController

Owns one generation-safe temporary expansion lease at a time.

```ts
new KanbanCollapsedHoverController(options: KanbanCollapsedHoverControllerOptions = {})
// methods & signals:
begin(target: KanbanCollapsedHoverTarget): boolean
leave(swimlaneId: string): void
cancel(): void
snapshot(): KanbanCollapsedHoverState
dispose(): void
```

## KanbanCollapsedHoverControllerOptions

Construction options for one independent hover lease controller.

```ts
interface KanbanCollapsedHoverControllerOptions {
  scheduler?: KanbanCollapsedHoverScheduler;   // Timer boundary; omission uses the current JavaScript host timers.
  onChanged?: () => void;   // Optional repaint/reprojection request after observable lease state changes.
}
```

## KanbanCollapsedHoverScheduler

Injectable timer boundary used by deterministic tests and host schedulers.

```ts
interface KanbanCollapsedHoverScheduler {
  schedule: (callback: () => void, delayMs: number) => unknown;   // Schedules one callback after a non-negative millisecond delay.
  cancel: (handle: unknown) => void;   // Cancels one handle previously returned by `schedule`.
}
```

## KanbanCollapsedHoverState

Observable state of one temporary collapsed-swimlane hover lease.

```ts
type KanbanCollapsedHoverState = | { readonly kind: 'idle' }
  | { readonly kind: 'waiting'; readonly swimlaneId: string }
  | { readonly kind: 'expanded'; readonly swimlaneId: string; readonly temporary: true }
  | { readonly kind: 'disposed' }
```

## KanbanCollapsedHoverTarget

Candidate semantic swimlane for temporary drag-hover expansion.

```ts
interface KanbanCollapsedHoverTarget {
  swimlaneId: string;   // Stable semantic swimlane identity.
  visible: boolean;   // Whether the group participates in the visible scene.
  collapsed: boolean;   // Whether the saved/current view state is collapsed.
}
```

## KanbanColumnAddProposal

Add one workflow column at a semantic structural position.

```ts
interface KanbanColumnAddProposal {
  kind: 'column-add';   // Request discriminator.
  draft: KanbanColumnDraft;   // Validated generic column definition.
  position: KanbanColumnPosition;   // Stable-neighbor structural destination.
}
```

## KanbanColumnDeleteProposal

Delete one workflow column with an optional application-authorized card reassignment target.

```ts
interface KanbanColumnDeleteProposal {
  kind: 'column-delete';   // Request discriminator.
  columnId: KanbanColumnId;   // Stable identity of the column to delete.
  reassignTo?: KanbanColumnId;   // Optional application-authorized destination for affected cards.
}
```

## KanbanColumnDraft

Generic application-owned workflow-column draft with package-validated identity and label.

```ts
interface KanbanColumnDraft {
  columnId: KanbanColumnId;   // Stable identity proposed for the new workflow column.
  label: string;   // Safe human-readable column label.
  data?: KanbanSemanticValue;   // Optional bounded application-owned column metadata.
}
```

## KanbanColumnHeader

Detached column header publication.

```ts
interface KanbanColumnHeader {
  columnId: KanbanColumnId;   // Column represented by this header.
  label: string;   // Sanitized human-readable label.
}
```

## KanbanColumnHeaderAlignment

Horizontal alignment available for one workflow-column header label.

```ts
type KanbanColumnHeaderAlignment = 'start' | 'center'
```

## KanbanColumnId

A validated workflow-column identity.

```ts
type KanbanColumnId = string
```

## KanbanColumnMeta

Display metadata for one workflow column.

```ts
interface KanbanColumnMeta {
  columnId: KanbanColumnId;   // Stable semantic column identity.
  label: string;   // Human-readable label rendered after terminal sanitization.
  revision: KanbanRevision;   // Equality-only presentation revision for this metadata.
}
```

## KanbanColumnOperationSubject

Stable workflow-column identity affected or reserved by an operation.

```ts
interface KanbanColumnOperationSubject {
  kind: 'column';   // Subject discriminator.
  columnId: KanbanColumnId;   // Stable workflow-column identity.
}
```

## KanbanColumnPolicy

View-owned presentation policy for one stable workflow column.

```ts
interface KanbanColumnPolicy {
  columnId: string;   // Stable application-owned column identity.
  visible?: boolean;   // Whether the column participates in the visible scene.
  collapsed?: boolean;   // Whether the header remains visible while the card region is suppressed.
  width?: KanbanColumnWidthPreference;   // Optional responsive width preference.
  headerAlignment?: KanbanColumnHeaderAlignment;   // Optional header-label alignment; defaults to `start`.
  wip?: KanbanWipPolicy;   // Optional workflow count policy used by pure eligibility evaluation.
  definitionOfDone?: KanbanDefinitionOfDone;   // Optional compact and complete definition-of-done text.
  capabilities?: readonly KanbanStructureCapability[];   // Package-understood presentation capabilities.
  style?: KanbanStructureStyle;   // Optional allowlisted semantic style.
}
```

## KanbanColumnPosition

Semantic placement of one workflow column among stable neighboring column identities.

```ts
type KanbanColumnPosition = | { readonly kind: 'start' }
  | { readonly kind: 'end' }
  | {
      readonly kind: 'between';
      readonly beforeColumnId: KanbanColumnId | null;
      readonly afterColumnId: KanbanColumnId | null;
    }
```

## KanbanColumnPublicationSubject

Workflow-column publication expected after an accepted application request.

```ts
interface KanbanColumnPublicationSubject {
  kind: 'column';
  columnId: KanbanColumnId;
  baselineRevision: KanbanRevision;
  expectedRevision: KanbanRevision;
}
```

## KanbanColumnReorderProposal

Reorder one workflow column without a numeric index or generated rank.

```ts
interface KanbanColumnReorderProposal {
  kind: 'column-reorder';   // Request discriminator.
  columnId: KanbanColumnId;   // Stable identity of the column to move.
  position: KanbanColumnPosition;   // Stable-neighbor structural destination.
}
```

## KanbanColumnSemanticReference

Stable semantic reference retained across display-label changes.

```ts
interface KanbanColumnSemanticReference {
  kind: 'column';   // Structural discriminator.
  columnId: string;   // Stable source-owned column identity.
}
```

## KanbanColumnUpdateProposal

Patch one workflow column through application-owned policy.

```ts
interface KanbanColumnUpdateProposal {
  kind: 'column-update';   // Request discriminator.
  columnId: KanbanColumnId;   // Stable identity of the column to update.
  patch: KanbanSemanticValue;   // Bounded application-schema patch data.
}
```

## KanbanColumnWidthInput

Width constraints supplied for one source-ordered workflow column.

```ts
interface KanbanColumnWidthInput {
  columnId: string;   // Stable application-owned column identity.
  minimumWidth?: number;   // Smallest configured surface width; defaults to 18 cells.
  preferredWidth?: number;   // Preferred surface width; defaults to 24 cells.
  maximumWidth?: number;   // Largest configured surface width; defaults to 32 cells.
  chromeMinimumWidth?: number;   // Minimum cells required for mandatory non-color chrome.
  rendererMinimumHint?: number;   // Optional untrusted renderer measurement hint. Invalid hints are ignored.
}
```

## KanbanColumnWidthPreference

Complete validated terminal-cell width preference for one workflow column.

```ts
interface KanbanColumnWidthPreference {
  minimumWidth: number;   // Smallest usable column surface width.
  preferredWidth: number;   // Desired column surface width when room is available.
  maximumWidth: number;   // Largest column surface width allocated by the responsive solver.
}
```

## KanbanColumnWidthSolution

Immutable result of one pure responsive width solve.

```ts
interface KanbanColumnWidthSolution {
  mode: 'multi-column' | 'focused-column';   // Responsive presentation selected for the available cells.
  availableWidth: number;   // Validated width offered by the parent.
  contentWidth: number;   // Total column and separator width; it may exceed availability to represent horizontal overflow.
  separatorWidth: number;   // Cells reserved between adjacent columns.
  columns: readonly KanbanSolvedColumnWidth[];   // Source-ordered solved columns, or the single active column in focused mode.
  interactiveColumnIds: readonly string[];   // Columns that may participate in Phase A inspection and later interaction.
  navigator?: KanbanFocusedColumnNavigator;   // Compact navigation state present only in focused-column mode.
}
```

## KanbanConfirmationClassification

Pure coordinator input describing whether a currently eligible proposal needs confirmation.

```ts
type KanbanConfirmationClassification = | Extract<KanbanEligibility, { readonly kind: 'warning' }>
  | { readonly kind: 'destructive' }
  | { readonly kind: 'not-required' }
```

## KanbanConfirmationContext

Exact confirmation facts exposed without application records or terminal geometry.

```ts
interface KanbanConfirmationContext {
  operationId: KanbanOperationId;   // Reserved operation identity.
  proposal: KanbanRequestProposal;   // Detached validated proposal awaiting dispatch.
  affected: readonly KanbanOperationSubject[];   // Sorted semantic subjects reserved by this operation.
  expected: KanbanRequestExpectedRevisions;   // Equality-only revisions captured at admission.
  eligibility: Extract<KanbanEligibility, { readonly kind: 'warning' }> | { readonly kind: 'destructive' };   // Warning or destructive classification that requires a user decision.
  signal: AbortSignal;   // Live coordinator-owned cancellation signal.
}
```

## KanbanConfirmedPublicationNotice

Exact operation-correlated confirmation that carries no inferred application semantics.

```ts
interface KanbanConfirmedPublicationNotice {
  kind: 'confirmed';   // Notice discriminator.
  operationId: KanbanOperationId;   // Operation explicitly confirmed by the authoritative application publication.
}
```

## KanbanConfirmer

Application confirmation callback with an exact synchronous-or-native-Promise result.

```ts
type KanbanConfirmer = (context: KanbanConfirmationContext) => boolean | Promise<boolean>
```

## KanbanCount

A count whose authority and completeness are explicit.

```ts
type KanbanCount = | { readonly quality: 'unknown' }
  | {
      readonly quality: 'exact' | 'estimated' | 'truncated';
      readonly value: number;
    }
```

## KanbanCurrentCard

Current revision of one card used by move eligibility.

```ts
interface KanbanCurrentCard {
  cardKey: CardKey;   // Stable application-owned card identity.
  revision: KanbanRevision;   // Current equality-only entity revision.
}
```

## KanbanCurrentColumn

Current revision of one structural column used by move eligibility.

```ts
interface KanbanCurrentColumn {
  columnId: KanbanColumnId;   // Stable workflow-column identity.
  revision: KanbanRevision;   // Current equality-only entity revision.
}
```

## KanbanCurrentSwimlane

Current revision of one structural swimlane used by move eligibility.

```ts
interface KanbanCurrentSwimlane {
  swimlaneId: KanbanSwimlaneId;   // Stable explicit-swimlane identity.
  revision: KanbanRevision;   // Current equality-only entity revision.
}
```

## KanbanCustomPresentation

Caller-defined card presentation budget before validation and normalization.

```ts
interface KanbanCustomPresentation {
  revision: KanbanRevision;   // Equality-only revision for the complete custom policy.
  cardRows: number;   // Maximum descriptor rows, including mandatory title and status rows.
  cardGap: number;   // Empty terminal rows reserved between adjacent cards by scene geometry.
  metadataFields: number;   // Maximum selected metadata fields.
  labelRows: number;   // Maximum rows used to wrap labels.
  summarySections: number;   // Maximum selected summary sections.
  checklistMode: KanbanChecklistMode;   // Checklist detail available to the standard renderer.
  checklistPreviewItems: number;   // Maximum checklist items displayed across selected groups.
  degradationOrder?: readonly string[];   // Optional string candidates validated into a closed low-to-high optional-section removal order.
}
```

## KanbanCustomSwimlanePresentation

Application-owned custom swimlane chrome producer validated before rendering.

```ts
interface KanbanCustomSwimlanePresentation {
  kind: 'custom';   // Discriminator separating custom chrome from built-in variants.
  revision: KanbanRevision;   // Equality-only revision of the renderer and its configuration.
  render: (context: KanbanSwimlanePresentationContext) => unknown;   // Produces untrusted renderer-neutral chrome input for bounded validation.
}
```

## KanbanDamageRegion

Bounded changed rectangle returned by viewport damage calculation.

```ts
interface KanbanDamageRegion {
  kind: 'descriptor' | 'sticky' | 'state' | 'overlay' | 'scroll-exposed' | 'whole-viewport';   // Stable source of the damage request.
  cardKey?: CardKey;   // Stable card identity when descriptor-local damage is known.
}
```

## KanbanDataSource

Application-owned source that opens synchronous, independently disposable query sessions.

```ts
interface KanbanDataSource<TCard> {
  openQuery(query: KanbanQuery, options?: { readonly signal?: AbortSignal }): KanbanQuerySession<TCard>;   // Opens one session and immediately transfers cancellation/disposal ownership to the caller.
}
```

## KanbanDefinitionOfDone

Safe compact and complete definition-of-done text for one workflow column.

```ts
interface KanbanDefinitionOfDone {
  summary: string;   // Compact header/help summary.
  details?: string;   // Optional complete text exposed only through focused help or interaction surfaces.
}
```

## KanbanDefinitionOfDoneSnapshot

Complete safe definition-of-done evidence exposed by focused interaction surfaces.

```ts
interface KanbanDefinitionOfDoneSnapshot {
  indicator: 'configured';   // Compact non-color evidence rendered by a configured column header.
}
```

## KanbanDisposedResourceError

Raised when a caller uses a source, cursor, or viewport after disposal.

```ts
new KanbanDisposedResourceError()   // extends KanbanError
// methods & signals:
code
```

## KanbanDragConfiguration

Public bounded drag configuration shared by board-owned pointer gestures.

```ts
type KanbanDragConfiguration = KanbanPointerRouterOptions
```

## KanbanEligibility

Pure synchronous result shared by pointer, keyboard, programmatic, menu, and dialog producers.

```ts
type KanbanEligibility = | { readonly kind: 'allowed' }
  | { readonly kind: 'warning'; readonly code: string; readonly params?: KanbanSemanticValue }
  | { readonly kind: 'blocked'; readonly code: string; readonly params?: KanbanSemanticValue }
  | { readonly kind: 'unavailable'; readonly code: string; readonly params?: KanbanSemanticValue }
```

## KanbanError

Base class for sanitized programmer and configuration errors raised by Kanban.

```ts
new KanbanError()   // extends Error
// methods & signals:
code: KanbanErrorCode
```

## KanbanErrorCode

Stable machine-readable codes for package-owned contract failures.

```ts
type KanbanErrorCode = | 'invalid-identity'
  | 'invalid-limit'
  | 'invalid-semantic-value'
  | 'invalid-query'
  | 'invalid-range'
  | 'invalid-source-publication'
  | 'invalid-presentation'
  | 'invalid-descriptor'
  | 'invalid-geometry'
  | 'disposed-resource'
```

## KanbanExpectedCardRevision

Captured card revision required by an application request.

```ts
interface KanbanExpectedCardRevision {
  kind: 'card';   // Entity discriminator used for exact validation.
  cardKey: CardKey;   // Stable application-owned card identity.
  revision: KanbanRevision;   // Equality-only revision captured before admission.
}
```

## KanbanExpectedColumnRevision

Captured workflow-column revision required by an application request.

```ts
interface KanbanExpectedColumnRevision {
  kind: 'column';   // Entity discriminator used for exact validation.
  columnId: KanbanColumnId;   // Stable workflow-column identity.
  revision: KanbanRevision;   // Equality-only revision captured before admission.
}
```

## KanbanExpectedEntityRevision

One typed entity revision captured before a request reaches application code.

```ts
type KanbanExpectedEntityRevision = KanbanExpectedCardRevision | KanbanExpectedColumnRevision | KanbanExpectedSwimlaneRevision
```

## KanbanExpectedSwimlaneRevision

Captured swimlane revision required by an application request.

```ts
interface KanbanExpectedSwimlaneRevision {
  kind: 'swimlane';   // Entity discriminator used for exact validation.
  swimlaneId: KanbanSwimlaneId;   // Stable explicit-swimlane identity.
  revision: KanbanRevision;   // Equality-only revision captured before admission.
}
```

## KanbanExplicitGrouping

Explicit ordered groups and memberships from an authoritative source.

```ts
interface KanbanExplicitGrouping<TCardKey extends CardKey = CardKey> {
  groups: readonly KanbanSwimlaneMeta[];   // Ordered semantic swimlane metadata.
  memberships: readonly KanbanExplicitGroupingMembership<TCardKey>[];   // Card memberships independent of view visibility.
}
```

## KanbanExplicitGroupingMembership

One explicit application-published card-to-swimlane membership.

```ts
interface KanbanExplicitGroupingMembership<TCardKey extends CardKey = CardKey> {
  cardKey: TCardKey;   // Stable application card identity.
  swimlaneId?: string;   // Semantic group identity; omission means unassigned.
}
```

## KanbanExtensionId

A validated lowercase dotted identity for an application extension.

```ts
type KanbanExtensionId = string
```

## KanbanExtensionRequest

Generic namespaced application-extension request.

```ts
interface KanbanExtensionRequest<TType extends KanbanExtensionId = KanbanExtensionId, TPayload extends KanbanSemanticValue = KanbanSemanticValue> {
  kind: 'extension';   // Request discriminator.
  extensionId: TType;   // Namespaced application extension identity.
  operationId: KanbanOperationId;   // Caller-provided legacy operation identity adopted by the coordinator.
  expected: KanbanRequestExpectedRevisions;   // Equality-only authority captured by the legacy caller.
  payload: TPayload;   // Bounded application-owned extension data.
  signal: AbortSignal;   // Live legacy cancellation signal adopted for this operation.
}
```

## KanbanExtensionRequestProposal

Caller-facing namespaced extension proposal without coordinator-owned lifecycle fields.

```ts
interface KanbanExtensionRequestProposal<TType extends KanbanExtensionId = KanbanExtensionId, TPayload extends KanbanSemanticValue = KanbanSemanticValue> {
  kind: 'extension';   // Request discriminator.
  extensionId: TType;   // Namespaced application extension identity.
  payload: TPayload;   // Bounded application-owned extension data.
}
```

## KanbanExtentQuality

Confidence attached to one published scroll extent.

```ts
type KanbanExtentQuality = 'exact' | 'lower-bound' | 'unknown'
```

## KanbanFieldId

A validated application field identity.

```ts
type KanbanFieldId = string
```

## KanbanFilter

One semantic filter supplied to a data source.

```ts
interface KanbanFilter {
  fieldId: KanbanFieldId;   // Application field evaluated by a registered source adapter.
  operatorId: KanbanExtensionId;   // Application-namespaced operator interpreted by that adapter.
  value: KanbanSemanticValue;   // Detached semantic operand, never an executable expression.
}
```

## KanbanFilterField

Application filter field with a finite allowlist of supported operators.

```ts
interface KanbanFilterField<TCard> {
  fieldId: KanbanFieldId;   // Semantic field selected by a query filter.
  operators: readonly KanbanFilterOperator<TCard>[];   // Finite operator registry validated before a session opens.
}
```

## KanbanFilterOperator

One explicitly registered filter operation for an application field.

```ts
interface KanbanFilterOperator<TCard> {
  operatorId: KanbanExtensionId;   // Application-namespaced operator selected by a query filter.
  matches: (card: TCard, value: KanbanSemanticValue) => boolean;   // Evaluates one card against a detached semantic operand.
}
```

## KanbanFocusTarget

A semantic board target that may own keyboard focus.

```ts
type KanbanFocusTarget = | { readonly kind: 'board-state' }
  | { readonly kind: 'column-header'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'swimlane-header'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'card'; readonly cardKey: CardKey; readonly address: KanbanCellAddress }
```

## KanbanFocusedColumnNavigator

One-row navigation metadata shown only in focused-column mode.

```ts
interface KanbanFocusedColumnNavigator {
  rowCount: 1;   // Fixed compact navigator height.
  columnId: string;   // Active source column.
  position: number;   // One-based position in the complete visible-column sequence.
  total: number;   // Complete number of visible columns.
  previousEnabled: boolean;   // Whether a previous source-ordered column exists.
  nextEnabled: boolean;   // Whether a next source-ordered column exists.
}
```

## KanbanFocusedDetailField

One complete safe field value available for focused-card inspection.

```ts
interface KanbanFocusedDetailField {
  fieldId: KanbanFieldId;   // Stable configured field identity.
  label: string;   // Sanitized localized field label.
  values: readonly string[];   // Complete bounded safe display values, independent of visible card clipping.
}
```

## KanbanFocusedDetailKeyHint

Keyboard hint for one semantic action available on the focused target.

```ts
interface KanbanFocusedDetailKeyHint {
  actionId: KanbanExtensionId;   // Application or package action advertised by the target.
  label: string;   // Sanitized localized action label.
  key: string;   // Sanitized host-normalized key description.
}
```

## KanbanFocusedDetailSelection

Honest scope summary for the current ordered selection.

```ts
interface KanbanFocusedDetailSelection {
  loadedCount: number;   // Number of resident card keys in the ordered selection.
  scope: 'loaded' | 'server';   // Whether a separate application server-wide selection is active.
}
```

## KanbanFocusedDetailSnapshot

Detached, bounded values used by focused help, status chrome, and inspection.

```ts
interface KanbanFocusedDetailSnapshot {
  target: KanbanFocusTarget;   // Target described by the remaining fields.
  title?: string;   // Optional complete sanitized title for a focused card.
  status?: string;   // Optional complete sanitized status for a focused card.
  fields: readonly KanbanFocusedDetailField[];   // Complete bounded safe field values selected for inspection.
  checklists: readonly KanbanChecklistGroup[];   // Complete bounded read-only checklist values selected for inspection.
  definitionOfDone?: string;   // Optional complete sanitized definition-of-done text.
  actions: readonly KanbanCardAction[];   // Semantic actions currently advertised by the focused target.
  keyHints: readonly KanbanFocusedDetailKeyHint[];   // Current host-normalized key hints for the advertised actions.
  selection: KanbanFocusedDetailSelection;   // Honest summary of the current ordered selection.
}
```

## KanbanGroupedResult

Normalized visible and detached grouping projection.

```ts
interface KanbanGroupedResult<TCardKey extends CardKey = CardKey> {
  kind: 'grouped';   // Structural discriminator.
  activeFieldId: KanbanFieldId;   // Sole field selected by the validated query.
  groups: readonly KanbanResolvedGroupingMeta[];   // Ordered groups participating in the visible scene.
  memberships: readonly KanbanResolvedGroupingMembership<TCardKey>[];   // Visible card memberships.
  detached: {
    readonly groups: readonly KanbanResolvedGroupingMeta[];
    readonly memberships: readonly KanbanResolvedGroupingMembership<TCardKey>[];
  };   // Complete semantic groups and memberships before visibility projection.
}
```

## KanbanGroupingField

Application grouping adapter used by the eager source.

```ts
interface KanbanGroupingField<TCard> {
  id: KanbanFieldId;   // Semantic field selected by `query.groupBy`.
  swimlaneOf: (card: TCard) => KanbanSwimlaneId | undefined;   // Returns an optional semantic swimlane identity for one card.
  unassignedSwimlaneId?: KanbanSwimlaneId;   // Declared semantic target for missing or valid-unmapped values.
  resolverFallbackSwimlaneId?: KanbanSwimlaneId;   // Declared semantic target for thrown or malformed resolver results.
}
```

## KanbanGroupingPolicy

View-owned policy for the sole query-selected grouping field.

```ts
interface KanbanGroupingPolicy<TCard, TCardKey extends CardKey = KanbanCardKeyFor<TCard>> {
  fieldId: KanbanFieldId;   // Field that must equal the active query grouping field.
  unassigned: KanbanSwimlaneMeta;   // Stable group used only for missing or unmapped values.
  resolverFallback?: KanbanSwimlaneMeta;   // Stable local group used when an application resolver fails.
  visibleSwimlaneIds?: readonly string[];   // Optional visible-group allowlist. Hidden membership remains detached.
  collapsedSwimlaneIds?: readonly string[];   // Visible groups whose headers remain while card regions are suppressed.
  order?: readonly string[];   // Optional semantic group order applied after source or registry normalization.
  allowDuplicateLabels?: boolean;   // Whether normalized-equal labels may be shown with distinct disambiguators.
  disambiguators?: Readonly<Record<string, string>>;   // Visible disambiguators keyed by stable semantic group identity.
  presentation?: KanbanSwimlanePresentationInput;   // Built-in or bounded custom presentation selected for this grouping.
  railWidth?: number;   // Preferred width of the rail variant before responsive degradation.
  cardKeyOf?: (card: TCard) => TCardKey;   // Optional card identity resolver for records without a conventional `id` data property.
}
```

## KanbanGroupingRegistryEntry

Registered pure derived grouping behavior for one field.

```ts
interface KanbanGroupingRegistryEntry<TCard> {
  fieldId: KanbanFieldId;   // Field selected by `KanbanQuery.groupBy`.
  groups: readonly KanbanSwimlaneMeta[];   // Ordered semantic groups known by the resolver.
  resolve: (card: TCard) => string | undefined;   // Resolves one card to a semantic group, or no value when it is unassigned.
  styleOf?: (group: KanbanSwimlaneMeta) => KanbanStructureStyle | undefined;   // Optional semantic style resolver isolated per group.
  summaryOf?: (group: KanbanSwimlaneMeta) => KanbanGroupingSummary | undefined;   // Optional numeric summary resolver isolated per group.
}
```

## KanbanGroupingResult

Complete pure grouping result.

```ts
type KanbanGroupingResult<TCardKey extends CardKey = CardKey> = KanbanUngroupedResult | KanbanGroupedResult<TCardKey>
```

## KanbanGroupingSummary

One application-owned numeric/text summary associated with a semantic swimlane.

```ts
interface KanbanGroupingSummary {
  count: number;   // Non-negative safe aggregate.
  label: string;   // Sanitized compact summary label.
}
```

## KanbanHeaderBatch

Atomic header metadata for one session revision.

```ts
interface KanbanHeaderBatch {
  revision: KanbanRevision;   // Session revision from which the header values were derived.
  columns: readonly KanbanColumnHeader[];   // Ordered column headers.
  swimlanes: readonly KanbanSwimlaneHeader[];   // Ordered swimlane headers.
}
```

## KanbanHeaderSummary

Header metadata shared by columns and swimlanes.

```ts
interface KanbanHeaderSummary {
  wip?: KanbanCount;   // Optional authoritative work-in-progress count.
  summaries?: Readonly<Record<KanbanFieldId, KanbanNumericSummary>>;   // Bounded honest numeric summaries keyed by application field identity.
}
```

## KanbanIdentityChange

Authoritative deletion of one semantic identity.

```ts
type KanbanIdentityChange = | { readonly kind: 'deleted-card'; readonly cardKey: CardKey }
  | { readonly kind: 'deleted-column'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'deleted-swimlane'; readonly swimlaneId: KanbanSwimlaneId }
```

## KanbanIdentityChangeBatch

Bounded authoritative deletion facts for one session revision.

```ts
interface KanbanIdentityChangeBatch {
  revision: KanbanRevision;   // Session revision from which the deletion facts were derived.
  changes: readonly KanbanIdentityChange[];   // Exact deletion records; transient unload is deliberately absent.
}
```

## KanbanIdentityInput

Application-owned identity hints projected by a read-only board.

```ts
interface KanbanIdentityInput {
  focusedCardKey?: CardKey;   // Card that should retain the primary non-color focus cue when resident.
  focusedColumnId?: string;   // Workflow column preferred when responsive geometry can show only one column.
  selectedCardKeys?: readonly CardKey[];   // Application-owned selected identities retained through ordinary source unload.
}
```

## KanbanIdentityKind

Structural identity categories accepted by the shared uniqueness validator.

```ts
type KanbanIdentityKind = 'card' | 'column' | 'swimlane' | 'field' | 'view' | 'checklist' | 'extension' | 'operation'
```

## KanbanInspectedCard

Detached visible-card evidence suitable for tests and modeless inspectors.

```ts
interface KanbanInspectedCard {
  cardKey: CardKey;   // Stable application-owned card identity.
  columnId: string;   // Containing workflow column identity.
  address: KanbanCellAddress;   // Complete semantic cell address containing the card.
  descriptor: import('../card/descriptor.js').KanbanCardDescriptor;   // Validated immutable descriptor retained for modeless diagnostics and specification evidence.
  title: string;   // Sanitized visible title projection.
  marker: { readonly cues: readonly string[] };   // Non-color marker projected with the visible descriptor.
}
```

## KanbanInspectedCell

Detached inspection state for one retained source cell.

```ts
interface KanbanInspectedCell {
  address: KanbanCellAddress;   // Canonical source coordinate.
  state: KanbanCellState;   // Safe source state with no application record payload.
}
```

## KanbanInspectedColumn

Detached visible-column evidence with the complete sanitized semantic label.

```ts
interface KanbanInspectedColumn {
  columnId: string;   // Stable workflow-column identity.
  label: string;   // Complete bounded sanitized label before visual ellipsis.
}
```

## KanbanInteractionAcquisitionRequest

Bounded acquisition request for one semantic target.

```ts
interface KanbanInteractionAcquisitionRequest {
  target: KanbanFocusTarget;   // Requested focus target retained across asynchronous settlement.
  kind: 'reveal' | 'acquire';   // Operation requiring the bounded source work.
}
```

## KanbanInteractionAcquisitionResult

Payload-free bounded reveal or acquisition settlement.

```ts
type KanbanInteractionAcquisitionResult = { readonly kind: 'available' } | { readonly kind: 'unavailable'; readonly retry: 'available' | 'unavailable' }
```

## KanbanInteractionController

Complete mount-owned state controller used behind the stable board facade.

```ts
interface KanbanInteractionController {
  snapshot(): KanbanInteractionSnapshot;   // Returns the current detached immutable semantic state.
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult> | KanbanInteractionResult;   // Applies one closed transition synchronously or through bounded asynchronous acquisition.
  subscribe(invalidate: () => void): () => void;   // Subscribes to semantic publications and returns an idempotent unsubscribe function.
  dispose(): void;   // Releases subscriptions, cancellation, and other controller-owned resources idempotently.
}
```

## KanbanInteractionControllerFactory

Sole injection seam for replacing the default interaction controller.

```ts
type KanbanInteractionControllerFactory = (
  environment: KanbanInteractionEnvironment,
) => KanbanInteractionController
```

## KanbanInteractionEnvironment

Mount-scoped bounded services available to an interaction controller factory.

```ts
interface KanbanInteractionEnvironment {
  scene: () => KanbanNavigationSnapshot;   // Reads current detached scene evidence.
  revisions: () => KanbanInteractionRevisions;   // Reads current source/query revision evidence.
  reveal: (
    target: KanbanFocusTarget,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<KanbanInteractionAcquisitionResult> | KanbanInteractionAcquisitionResult;   // Minimally reveals an already-known eligible target.
  acquire: (
    request: KanbanInteractionAcquisitionRequest,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<KanbanInteractionAcquisitionResult> | KanbanInteractionAcquisitionResult;   // Requests one bounded missing-target acquisition.
  feedback: (code: KanbanInteractionFeedbackCode, count?: number) => KanbanInteractionFeedback;   // Creates safe localized feedback without exposing source payloads.
  invalidate: () => void;   // Schedules at most one mounted repaint for a published semantic change.
}
```

## KanbanInteractionFacade

Stable board-owned programmatic interaction surface available before and after mount.

```ts
interface KanbanInteractionFacade {
  snapshot(): KanbanInteractionSnapshot;   // Returns the last valid detached immutable interaction snapshot.
  accept(command: KanbanInteractionTransition): boolean;   // Synchronously queues one enabled event-loop transition when a controller is available.
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult>;   // Serializes one closed transition behind settlement-generation checks.
  activate(options?: KanbanActivateOptions): Promise<boolean>;   // Opens the current or explicit card through the serialized semantic intent boundary.
  openContext(options?: KanbanOpenContextOptions): Promise<boolean>;   // Opens application-owned context for the current or explicit closed semantic scope.
  invokeScopedAction(actionId: KanbanScopedActionId, scope: KanbanActionScope, origin?: KanbanInteractionOrigin): Promise<boolean>;   // Invokes one application-owned scoped action without mutating board state locally.
  snapshotEligibleSelection(): KanbanSelectionSnapshot;   // Captures current eligible ordered selection independently from later live changes.
  subscribe(invalidate: () => void): () => void;   // Subscribes to facade publications and returns an idempotent unsubscribe function.
}
```

## KanbanInteractionFeedback

Localized, bounded feedback that may be shown without exposing card values.

```ts
interface KanbanInteractionFeedback {
  code: KanbanInteractionFeedbackCode;   // Machine-readable reason used by applications and tests.
  label: string;   // Sanitized localized text suitable for board chrome.
  count?: number;   // Optional non-negative count associated with selection feedback.
  retry?: 'available' | 'unavailable';   // Whether the same semantic request may be attempted again.
}
```

## KanbanInteractionFeedbackCode

Stable, payload-free interaction feedback categories.

```ts
type KanbanInteractionFeedbackCode = | 'navigation-pending'
  | 'navigation-unavailable'
  | 'navigation-error'
  | 'selection-limit-exceeded'
  | 'selection-pruned'
  | 'interaction-unavailable'
```

## KanbanInteractionHandler

Optional synchronous application handler for immutable semantic interaction intents.

```ts
type KanbanInteractionHandler = (intent: KanbanInteractionIntent) => void
```

## KanbanInteractionInspection

Detached controller evidence exposed without application records or host handles.

```ts
interface KanbanInteractionInspection {
  revision: number;   // Equality-only controller publication revision.
  focused: KanbanInteractionSnapshot['focused'];   // Current stable focus target.
  selectedCardKeys: KanbanInteractionSnapshot['selectedCardKeys'];   // Ordered type-preserving loaded selection identities.
  selectedCount: number;   // Number of loaded selected identities.
  selectionScope: 'loaded' | 'server';   // Honest active selection scope.
  rangeAnchor?: KanbanRangeAnchor;   // Explicit cell-local range anchor when range extension is active.
  pendingNavigationKind?: 'reveal' | 'acquire';   // Current bounded acquisition kind without retaining its request target.
  lastPruneCount?: number;   // Exact most recent prune count when prune feedback is active.
  feedback?: KanbanInteractionFeedback;   // Safe localized payload-free interaction feedback.
}
```

## KanbanInteractionIntent

Complete non-mutation interaction boundary delivered to an application handler.

```ts
type KanbanInteractionIntent = KanbanOpenCardIntent | KanbanOpenContextIntent | KanbanScopedActionIntent
```

## KanbanInteractionIntentBase

Shared immutable evidence captured for every application interaction intent.

```ts
interface KanbanInteractionIntentBase {
  origin: KanbanInteractionOrigin;   // Input channel that initiated the interaction.
  selection: KanbanSelectionSnapshot;   // Eligible ordered selection captured after the required interaction transition settles.
}
```

## KanbanInteractionOrigin

Input channel that initiated one semantic application interaction.

```ts
type KanbanInteractionOrigin = 'keyboard' | 'pointer' | 'programmatic'
```

## KanbanInteractionPendingResult

Pending bounded acquisition settlement that leaves current focus in place.

```ts
interface KanbanInteractionPendingResult {
  kind: 'pending';   // Stable result discriminator.
  snapshot: KanbanInteractionSnapshot;   // Current immutable state while bounded source work is outstanding.
}
```

## KanbanInteractionReconcileReason

Reasons that require stable focus and selection to reconcile with current evidence.

```ts
type KanbanInteractionReconcileReason = 'query' | 'source-publication' | 'cursor-unload' | 'geometry' | 'visibility' | 'deletion'
```

## KanbanInteractionResult

Complete typed settlement returned by a controller or facade transition.

```ts
type KanbanInteractionResult = KanbanInteractionSuccessResult | KanbanInteractionPendingResult | KanbanInteractionUnavailableResult
```

## KanbanInteractionRevisions

Current session and view revisions exposed without source records or host handles.

```ts
interface KanbanInteractionRevisions {
  sessionRevision: KanbanRevision;   // Active query-session revision.
  queryGeneration: number;   // Active query generation.
  viewRevision?: KanbanRevision;   // Optional application saved-view revision.
}
```

## KanbanInteractionSnapshot

Complete immutable interaction state consumed by scene construction.

```ts
interface KanbanInteractionSnapshot {
  revision: number;   // Monotonic semantic-state revision owned by the interaction controller.
  focused: KanbanFocusTarget;   // Current semantic focus target.
  selectedCardKeys: readonly CardKey[];   // Ordered selected keys with number and string identities kept distinct.
  rangeAnchor?: KanbanRangeAnchor;   // Optional range-selection anchor.
  preferredCenterRow?: number;   // Preferred visual center row retained during horizontal navigation.
  pendingNavigation?: KanbanPendingNavigation;   // Optional asynchronous navigation operation.
  feedback?: KanbanInteractionFeedback;   // Optional safe localized status feedback.
  serverSelection?: KanbanServerSelectionReference;   // Optional application-owned server-wide selection reference.
}
```

## KanbanInteractionSuccessResult

Successful interaction settlement with the controller's complete current snapshot.

```ts
type KanbanInteractionSuccessResult = | { readonly kind: 'changed'; readonly snapshot: KanbanInteractionSnapshot }
  | { readonly kind: 'unchanged'; readonly snapshot: KanbanInteractionSnapshot }
```

## KanbanInteractionTransition

Closed programmatic interaction transition accepted by a controller or facade.

```ts
type KanbanInteractionTransition = | { readonly kind: 'focus'; readonly target: KanbanFocusTarget }
  | {
      readonly kind: 'navigate';
      readonly direction: KanbanNavigationDirection;
      readonly extendSelection?: boolean;
    }
  | {
      readonly kind: 'selection';
      readonly operation: KanbanSelectionOperation;
      readonly serverSelection?: KanbanServerSelectionReference;
    }
  | {
      readonly kind: 'reconcile';
      readonly reason: KanbanInteractionReconcileReason;
      /** Exact authoritative card deletions, kept separate from unloaded or merely hidden identities. */
      readonly deletedCardKeys?: readonly CardKey[];
      /** Exact authoritative workflow-column deletions. */
      readonly deletedColumnIds?: readonly KanbanColumnId[];
      /** Exact authoritative swimlane deletions. */
      readonly deletedSwimlaneIds?: readonly KanbanSwimlaneId[];
    }
  | {
      readonly kind: 'escape';
      readonly transient?: { readonly kind: 'synthetic'; readonly cancel: () => void };
    }
```

## KanbanInteractionUnavailableResult

Typed unavailable settlement used instead of throwing across the public facade.

```ts
interface KanbanInteractionUnavailableResult {
  kind: 'unavailable';   // Stable result discriminator.
  code: KanbanInteractionFeedbackCode;   // Payload-free reason suitable for localization and diagnostics.
  snapshot: KanbanInteractionSnapshot;   // Last valid immutable state retained after the rejected transition.
  retry?: 'available' | 'unavailable';   // Whether the same semantic transition may be retried.
}
```

## KanbanInvalidDescriptorError

Raised when a custom card descriptor violates its bounded render contract.

```ts
new KanbanInvalidDescriptorError()   // extends KanbanError
// methods & signals:
code
```

## KanbanInvalidGeometryError

Raised when component geometry is unsafe or internally inconsistent.

```ts
new KanbanInvalidGeometryError()   // extends KanbanError
// methods & signals:
code
```

## KanbanInvalidIdentityError

A safe typed error raised before an invalid structural identity is published.

```ts
new KanbanInvalidIdentityError(kind: KanbanIdentityKind | 'placement-token')   // extends KanbanError
// methods & signals:
code
kind: KanbanIdentityKind | 'placement-token'
```

## KanbanInvalidLimitError

A safe typed error raised before invalid resource limits can be used.

```ts
new KanbanInvalidLimitError()   // extends KanbanError
// methods & signals:
code
```

## KanbanInvalidPresentationError

Raised when presentation policy or per-card selection data is structurally invalid.

```ts
new KanbanInvalidPresentationError()   // extends KanbanError
// methods & signals:
code
```

## KanbanInvalidQueryError

Raised when a query does not satisfy the published query contract.

```ts
new KanbanInvalidQueryError()   // extends KanbanError
// methods & signals:
code
```

## KanbanInvalidRangeError

Raised before an invalid half-open source range reaches application code.

```ts
new KanbanInvalidRangeError()   // extends KanbanError
// methods & signals:
code
```

## KanbanInvalidSemanticValueError

Raised when a semantic value cannot be safely snapshotted.

```ts
new KanbanInvalidSemanticValueError()   // extends KanbanError
// methods & signals:
code
```

## KanbanInvalidSourcePublicationError

Raised when a source publication violates its structural contract.

```ts
new KanbanInvalidSourcePublicationError()   // extends KanbanError
// methods & signals:
code
```

## KanbanInverseRequestBuilder

Trusted application callback that constructs one fresh proposal from current authority.

```ts
type KanbanInverseRequestBuilder = (
  context: KanbanInverseRequestContext,
) => KanbanRequestProposal | Promise<KanbanRequestProposal>
```

## KanbanInverseRequestContext

Exact metadata supplied when an application builds a fresh inverse proposal.

```ts
interface KanbanInverseRequestContext {
  prior: KanbanOperationSnapshot;   // Payload-free snapshot of the committed operation being undone.
  undo: KanbanUndoDescriptor;   // Opaque committed descriptor selected for this fresh operation.
  expected: KanbanRequestExpectedRevisions;   // Current equality-only revisions captured for the inverse request.
  capabilities: KanbanCapabilities;   // Current presentation capabilities; application authorization remains in the dispatcher.
  signal: AbortSignal;   // Live coordinator-owned cancellation signal.
}
```

## KanbanInverseRequestSettlement

Safe result of settling an application-owned inverse proposal builder.

```ts
type KanbanInverseRequestSettlement = { readonly kind: 'proposal'; readonly proposal: unknown } | { readonly kind: 'invalid' }
```

## KanbanKnownLength

Logical length knowledge exposed without fabricating completeness.

```ts
type KanbanKnownLength = | { readonly kind: 'exact'; readonly value: number }
  | { readonly kind: 'at-least'; readonly value: number }
  | { readonly kind: 'unknown' }
```

## KanbanLayoutRegion

Semantic rectangle emitted by pure layout projection for inspection or future interaction.

```ts
interface KanbanLayoutRegion {
  kind: | 'workflow-header'
    | 'swimlane-header'
    | 'swimlane-band'
    | 'swimlane-separator'
    | 'swimlane-rail'
    | 'swimlane-custom'
    | 'cell'
    | 'insertion-gutter'
    | 'card'
    | 'card-gap'
    | 'state'
    | 'minimum-size';   // Region meaning; Phase A keeps every emitted region non-actionable.
  actionable: boolean;   // Whether current input may target this region.
  cardKey?: CardKey;   // Stable card identity for card rectangles.
}
```

## KanbanLimitClass

Resource class selected by a component instance.

```ts
type KanbanLimitClass = 'safe' | 'standard' | 'advanced'
```

## KanbanLimitManifest

Complete durable resource-limit surface shared by all Kanban phases.

```ts
interface KanbanLimitManifest {
  idBytes: KanbanLimitRow;
  tokenBytes: KanbanLimitRow;
  semanticEncodedBytes: KanbanLimitRow;
  semanticDepth: KanbanLimitRow;
  semanticArrayEntries: KanbanLimitRow;
  semanticObjectKeys: KanbanLimitRow;
  semanticStringBytes: KanbanLimitRow;
  columns: KanbanLimitRow;
  swimlanes: KanbanLimitRow;
  retainedCursors: KanbanLimitRow;
  ensureRangeCards: KanbanLimitRow;
  retainedDescriptors: KanbanLimitRow;   // Maximum immutable descriptors and reactive computations retained by one viewport.
  cardFields: KanbanLimitRow;
  summarySections: KanbanLimitRow;
  checklistGroups: KanbanLimitRow;
  checklistItemsPerGroup: KanbanLimitRow;
  cardRowsCompact: KanbanLimitRow;
  cardRowsComfortable: KanbanLimitRow;
  cardRowsSpacious: KanbanLimitRow;
  descriptorRows: KanbanLimitRow;
  selectedKeys: KanbanLimitRow;
  concurrentCellLoads: KanbanLimitRow;
  concurrentValidators: KanbanLimitRow;
  pendingOperations: KanbanLimitRow;
  retainedOperationIds: KanbanLimitRow;
  retainedUndoDescriptors: KanbanLimitRow;   // Maximum whole committed undo descriptors retained by one board coordinator.
  retainedObservations: KanbanLimitRow;
  verticalOverscan: KanbanLimitRow;
  horizontalOverscan: KanbanLimitRow;
}
```

## KanbanLimitOptions

Caller-selected class and optional values that may lower, but never exceed, its ceiling.

```ts
interface KanbanLimitOptions {
  class?: KanbanLimitClass;
  values?: Partial<KanbanResolvedLimits>;
}
```

## KanbanLimitRow

One package resource limit across safe, standard, and absolute classes.

```ts
interface KanbanLimitRow {
  safe: number;   // Conservative default and maximum accepted by the safe class.
  standard: number;   // Larger default and maximum accepted by the standard class.
  absolute: number;   // Hard package ceiling, used as the advanced-class maximum.
}
```

## KanbanLoadedMoveSelection

Bounded loaded selection represented by one atomic move proposal.

```ts
interface KanbanLoadedMoveSelection {
  kind: 'loaded';   // Selection discriminator.
  orderedCardKeys: readonly CardKey[];   // Ordered stable keys represented by the atomic proposal.
  maximum: number;   // Caller-selected atomic ceiling, bounded by the package manifest.
}
```

## KanbanMarkerPendingProjection

Minimal pending marker for non-move request families.

```ts
interface KanbanMarkerPendingProjection {
  kind: Exclude<KanbanRequest['kind'], 'card-move'>;   // Non-move request discriminator represented by this projection.
  state: 'pending' | 'accepted';   // Lifecycle states that continue to render as pending.
  cardKeys: readonly CardKey[];   // Bounded related card identities when the request exposes them directly.
}
```

## KanbanMessageMap

Exact Phase A message inventory required from every Kanban locale.

```ts
interface KanbanMessageMap {
  'kanban.board.label': Message;   // Accessible board label.
  'kanban.board.no-columns': Message;   // Empty board state used when no workflow columns exist.
  'kanban.state.loading': Message;   // Initial source-loading state.
  'kanban.state.refreshing': Message;   // Background source-refresh state.
  'kanban.state.partial': Message;   // Partial-data state.
  'kanban.state.empty': Message;   // Empty-card state.
  'kanban.state.error': Message;   // Board source-error state.
  'kanban.action.retry': Message;   // Retry action label.
  'kanban.layout.minimum-size': Message;   // Minimum terminal geometry message using `width` and `height`.
  'kanban.count.unknown': Message;   // Label for an unavailable count.
  'kanban.count.truncated': Message;   // Lower-bound count using `count`.
  'kanban.focused-column.previous': Message;   // Previous-column navigation label.
  'kanban.focused-column.next': Message;   // Next-column navigation label.
  'kanban.focused-column.position': Message;   // Focused-column position using `current` and `total`.
  'kanban.card.invalid-title': Message;   // Safe replacement for an invalid mandatory card title.
  'kanban.card.unknown-status': Message;   // Safe replacement for an invalid mandatory card status.
  'kanban.reason.source-unavailable': Message;   // Payload-free source failure reason.
  'kanban.reason.renderer-unavailable': Message;   // Payload-free card renderer failure reason.
}
```

## KanbanMinimumGeometry

Atomic impossible-geometry projection with no partial targets.

```ts
interface KanbanMinimumGeometry {
  kind: 'minimum-size';   // Stable degraded-state discriminator.
  bounds: Readonly<Rect>;   // Parent-assigned rectangle.
  required: { readonly width: number; readonly height: number };   // Required usable dimensions.
  message: KanbanMinimumMessage;   // Bounded visible feedback.
  inspectionRegions: readonly KanbanLayoutRegion[];   // No partial header/card regions are exposed.
  actionTargets: readonly KanbanActionTarget[];   // No partial actions are exposed.
}
```

## KanbanMinimumMessage

One clipped minimum-size message rectangle.

```ts
interface KanbanMinimumMessage {
  text: string;   // Sanitized cell-safe visible text.
  width: number;   // Visible message width in terminal cells.
  height: number;   // Visible message height in terminal rows.
}
```

## KanbanMoveCapability

Presentation-only capability state for one proposed move.

```ts
interface KanbanMoveCapability {
  state: 'allowed' | 'disabled' | 'hidden';   // Presentation state; this value never authorizes persistence.
  reasonCode?: string;   // Optional machine-readable reason for a disabled or hidden move.
}
```

## KanbanMoveCardOptions

Options for moving one explicit card through the stable facade.

```ts
interface KanbanMoveCardOptions {
  cardKey: CardKey;   // Stable application-owned card identity.
  target?: KanbanCellAddress;   // Explicit semantic destination; omission requires a scene-relative direction.
  position?: KanbanCardMovePositionInput;   // Semantic edge resolved through the current destination cursor.
  direction?: KanbanMoveDirection;   // Scene-relative destination used when an explicit position or target is omitted.
  origin?: 'pointer' | 'keyboard' | 'programmatic';   // Input origin retained only for parity diagnostics; it never changes request semantics.
}
```

## KanbanMoveCurrentAuthority

Complete current semantic authority required before workflow policy is evaluated.

```ts
interface KanbanMoveCurrentAuthority {
  boardRevision?: KanbanRevision;   // Current board revision when the application publishes board-wide authority.
  sourceRevision: KanbanRevision;   // Current source generation revision.
  queryRevision: KanbanRevision;   // Current query revision.
  viewRevision?: KanbanRevision;   // Current saved or transient view revision when one controls placement.
  columns: readonly KanbanCurrentColumn[];   // Bounded current workflow columns and their entity revisions.
  swimlanes: readonly KanbanCurrentSwimlane[];   // Bounded current explicit swimlanes and their entity revisions.
  cards: readonly KanbanCurrentCard[];   // Bounded current cards relevant to this proposal and its captured expectations.
  sourceCells: readonly KanbanMoveSourceCellEvidence[];   // Per-source-cell evidence used to revalidate every moved card's original interval.
  targetCursorRevision: KanbanRevision;   // Current destination cursor revision.
  targetEdges: Readonly<{ readonly start: 'complete' | 'unknown'; readonly end: 'complete' | 'unknown' }>;   // Current completeness of the destination's logical edges.
  targetCardKeys: readonly CardKey[];   // Current destination anchors visible to semantic placement.
  placementTokens: readonly PlacementToken[];   // Current source-issued opaque destination placement tokens.
}
```

## KanbanMoveDirection

Direction names resolved against the current semantic scene rather than terminal coordinates.

```ts
type KanbanMoveDirection = 'left' | 'right' | 'start' | 'end'
```

## KanbanMovePendingProjection

Minimal pending projection for card movement, including no full card records.

```ts
interface KanbanMovePendingProjection {
  kind: 'card-move';   // Request discriminator represented by this projection.
  state: 'pending' | 'accepted';   // Lifecycle states that continue to render as pending.
  cardKeys: readonly CardKey[];   // Ordered stable card identities represented atomically.
  sources: readonly KanbanCellAddress[];   // Semantic source cells aligned by index with `cardKeys`.
  target: KanbanCellAddress;   // Shared semantic destination cell.
  position: KanbanMovePosition;   // Revision-bound semantic destination interval.
}
```

## KanbanMovePosition

Dispatchable semantic destination that never treats a visual index or generated rank as authority.

```ts
type KanbanMovePosition = | { readonly kind: 'start'; readonly cursorRevision: KanbanRevision }
  | { readonly kind: 'end'; readonly cursorRevision: KanbanRevision }
  | {
      readonly kind: 'between';
      readonly beforeCardKey: CardKey | null;
      readonly afterCardKey: CardKey | null;
      readonly cursorRevision: KanbanRevision;
    }
  | {
      readonly kind: 'window-edge';
      readonly edge: 'before' | 'after';
      readonly neighborCardKey: CardKey;
      readonly token: PlacementToken;
      readonly cursorRevision: KanbanRevision;
    }
```

## KanbanMovePositionCurrency

Pure result of checking semantic placement against current source evidence.

```ts
type KanbanMovePositionCurrency = { readonly kind: 'current' } | { readonly kind: 'unavailable'; readonly code: string }
```

## KanbanMovePositionEvidence

Evidence proving that one semantic target position still belongs to the current cursor.

```ts
interface KanbanMovePositionEvidence {
  cursorRevision: KanbanRevision;   // Current equality-only target cursor revision.
  edges: Readonly<{ readonly start: 'complete' | 'unknown'; readonly end: 'complete' | 'unknown' }>;   // Whether the source has proven each logical edge complete.
  cardKeys: readonly CardKey[];   // Stable card identities currently available as target anchors.
  placementTokens: readonly PlacementToken[];   // Opaque source-issued tokens that are current for this cursor revision.
}
```

## KanbanMoveSelectedBlockOptions

Options for moving the current bounded loaded selection atomically.

```ts
type KanbanMoveSelectedBlockOptions = Omit<KanbanMoveCardOptions, 'cardKey'>
```

## KanbanMoveSelection

Selection authority accepted by the synchronous move pipeline.

```ts
type KanbanMoveSelection = KanbanLoadedMoveSelection | KanbanServerMoveSelection
```

## KanbanMoveSourceCellEvidence

Current semantic placement evidence for one distinct source cell.

```ts
interface KanbanMoveSourceCellEvidence {
  address: Readonly<{ readonly columnId: KanbanColumnId; readonly swimlaneId?: KanbanSwimlaneId }>;   // Stable column/swimlane address whose cursor issued this evidence.
}
```

## KanbanMovedCardSnapshot

Source placement and revision evidence captured for one card in an atomic move.

```ts
interface KanbanMovedCardSnapshot {
  cardKey: CardKey;   // Stable application-owned card identity.
  source: KanbanCellAddress;   // Semantic source cell before the move.
  sourcePlacement: KanbanMovePosition;   // Source-issued semantic placement at capture time.
  sourceRevision: KanbanRevision;   // Equality-only source-cell revision captured with the placement.
  entityRevision: KanbanRevision;   // Equality-only card revision captured with the placement.
}
```

## KanbanNavigationDirection

Directions understood by programmatic spatial navigation.

```ts
type KanbanNavigationDirection = | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'home'
  | 'end'
  | 'page-up'
  | 'page-down'
  | 'board-start'
  | 'board-end'
  | 'previous-column'
  | 'next-column'
```

## KanbanNavigationSnapshot

Detached bounded scene evidence supplied to pure focus and navigation transitions.

```ts
interface KanbanNavigationSnapshot {
  revision: KanbanRevision;   // Equality-only scene revision.
  targets: readonly KanbanNavigationTarget[];   // Visible targets in deterministic scene order.
  viewportContentHeight: number;   // Visible content height used by page navigation.
}
```

## KanbanNavigationTarget

One bounded scene target used by pure navigation without reading a live view.

```ts
interface KanbanNavigationTarget {
  target: KanbanFocusTarget;   // Semantic focus target represented by this rectangle.
  sceneIndex: number;   // Source scene order used as the deterministic final tie-breaker.
  centerColumn: number;   // Viewport-local horizontal center in terminal cells.
  centerRow: number;   // Viewport-local vertical center in terminal rows.
  enabled: boolean;   // Whether the current policy permits focus.
}
```

## KanbanNonColorCue

One non-color distinction retained when terminal color is unavailable or insufficient.

```ts
type KanbanNonColorCue = | { readonly kind: 'marker'; readonly glyph: string }
  | { readonly kind: 'border'; readonly style: 'single' | 'double' | 'heavy' | 'dashed' }
  | { readonly kind: 'attribute'; readonly attrs: AttrMask }
  | { readonly kind: 'text'; readonly prefix: string }
```

## KanbanNumericSummary

Honest numeric summary that never presents unavailable authority as zero.

```ts
type KanbanNumericSummary = | { readonly scope: KanbanSummaryScope; readonly quality: 'unknown' }
  | {
      readonly scope: KanbanSummaryScope;
      readonly quality: 'exact' | 'estimated' | 'truncated';
      readonly value: number;
    }
```

## KanbanObservation

Safe diagnostic metadata that never contains application records, queries, tokens, or raw errors.

```ts
interface KanbanObservation {
  code: string;   // Stable sanitized reason code.
  scope: KanbanObservationScope;   // Small semantic scope used to route diagnostics.
  operationId?: KanbanOperationId;   // Optional operation identity for payload-free request lifecycle diagnostics.
  kind?: KanbanRequest['kind'];   // Optional request discriminator for payload-free operation lifecycle diagnostics.
  state?: KanbanOperationState;   // Optional operation lifecycle state.
  duration?: KanbanObservationDurationBucket;   // Optional coarse elapsed time since the operation was admitted.
  cardKey?: CardKey;   // Optional application card identity, preserving string and number distinction.
  columnId?: KanbanColumnId;   // Optional validated workflow-column identity.
  swimlaneId?: KanbanSwimlaneId;   // Optional validated swimlane identity.
  counts?: KanbanObservationCounts;   // Optional bounded payload-free counters.
  message?: string;   // Optional sanitized display label.
}
```

## KanbanObservationBuffer

Fixed-capacity FIFO buffer for already-redacted runtime observations.

```ts
new KanbanObservationBuffer(capacity: number)
// methods & signals:
push(observation: KanbanObservation): void
values(): readonly KanbanObservation[]
clear(): void
```

## KanbanObservationCounts

Bounded numeric counters that provide payload-free diagnostic context.

```ts
type KanbanObservationCounts = Readonly<Record<string, number>>
```

## KanbanObservationDurationBucket

Coarse monotonic elapsed-time band that avoids exposing precise timing data.

```ts
type KanbanObservationDurationBucket = 'under-10ms' | 'under-100ms' | 'under-1s' | 'under-10s' | '10s-or-more'
```

## KanbanObservationInput

Input accepted when converting a caught callback failure to safe diagnostic metadata.

```ts
interface KanbanObservationInput {
  error?: unknown;   // Raw callback failure, deliberately ignored after failure classification.
  message?: string;   // Optional already-safe label; raw exception messages must never be supplied here.
}
```

## KanbanObservationScope

Runtime scope in which an isolated application or package failure occurred.

```ts
type KanbanObservationScope = 'board' | 'query' | 'source' | 'cell' | 'card' | 'renderer' | 'request'
```

## KanbanOpenCardIntent

Requests that the application open or otherwise activate one card.

```ts
interface KanbanOpenCardIntent {
  kind: 'open-card';   // Stable intent discriminator.
  cardKey: CardKey;   // Application-owned card identity without the application record payload.
  address: KanbanCellAddress;   // Semantic cell containing the card when the intent was captured.
  actionId?: KanbanExtensionId;   // Optional descriptor action that requested the activation.
}
```

## KanbanOpenContextIntent

Requests an application-owned context surface for one closed semantic scope.

```ts
interface KanbanOpenContextIntent {
  kind: 'open-context';   // Stable intent discriminator.
  scope: KanbanActionScope;   // Semantic owner targeted after focus and eligible selection have settled.
}
```

## KanbanOpenContextOptions

Options for programmatic or mounted context activation.

```ts
interface KanbanOpenContextOptions {
  origin?: KanbanInteractionOrigin;   // Input channel; programmatic is used when omitted.
  scope?: KanbanActionScope;   // Explicit scope; omission resolves current semantic focus after earlier queued work settles.
}
```

## KanbanOperationId

A validated identity that correlates one application request and result.

```ts
type KanbanOperationId = string
```

## KanbanOperationIdFactory

Trusted synchronous factory used to propose one operation identity.

```ts
type KanbanOperationIdFactory = () => string
```

## KanbanOperationIdLease

Generation-bound active operation identity owned by one coordinator admission.

```ts
interface KanbanOperationIdLease {
  operationId: KanbanOperationId;   // Validated identity reserved by this lease.
  active(): boolean;   // Whether this exact lease still owns an active reservation.
  retain(): void;   // Complete the reservation and retain its identity in bounded collision history.
  release(): void;   // Abandon an undispatched reservation without retaining its identity.
}
```

## KanbanOperationIdRegistry

Active and retained collision protection for one board operation coordinator.

```ts
interface KanbanOperationIdRegistry {
  acquire(): KanbanOperationIdLease;   // Allocate a factory identity and reserve it as active.
  adopt(operationId: KanbanOperationId): KanbanOperationIdLease;   // Adopt a validated legacy caller identity and reserve it as active.
  dispose(): void;   // Release every active and retained identity; idempotent.
}
```

## KanbanOperationIdRegistryOptions

Options for one bounded operation-ID registry.

```ts
interface KanbanOperationIdRegistryOptions {
  factory?: KanbanOperationIdFactory;   // Optional application factory; the package validates every returned identity.
  activeLimit?: number;   // Maximum active identities before a new acquisition fails closed.
  retainedLimit?: number;   // Number of completed identities retained to prevent delayed-result collision.
}
```

## KanbanOperationSnapshot

Immutable payload-free state published by the board operation coordinator.

```ts
interface KanbanOperationSnapshot {
  operationId: KanbanOperationId;   // Stable identity of the operation.
  kind: KanbanRequest['kind'];   // Request discriminator without its application-owned payload.
  state: KanbanOperationState;   // Current lifecycle state.
  affected: readonly KanbanOperationSubject[];   // Sorted type-preserving identities reserved or affected by the operation.
  projection?: KanbanPendingProjection;   // Optional semantic pending projection for pending and accepted states only.
  code?: string;   // Optional safe machine-readable terminal or policy reason.
}
```

## KanbanOperationState

Durable operation states exposed without request payloads or application records.

```ts
type KanbanOperationState = 'proposed' | 'pending' | 'accepted' | 'committed' | 'rejected' | 'cancelled' | 'superseded'
```

## KanbanOperationSubject

Type-preserving identity used for conflict detection without retaining application records.

```ts
type KanbanOperationSubject = KanbanCardOperationSubject | KanbanColumnOperationSubject | KanbanSwimlaneOperationSubject
```

## KanbanOperationSubscriber

Callback invoked with one immutable payload-free lifecycle snapshot.

```ts
type KanbanOperationSubscriber = (snapshot: KanbanOperationSnapshot) => void
```

## KanbanOverscanOptions

Finite projection retained around the visible terminal cells.

```ts
interface KanbanOverscanOptions {
  vertical?: number;   // Extra viewport-height card window retained below and, when available, above the visible range.
  horizontal?: number;   // Extra source-ordered columns retained on each horizontal side.
}
```

## KanbanPendingNavigation

Navigation work that is waiting for a bounded reveal or data acquisition.

```ts
interface KanbanPendingNavigation {
  kind: 'reveal' | 'acquire';   // Operation being completed without moving the current focus prematurely.
  target: KanbanFocusTarget;   // Requested destination retained across asynchronous settlement.
}
```

## KanbanPendingProjection

Payload-free semantic projection retained only while an operation is pending or accepted.

```ts
type KanbanPendingProjection = KanbanMovePendingProjection | KanbanMarkerPendingProjection
```

## KanbanPhaseBMessageMap

Exact first-use Phase B message inventory required from every Kanban translation overlay.

```ts
interface KanbanPhaseBMessageMap {
  'kanban.state.descriptor-limit': Message;   // Partial-state evidence that names the number of descriptors omitted by the finite viewport budget.
  'kanban.action.open-card-editor': Message;   // Read-only card action that asks the application to open its card editor.
  'kanban.card.feedback.pending': Message;   // Compact feedback shown while a card operation is pending.
  'kanban.card.feedback.invalid': Message;   // Compact feedback shown when card validation is invalid.
  'kanban.card.feedback.rejected': Message;   // Compact feedback shown when a card operation is rejected.
  'kanban.state.filtered-empty': Message;   // Empty-result state used when active filters exclude every card.
  'kanban.state.collapsed': Message;   // Non-color cue for a collapsed structural region.
  'kanban.action.clear-filters': Message;   // Action that asks the application to remove active filters.
  'kanban.workflow.definition-of-done': Message;   // Compact heading for application-supplied definition-of-done text.
  'kanban.workflow.wip-minimum-not-met': Message;   // Feedback for a proposed count below the configured WIP minimum.
  'kanban.workflow.wip-maximum-exceeded': Message;   // Feedback for a proposed count above the configured WIP maximum.
  'kanban.workflow.wip-count-unavailable': Message;   // Feedback when blocking WIP authority is unavailable.
  'kanban.reason.transition-unavailable': Message;   // Payload-free feedback when the application transition resolver fails.
  'kanban.swimlane.unavailable': Message;   // Safe package-owned label for a derived-group resolver failure.
  'kanban.interaction.navigation-pending': Message;   // Feedback while bounded navigation is awaiting source work.
  'kanban.interaction.navigation-unavailable': Message;   // Feedback when a navigation destination cannot be acquired.
  'kanban.interaction.navigation-error': Message;   // Payload-free feedback when navigation fails unexpectedly.
  'kanban.interaction.selection-limit-exceeded': Message;   // Feedback when a selection operation exceeds the configured finite limit.
  'kanban.interaction.selection-pruned': Message;   // Feedback after ineligible selected cards are pruned.
  'kanban.interaction.selected-count': Message;   // Compact count shown while multiple loaded cards are selected.
  'kanban.interaction.server-selection-active': Message;   // Fallback label for an application-owned server selection without its own label.
  'kanban.interaction.unavailable': Message;   // Payload-free feedback when the interaction owner is unavailable.
}
```

## KanbanPlacement

Revision-bound semantic insertion placement returned by a cursor.

```ts
type KanbanPlacement = | { readonly kind: 'start'; readonly cursorRevision: KanbanRevision }
  | { readonly kind: 'end'; readonly cursorRevision: KanbanRevision }
  | {
      readonly kind: 'between';
      readonly beforeCardKey: CardKey | null;
      readonly afterCardKey: CardKey | null;
      readonly cursorRevision: KanbanRevision;
    }
  | {
      readonly kind: 'window-edge';
      readonly edge: 'before' | 'after';
      readonly neighborCardKey: CardKey;
      readonly token?: PlacementToken;
      readonly cursorRevision: KanbanRevision;
    }
  | {
      readonly kind: 'unavailable';
      readonly code: string;
      readonly label?: string;
      readonly prefetch?: KanbanPrefetchRange;
      readonly cursorRevision: KanbanRevision;
    }
```

## KanbanPrefetchRange

Half-open source range used as an optional placement prefetch hint.

```ts
interface KanbanPrefetchRange {
  start: number;   // First included logical card index.
  end: number;   // First excluded logical card index.
}
```

## KanbanPresentationInput

Preset name or complete custom presentation policy accepted by the public resolver.

```ts
type KanbanPresentationInput = KanbanCardDensity | KanbanCustomPresentation
```

## KanbanPresentationPresetDefault

Fixed scan-oriented values that define one named presentation preset.

```ts
interface KanbanPresentationPresetDefault {
  cardRows: number;   // Maximum rows occupied by the card descriptor.
  cardGap: number;   // Empty rows reserved between adjacent cards.
  metadataFields: number;   // Maximum metadata fields selected before geometry degradation.
  labelRows: number;   // Maximum rows available to wrapped labels.
  summarySections: number;   // Maximum summary sections selected before geometry degradation.
  checklistMode: 'hidden';   // Named presets keep checklist detail opt-in.
  checklistPreviewItems: 0;   // Hidden named presets do not reserve checklist preview work.
}
```

## KanbanPresentationPresetDefaultManifest

Complete fixed defaults for the three durable named presentation presets.

```ts
interface KanbanPresentationPresetDefaultManifest {
  compact: KanbanPresentationPresetDefault;   // Dense preset for terminals where vertical space is scarce.
  comfortable: KanbanPresentationPresetDefault;   // Default preset balancing scanability and optional card detail.
  spacious: KanbanPresentationPresetDefault;   // Detail-oriented preset for larger terminal surfaces.
}
```

## KanbanPublicationExpectation

Bounded publication metadata retained after an accepted request.

```ts
interface KanbanPublicationExpectation {
  operationId: KanbanOperationId;
  subjects: readonly KanbanPublicationSubject[];
}
```

## KanbanPublicationNotice

Exact authoritative notice accepted by operation publication reconciliation.

```ts
type KanbanPublicationNotice = KanbanConfirmedPublicationNotice | KanbanSubjectPublicationNotice
```

## KanbanPublicationReconciliation

Pure reconciliation result that contains no application records.

```ts
interface KanbanPublicationReconciliation {
  pending: readonly KanbanPublicationExpectation[];
  cleared?: KanbanPublicationNotice;
}
```

## KanbanPublicationSubject

One structural subject represented only by safe identity and revision metadata.

```ts
type KanbanPublicationSubject = KanbanCardPublicationSubject | KanbanColumnPublicationSubject | KanbanSwimlanePublicationSubject
```

## KanbanQuery

Immutable semantic read projection opened by a Kanban data source.

```ts
interface KanbanQuery {
  search?: string;   // Optional bounded plain-text search term.
  filters?: readonly KanbanFilter[];   // Ordered local filter directives.
  groupBy?: KanbanFieldId;   // Optional field used to derive semantic swimlanes.
  sort?: readonly KanbanSort[];   // Ordered stable sort directives.
  visibleColumnIds?: readonly KanbanColumnId[];   // Optional allowlist of visible workflow columns.
  visibleSwimlaneIds?: readonly KanbanSwimlaneId[];   // Optional allowlist of visible semantic swimlanes.
  viewRevision?: KanbanRevision;   // Equality-only application revision of the saved or active view.
}
```

## KanbanQuerySession

Independently disposable read session for one semantic query.

```ts
interface KanbanQuerySession<TCard> {
  state(): KanbanSourceState;   // Returns the reactive board-wide source state.
  revision(): KanbanRevision;   // Returns the equality-only active session revision.
  columns(): readonly KanbanColumnMeta[];   // Returns ordered reactive column metadata.
  swimlanes(): readonly KanbanSwimlaneMeta[];   // Returns ordered reactive swimlane metadata.
  counts(): KanbanBoardCounts;   // Returns honest reactive board-wide counts.
  headers(): KanbanHeaderBatch;   // Returns atomic reactive header metadata.
  identityChanges(): KanbanIdentityChangeBatch;   // Returns authoritative reactive deletion facts.
  cell(address: KanbanCellAddress): KanbanCellCursor<TCard>;   // Opens a sparse cursor only for the explicitly requested semantic cell.
  locateCard?(key: CardKey, options?: { readonly signal?: AbortSignal }): Promise<KanbanCardLocation> | KanbanCardLocation;   // Performs one bounded optional identity lookup without scanning cursor contents.
  swimlaneLayoutHints?(request: KanbanSwimlaneLayoutHintRequest, options?: { readonly signal?: AbortSignal }): Promise<KanbanSwimlaneLayoutHintBatch> | KanbanSwimlaneLayoutHintBatch;   // Optionally returns payload-free aggregate swimlane extents for preliminary grouped layout. The signal aborts only this hint request and never disposes the owning query session.
  dispose(): void;   // Releases session work and child resources idempotently.
}
```

## KanbanRangeAnchor

Explicit anchor used for range selection inside one semantic cell.

```ts
interface KanbanRangeAnchor {
  cardKey: CardKey;   // Stable card identity at which range extension began.
  address: KanbanCellAddress;   // Cell containing the anchor when it was established.
}
```

## KanbanReorderColumnOptions

Options for reordering one workflow column among stable siblings.

```ts
interface KanbanReorderColumnOptions {
  columnId: string;   // Stable column being moved.
  position: KanbanColumnPosition;   // Stable-neighbor destination.
}
```

## KanbanReorderSwimlaneOptions

Options for reordering one explicit swimlane among stable siblings.

```ts
interface KanbanReorderSwimlaneOptions {
  swimlaneId: string;   // Stable explicit swimlane being moved.
  position: KanbanSwimlanePosition;   // Stable-neighbor destination.
}
```

## KanbanRequest

Final request union accepted by the application dispatcher.

```ts
type KanbanRequest = KanbanStandardRequest | KanbanExtensionRequest
```

## KanbanRequestAccepted

Publication metadata returned with an accepted request result.

```ts
interface KanbanRequestAccepted {
  kind: 'accepted';   // Result discriminator.
  operationId: KanbanOperationId;   // Identity of the operation being acknowledged.
  publication?: KanbanPublicationExpectation;   // Optional authoritative publication expected before commit.
  undo?: KanbanUndoDescriptor;   // Optional application-owned descriptor retained only after authoritative commit.
}
```

## KanbanRequestCancelled

Explicit cancellation outcome, distinct from rejection and supersession.

```ts
interface KanbanRequestCancelled {
  kind: 'cancelled';   // Result discriminator.
  operationId: KanbanOperationId;   // Identity of the cancelled operation.
  code?: string;   // Optional safe machine-readable reason code.
  label?: string;   // Optional sanitized application-facing reason label.
}
```

## KanbanRequestContext

Context captured and passed to the application dispatcher.

```ts
interface KanbanRequestContext {
  capabilities: KanbanCapabilities;   // UX capability descriptions for diagnostics only, never authorization.
}
```

## KanbanRequestDispatcher

Application-owned dispatcher; capability descriptions never authorize this call.

```ts
type KanbanRequestDispatcher = (
  request: KanbanRequest,
  context: KanbanRequestContext,
) => KanbanRequestResult | Promise<KanbanRequestResult>
```

## KanbanRequestExpectedRevisions

Equality-only revisions captured with an application request.

```ts
interface KanbanRequestExpectedRevisions {
  board?: KanbanRevision;   // Optional board-wide equality revision.
  source?: KanbanRevision;   // Optional source-session equality revision.
  query?: KanbanRevision;   // Optional active-query equality revision.
  entities?: readonly KanbanExpectedEntityRevision[];   // Bounded entity revisions that must still match before dispatch.
}
```

## KanbanRequestLifecycle

Package-owned lifecycle values added to a validated proposal immediately before dispatch.

```ts
interface KanbanRequestLifecycle {
  operationId: KanbanOperationId;   // Unique operation identity allocated or adopted for this dispatch.
  expected: KanbanRequestExpectedRevisions;   // Equality-only authority snapshot captured before application code runs.
  signal: AbortSignal;   // Live cancellation signal owned by the operation coordinator.
}
```

## KanbanRequestProposal

Complete caller-facing standard and namespaced-extension proposal union.

```ts
type KanbanRequestProposal = | KanbanCardRequestProposal
  | KanbanStructureRequestProposal
  | KanbanSavedViewRequestProposal
  | KanbanExtensionRequestProposal
```

## KanbanRequestRejected

Sanitized application rejection.

```ts
interface KanbanRequestRejected {
  kind: 'rejected';   // Result discriminator.
  operationId: KanbanOperationId;   // Identity of the rejected operation.
  code: string;   // Safe machine-readable reason code.
  label?: string;   // Optional sanitized application-facing reason label.
}
```

## KanbanRequestResult

Terminal operation-correlated result returned by the application dispatcher.

```ts
type KanbanRequestResult = KanbanRequestAccepted | KanbanRequestRejected | KanbanRequestCancelled | KanbanRequestSuperseded
```

## KanbanRequestSuperseded

Outcome indicating that a newer application operation replaced this request.

```ts
interface KanbanRequestSuperseded {
  kind: 'superseded';   // Result discriminator.
  operationId: KanbanOperationId;   // Identity of the superseded operation.
  code?: string;   // Optional safe machine-readable reason code.
  label?: string;   // Optional sanitized application-facing reason label.
}
```

## KanbanResolvedCustomSwimlaneGeometry

Geometry-only custom chrome values safe to consume during scene projection.

```ts
interface KanbanResolvedCustomSwimlaneGeometry {
  swimlaneId: string;   // Stable validated swimlane identity.
  rows: number;   // Horizontal rows reserved above this swimlane's cards.
  railWidth: number;   // Left cells reserved beside every card column.
  regions: readonly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];   // Bounded header-only regions copied away from application ownership.
}
```

## KanbanResolvedGroupingMembership

Resolved card membership in one semantic swimlane address.

```ts
interface KanbanResolvedGroupingMembership<TCardKey extends CardKey = CardKey> {
  cardKey: TCardKey;   // Stable application card identity.
  address: { readonly swimlaneId: string };   // One-dimensional semantic grouping address.
}
```

## KanbanResolvedGroupingMeta

Semantic swimlane metadata after safe label, style, summary, and view-state projection.

```ts
interface KanbanResolvedGroupingMeta {
  disambiguator?: string;   // Optional visible duplicate-label distinction.
  visibility: 'visible' | 'hidden';   // Whether the group participates in the visible scene.
  collapse: 'expanded' | 'collapsed';   // Whether retained chrome suppresses ordinary card regions.
  style?: KanbanStructureStyle;   // Optional allowlisted semantic style.
  summary?: KanbanGroupingSummary;   // Optional bounded application summary.
}
```

## KanbanResolvedLimits

Every validated concrete limit keyed by the public manifest.

```ts
type KanbanResolvedLimits = Readonly<Record<keyof KanbanLimitManifest, number>>
```

## KanbanResolvedSwimlaneChrome

Built-in or validated custom chrome selected for one semantic swimlane.

```ts
type KanbanResolvedSwimlaneChrome = | {
      readonly kind: KanbanSwimlanePresentationVariant;
      readonly rows: 1;
      readonly fill: boolean;
      readonly railWidth: number;
    }
  | { readonly kind: 'custom'; readonly descriptor: KanbanSwimlaneChromeDescriptor }
```

## KanbanResolvedThemeRole

Effective style and non-color evidence for one requested semantic role.

```ts
interface KanbanResolvedThemeRole {
  role: KanbanThemeRole;   // Allowlisted role ultimately selected for drawing.
  style: ThemeRole;   // Detached terminal style selected by the fallback chain.
  cues: readonly [KanbanNonColorCue, ...KanbanNonColorCue[]];   // Non-empty redundant semantic cues.
  fallback: 'none' | 'mapped-core' | 'family' | 'emergency';   // Fallback stage that produced the effective style.
  contrastRatio?: number;   // Effective-depth contrast ratio; omitted for monochrome, no-color, or unresolvable defaults.
}
```

## KanbanRevealAlignment

Placement preference for an imperative card reveal.

```ts
type KanbanRevealAlignment = 'nearest' | 'start' | 'center' | 'end'
```

## KanbanRevealResult

Public result of a bounded identity reveal.

```ts
interface KanbanRevealResult {
  location: KanbanCardLocation;   // Locator outcome; unsupported and unknown remain explicit.
  scrolled: boolean;   // Whether the viewport offsets changed.
}
```

## KanbanRevision

Equality-only revision value published by an application or data source.

```ts
type KanbanRevision = string | number
```

## KanbanRowExtent

Honest row-extent knowledge that never converts incomplete data to zero.

```ts
type KanbanRowExtent = { readonly quality: 'unknown' } | { readonly quality: 'exact' | 'lower-bound'; readonly value: number }
```

## KanbanSafeRenderOptions

Options for isolated renderer execution and redacted diagnostics.

```ts
interface KanbanSafeRenderOptions {
  labels: KanbanCardFallbackLabels;   // Localized fallback labels supplied by the board locale resolver.
  observe?: (observation: KanbanObservation) => void;   // Optional sink for already-redacted package observations.
}
```

## KanbanSavedViewDeleteProposal

Delete one application-owned saved view.

```ts
interface KanbanSavedViewDeleteProposal {
  kind: 'saved-view-delete';   // Request discriminator.
  viewId: KanbanViewId;   // Stable application-owned view identity.
}
```

## KanbanSavedViewRenameProposal

Rename one application-owned saved view.

```ts
interface KanbanSavedViewRenameProposal {
  kind: 'saved-view-rename';   // Request discriminator.
  viewId: KanbanViewId;   // Stable application-owned view identity.
  label: string;   // Safe human-readable replacement label.
}
```

## KanbanSavedViewRequestProposal

Saved-view standard proposals defined for later package-owned view UI.

```ts
type KanbanSavedViewRequestProposal = KanbanSavedViewSaveProposal | KanbanSavedViewRenameProposal | KanbanSavedViewDeleteProposal
```

## KanbanSavedViewSaveProposal

Save or replace one application-owned semantic view definition.

```ts
interface KanbanSavedViewSaveProposal {
  kind: 'saved-view-save';   // Request discriminator.
  viewId: KanbanViewId;   // Stable application-owned view identity.
  data: KanbanSemanticValue;   // Bounded semantic view definition.
}
```

## KanbanScene

Canonical immutable semantic scene shared by every presentation variant.

```ts
interface KanbanScene {
  revision: KanbanRevision;   // Equality-only scene revision.
  queryGeneration: number;   // Query generation that owns every resident cell.
  sessionRevision: KanbanRevision;   // Revision of the owning board-wide query session.
  columns: readonly KanbanColumnMeta[];   // Source-ordered workflow columns.
  swimlanes: readonly KanbanSceneSwimlane[];   // Source-ordered visible swimlanes.
  cells: readonly KanbanSceneCell[];   // Occupied or explicitly retained cells only; no Cartesian synthesis.
  cards: readonly KanbanSceneCard[];   // Source-ordered resident cards flattened for bounded projection.
  states: readonly KanbanSceneLimitState[];   // Non-actionable partial-state evidence.
  detached: KanbanSemanticValue;   // Hidden and collapsed semantic evidence with no terminal geometry.
}
```

## KanbanSceneCard

One resident card in the canonical semantic scene.

```ts
interface KanbanSceneCard {
  cardKey: CardKey;   // Stable application-owned card identity.
  address: KanbanCellAddress;   // Semantic source cell containing the card.
  logicalIndex: number;   // Zero-based logical position in the owning cursor.
  entityRevision: KanbanRevision;   // Equality-only application entity revision.
  descriptor: KanbanSceneCardDescriptor;   // Immutable renderer-neutral descriptor.
  interaction: KanbanSemanticValue;   // Detached focus and selection evidence.
  workflow: KanbanSemanticValue;   // Detached workflow eligibility evidence.
}
```

## KanbanSceneCardDescriptor

Renderer-neutral card descriptor fields required by scene geometry and inspection.

```ts
interface KanbanSceneCardDescriptor {
  cardKey: CardKey;   // Typed card identity repeated by the descriptor.
  width: number;   // Exact descriptor width in terminal cells.
  measuredHeight: number;   // Exact descriptor height in terminal rows.
  presentationRevision?: KanbanRevision;   // Equality-only card presentation revision.
  value: KanbanSemanticValue;   // Complete detached descriptor payload already validated by its owning presentation boundary.
}
```

## KanbanSceneCardGeometry

One projected card descriptor rectangle.

```ts
interface KanbanSceneCardGeometry {
  cardKey: CardKey;   // Stable application-owned card identity.
  address: KanbanCellAddress;   // Owning semantic cell address.
  logicalIndex: number;   // Source cursor position.
  descriptorColumnOffset: number;   // Descriptor columns clipped from the left edge.
  descriptorRowOffset: number;   // Descriptor rows clipped from the top edge.
}
```

## KanbanSceneCell

One occupied or explicitly retained semantic source cell.

```ts
interface KanbanSceneCell {
  address: KanbanCellAddress;   // Stable workflow-column and optional swimlane coordinate.
  cursorRevision: KanbanRevision;   // Equality-only owning cursor revision.
  state: KanbanCellState;   // Current source lifecycle state.
  cards: readonly KanbanSceneCard[];   // Source-ordered resident cards retained within the descriptor ceiling.
}
```

## KanbanSceneCellGeometry

One projected sparse source cell.

```ts
interface KanbanSceneCellGeometry {
  address: KanbanCellAddress;   // Stable semantic cell address.
}
```

## KanbanSceneCellHeightProjection

One semantic cell's bounded sparse descriptor-height evidence.

```ts
interface KanbanSceneCellHeightProjection {
  address: KanbanCellAddress;   // Exact semantic source cell that owns the projection.
  projection: KanbanVerticalHeightProjection;   // Descriptor-only rows and extent; scene geometry adds the active resting gap.
}
```

## KanbanSceneCustomChromeInput

One application-produced, already semantic-scoped custom swimlane descriptor.

```ts
interface KanbanSceneCustomChromeInput {
  swimlaneId: string;   // Stable swimlane identity receiving this chrome.
  descriptor: KanbanSwimlaneChromeDescriptor;   // Bounded renderer-neutral descriptor returned by the presentation resolver.
}
```

## KanbanSceneGeometry

Complete immutable exact-cell projection of a canonical semantic scene.

```ts
interface KanbanSceneGeometry {
  revision: KanbanRevision;   // Equality-only scene revision represented by this projection.
  requestedVariant: KanbanSceneGeometryVariant;   // Requested presentation before responsive strategy resolution.
  resolvedVariant: KanbanSceneGeometryVariant;   // Effective built-in presentation.
  visibleColumnIds: readonly string[];   // Source-ordered workflow columns retained by the projection.
  offsets: { readonly x: number; readonly y: number };   // Clamped offsets used for projection.
  extents: { readonly x: number; readonly y: number };   // Greatest currently valid offsets.
  contentOrigin: { readonly x: number; readonly y: number };   // First cell below the sticky workflow-header row.
  anchor?: KanbanSceneGeometryAnchor;   // Preserved stable anchor when one was supplied.
  workflowHeaders: readonly KanbanSceneWorkflowHeaderGeometry[];   // Sticky workflow-column header rectangles.
  swimlaneChrome: readonly KanbanSceneSwimlaneChromeGeometry[];   // Source-ordered visible swimlane chrome rectangles.
  cells: readonly KanbanSceneCellGeometry[];   // Sparse occupied cell rectangles.
  cards: readonly KanbanSceneCardGeometry[];   // Source-ordered card rectangles.
  regions: readonly KanbanSceneGeometryRegion[];   // Positive-area semantic regions used by later drawing, hit, and damage projection.
  changedRegions: readonly Readonly<Rect>[];   // Regions changed relative to an optional future projection baseline.
}
```

## KanbanSceneGeometryAnchor

Stable resize anchor retained independently from terminal rectangles.

```ts
interface KanbanSceneGeometryAnchor {
  cardKey: CardKey;   // Application-owned card identity.
  preferredRow: number;   // Preferred viewport row for the anchored card.
}
```

## KanbanSceneGeometryRegion

One clipped positive-area region available to drawing, damage, and inspection.

```ts
interface KanbanSceneGeometryRegion {
  kind: KanbanSceneRegionKind;   // Stable semantic purpose of this rectangle.
  columnId?: string;   // Workflow column owning the region when applicable.
  swimlaneId?: string;   // Swimlane owning the region when applicable.
  cardKey?: CardKey;   // Card owning the region when applicable.
  actionable: false;   // Resting geometry is non-actionable until hit projection closes its semantic scope.
}
```

## KanbanSceneGeometryVariant

Scene presentation layouts supported by the geometry projector.

```ts
type KanbanSceneGeometryVariant = 'hybrid' | 'separator' | 'band' | 'rail' | 'custom'
```

## KanbanSceneHitProjection

Immutable clipped target list tied to one scene revision.

```ts
interface KanbanSceneHitProjection {
  revision: KanbanRevision;   // Scene revision represented by every target.
  targets: readonly KanbanActionTarget[];   // Highest-priority-first bounded target list.
}
```

## KanbanSceneLimitState

Non-actionable semantic evidence that visible descriptor demand exceeded its finite budget.

```ts
interface KanbanSceneLimitState {
  code: 'descriptor-limit';   // Stable state code used by drawing and inspection.
  scope: { readonly kind: 'cell'; readonly address: KanbanCellAddress };   // Owning source cell.
  actionable: false;   // Limit surfaces never become an interaction target.
  omittedCount: number;   // Number of source-ordered resident descriptors omitted from this scene.
}
```

## KanbanSceneRegionKind

Semantic region kinds emitted by built-in scene geometry.

```ts
type KanbanSceneRegionKind = | 'workflow-header'
  | 'swimlane-header'
  | 'swimlane-band'
  | 'swimlane-separator'
  | 'swimlane-rail'
  | 'swimlane-custom'
  | 'cell'
  | 'card'
  | 'state'
```

## KanbanSceneSwimlane

Semantic swimlane header retained before any terminal geometry is assigned.

```ts
interface KanbanSceneSwimlane {
  swimlaneId: string;   // Stable application-owned swimlane identity.
  label: string;   // Sanitized display label.
  revision: KanbanRevision;   // Equality-only presentation revision.
  count?: KanbanSemanticValue;   // Optional detached count or summary evidence.
}
```

## KanbanSceneSwimlaneChromeGeometry

One visible swimlane chrome rectangle.

```ts
interface KanbanSceneSwimlaneChromeGeometry {
  swimlaneId: string;   // Stable semantic swimlane identity.
  label: string;   // Sanitized source label.
  sticky: boolean;   // Whether this active row is pinned beneath the workflow headers.
  variant: KanbanSceneGeometryVariant;   // Effective built-in visual treatment.
}
```

## KanbanSceneWindowCell

Preliminary column plus logical swimlane-index coordinate.

```ts
interface KanbanSceneWindowCell {
  columnId: string;   // Stable visible workflow-column identity.
  swimlaneIndex: number;   // Source-ordered semantic swimlane index resolved to identity by the owning publication.
}
```

## KanbanSceneWindowLayoutHint

Revision-bound aggregate hint used by preliminary scene-window projection.

```ts
interface KanbanSceneWindowLayoutHint {
  queryGeneration: number;   // Query generation that owns the hint.
  sessionRevision: KanbanRevision;   // Query-session revision that owns the hint.
  rows: readonly KanbanSceneWindowLayoutRow[];   // Source-ordered bounded aggregate row spans.
}
```

## KanbanSceneWindowLayoutRow

Preliminary row-axis aggregate used without opening preceding semantic cells.

```ts
interface KanbanSceneWindowLayoutRow {
  start: number;   // First included semantic swimlane index covered by this aggregate.
  end: number;   // First excluded semantic swimlane index covered by this aggregate.
  extent: number;   // Aggregate terminal rows occupied by the covered semantic range.
  quality: 'exact' | 'lower-bound' | 'unknown';   // Honest completeness of the aggregate row extent.
}
```

## KanbanSceneWindowResult

Honest preliminary row projection outcome.

```ts
type KanbanSceneWindowResult = | {
      readonly kind: 'available';
      readonly requestedCells: readonly KanbanSceneWindowCell[];
      readonly range: { readonly start: number; readonly end: number };
      readonly quality: 'known' | 'hinted';
    }
  | {
      readonly kind: 'unavailable';
      readonly code: 'distant-layout-unknown' | 'retention-limit' | 'cell-open-failed';
      readonly retryable: boolean;
    }
```

## KanbanSceneWorkflowHeaderGeometry

One sticky workflow-column header rectangle.

```ts
interface KanbanSceneWorkflowHeaderGeometry {
  columnId: string;   // Stable workflow-column identity.
  label: string;   // Sanitized source label.
  contentOffset: number;   // Header columns clipped from the left by horizontal scrolling.
  contentWidth: number;   // Complete unclipped workflow-column width.
  sticky: true;   // Workflow headers always remain vertically sticky.
}
```

## KanbanScopedActionId

Complete action identity accepted by the application-owned scoped-action boundary.

```ts
type KanbanScopedActionId = KanbanBuiltInActionId | KanbanExtensionId
```

## KanbanScopedActionIntent

Requests one application-owned action without mutating board data or policy locally.

```ts
interface KanbanScopedActionIntent {
  kind: 'scoped-action';   // Stable intent discriminator.
  actionId: KanbanScopedActionId;   // Package-owned or validated application-namespaced semantic action.
  scope: KanbanActionScope;   // Closed semantic owner of the action.
}
```

## KanbanScrollAnchor

Stable semantic anchor used to restore a containing column and relative card row.

```ts
interface KanbanScrollAnchor {
  columnId: string;   // Containing workflow column identity.
  cardKey?: CardKey;   // Stable card identity when a visible card can be anchored.
  relativeRow: number;   // Preferred card row relative to the scrolling viewport.
  columnOffset: number;   // Horizontal offset retained inside the containing column.
}
```

## KanbanScrollTarget

Partial two-axis terminal-cell target accepted by imperative scrolling.

```ts
interface KanbanScrollTarget {
  x?: number;   // Optional horizontal cell offset.
  y?: number;   // Optional vertical cell offset.
}
```

## KanbanSelectionEntry

One eligible selected card detached from live cursor and application ownership.

```ts
interface KanbanSelectionEntry {
  cardKey: CardKey;   // Stable type-preserving application card identity.
  address: KanbanCellAddress;   // Semantic cell occupied when the snapshot was captured.
  entityRevision: KanbanRevision;   // Equality-only entity revision captured with the selection.
}
```

## KanbanSelectionOperation

Selection operations owned by the interaction controller.

```ts
type KanbanSelectionOperation = | 'replace'
  | 'toggle'
  | 'range'
  | 'select-loaded-visible-matching'
  | 'clear-multiple'
  | 'set-server-selection'
  | 'clear-server-selection'
```

## KanbanSelectionSnapshot

Immutable bounded selection captured for one later action or request.

```ts
interface KanbanSelectionSnapshot {
  entries: readonly KanbanSelectionEntry[];   // Ordered eligible selected cards.
  sessionRevision: KanbanRevision;   // Query-session revision that owns every entry.
  queryGeneration: number;   // Query generation that owns every entry.
  viewRevision?: KanbanRevision;   // Optional application saved-view revision.
}
```

## KanbanSemanticValue

Recursive immutable value domain used by queries and application extension payloads.

```ts
type KanbanSemanticValue = null | boolean | number | string | readonly KanbanSemanticValue[] | { readonly [key: string]: KanbanSemanticValue }
```

## KanbanServerMoveSelection

Server-side selection that cannot be expanded into an ordered atomic move locally.

```ts
interface KanbanServerMoveSelection {
  kind: 'server';   // Selection discriminator for a set that cannot be expanded locally.
}
```

## KanbanServerSelectionReference

Opaque application reference for a server-wide selection not expanded into resident card keys.

```ts
interface KanbanServerSelectionReference {
  token: string;   // Bounded opaque token interpreted only by the owning application.
  revision?: KanbanRevision;   // Optional equality-only revision of the represented server selection.
  label?: string;   // Optional sanitized localized description of the selection scope.
}
```

## KanbanSessionPublication

Complete atomic source metadata publication used by deterministic sources and validators.

```ts
interface KanbanSessionPublication {
  revision: KanbanRevision;   // Equality-only revision of every value in this snapshot.
  state: KanbanSourceState;   // Board-wide lifecycle state.
  columns: readonly KanbanColumnMeta[];   // Ordered workflow-column metadata.
  swimlanes: readonly KanbanSwimlaneMeta[];   // Ordered optional swimlane metadata.
  counts: KanbanBoardCounts;   // Honest board-wide count qualities.
  headers: KanbanHeaderBatch;   // Header metadata from the same revision.
  identityChanges: KanbanIdentityChangeBatch;   // Authoritative identity facts from the same revision.
}
```

## KanbanSolvedColumnWidth

Final width assigned to one source-ordered column.

```ts
interface KanbanSolvedColumnWidth {
  columnId: string;   // Stable column identity.
  width: number;   // Assigned surface width, excluding the separator.
  minimumWidth: number;   // Validated effective minimum used by the solver.
  preferredWidth: number;   // Validated preferred width used by the solver.
  maximumWidth: number;   // Validated maximum width used by the solver.
}
```

## KanbanSort

One stable ordering directive in a semantic query.

```ts
interface KanbanSort {
  fieldId: KanbanFieldId;   // Application field evaluated by a registered sort adapter.
  direction: 'ascending' | 'descending';   // Requested order for values of the field.
}
```

## KanbanSortField

Application stable-order adapter used by the eager source.

```ts
interface KanbanSortField<TCard> {
  fieldId: KanbanFieldId;   // Semantic field selected by a sort directive.
  compare: (left: TCard, right: TCard) => -1 | 0 | 1;   // Compares two cards in ascending semantic order.
}
```

## KanbanSourceState

Reactive lifecycle state published by a query session.

```ts
type KanbanSourceState = | { readonly kind: 'loading' | 'ready' | 'refreshing' | 'partial' | 'empty' }
  | { readonly kind: 'error'; readonly code: string; readonly label?: string }
```

## KanbanSparseHeightAnchor

Stable card position used while exact measurements correct estimated geometry.

```ts
interface KanbanSparseHeightAnchor {
  cardKey: CardKey;   // Stable application-owned card identity.
  logicalIndex: number;   // Zero-based logical position in the owning cursor.
  viewportRow: number;   // Preferred row relative to the card-content viewport.
}
```

## KanbanSparseHeightIndex

Bounded sparse prefix-height index for one retained semantic cell.

```ts
new KanbanSparseHeightIndex(options: KanbanSparseHeightIndexOptions)
// methods & signals:
anchor(anchor: KanbanSparseHeightAnchor): KanbanSparseHeightAnchor
anchorFor(cardKey: CardKey): KanbanSparseHeightRetainedAnchor | undefined
unload(cardKey: CardKey): void
interactionIdentity(cardKey: CardKey): Readonly<{ cardKey: CardKey; logicalIndex: number }> | undefined
reconcile(input: KanbanSparseHeightReconciliation): void
invalidateRevisions(input: KanbanSparseHeightRevisionInput): number
rowAt(logicalIndex: number): KanbanSparseHeightPosition
indexAt(row: number): KanbanSparseHeightLookup
snapshot(): KanbanSparseHeightSnapshot
dispose(): void
```

## KanbanSparseHeightIndexOptions

Construction values for one retained semantic cell's sparse height index.

```ts
interface KanbanSparseHeightIndexOptions {
  logicalLength: number;   // Logical cards reported by the owning cursor without requiring materialization.
  estimatedHeight: number;   // Estimated occupied rows for each card whose exact height is not retained.
  maximumAnchors: number;   // Maximum exact card anchors retained by this index.
  maximumRuns: number;   // Maximum contiguous measured run summaries retained by this index.
  sourceRevision: KanbanRevision;   // Source revision that owns the measurements.
  cursorRevision: KanbanRevision;   // Cursor revision that owns the logical indexes.
  presentationRevision: KanbanRevision;   // Presentation revision that owns the measured heights.
}
```

## KanbanSparseHeightLookup

Result of converting a terminal row back to one logical card position.

```ts
interface KanbanSparseHeightLookup {
  logicalIndex: number;   // Nearest zero-based logical card position at or before the requested row.
  row: number;   // Saturated terminal row at which that logical position starts.
  quality: 'exact' | 'estimated';   // Whether every preceding occupied height was measured.
}
```

## KanbanSparseHeightMeasurement

One exact resident height supplied after descriptor measurement.

```ts
interface KanbanSparseHeightMeasurement {
  cardKey: CardKey;   // Stable application-owned card identity.
  logicalIndex: number;   // Zero-based logical position in the owning cursor.
  height: number;   // Exact occupied rows for this card under the active presentation revision.
  anchor?: KanbanSparseHeightAnchor;   // Optional stable visible anchor that must retain its viewport-relative row.
}
```

## KanbanSparseHeightMeasurementResult

Result of applying one resident measurement.

```ts
type KanbanSparseHeightMeasurementResult = | { readonly kind: 'measured'; readonly cardKey: CardKey; readonly logicalIndex: number }
  | {
      readonly kind: 'corrected';
      readonly cardKey: CardKey;
      readonly logicalIndex: number;
      readonly viewportRow: number;
      readonly passes: 1;
    }
```

## KanbanSparseHeightPosition

Estimated or exact conversion between logical positions and terminal rows.

```ts
interface KanbanSparseHeightPosition {
  value: number;   // Saturated non-negative terminal row.
  quality: 'exact' | 'estimated';   // Whether the conversion crossed any estimated card span.
}
```

## KanbanSparseHeightReconciliation

Authoritative source reconciliation for one retained interaction identity.

```ts
type KanbanSparseHeightReconciliation = | {
      readonly kind: 'reorder';
      readonly cardKey: CardKey;
      readonly logicalIndex: number;
      readonly sourceRevision: KanbanRevision;
    }
  | { readonly kind: 'delete'; readonly cardKey: CardKey; readonly sourceRevision: KanbanRevision }
```

## KanbanSparseHeightRetainedAnchor

Retained exact or estimated evidence for one stable card anchor.

```ts
interface KanbanSparseHeightRetainedAnchor {
  height: number;   // Exact measured or fallback estimated occupied rows.
  quality: 'exact' | 'estimated';   // Whether the retained height remains compatible with current revisions.
}
```

## KanbanSparseHeightRevisionInput

Complete active revision tuple used to prune incompatible exact measurements.

```ts
interface KanbanSparseHeightRevisionInput {
  sourceRevision: KanbanRevision;   // Current source publication revision.
  cursorRevision: KanbanRevision;   // Current owning cursor revision.
  presentationRevision: KanbanRevision;   // Current presentation revision for height measurement.
}
```

## KanbanSparseHeightSnapshot

Counter-only immutable evidence for scale tests and support diagnostics.

```ts
interface KanbanSparseHeightSnapshot {
  logicalLength: number;   // Logical cards represented without a logical-length-sized allocation.
  estimatedHeight: number;   // Current estimate used for unmeasured spans.
  retainedAnchors: number;   // Number of exact resident anchors.
  retainedRuns: number;   // Number of contiguous measured run summaries.
  allocatedEntries: number;   // Total bounded records held by the sparse index.
  revisions: {
    readonly source: KanbanRevision;
    readonly cursor: KanbanRevision;
    readonly presentation: KanbanRevision;
  };   // Revisions that determine measurement compatibility.
}
```

## KanbanStandardCardCompositionContext

Geometry/theme inputs used to compose one detached rich card snapshot.

```ts
interface KanbanStandardCardCompositionContext {
  width: number;   // Exact descriptor width in terminal cells.
  rowBudget: number;   // Maximum descriptor rows for this projection.
  theme: Readonly<KanbanTheme>;   // Fully resolved semantic theme.
  capabilities: Readonly<KanbanCardTerminalCapabilities>;   // Terminal features used for deterministic text geometry.
  openEditorLabel?: string;   // Optional localized label for the read-only checklist editor action.
  feedbackLabels?: Partial<Readonly<Record<'pending' | 'invalid' | 'rejected', string>>>;   // Optional localized compact labels for pending, invalid, and rejected card state.
}
```

## KanbanStandardRequest

Final package-owned standard dispatch envelope.

```ts
type KanbanStandardRequest = (
  KanbanCardRequestProposal | KanbanStructureRequestProposal | KanbanSavedViewRequestProposal
) &
  KanbanRequestLifecycle
```

## KanbanStructureCapability

Package-understood structural capability labels used for presentation only.

```ts
type KanbanStructureCapability = 'collapse' | 'configure' | 'add-card' | 'rename' | 'reorder' | 'delete'
```

## KanbanStructurePolicy

Complete reactive structure policy snapshotted before scene projection.

```ts
interface KanbanStructurePolicy<TCard, TCardKey extends CardKey = KanbanCardKeyFor<TCard>> {
  revision: KanbanRevision;   // Equality-only revision covering every layout-affecting policy value.
  columns: readonly KanbanColumnPolicy[];   // Per-column policy keyed by stable identity.
  grouping?: KanbanGroupingPolicy<TCard, TCardKey>;   // Optional policy for the query-owned grouping field.
}
```

## KanbanStructurePresentationLimits

Additive fixed limits for structure and custom swimlane presentation.

```ts
interface KanbanStructurePresentationLimits {
  columnWidthCells: 512;   // Maximum terminal-cell width accepted for one structural column preference.
  descriptorRows: 32;   // Maximum rows returned by one custom swimlane chrome descriptor.
  railWidth: 64;   // Maximum terminal-cell width reserved by a custom swimlane label rail.
  descriptorTextBytes: 4096;   // Maximum safe text bytes returned by one custom swimlane chrome descriptor.
  descriptorRoles: 16;   // Maximum distinct semantic roles returned by one custom swimlane chrome descriptor.
  descriptorRegions: 64;   // Maximum bounded regions returned by one custom swimlane chrome descriptor.
  descriptorActions: 32;   // Maximum bounded header actions returned by one custom swimlane chrome descriptor.
}
```

## KanbanStructureRequestProposal

Structural standard proposals for columns and explicit swimlanes.

```ts
type KanbanStructureRequestProposal = | KanbanColumnAddProposal
  | KanbanColumnUpdateProposal
  | KanbanColumnReorderProposal
  | KanbanColumnDeleteProposal
  | KanbanSwimlaneAddProposal
  | KanbanSwimlaneUpdateProposal
  | KanbanSwimlaneReorderProposal
  | KanbanSwimlaneDeleteProposal
```

## KanbanStructureScope

Semantic scope owned by one normalized structure state.

```ts
type KanbanStructureScope = | { readonly kind: 'board' }
  | { readonly kind: 'column'; readonly columnId: string }
  | { readonly kind: 'swimlane'; readonly swimlaneId: string }
  | { readonly kind: 'cell'; readonly address: { readonly columnId: string; readonly swimlaneId?: string } }
```

## KanbanStructureSourceState

Source lifecycle facts accepted by the pure structural-state resolver.

```ts
type KanbanStructureSourceState = | { readonly kind: 'empty' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'refreshing' }
  | { readonly kind: 'partial' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'error'; readonly code: string; readonly retry: 'available' | 'unavailable' }
```

## KanbanStructureState

Detached immutable state presentation for one structural scope.

```ts
interface KanbanStructureState {
  code: KanbanStructureStateCode;   // Distinct semantic state code.
  scope: KanbanStructureScope;   // Semantic owner retained without renderer geometry.
  actions: readonly KanbanStructureStateAction[];   // Available package-owned semantic actions.
  nonColorCue?: string;   // Non-color text cue that keeps the state distinguishable.
}
```

## KanbanStructureStateAction

Bounded semantic action exposed by one structural state surface.

```ts
interface KanbanStructureStateAction {
  kind: 'clear-filters' | 'retry';   // Package-owned action route; application publication remains authoritative.
}
```

## KanbanStructureStateCode

Closed semantic state codes used by renderer and interaction layers.

```ts
type KanbanStructureStateCode = | 'no-columns'
  | 'true-empty'
  | 'filtered-empty'
  | 'loading'
  | 'refreshing'
  | 'partial'
  | 'ready'
  | 'collapsed'
  | 'hidden'
  | 'error'
```

## KanbanStructureStateInput

Facts used to distinguish empty, filtered, loading, partial, collapsed, hidden, and error states.

```ts
interface KanbanStructureStateInput {
  scope: KanbanStructureScope;   // Semantic owner of the state surface.
  source: KanbanStructureSourceState;   // Authoritative source lifecycle fact.
  filtered: boolean;   // Whether an active filter explains an empty result.
  collapsed?: boolean;   // Whether visible chrome suppresses ordinary card regions.
  hidden?: boolean;   // Whether the semantic entity is detached from the visible scene.
}
```

## KanbanStructureStyle

Allowlisted semantic role attached to one column or swimlane surface.

```ts
interface KanbanStructureStyle {
  role: KanbanThemeRole;   // Theme role resolved through the complete Kanban fallback chain.
}
```

## KanbanSubjectPublicationNotice

Authoritative subject publication that matches, contradicts, or deletes operation state.

```ts
interface KanbanSubjectPublicationNotice {
  kind: 'matching' | 'contradictory' | 'deleted';   // Notice discriminator.
  operationId: KanbanOperationId;   // Operation explicitly correlated by the application.
  subjects: readonly KanbanPublicationSubject[];   // Bounded identity/revision evidence carried by the authoritative publication.
}
```

## KanbanSummaryAdapter

Application numeric summary adapter used by eager headers.

```ts
interface KanbanSummaryAdapter<TCard> {
  summaryId: KanbanFieldId;   // Semantic summary field written into the header summary map.
  scope: KanbanSummaryScope;   // Whether the result describes authoritative or merely resident records.
  aggregation: KanbanSummaryAggregation;   // Package-owned aggregation applied deterministically to supplied values.
  valueOf: (card: TCard) => number | undefined;   // Returns one finite contribution or omits this card from the aggregate.
}
```

## KanbanSummaryAggregation

Deterministic package-owned numeric aggregation for an eager summary.

```ts
type KanbanSummaryAggregation = 'sum' | 'minimum' | 'maximum' | 'average'
```

## KanbanSummaryScope

Authority scope declared by one application numeric summary.

```ts
type KanbanSummaryScope = 'authoritative' | 'loaded-only'
```

## KanbanSwimlaneAddProposal

Add one explicit swimlane at a semantic structural position.

```ts
interface KanbanSwimlaneAddProposal {
  kind: 'swimlane-add';   // Request discriminator.
  draft: KanbanSwimlaneDraft;   // Validated generic explicit-swimlane definition.
  position: KanbanSwimlanePosition;   // Stable-neighbor structural destination.
}
```

## KanbanSwimlaneChromeAction

One validated application header action.

```ts
interface KanbanSwimlaneChromeAction {
  actionId: string;   // Dotted application extension identity.
}
```

## KanbanSwimlaneChromeDescriptor

Complete bounded renderer-neutral custom swimlane chrome descriptor.

```ts
interface KanbanSwimlaneChromeDescriptor {
  rows: number;   // Rows occupied by the header/separator region.
  railWidth: number;   // Optional left label rail width.
  text: readonly string[];   // Sanitized bounded display fragments.
  roles: readonly KanbanThemeRole[];   // Allowlisted semantic roles used by the descriptor.
  regions: readonly KanbanSwimlaneChromeRegion[];   // Bounded header-only regions.
  actions: readonly KanbanSwimlaneChromeAction[];   // Bounded application header actions.
}
```

## KanbanSwimlaneChromeRegion

Bounded custom header region that never creates card or drop targets.

```ts
interface KanbanSwimlaneChromeRegion {
  x: number;   // Left cell relative to the swimlane chrome.
  y: number;   // Top row relative to the swimlane chrome.
  width: number;   // Positive region width.
  height: number;   // Positive region height.
}
```

## KanbanSwimlaneDeleteProposal

Delete one explicit swimlane with an optional application-authorized reassignment target.

```ts
interface KanbanSwimlaneDeleteProposal {
  kind: 'swimlane-delete';   // Request discriminator.
  swimlaneId: KanbanSwimlaneId;   // Stable identity of the swimlane to delete.
  reassignTo?: KanbanSwimlaneId;   // Optional application-authorized destination for affected cards.
}
```

## KanbanSwimlaneDraft

Generic application-owned swimlane draft with package-validated identity and label.

```ts
interface KanbanSwimlaneDraft {
  swimlaneId: KanbanSwimlaneId;   // Stable identity proposed for the new explicit swimlane.
  label: string;   // Safe human-readable swimlane label.
  data?: KanbanSemanticValue;   // Optional bounded application-owned swimlane metadata.
}
```

## KanbanSwimlaneHeader

Detached swimlane header publication.

```ts
interface KanbanSwimlaneHeader {
  swimlaneId: KanbanSwimlaneId;   // Swimlane represented by this header.
  label: string;   // Sanitized human-readable label.
}
```

## KanbanSwimlaneId

A validated swimlane identity.

```ts
type KanbanSwimlaneId = string
```

## KanbanSwimlaneLayoutHintBatch

Revision-bound aggregate hints for one requested swimlane-axis window.

```ts
interface KanbanSwimlaneLayoutHintBatch {
  rows: readonly KanbanSwimlaneRowLayoutHint[];   // Source-ordered rows corresponding exactly to the returned bounded window.
}
```

## KanbanSwimlaneLayoutHintRequest

Bounded half-open swimlane-axis window requested for preliminary layout.

```ts
interface KanbanSwimlaneLayoutHintRequest {
  start: number;   // First included semantic swimlane index.
  end: number;   // First excluded semantic swimlane index.
  sessionRevision: KanbanRevision;   // Equality-only active query-session revision.
  queryGeneration: number;   // Active query generation used to reject stale asynchronous responses.
}
```

## KanbanSwimlaneMeta

Display metadata for one optional horizontal swimlane.

```ts
interface KanbanSwimlaneMeta {
  swimlaneId: KanbanSwimlaneId;   // Stable semantic swimlane identity.
  label: string;   // Human-readable label rendered after terminal sanitization.
  revision: KanbanRevision;   // Equality-only presentation revision for this metadata.
}
```

## KanbanSwimlaneOperationSubject

Stable explicit-swimlane identity affected or reserved by an operation.

```ts
interface KanbanSwimlaneOperationSubject {
  kind: 'swimlane';   // Subject discriminator.
  swimlaneId: KanbanSwimlaneId;   // Stable explicit-swimlane identity.
}
```

## KanbanSwimlanePosition

Semantic placement of one swimlane relative to a stable neighboring swimlane identity.

```ts
type KanbanSwimlanePosition = | { readonly kind: 'start' }
  | { readonly kind: 'end' }
  | { readonly kind: 'before'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'after'; readonly swimlaneId: KanbanSwimlaneId }
```

## KanbanSwimlanePresentationColumn

One responsive card-column allocation after optional rail reservation.

```ts
interface KanbanSwimlanePresentationColumn {
  columnId: string;   // Stable workflow-column identity.
  availableWidth: number;   // Cells remaining for this card column.
}
```

## KanbanSwimlanePresentationColumnInput

Input constraint for one responsive card column.

```ts
interface KanbanSwimlanePresentationColumnInput {
  columnId: string;   // Stable workflow-column identity.
  minimumWidth: number;   // Effective minimum width that presentation must preserve.
}
```

## KanbanSwimlanePresentationContext

Safe semantic context supplied once for one visible swimlane presentation revision.

```ts
interface KanbanSwimlanePresentationContext {
  swimlaneId: string;   // Stable semantic swimlane identity.
  label: string;   // Sanitized visible label.
  revision: KanbanRevision;   // Equality-only presentation revision.
  availableWidth: number;   // Available horizontal terminal cells.
}
```

## KanbanSwimlanePresentationInput

Built-in or bounded custom swimlane presentation input.

```ts
type KanbanSwimlanePresentationInput = KanbanSwimlanePresentationVariant | KanbanCustomSwimlanePresentation
```

## KanbanSwimlanePresentationResolver

Disposable per-board resolver that caches custom callbacks by visible presentation revision.

```ts
interface KanbanSwimlanePresentationResolver {
  resolve(input: ResolveKanbanSwimlanePresentationInput): ResolvedKanbanSwimlanePresentation;   // Resolves one immutable presentation snapshot.
  dispose(): void;   // Releases cached custom results idempotently.
}
```

## KanbanSwimlanePresentationResolverOptions

Optional resolver diagnostics.

```ts
interface KanbanSwimlanePresentationResolverOptions {
  observe?: (observation: KanbanObservation) => void;   // Sink for already-redacted custom descriptor failures.
}
```

## KanbanSwimlanePresentationSemantic

Semantic content shared unchanged by every swimlane chrome strategy.

```ts
interface KanbanSwimlanePresentationSemantic {
  swimlaneId: string;   // Stable semantic swimlane identity.
  label: string;   // Sanitized visible label.
  revision: KanbanRevision;   // Equality-only visible presentation revision.
  count?: KanbanCount;   // Optional honest aggregate count.
  summary?: KanbanGroupingSummary;   // Optional bounded numeric/text summary.
}
```

## KanbanSwimlanePresentationVariant

Built-in swimlane chrome strategies with identical semantic membership.

```ts
type KanbanSwimlanePresentationVariant = 'hybrid' | 'separator' | 'band' | 'rail'
```

## KanbanSwimlanePublicationSubject

Swimlane publication expected after an accepted application request.

```ts
interface KanbanSwimlanePublicationSubject {
  kind: 'swimlane';
  swimlaneId: KanbanSwimlaneId;
  baselineRevision: KanbanRevision;
  expectedRevision: KanbanRevision;
}
```

## KanbanSwimlaneRailResolution

Immutable rail allocation or its responsive hybrid fallback.

```ts
interface KanbanSwimlaneRailResolution {
  resolvedVariant: 'rail' | 'hybrid';   // Effective presentation after responsive resolution.
  degraded: boolean;   // Whether the requested rail was removed.
  railWidth: number;   // Effective reserved width, or zero after fallback.
  cardBounds: Readonly<Rect>;   // Exact rectangle available to card columns and workflow headers.
}
```

## KanbanSwimlaneReorderProposal

Reorder one explicit swimlane without a numeric index or generated rank.

```ts
interface KanbanSwimlaneReorderProposal {
  kind: 'swimlane-reorder';   // Request discriminator.
  swimlaneId: KanbanSwimlaneId;   // Stable identity of the swimlane to move.
  position: KanbanSwimlanePosition;   // Stable-neighbor structural destination.
}
```

## KanbanSwimlaneRowLayoutHint

Payload-free aggregate layout hint for one semantic swimlane row.

```ts
interface KanbanSwimlaneRowLayoutHint {
  swimlaneId: KanbanSwimlaneId;   // Stable semantic swimlane identity.
  extent: KanbanRowExtent;   // Aggregate terminal-row extent with explicit completeness.
  count: KanbanCount;   // Aggregate card count with explicit authority/completeness.
}
```

## KanbanSwimlaneUpdateProposal

Patch one explicit swimlane through application-owned policy.

```ts
interface KanbanSwimlaneUpdateProposal {
  kind: 'swimlane-update';   // Request discriminator.
  swimlaneId: KanbanSwimlaneId;   // Stable identity of the swimlane to update.
  patch: KanbanSemanticValue;   // Bounded application-schema patch data.
}
```

## KanbanTheme

Versioned complete package-local semantic palette consumed by card descriptors.

```ts
interface KanbanTheme {
  contractVersion: 1;   // Exact contract version understood by this package release.
  roles: Readonly<Record<KanbanThemeRole, KanbanThemeToken>>;   // Complete token map for every allowlisted semantic role.
}
```

## KanbanThemeCapabilities

Minimal capability projection required by semantic theme-role resolution.

```ts
type KanbanThemeCapabilities = Pick<CapabilityProfile, 'colorDepth'> & {
  /** Treat color as unavailable while preserving attributes and non-color cues. */
  readonly noColor?: boolean;
}
```

## KanbanThemeOverrides

Caller overrides applied above mapped Core roles during safe theme resolution.

```ts
type KanbanThemeOverrides = Readonly<Partial<Record<KanbanThemeRole, Readonly<Partial<ThemeRole>>>>>
```

## KanbanThemeResolutionReport

Bounded evidence describing rejected input and deterministic accessibility repairs.

```ts
interface KanbanThemeResolutionReport {
  rejected: readonly string[];   // Bounded semantic paths rejected while reading caller data.
  adjustments: readonly {
    /** Allowlisted semantic path, or `*` for a palette-wide capability adaptation. */
    readonly path: string;
    /** Stable reason the requested presentation was not used unchanged. */
    readonly reason: 'minimum-contrast' | 'capability-fallback' | 'unknown-role';
  }[];   // Palette-level readability adjustments applied while creating this immutable theme.
}
```

## KanbanThemeRole

One allowlisted package-local semantic role.

```ts
type KanbanThemeRole = (typeof KANBAN_THEME_ROLES)[number]
```

## KanbanThemeToken

Complete immutable style and fallback chain for one semantic role.

```ts
interface KanbanThemeToken {
  style: ThemeRole;   // Explicitly resolved Kanban style.
  mappedFallback: ThemeRole;   // Role-specific style derived directly from the application Core theme.
  terminalFallback: ThemeRole;   // Family-level terminal-safe fallback used after the mapped role.
  cues: readonly [KanbanNonColorCue, ...KanbanNonColorCue[]];   // Non-empty redundant cues that preserve meaning without color.
}
```

## KanbanTimingDefaults

Fixed interaction timings that must remain deterministic across resource classes.

```ts
interface KanbanTimingDefaults {
  collapsedSwimlaneHoverMs: 500;   // Delay before drag hover temporarily expands one visible collapsed swimlane.
}
```

## KanbanTransitionContext

Complete detached context for one synchronous application transition resolver.

```ts
interface KanbanTransitionContext {
  source: KanbanTransitionEndpoint;   // Current semantic endpoint.
  target: KanbanTransitionEndpoint;   // Proposed semantic endpoint.
  cardKeys: readonly CardKey[];   // Ordered application card identities participating in the proposal.
  sourceRevision: KanbanRevision;   // Equality-only source endpoint revision.
  targetRevision: KanbanRevision;   // Equality-only target endpoint revision.
  sessionRevision: KanbanRevision;   // Equality-only query-session revision.
  queryGeneration: number;   // Active query generation used to reject stale advice.
  counts: KanbanTransitionCounts;   // Authoritative source and target counts.
  definitionOfDone?: KanbanDefinitionOfDoneSnapshot;   // Optional complete definition-of-done evidence for the target.
}
```

## KanbanTransitionCounts

Authoritative counts supplied to one transition resolver.

```ts
interface KanbanTransitionCounts {
  source: KanbanCount;   // Count at the source endpoint.
  target: KanbanCount;   // Count at the target endpoint.
}
```

## KanbanTransitionEndpoint

Source or target semantic endpoint used by transition advice.

```ts
interface KanbanTransitionEndpoint {
  columnId: string;   // Stable workflow-column identity.
  swimlaneId?: string;   // Optional stable swimlane identity.
}
```

## KanbanTransitionObservationSink

Optional sink for already-redacted transition observations.

```ts
type KanbanTransitionObservationSink = (observation: KanbanObservation) => void
```

## KanbanTransitionResolver

Pure application callback that provides transition advice without dispatching.

```ts
type KanbanTransitionResolver = (context: KanbanTransitionContext) => KanbanWorkflowEvaluation
```

## KanbanUndoDescriptor

Mutually exclusive application undo token or inverse-proposal builder.

```ts
type KanbanUndoDescriptor = | { readonly kind: 'token'; readonly token: KanbanUndoToken }
  | { readonly kind: 'inverse-builder'; readonly build: KanbanInverseRequestBuilder }
```

## KanbanUndoToken

Opaque bounded application token used only to request a fresh undo operation.

```ts
type KanbanUndoToken = string & { readonly [kanbanUndoTokenBrand]: true }
```

## KanbanUngroupedResult

Normalized result when the query does not select a grouping field.

```ts
interface KanbanUngroupedResult {
  kind: 'none';   // Structural discriminator.
  activeFieldId: undefined;   // Explicit absence retained for inspection.
  groups: readonly [];   // No semantic swimlane groups.
  memberships: readonly [];   // No swimlane memberships.
  detached: {
    readonly groups: readonly [];
    readonly memberships: readonly [];
  };   // Complete empty evidence retained without requiring discriminator narrowing.
}
```

## KanbanVerticalCardAnchor

Stable card position used to preserve vertical identity through recomputation.

```ts
interface KanbanVerticalCardAnchor {
  cardKey: CardKey;   // Stable card identity.
  logicalRow: number;   // Logical top row in the unscrolled card stack.
  height: number;   // Descriptor height in terminal rows.
  logicalIndex?: number;   // Global logical position when sparse height evidence owns placement.
  quality?: KanbanSparseHeightPosition['quality'];   // Whether the logical row is exact or still estimated.
}
```

## KanbanVerticalCardInput

Bounded card extent consumed by the pure vertical projector.

```ts
interface KanbanVerticalCardInput {
  cardKey: CardKey;   // Stable application-owned card identity.
  height: number;   // Validated descriptor height in terminal rows.
  logicalIndex?: number;   // Global logical position required when a sparse height projection is supplied.
}
```

## KanbanVerticalGeometry

Immutable result of one bounded vertical projection.

```ts
interface KanbanVerticalGeometry {
  regions: readonly KanbanLayoutRegion[];   // Clipped semantic regions visible in the assigned rectangle.
  actionTargets: readonly KanbanActionTarget[];   // Actionable targets; deliberately empty in Phase A.
  contentHeight: number;   // Complete unscrolled height including sticky chrome and resting gaps.
  extentQuality: 'exact' | 'unknown';   // Confidence in the card-content portion of `contentHeight`.
  scrollExtent: number;   // Greatest valid vertical card-content offset.
  scrollOffset: number;   // Clamped offset used for this projection.
  retainedStart: number;   // First retained source-card index.
  retainedEnd: number;   // Exclusive retained source-card index.
  anchors: readonly KanbanVerticalCardAnchor[];   // Source-ordered stable anchors independent of clipping.
}
```

## KanbanVerticalHeightProjection

Immutable bounded sparse-height evidence shared by projection and metrics.

```ts
interface KanbanVerticalHeightProjection {
  logicalLength: number;   // Complete logical card count represented arithmetically rather than by allocation.
  rows: readonly KanbanVerticalHeightProjectionRow[];   // Bounded retained rows needed by the current visible and overscan window.
  descriptorExtent: KanbanSparseHeightPosition;   // Descriptor-only aggregate extent at the logical end boundary.
  revisions: {
    readonly source: KanbanRevision;
    readonly cursor: KanbanRevision;
    readonly presentation: KanbanRevision;
  };   // Revisions that make every retained row and the aggregate extent compatible.
}
```

## KanbanVerticalHeightProjectionRow

One retained card row detached from a mutable sparse height index.

```ts
interface KanbanVerticalHeightProjectionRow {
  cardKey: CardKey;   // Stable application-owned card identity.
  logicalIndex: number;   // Global logical position in the owning semantic cell.
  descriptorRow: KanbanSparseHeightPosition;   // Descriptor-only row before density-owned resting gaps are added.
}
```

## KanbanVerticalProjectionExtent

Aggregate vertical content extent after density-owned gaps are applied.

```ts
interface KanbanVerticalProjectionExtent {
  value: number;   // Saturated card-content height in terminal rows.
  quality: 'exact' | 'unknown';   // Exact only when the complete descriptor prefix is exact.
}
```

## KanbanViewId

A validated saved-view identity.

```ts
type KanbanViewId = string
```

## KanbanViewport

Exact-cell read-only Kanban projection that owns one query/session/cursor coordinator.

```ts
new KanbanViewport<TCard>(options: KanbanViewportOptions<TCard>)   // extends View
// methods & signals:
runPendingMounts(): void
metrics(): KanbanViewportMetrics
metricsSignal(): Signal<number>
sourceState(): KanbanSourceState | undefined
identityChanges(): KanbanIdentityChangeBatch | undefined
focusedNavigator(): KanbanFocusedColumnNavigator | undefined
interactionScene(): KanbanNavigationSnapshot
interactionRevisions(): KanbanInteractionRevisions
interactionStructureRevision(): KanbanRevision
interactionEligibleSelection(): readonly KanbanEligibleSelectionCandidate[]
revealInteractionTarget(target: KanbanFocusTarget, options?: { readonly signal?: AbortSignal }): Promise<KanbanInteractionAcquisitionResult>
scrollTo(target: KanbanScrollTarget): void
scrollBy(delta: KanbanScrollTarget): void
revealCard(key: CardKey, alignment?: KanbanRevealAlignment, options?: { readonly signal?: AbortSignal }): Promise<KanbanRevealResult>
inspection(): KanbanViewportInspection
dispose(): void
```

## KanbanViewportExtentQuality

Independent confidence for horizontal and vertical viewport extents.

```ts
interface KanbanViewportExtentQuality {
  x: KanbanExtentQuality;   // Column structure makes horizontal extent exact.
  y: KanbanExtentQuality;   // Cursor length quality represented by the vertical extent.
}
```

## KanbanViewportInspection

Detached viewport evidence for tests and modeless diagnostics.

```ts
interface KanbanViewportInspection {
  cells: readonly KanbanInspectedCell[];   // Retained source cells and their safe lifecycle states.
  visibleColumns: readonly KanbanInspectedColumn[];   // Complete sanitized source columns intersecting the viewport.
  visibleCards: readonly KanbanInspectedCard[];   // Resident cards projected in the viewport.
  regions: readonly KanbanLayoutRegion[];   // Clipped semantic geometry kept separate from active hit-test entries.
  damage: readonly KanbanDamageRegion[];   // Bounded changed rectangles from the latest completed projection.
  actionTargets: readonly KanbanActionTarget[];   // Bounded closed-scope targets; deferred drag and insertion kinds are not representable.
  mountedCardViews: 0;   // Resident card widgets; scene rendering deliberately keeps this at zero.
  structureState?: KanbanStructureState;   // Board-level semantic structure state when one is active.
  interaction: KanbanInteractionInspection;   // Detached current controller state and bounded selection evidence.
  focusedDetail: KanbanFocusedDetailSnapshot;   // Complete bounded safe values for the currently focused target.
  operation?: { readonly kind: 'unavailable'; readonly code: 'dispatcher-unavailable' };   // Safe mutation-availability evidence for a standalone read viewport.
}
```

## KanbanViewportInteractionAdapter

Non-owning state and transition adapter accepted by a standalone Kanban viewport.

```ts
interface KanbanViewportInteractionAdapter {
  snapshot(): KanbanInteractionSnapshot;   // Returns the latest detached immutable interaction publication.
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult> | KanbanInteractionResult;   // Applies one closed semantic transition through the adapter's existing owner.
  subscribe(invalidate: () => void): () => void;   // Subscribes to semantic publications and returns an idempotent unsubscribe function.
}
```

## KanbanViewportMetrics

Read-only exact-cell projection metrics exposed by a mounted viewport.

```ts
interface KanbanViewportMetrics {
  assignedRect: Readonly<Rect>;   // Parent-relative rectangle currently assigned by layout.
  mode: KanbanViewportMode;   // Active responsive presentation mode.
  offsets: KanbanViewportPoint;   // Clamped horizontal and vertical scroll offsets.
  extents: KanbanViewportPoint;   // Greatest currently valid horizontal and vertical offsets.
  extentQuality: KanbanViewportExtentQuality;   // Whether each numeric extent is final, a proven lower bound, or currently unknown.
  visibleColumnIds: readonly string[];   // Source-ordered columns intersecting the retained projection.
  visibleCardRanges: readonly KanbanVisibleCardRange[];   // Visible and overscan logical ranges keyed by cell address.
  stickyRows: number;   // Sticky rows removed from the scrolling card rectangle.
  overscan: KanbanViewportPoint;   // Effective finite overscan retained around the visible projection.
  generation: number;   // Private lifecycle generation projected as an opaque monotone number for diagnostics.
  sourceRevision?: KanbanRevision;   // Equality-only source revision represented by this snapshot.
}
```

## KanbanViewportMode

Responsive viewport presentation mode.

```ts
type KanbanViewportMode = 'multi-column' | 'focused-column' | 'minimum-size'
```

## KanbanViewportOptions

Construction options shared by standalone viewports and the board shell.

```ts
interface KanbanViewportOptions<TCard> {
  source: KanbanDataSource<TCard>;   // Application-owned sparse or eager source.
  query: () => KanbanQuery;   // Reactive semantic query getter.
  card: KanbanCardPresentationAdapter<TCard>;   // Generic application-record adapter.
  i18n?: () => I18n;   // Optional reactive localization service getter.
  density?: () => KanbanCardDensity;   // Optional reactive card-density getter.
  presentation?: () => KanbanPresentationInput;   // Optional reactive rich-card presentation policy getter.
  structure?: () => KanbanStructurePolicy<TCard>;   // Optional reactive workflow-column and swimlane structure policy getter.
  formatting?: () => KanbanCardFormattingContext;   // Optional reactive application formatting context getter.
  cardPresentation?: (card: TCard) => KanbanViewportCardPresentation | undefined;   // Optional card-local selection and visual-state projection.
  renderer?: () => KanbanCardRenderer<TCard>;   // Optional reactive custom descriptor renderer getter.
  rendererRevision?: () => KanbanRevision;   // Optional reactive custom renderer/configuration revision getter.
  theme?: () => KanbanTheme;   // Optional reactive semantic theme getter.
  limits?: KanbanLimitOptions;   // Optional lower resource limits.
  overscan?: KanbanOverscanOptions;   // Optional finite visible-projection expansion.
  observe?: (observation: KanbanObservation) => void;   // Optional already-redacted observation sink.
  capabilities?: () => KanbanCapabilities;   // Optional reactive UX capability descriptions.
  identity?: () => KanbanIdentityInput;   // Optional reactive compatibility identity projection for a standalone viewport.
  interaction?: KanbanViewportInteractionAdapter;   // Optional non-owning interaction publication adapter for scene cues and inspection.
  collapsedColumnIds?: () => readonly string[];   // Optional reactive column-collapse projection applied before cursor acquisition.
  drag?: KanbanDragConfiguration;   // Optional bounded board-owned drag threshold configuration.
}
```

## KanbanViewportPoint

Immutable horizontal and vertical cell coordinates or extents.

```ts
interface KanbanViewportPoint {
  x: number;   // Horizontal terminal-cell value.
  y: number;   // Vertical terminal-cell value.
}
```

## KanbanVisibleCardRange

Visible half-open logical card range for one retained source cell.

```ts
interface KanbanVisibleCardRange {
  address: KanbanCellAddress;   // Canonical column/swimlane address.
  start: number;   // First retained logical card index.
  end: number;   // Exclusive retained logical card index.
}
```

## KanbanWipDonePolicy

Whether cards already classified as done contribute to a WIP count.

```ts
type KanbanWipDonePolicy = 'include' | 'exclude'
```

## KanbanWipMode

How a workflow limit affects application-owned move eligibility.

```ts
type KanbanWipMode = 'informational' | 'advisory' | 'blocking'
```

## KanbanWipPolicy

Validated minimum/maximum workflow policy for one structural entity.

```ts
interface KanbanWipPolicy {
  minimum?: number;   // Optional inclusive minimum authoritative card count.
  maximum?: number;   // Optional inclusive maximum authoritative card count.
  mode: KanbanWipMode;   // Presentation and eligibility behavior when a boundary is violated.
  countDone: KanbanWipDonePolicy;   // Explicit treatment of cards classified as done.
}
```

## KanbanWorkflowEvaluation

Pure presentation advice shared by WIP and arbitrary transition evaluators.

```ts
type KanbanWorkflowEvaluation = | { readonly kind: 'allowed'; readonly violation?: KanbanWorkflowViolationEvidence }
  | { readonly kind: 'warning'; readonly code: string; readonly label?: string; readonly violation?: never }
  | { readonly kind: 'blocked'; readonly code: string; readonly label?: string; readonly violation?: never }
  | { readonly kind: 'unavailable'; readonly code: string; readonly retryable: boolean; readonly violation?: never }
```

## KanbanWorkflowViolationEvidence

Immutable evidence retained when an exact WIP boundary is violated.

```ts
interface KanbanWorkflowViolationEvidence {
  boundary: 'minimum' | 'maximum';   // Boundary crossed by the proposed authoritative count.
  authoritativeCount: number;   // Exact authoritative WIP count before the proposal.
  matchingCount?: number;   // Separately qualified exact count matching the active query, when known.
  proposedCount: number;   // Exact authoritative WIP count after the proposed delta.
  limit: number;   // Configured boundary that the proposal violates.
}
```

## PlacementToken

An opaque source-issued placement token.

```ts
type PlacementToken = string & { readonly [placementTokenBrand]: true }
```

## ProjectKanbanMinimumGeometryOptions

Inputs for safe impossible-geometry feedback projection.

```ts
interface ProjectKanbanMinimumGeometryOptions {
  bounds: Readonly<Rect>;   // Parent-assigned rectangle.
  requiredWidth: number;   // Smallest usable board width.
  requiredHeight: number;   // Smallest usable board height.
  message: string;   // Localized untrusted feedback text.
}
```

## ProjectKanbanSceneGeometryOptions

Options for projecting one canonical scene into exact terminal cells.

```ts
interface ProjectKanbanSceneGeometryOptions {
  bounds: Readonly<Rect>;   // Parent-assigned viewport rectangle.
  variant: KanbanSceneGeometryVariant;   // Requested built-in presentation.
  offsets: { readonly x: number; readonly y: number };   // Independent requested horizontal and vertical content offsets.
  activeSwimlaneId?: string;   // Active swimlane whose visible chrome may pin beneath workflow headers.
  minimumColumnWidth: number;   // Effective minimum width of each visible card column.
  columnWidths?: readonly { readonly columnId: string; readonly width: number }[];   // Optional exact solved widths for retained workflow columns.
  columnGap?: number;   // Empty terminal cells separating adjacent solved workflow columns.
  cardGap?: number;   // Empty resting rows between adjacent cards; defaults to one.
  estimatedCardHeight?: number;   // Estimated descriptor rows used only for unloaded logical positions before retained cards.
  heightProjections?: readonly KanbanSceneCellHeightProjection[];   // Optional revision-compatible sparse descriptor rows keyed by semantic source cell.
  railWidth?: number;   // Requested left rail width; defaults to ten terminal cells.
  customChrome?: readonly KanbanSceneCustomChromeInput[];   // Per-visible-swimlane descriptors required by the custom strategy.
  focusedColumnId?: string;   // Optional focused workflow column; exactly this column remains visible.
  anchor?: KanbanSceneGeometryAnchor;   // Optional stable anchor preserved through responsive recomputation.
}
```

## ProjectKanbanSceneHitsOptions

Options for one bounded scene hit projection.

```ts
interface ProjectKanbanSceneHitsOptions {
  maximumTargets: number;   // Maximum highest-priority targets retained in the immutable result.
}
```

## ProjectKanbanVerticalGeometryOptions

Inputs for one pure vertical card-stack projection.

```ts
interface ProjectKanbanVerticalGeometryOptions {
  bounds: Readonly<Rect>;   // Exact rectangle assigned to the retained column.
  stickyHeaderHeight: number;   // Sticky workflow-header rows at the top of the rectangle.
  swimlaneHeaderHeight?: number;   // Optional swimlane-header rows below the workflow header.
  scrollOffset: number;   // Requested vertical card-content offset.
  contentOrigin?: number;   // Logical row occupied by the first retained card in a sparse source window.
  heightProjection?: KanbanVerticalHeightProjection;   // Optional immutable sparse row evidence for global variable-height placement.
  density: KanbanCardDensity;   // Resting card-spacing policy.
  cards: readonly KanbanVerticalCardInput[];   // Source-ordered retained cards.
  verticalOverscan: number;   // Finite extra card rows retained around the visible range.
  projectInsertionGutters?: boolean;   // Whether to expose non-actionable future insertion geometry for inspection.
}
```

## ResolveKanbanCustomSwimlaneGeometryOptions

Inputs for validating custom chrome against current responsive geometry.

```ts
interface ResolveKanbanCustomSwimlaneGeometryOptions {
  chrome: KanbanSceneCustomChromeInput;   // Application-produced semantic-scoped descriptor.
  availableWidth: number;   // Complete available viewport width.
  visibleColumnCount: number;   // Number of visible card columns.
  minimumColumnWidth: number;   // Effective minimum width of every card column.
}
```

## ResolveKanbanGroupingInput

Inputs to query-owned explicit or derived grouping normalization.

```ts
interface ResolveKanbanGroupingInput<TCard, TCardKey extends CardKey = KanbanCardKeyFor<TCard>> {
  query: unknown;   // Untyped query boundary; validation rejects competing grouping fields atomically.
  cards: readonly TCard[];   // Application cards read without mutation.
  policy?: KanbanGroupingPolicy<TCard, TCardKey>;   // Policy that must name the same active query field.
  registry?: readonly KanbanGroupingRegistryEntry<TCard>[];   // Registered derived resolvers keyed by field identity.
  explicit?: KanbanExplicitGrouping<TCardKey>;   // Optional authoritative explicit groups and memberships.
  previous?: KanbanGroupingResult<TCardKey>;   // Previous immutable result retained by the caller on rejection.
  observe?: (observation: KanbanObservation) => void;   // Optional sink for already-redacted local fallback observations.
}
```

## ResolveKanbanStructureInput

Complete source-authoritative structure input with view-owned projection policy.

```ts
interface ResolveKanbanStructureInput<TCard> {
  revision: KanbanRevision;   // Equality-only revision for the resulting structure snapshot.
  columns: readonly KanbanColumnMeta[];   // Source-ordered workflow columns.
  policy: KanbanStructurePolicy<TCard>;   // Validated view-owned structure policy.
}
```

## ResolveKanbanSwimlanePresentationInput

Inputs to one built-in or custom swimlane presentation resolution.

```ts
interface ResolveKanbanSwimlanePresentationInput {
  presentation: KanbanSwimlanePresentationInput;   // Built-in variant or bounded custom producer.
  swimlane: KanbanSwimlanePresentationSemantic;   // Semantic content shared by every variant.
  availableWidth: number;   // Total horizontal cells assigned to the swimlane region.
  columns: readonly KanbanSwimlanePresentationColumnInput[];   // Visible workflow-column minimums.
  railWidth?: number;   // Requested rail width; defaults to ten cells.
}
```

## ResolveKanbanSwimlaneRailOptions

Inputs for deterministic rail reservation and responsive fallback.

```ts
interface ResolveKanbanSwimlaneRailOptions {
  bounds: Readonly<Rect>;   // Complete parent-assigned scene rectangle.
  visibleColumnCount: number;   // Number of visible workflow columns.
  minimumColumnWidth: number;   // Effective minimum width for every card column.
  railWidth?: number;   // Requested rail width, defaulting to ten cells.
  focused: boolean;   // Focused-column layouts use horizontal hybrid chrome instead of a permanent rail.
}
```

## ResolvedKanbanCardPresentationSelection

Detached immutable section selection used by the standard card pipeline.

```ts
interface ResolvedKanbanCardPresentationSelection {
  budget: ResolvedKanbanPresentationBudget;   // Exact resolved budget supplied by the maximum.
  limits: KanbanResolvedLimits;   // Exact active limits supplied by the maximum.
  fieldIds: readonly KanbanFieldId[];   // Known metadata IDs after intersection and cardinality capping.
  summaryIds: readonly KanbanFieldId[];   // Known summary IDs after intersection and cardinality capping.
  checklistIds: readonly KanbanChecklistId[];   // Known checklist-group IDs after intersection.
}
```

## ResolvedKanbanColumn

One source column after validated policy projection.

```ts
interface ResolvedKanbanColumn {
  columnId: string;   // Stable source-owned column identity.
  label: string;   // Sanitized source-owned display label.
  revision: KanbanRevision;   // Equality-only source metadata revision.
  semanticReference: KanbanColumnSemanticReference;   // Stable reference used by focus, selection, and saved view semantics.
  visibility: 'visible' | 'hidden';   // Whether this entity participates in the visible scene.
  collapse: 'expanded' | 'collapsed';   // Whether card regions are available below retained chrome.
  cardRegion: 'active' | 'suppressed';   // Whether ordinary card scene nodes may be projected.
  width?: KanbanColumnWidthPreference;   // Optional complete responsive width preference.
  headerAlignment: KanbanColumnHeaderAlignment;   // Horizontal alignment of the sanitized header label.
  wip?: KanbanWipPolicy;   // Optional pure WIP evaluation policy.
  definitionOfDone?: KanbanDefinitionOfDone;   // Optional compact/full definition-of-done evidence.
  capabilities: readonly KanbanStructureCapability[];   // Package-understood presentation capabilities.
  style?: KanbanStructureStyle;   // Optional allowlisted semantic style.
}
```

## ResolvedKanbanPresentationBudget

Immutable card budget consumed by snapshot, composition, and scene geometry.

```ts
interface ResolvedKanbanPresentationBudget {
  preset: KanbanCardDensity | 'custom';   // Preset that supplied the values, or `custom` for caller data.
  revision: KanbanRevision;   // Equality-only normalized policy revision.
  cardRows: number;   // Maximum descriptor rows.
  cardGap: number;   // Empty scene rows between adjacent cards.
  metadataFields: number;   // Maximum selected metadata fields.
  labelRows: number;   // Maximum label wrapping rows.
  summarySections: number;   // Maximum selected summary sections.
  checklistMode: KanbanChecklistMode;   // Resolved checklist detail mode.
  checklistPreviewItems: number;   // Maximum checklist preview items across selected groups.
  degradationOrder: readonly KanbanCardSectionKind[];   // Complete low-to-high removal order for optional sections.
}
```

## ResolvedKanbanStructure

Immutable normalized workflow structure with hidden/collapsed evidence kept separately.

```ts
interface ResolvedKanbanStructure {
  revision: KanbanRevision;   // Equality-only snapshot revision.
  columns: readonly ResolvedKanbanColumn[];   // Source-ordered columns participating in the visible scene.
  detached: { readonly columns: readonly ResolvedKanbanColumn[] };   // Complete normalized column evidence, including hidden and collapsed entities.
  state: KanbanStructureState;   // Board-level structure state.
}
```

## ResolvedKanbanSwimlanePresentation

Immutable result of one swimlane presentation resolution.

```ts
interface ResolvedKanbanSwimlanePresentation {
  requestedVariant: KanbanSwimlanePresentationVariant | 'custom';   // Requested built-in name or `custom`.
  resolvedVariant: KanbanSwimlanePresentationVariant | 'custom';   // Effective built-in/custom strategy after responsive or safety fallback.
  degraded: boolean;   // Whether responsive geometry changed the requested strategy.
  fallback?: 'invalid-custom';   // Local fallback reason for rejected custom chrome.
  semantic: KanbanSwimlanePresentationSemantic;   // Presentation-independent semantic content.
  chrome: KanbanResolvedSwimlaneChrome;   // Effective renderer-neutral chrome.
  columns: readonly KanbanSwimlanePresentationColumn[];   // Responsive card-column widths after effective rail reservation.
}
```

## ResolvedKanbanTheme

Complete safe theme together with inspectable resolution evidence.

```ts
interface ResolvedKanbanTheme {
  theme: KanbanTheme;   // Deeply immutable complete Kanban theme.
  report: KanbanThemeResolutionReport;   // Deeply immutable bounded resolution report.
}
```

## SolveKanbanColumnWidthsOptions

Inputs for the pure deterministic column-width solver.

```ts
interface SolveKanbanColumnWidthsOptions {
  availableWidth: number;   // Parent-assigned width in terminal cells.
  columns: readonly KanbanColumnWidthInput[];   // Source-ordered visible columns.
  focusedColumnId?: string;   // Preferred active column when narrow geometry permits only one.
  separatorWidth?: number;   // Cells between adjacent column surfaces; defaults to one.
}
```

## StandardCard

Optional convenience model for common Kanban card data.

```ts
interface StandardCard<TDate = unknown, TCustom = unknown> {
  key: CardKey;   // Stable application-owned card identity.
  columnId: KanbanColumnId;   // Workflow column that currently contains the card.
  swimlaneId?: KanbanSwimlaneId;   // Optional horizontal grouping identity.
  rank?: string | number;   // Optional application ordering value; the package does not rewrite it.
  presentationRevision?: KanbanRevision;   // Optional equality-only revision for presentation-affecting values.
  title: string;   // Required primary card label.
  status: string;   // Required application-formatted workflow status.
  description?: string;   // Optional long description reserved for editor and later presentation phases.
  type?: string;   // Optional application-formatted work-item type.
  priority?: string;   // Optional application-formatted priority.
  assignees?: readonly StandardCardAssignee[];   // Optional ordered assignee summaries.
  labels?: readonly StandardCardLabel[];   // Optional ordered card labels.
  startDate?: TDate;   // Optional opaque start-date value interpreted only by an injected formatter.
  dueDate?: TDate;   // Optional opaque due-date value interpreted only by an injected formatter.
  estimate?: string;   // Optional application-formatted estimate.
  value?: string;   // Optional application-formatted business value.
  checklists?: readonly StandardCardChecklist[];   // Optional ordered checklist groups reserved for configurable later rendering.
  summaries?: readonly StandardCardSummary[];   // Optional ordered compact summary values.
  custom?: TCustom;   // Optional application-specific data retained without interpretation.
}
```

## StandardCardAssignee

One compact application-owned assignee label carried by the convenience card model.

```ts
interface StandardCardAssignee {
  id: string;   // Stable application identity for the assignee.
  label: string;   // Application-formatted display label.
}
```

## StandardCardChecklist

One ordered checklist group carried by a standard card.

```ts
interface StandardCardChecklist {
  checklistId: KanbanChecklistId;   // Stable checklist-group identity.
  title?: string;   // Optional application-formatted group heading.
  items: readonly StandardCardChecklistItem[];   // Ordered application-owned items in this group.
}
```

## StandardCardChecklistItem

One read-only checklist item available to later standard-card presentation modes.

```ts
interface StandardCardChecklistItem {
  itemId: string;   // Stable application identity within its checklist group.
  text: string;   // Application-owned checklist text.
  completed: boolean;   // Whether the application currently considers the item complete.
}
```

## StandardCardLabel

One compact application-owned label carried by the convenience card model.

```ts
interface StandardCardLabel {
  id: string;   // Stable application identity for the label.
  label: string;   // Application-formatted display label.
}
```

## StandardCardSummary

One compact application-formatted summary value carried by a standard card.

```ts
interface StandardCardSummary {
  fieldId: KanbanFieldId;   // Stable identity of the application field being summarized.
  label: string;   // Application-formatted summary label.
  value: string;   // Application-formatted summary value.
}
```

## StandardKanbanCardAdapterOptions

Optional rich-presentation configuration for the standard-card adapter factory.

```ts
interface StandardKanbanCardAdapterOptions<TDate = unknown, TCustom = unknown> {
  fields?: StandardKanbanCardFieldsConfiguration;   // Common fields to expose, in the package's stable canonical order.
  summaries?: readonly StandardKanbanCardSummaryConfiguration[];   // Ordered configured summaries read from each card by stable field identity.
  selectionOf?: (card: StandardCard<TDate, TCustom>) => KanbanCardPresentationSelection | undefined;   // Optionally selects a reordered subset for each card without enlarging policy maxima.
  styleOf?: (card: StandardCard<TDate, TCustom>, state: KanbanCardVisualState) => KanbanCardStyleSelection;   // Optionally selects semantic roles from the detached visual state.
}
```

## StandardKanbanCardDateFieldConfiguration

Localized configuration for one opaque standard-card date field.

```ts
interface StandardKanbanCardDateFieldConfiguration {
  format?: (value: unknown, context: KanbanCardFormattingContext) => string | undefined;   // Optionally formats the exact unchanged application date value once.
}
```

## StandardKanbanCardFieldConfiguration

Shared localized display configuration for one optional standard-card field.

```ts
interface StandardKanbanCardFieldConfiguration {
  label: string;   // Application-localized field label.
  priority: number;   // Non-negative priority used only when optional content must degrade.
  role?: KanbanThemeRole;   // Optional semantic text role.
}
```

## StandardKanbanCardFieldName

Common optional property names understood by the StandardCard convenience adapter.

```ts
type StandardKanbanCardFieldName = 'description' | 'type' | 'priority' | 'assignees' | 'labels' | 'startDate' | 'dueDate' | 'estimate' | 'value'
```

## StandardKanbanCardFieldsConfiguration

Optional common fields exposed by the standard-card presentation adapter.

```ts
interface StandardKanbanCardFieldsConfiguration {
  description?: StandardKanbanCardTextFieldConfiguration;   // Long description metadata.
  type?: StandardKanbanCardTextFieldConfiguration;   // Work-item type metadata.
  priority?: StandardKanbanCardTextFieldConfiguration;   // Priority metadata.
  assignees?: StandardKanbanCardListFieldConfiguration;   // Ordered assignee labels.
  labels?: StandardKanbanCardListFieldConfiguration;   // Ordered card labels.
  startDate?: StandardKanbanCardDateFieldConfiguration;   // Opaque start date.
  dueDate?: StandardKanbanCardDateFieldConfiguration;   // Opaque due date.
  estimate?: StandardKanbanCardTextFieldConfiguration;   // Application-formatted estimate text.
  value?: StandardKanbanCardTextFieldConfiguration;   // Application-formatted business-value text.
}
```

## StandardKanbanCardListFieldConfiguration

Localized configuration for one standard-card list field.

```ts
interface StandardKanbanCardListFieldConfiguration {
  format?: (value: readonly string[], context: KanbanCardFormattingContext) => readonly string[] | undefined;   // Optionally formats the detached ordered labels once.
}
```

## StandardKanbanCardSummaryConfiguration

One configured standard-card summary section whose value is read by stable identity.

```ts
interface StandardKanbanCardSummaryConfiguration {
  fieldId: KanbanFieldId;   // Stable summary identity matching `StandardCard.summaries[].fieldId`.
  format?: (value: string, context: KanbanCardFormattingContext) => KanbanCardSummaryValue | undefined;   // Optionally formats the unchanged summary string once.
}
```

## StandardKanbanCardTextFieldConfiguration

Localized configuration for one standard-card text field.

```ts
interface StandardKanbanCardTextFieldConfiguration {
  format?: (value: string, context: KanbanCardFormattingContext) => string | undefined;   // Optionally formats the unchanged string value once.
}
```

## acceptKanbanPendingProjection

Copy one pending projection into its accepted-but-unpublished lifecycle state.

```ts
acceptKanbanPendingProjection(projection: KanbanPendingProjection): KanbanPendingProjection
```

## assertKanbanPlacementCurrent

Rejects any placement derived from a different cursor revision.

```ts
assertKanbanPlacementCurrent(placement: KanbanPlacement, currentRevision: KanbanRevision): KanbanPlacement
```

## buildKanbanScene

Builds one immutable geometry-free semantic scene from bounded resident source data.

```ts
buildKanbanScene(options: BuildKanbanSceneOptions): KanbanScene
```

## calculateKanbanSceneDamage

Computes bounded semantic-scene damage and preserves card-local descriptor invalidation.

```ts
calculateKanbanSceneDamage(options: CalculateKanbanSceneDamageOptions): readonly KanbanDamageRegion[]
```

## canonicalizeKanbanCellAddress

Creates a collision-safe key for one validated semantic cell address.

```ts
canonicalizeKanbanCellAddress(value: KanbanCellAddress): string
```

## canonicalizeKanbanOperationSubject

Return a collision-safe identity for one type-preserving subject.

```ts
canonicalizeKanbanOperationSubject(subject: KanbanOperationSubject): string
```

## clampKanbanScroll

Clamps requested offsets to current live extents without retaining caller objects.

```ts
clampKanbanScroll(options: ClampKanbanScrollOptions): KanbanViewportPoint
```

## classifyKanbanRequestConfirmation

Classify warning and destructive proposals without invoking a confirmer or dispatcher.

```ts
classifyKanbanRequestConfirmation(proposal: unknown, eligibility: unknown): KanbanConfirmationClassification
```

## composeStandardKanbanCard

Composes one detached presentation snapshot into a bounded immutable descriptor.

```ts
composeStandardKanbanCard(snapshot: KanbanCardPresentationSnapshot, context: KanbanStandardCardCompositionContext): KanbanCardDescriptor
```

## createEagerKanbanDataSource

Creates a reactive eager Kanban source that preserves original application card references.

```ts
createEagerKanbanDataSource<TCard>(cards: () => readonly TCard[], options: EagerKanbanSourceOptions<TCard>): KanbanDataSource<TCard>
```

## createEnglishKanbanI18n

Creates an isolated English service containing only the Kanban fallback catalog.

```ts
createEnglishKanbanI18n(): I18n
```

## createFallbackKanbanCardDescriptor

Creates a pure localized descriptor that fits the supplied render budget.

```ts
createFallbackKanbanCardDescriptor(context: KanbanCardRenderContext, labels: KanbanCardFallbackLabels): KanbanCardDescriptor
```

## createKanbanCardKey

Creates a validated application-owned card key while preserving number/string distinction.

```ts
createKanbanCardKey(value: CardKey): CardKey
```

## createKanbanChecklistId

Creates a validated checklist-group identity.

```ts
createKanbanChecklistId(value: string): KanbanChecklistId
```

## createKanbanChecklistItemId

Creates one bounded control-free checklist-item identity.

```ts
createKanbanChecklistItemId(value: string): KanbanChecklistItemId
```

## createKanbanCollapsedHoverController

Creates one independent temporary collapsed-swimlane hover controller.

```ts
createKanbanCollapsedHoverController(options: KanbanCollapsedHoverControllerOptions = {}): KanbanCollapsedHoverController
```

## createKanbanColumnId

Creates a validated workflow-column identity.

```ts
createKanbanColumnId(value: string): KanbanColumnId
```

## createKanbanExtensionId

Creates a validated application-extension identity.

```ts
createKanbanExtensionId(value: string): KanbanExtensionId
```

## createKanbanFieldId

Creates a validated application field identity.

```ts
createKanbanFieldId(value: string): KanbanFieldId
```

## createKanbanInteractionController

Creates the package default bounded interaction controller.

```ts
createKanbanInteractionController(environment: KanbanInteractionEnvironment, maximumSelectedKeys = KANBAN_LIMITS.selectedKeys.safe): KanbanInteractionController
```

## createKanbanObservation

Creates one detached, frozen, redacted observation.

```ts
createKanbanObservation(input: KanbanObservationInput): KanbanObservation
```

## createKanbanOperationId

Creates a validated request operation identity.

```ts
createKanbanOperationId(value: string): KanbanOperationId
```

## createKanbanOperationIdRegistry

Create a bounded registry that rejects active and recently completed operation-ID collisions.

```ts
createKanbanOperationIdRegistry(options: KanbanOperationIdRegistryOptions = {}): KanbanOperationIdRegistry
```

## createKanbanPendingProjection

Build the payload-free pending projection for one already-validated proposal.

```ts
createKanbanPendingProjection(proposal: KanbanRequestProposal): KanbanPendingProjection
```

## createKanbanRequestEnvelope

Create a coordinator-owned envelope or adopt one validated legacy extension envelope.

```ts
createKanbanRequestEnvelope(proposal: unknown, lifecycle?: unknown): KanbanRequest
```

## createKanbanScrollAnchor

Creates one detached immutable semantic scroll anchor.

```ts
createKanbanScrollAnchor(anchor: KanbanScrollAnchor): KanbanScrollAnchor
```

## createKanbanSparseHeightIndex

Creates one bounded sparse height index for a retained semantic cell.

```ts
createKanbanSparseHeightIndex(options: KanbanSparseHeightIndexOptions): KanbanSparseHeightIndex
```

## createKanbanSwimlaneId

Creates a validated swimlane identity.

```ts
createKanbanSwimlaneId(value: string): KanbanSwimlaneId
```

## createKanbanSwimlanePresentationResolver

Creates a disposable resolver for built-in and bounded custom swimlane presentation.

```ts
createKanbanSwimlanePresentationResolver(options: KanbanSwimlanePresentationResolverOptions = {}): KanbanSwimlanePresentationResolver
```

## createKanbanTheme

Creates the complete immutable Kanban semantic palette for a Core theme.

```ts
createKanbanTheme(coreTheme: Theme, overrides?: KanbanThemeOverrides): KanbanTheme
```

## createKanbanUndoToken

Create a bounded opaque application token for a future fresh undo operation.

```ts
createKanbanUndoToken(value: string): KanbanUndoToken
```

## createKanbanVerticalHeightProjection

Samples retained rows and the logical end boundary from one sparse index.

```ts
createKanbanVerticalHeightProjection(options: CreateKanbanVerticalHeightProjectionOptions): KanbanVerticalHeightProjection
```

## createKanbanViewId

Creates a validated saved-view identity.

```ts
createKanbanViewId(value: string): KanbanViewId
```

## createPlacementToken

Creates a validated opaque placement token without interpreting its contents.

```ts
createPlacementToken(value: string): PlacementToken
```

## createStandardKanbanCardAdapter

Creates the direct adapter for the optional StandardCard convenience model.

```ts
createStandardKanbanCardAdapter<TDate = unknown, TCustom = unknown>(options: StandardKanbanCardAdapterOptions<TDate, TCustom> = {}): KanbanCardPresentationAdapter<StandardCard<TDate, TCustom>>
```

## dispatchKanbanRequest

Validate and dispatch one raw request without consulting UX capabilities or mutating records.

```ts
dispatchKanbanRequest(request: KanbanRequest, dispatcher: (request: KanbanRequest, context: KanbanRequestContext) => unknown, context: KanbanRequestContext): Promise<KanbanRequestResult>
```

## evaluateKanbanMoveEligibility

Evaluate immutable move facts in fixed fail-closed order without dispatching or authorizing.

```ts
evaluateKanbanMoveEligibility(input: unknown): KanbanEligibility
```

## evaluateKanbanMovePositionCurrency

Check one validated semantic position against current source-owned placement evidence.

```ts
evaluateKanbanMovePositionCurrency(position: KanbanMovePosition, evidence: KanbanMovePositionEvidence): KanbanMovePositionCurrency
```

## evaluateKanbanTransition

Mirrors synchronous application transition advice without dispatching or assuming move direction.

```ts
evaluateKanbanTransition(context: KanbanTransitionContext, resolver: KanbanTransitionResolver, observe?: KanbanTransitionObservationSink): KanbanWorkflowEvaluation
```

## evaluateKanbanWip

Evaluates WIP advice from authoritative counts without dispatching or mutating application data.

```ts
evaluateKanbanWip(input: EvaluateKanbanWipInput): KanbanWorkflowEvaluation
```

## fingerprintKanbanSemanticValue

Derives a stable browser-safe 64-bit fingerprint from the canonical semantic snapshot.

```ts
fingerprintKanbanSemanticValue(value: unknown): string
```

## isKanbanPlacementTokenCurrent

Check opaque token membership only after validating the complete current source-owned set.

```ts
isKanbanPlacementTokenCurrent(token: PlacementToken, current: unknown): boolean
```

## isKanbanSourceReasonCode

Returns true only for an allowlisted source reason code.

```ts
isKanbanSourceReasonCode(value: unknown): value is string
```

## kanbanRevisionsEqual

Compares revisions without ordering, coercion, or stringification.

```ts
kanbanRevisionsEqual(left: KanbanRevision, right: KanbanRevision): boolean
```

## projectKanbanMinimumGeometry

Produces one atomic bounded minimum-size state with no partial inspection or action targets.

```ts
projectKanbanMinimumGeometry(options: ProjectKanbanMinimumGeometryOptions): KanbanMinimumGeometry
```

## projectKanbanSceneGeometry

Projects hybrid, separator, and band swimlane strategies from one canonical semantic scene.

```ts
projectKanbanSceneGeometry(scene: KanbanScene, options: ProjectKanbanSceneGeometryOptions): KanbanSceneGeometry
```

## projectKanbanSceneHits

Projects a bounded highest-priority-first hit map from final clipped scene geometry.

```ts
projectKanbanSceneHits(scene: KanbanScene, geometry: KanbanSceneGeometry, options: ProjectKanbanSceneHitsOptions): KanbanSceneHitProjection
```

## projectKanbanVerticalGeometry

Projects sticky headers and a bounded source-ordered card stack into exact terminal cells.

```ts
projectKanbanVerticalGeometry(options: ProjectKanbanVerticalGeometryOptions): KanbanVerticalGeometry
```

## readKanbanCardAdapter

Reads and validates one card through its adapter as one atomic presentation snapshot.

```ts
readKanbanCardAdapter<TCard>(card: TCard, adapter: KanbanCardAdapter<TCard>): KanbanCardAdapterSnapshot
```

## reconcileKanbanPublication

Clear publication metadata after matching or contradictory authoritative data arrives.

```ts
reconcileKanbanPublication(pending: readonly KanbanPublicationExpectation[], notice: KanbanPublicationNotice): KanbanPublicationReconciliation
```

## renderKanbanCardSafely

Executes one renderer behind the package's sole catch, validation, observation, and fallback boundary.

```ts
renderKanbanCardSafely<TCard>(card: TCard, renderer: KanbanCardRenderer<TCard>, context: KanbanCardRenderContext, options: KanbanSafeRenderOptions): KanbanCardDescriptor
```

## renderStandardKanbanCard

Snapshots and composes an application-owned card through the standard rich-card pipeline.

```ts
renderStandardKanbanCard<TCard>(card: TCard, adapter: KanbanCardPresentationAdapter<TCard>, context: KanbanCardRenderContext): KanbanCardDescriptor
```

## resolveKanbanCardPresentationSelection

Resolves one card's optional section order without changing numeric view maxima.

```ts
resolveKanbanCardPresentationSelection(selection: unknown, maximum: KanbanCardPresentationMaximum): ResolvedKanbanCardPresentationSelection
```

## resolveKanbanCustomSwimlaneGeometry

Copies custom swimlane chrome into a bounded geometry-only snapshot.

```ts
resolveKanbanCustomSwimlaneGeometry(options: ResolveKanbanCustomSwimlaneGeometryOptions): KanbanResolvedCustomSwimlaneGeometry
```

## resolveKanbanGrouping

Resolves zero-or-one query-owned grouping into visible and detached immutable membership.

```ts
resolveKanbanGrouping<TCard, TCardKey extends CardKey = KanbanCardKeyFor<TCard>>(input: ResolveKanbanGroupingInput<TCard, TCardKey>): KanbanGroupingResult<TCardKey>
```

## resolveKanbanPresentation

Resolves a named or custom presentation policy into one bounded immutable budget.

```ts
resolveKanbanPresentation(input: KanbanPresentationInput = 'comfortable', limits?: KanbanResolvedLimits): ResolvedKanbanPresentationBudget
```

## resolveKanbanSceneWindow

Resolves a bounded preliminary semantic cell window without enumerating preceding rows.

```ts
resolveKanbanSceneWindow(options: ResolveKanbanSceneWindowOptions): KanbanSceneWindowResult
```

## resolveKanbanStructure

Reconciles source-ordered column metadata with view-owned policy by stable semantic identity.

```ts
resolveKanbanStructure<TCard>(input: ResolveKanbanStructureInput<TCard>): ResolvedKanbanStructure
```

## resolveKanbanStructureState

Resolves authoritative lifecycle facts into one distinct, renderer-independent structural state.

```ts
resolveKanbanStructureState(input: KanbanStructureStateInput): KanbanStructureState
```

## resolveKanbanSwimlaneRail

Reserves a bounded left swimlane rail without changing the board's minimum usable width.

```ts
resolveKanbanSwimlaneRail(options: ResolveKanbanSwimlaneRailOptions): KanbanSwimlaneRailResolution
```

## resolveKanbanTheme

Resolves a complete immutable Kanban palette and bounded rejection evidence.

```ts
resolveKanbanTheme(coreTheme: Theme, overrides?: KanbanThemeOverrides): ResolvedKanbanTheme
```

## resolveKanbanThemeRole

Resolves one dynamic semantic role through the explicit, mapped, family, and emergency chain.

```ts
resolveKanbanThemeRole(theme: KanbanTheme, requestedRole: unknown, fallbackRole: KanbanThemeRole, capabilities: KanbanThemeCapabilities): KanbanResolvedThemeRole
```

## resolveKanbanVerticalProjectionExtent

Adds density-owned global resting gaps to a detached sparse descriptor extent.

```ts
resolveKanbanVerticalProjectionExtent(projection: KanbanVerticalHeightProjection, density: KanbanCardDensity): KanbanVerticalProjectionExtent
```

## setKanbanViewportInteractionEvidenceListener

Registers or clears one owning board listener without widening consumer construction options.

```ts
setKanbanViewportInteractionEvidenceListener<TCard>(viewport: KanbanViewport<TCard>, listener: (() => void) | undefined): void
```

## settleKanbanInverseRequest

Invoke one inverse builder through an exception-contained direct/native-Promise boundary.

```ts
settleKanbanInverseRequest(builder: KanbanInverseRequestBuilder, context: KanbanInverseRequestContext): Promise<KanbanInverseRequestSettlement>
```

## snapshotKanbanBoardCounts

Validates and freezes a complete board-count publication atomically.

```ts
snapshotKanbanBoardCounts(value: unknown): KanbanBoardCounts
```

## snapshotKanbanCapabilities

Creates a detached deeply frozen capability snapshot without changing authorization semantics.

```ts
snapshotKanbanCapabilities(capabilities: unknown): KanbanCapabilities
```

## snapshotKanbanCardLocation

Validates and freezes one bounded, revision-bound card-location result.

```ts
snapshotKanbanCardLocation(value: unknown): KanbanCardLocation
```

## snapshotKanbanCardMoveProposal

Validate, detach, and freeze one ordered atomic card-move proposal.

```ts
snapshotKanbanCardMoveProposal(value: unknown): KanbanCardMoveProposal
```

## snapshotKanbanCardPresentation

Detaches one application card into bounded, display-safe, deeply frozen presentation values.

```ts
snapshotKanbanCardPresentation<TCard>(card: TCard, adapter: KanbanCardPresentationAdapter<TCard>, context: KanbanCardPresentationSnapshotContext): KanbanCardPresentationSnapshot
```

## snapshotKanbanCellAddress

Validates, detaches, and freezes one column/swimlane cell address.

```ts
snapshotKanbanCellAddress(value: unknown): KanbanCellAddress
```

## snapshotKanbanCellCounts

Validates and freezes a complete cell-count publication atomically.

```ts
snapshotKanbanCellCounts(value: unknown): KanbanCellCounts
```

## snapshotKanbanCellState

Validates, detaches, and freezes one sparse-cursor lifecycle state.

```ts
snapshotKanbanCellState(value: unknown): KanbanCellState
```

## snapshotKanbanColumnMeta

Validates one ordered column metadata record.

```ts
snapshotKanbanColumnMeta(value: unknown): KanbanColumnMeta
```

## snapshotKanbanCount

Validates, detaches, and freezes one count without converting unknown authority to zero.

```ts
snapshotKanbanCount(value: unknown): KanbanCount
```

## snapshotKanbanDefinitionOfDone

Detaches compact and complete definition-of-done text for safe header/help presentation.

```ts
snapshotKanbanDefinitionOfDone(value: unknown): KanbanDefinitionOfDoneSnapshot
```

## snapshotKanbanEligibility

Validate and detach one result from a pure transition, DoD, WIP, or custom policy evaluator.

```ts
snapshotKanbanEligibility(value: unknown): KanbanEligibility
```

## snapshotKanbanGroupingPolicy

Snapshots the sole query-owned grouping policy without invoking card callbacks.

```ts
snapshotKanbanGroupingPolicy<TCard, TCardKey extends CardKey = KanbanCardKeyFor<TCard>>(value: unknown): KanbanGroupingPolicy<TCard, TCardKey>
```

## snapshotKanbanHeaderBatch

Validates, detaches, and freezes one complete header batch.

```ts
snapshotKanbanHeaderBatch(value: unknown): KanbanHeaderBatch
```

## snapshotKanbanIdentityChangeBatch

Validates and freezes one bounded authoritative identity-change batch atomically.

```ts
snapshotKanbanIdentityChangeBatch(value: unknown): KanbanIdentityChangeBatch
```

## snapshotKanbanKnownLength

Validates and freezes explicit exact, lower-bound, or unknown cursor length knowledge.

```ts
snapshotKanbanKnownLength(value: unknown): KanbanKnownLength
```

## snapshotKanbanLabel

Copies one sanitized bounded UX label.

```ts
snapshotKanbanLabel(value: unknown): string | undefined
```

## snapshotKanbanMovePosition

Validate, detach, and freeze one dispatchable semantic move position.

```ts
snapshotKanbanMovePosition(value: unknown): KanbanMovePosition
```

## snapshotKanbanMovePositionEvidence

Validate and detach bounded source-owned evidence before placement evaluation.

```ts
snapshotKanbanMovePositionEvidence(value: unknown): KanbanMovePositionEvidence
```

## snapshotKanbanMovedCard

Validate, detach, and freeze source evidence for one moved card.

```ts
snapshotKanbanMovedCard(value: unknown): KanbanMovedCardSnapshot
```

## snapshotKanbanNumericSummary

Validates one numeric summary with explicit authority and quality.

```ts
snapshotKanbanNumericSummary(value: unknown): KanbanNumericSummary
```

## snapshotKanbanOperationSnapshot

Validate, detach, and freeze one payload-free lifecycle snapshot.

```ts
snapshotKanbanOperationSnapshot(value: unknown): KanbanOperationSnapshot
```

## snapshotKanbanOperationSubject

Validate, detach, and freeze one operation subject.

```ts
snapshotKanbanOperationSubject(value: unknown): KanbanOperationSubject
```

## snapshotKanbanOperationSubjects

Validate a bounded sorted unique affected-subject set.

```ts
snapshotKanbanOperationSubjects(value: unknown): readonly KanbanOperationSubject[]
```

## snapshotKanbanPendingProjection

Validate and detach one payload-free semantic pending projection.

```ts
snapshotKanbanPendingProjection(value: unknown): KanbanPendingProjection
```

## snapshotKanbanPlacement

Validates, detaches, and freezes one revision-bound semantic placement.

```ts
snapshotKanbanPlacement(value: unknown): KanbanPlacement
```

## snapshotKanbanPlacementTokens

Validate a bounded set of current opaque placement tokens without interpreting their contents.

```ts
snapshotKanbanPlacementTokens(value: unknown): readonly PlacementToken[]
```

## snapshotKanbanQuery

Validates and deeply snapshots one immutable semantic query before a source sees it.

```ts
snapshotKanbanQuery(value: unknown): KanbanQuery
```

## snapshotKanbanReasonCode

Copies one bounded reason code or returns no value when it is unsafe.

```ts
snapshotKanbanReasonCode(value: unknown): string | undefined
```

## snapshotKanbanRequestProposal

Validate, deeply detach, and freeze one caller-facing request proposal.

```ts
snapshotKanbanRequestProposal<const T>(value: T): T & KanbanRequestProposal
```

## snapshotKanbanRevision

Validates one equality-only revision without coercion or disclosure of rejected content.

```ts
snapshotKanbanRevision(value: unknown): KanbanRevision
```

## snapshotKanbanSemanticValue

Validates, detaches, sorts, normalizes, and deeply freezes one semantic value.

```ts
snapshotKanbanSemanticValue<T extends KanbanSemanticValue>(value: T): T
```

## snapshotKanbanSessionPublication

Validates, detaches, and freezes one atomic session metadata publication.

```ts
snapshotKanbanSessionPublication(value: unknown): KanbanSessionPublication
```

## snapshotKanbanSourceState

Validates, detaches, and freezes one query-session lifecycle state.

```ts
snapshotKanbanSourceState(value: unknown): KanbanSourceState
```

## snapshotKanbanStructurePolicy

Validates and detaches a complete reactive structure policy before it affects scene projection.

```ts
snapshotKanbanStructurePolicy<TCard>(value: unknown): KanbanStructurePolicy<TCard>
```

## snapshotKanbanSwimlaneLayoutHintBatch

Validates one revision/query-generation-bound aggregate layout-hint response.

```ts
snapshotKanbanSwimlaneLayoutHintBatch(value: unknown): KanbanSwimlaneLayoutHintBatch
```

## snapshotKanbanSwimlaneLayoutHintRequest

Validates and detaches one bounded swimlane-axis layout-hint request.

```ts
snapshotKanbanSwimlaneLayoutHintRequest(value: unknown): KanbanSwimlaneLayoutHintRequest
```

## snapshotKanbanSwimlaneMeta

Validates one ordered swimlane metadata record.

```ts
snapshotKanbanSwimlaneMeta(value: unknown): KanbanSwimlaneMeta
```

## snapshotKanbanUndoDescriptor

Validate and freeze one exact mutually exclusive undo descriptor.

```ts
snapshotKanbanUndoDescriptor(value: unknown): KanbanUndoDescriptor
```

## snapshotKanbanVerticalHeightProjection

Validates and detaches one bounded sparse-height projection.

```ts
snapshotKanbanVerticalHeightProjection(value: unknown): KanbanVerticalHeightProjection
```

## solveKanbanColumnWidths

Solves bounded workflow-column widths using deterministic monotone progressive water filling.

```ts
solveKanbanColumnWidths(options: SolveKanbanColumnWidthsOptions): KanbanColumnWidthSolution
```

## validateKanbanCardDescriptor

Validates an untrusted renderer descriptor against its exact render context.

```ts
validateKanbanCardDescriptor(descriptor: KanbanCardDescriptor, context: KanbanCardRenderContext): void
```

## validateKanbanLimitOptions

Resolves and freezes a class-bounded limit selection before any caller allocation occurs.

```ts
validateKanbanLimitOptions(options: KanbanLimitOptions = {}): KanbanResolvedLimits
```

## validateKanbanUniqueIds

Validates a complete identity collection before optionally publishing it.

```ts
validateKanbanUniqueIds(kind: KanbanIdentityKind, values: readonly string[], publish?: (validated: readonly string[]) => void): readonly string[]
```
