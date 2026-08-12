<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:update`. Source: @jsvision/* JSDoc. -->

# API — @jsvision/kanban/testing — deterministic interaction harnesses

Test-only clocks, host trace replay, dispatcher control, and operation lifecycle evidence.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import these symbols from `@jsvision/kanban/testing`. For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## KanbanActiveDropGapInput

One compact-density gap created only for the current semantic proposal.

```ts
interface KanbanActiveDropGapInput {
  address: KanbanCellAddress;   // Cell whose stack owns the temporary row.
}
```

## KanbanBoardSetupHarness

Deterministic model of the board's cancellation-first setup transaction.

```ts
interface KanbanBoardSetupHarness {
  mount(): void;   // Runs the ordered setup transaction and throws at the configured stage.
  snapshot(): KanbanBoardSetupHarnessSnapshot;   // Returns immutable payload-free ownership counters.
}
```

## KanbanBoardSetupHarnessOptions

Options for forcing one setup stage to fail after its earlier resources are acquired.

```ts
interface KanbanBoardSetupHarnessOptions {
  failAt: KanbanBoardSetupStage;   // Stage that throws during KanbanBoardSetupHarness.mount.
}
```

## KanbanBoardSetupHarnessSnapshot

Detached resource evidence returned by the deterministic setup harness.

```ts
interface KanbanBoardSetupHarnessSnapshot {
  inputEnabled: boolean;   // Input becomes true only after every earlier owner is ready.
  liveResources: readonly KanbanBoardSetupStage[];   // Setup owners that have not yet been released, in acquisition order.
  captureLeases: number;   // Active synthetic capture leases retained by the harness.
  timers: number;   // Active synthetic timers retained by the harness.
  subscriptions: number;   // Active synthetic subscriptions retained by the harness.
}
```

## KanbanBoardSetupStage

Setup stages exposed by the deterministic board lifecycle harness.

```ts
type KanbanBoardSetupStage = 'coordinator' | 'viewport' | 'controller' | 'input'
```

## KanbanCardDropMap

Immutable pure target projection tied to one current geometry generation.

```ts
interface KanbanCardDropMap {
  geometryGeneration: number;   // Geometry generation represented by every retained target.
  density: KanbanCardDensity;   // Density whose gutter rules produced the target set.
  targets: readonly KanbanCardDropTarget[];   // Bounded deterministic targets in overlap-priority order.
  targetAt(point: Readonly<Point>): KanbanCardDropTarget | undefined;   // Resolve the highest-priority target containing one viewport-local point.
}
```

## KanbanCardDropTarget

One immutable semantic card destination independent of ordinary action-hit z-order.

```ts
interface KanbanCardDropTarget {
  kind: KanbanCardDropTargetKind;   // Visual target category used by projection and non-color feedback.
  slotId: string;   // Stable semantic slot identity used by hysteresis across layout movement.
  address: KanbanCellAddress;   // Destination cell represented by the target.
  position: KanbanMovePosition;   // Current revision-bound application placement.
  eligibility: KanbanEligibility;   // Pure policy result captured with this target.
  rect?: Readonly<Rect>;   // Current clipped viewport-local target rectangle.
  geometryGeneration: number;   // Geometry generation that owns the rectangle and placement.
  cardKey?: CardKey;   // Card whose upper or lower half supplied a fallback target.
  prefetch?: KanbanDragPrefetchHint;   // Bounded source hint present only while an unknown edge is unavailable.
}
```

## KanbanCardDropTargetKind

Exact semantic kinds produced by the pure card drop map.

```ts
type KanbanCardDropTargetKind = | 'resting-gutter'
  | 'card-before'
  | 'card-after'
  | 'cell-leading'
  | 'cell-trailing'
  | 'post-header'
  | 'empty-cell'
  | 'active-gap'
  | 'unknown-edge'
```

## KanbanCursorCardInspection

Safe inspection of one requested resident or unloaded card slot.

```ts
interface KanbanCursorCardInspection {
  index: number;   // Requested logical index.
  cardKey: CardKey | 'unloaded';   // Stable card key, or an explicit unloaded marker.
}
```

## KanbanCursorInspection

Detached inspection of one cursor's observable public state.

```ts
interface KanbanCursorInspection {
  state: KanbanCellState;
  counts: KanbanCellCounts;
  length: KanbanKnownLength;
  revision: KanbanRevision;
  cards: readonly KanbanCursorCardInspection[];
  placements: readonly KanbanPlacementInspection[];
}
```

## KanbanCursorLifecycleHarness

Public black-box cursor lifecycle harness.

```ts
interface KanbanCursorLifecycleHarness {
  ensureRange(start: number, end: number, options?: { readonly signal?: AbortSignal }): Promise<void>;
  snapshot(options?: {
    readonly indices?: readonly number[];
    readonly slots?: readonly number[];
  }): KanbanCursorInspection;
  retry(): Promise<void>;
  observations(): readonly KanbanObservation[];
  dispose(): void;
}
```

## KanbanCursorLifecycleHarnessOptions

Options for the testing-only cursor lifecycle harness.

```ts
interface KanbanCursorLifecycleHarnessOptions<TCard> {
  cursor: KanbanCellCursor<TCard>;
  address: KanbanCellAddress;
  keyOf: (card: TCard) => CardKey;
  limits?: KanbanLimitOptions;
  observe?: (observation: KanbanObservation) => void;
}
```

## KanbanDeferred

Deterministic manually settled promise controller for consumer source tests.

```ts
interface KanbanDeferred<T> {
  promise: Promise<T>;   // Promise settled exactly once by the controller.
  resolve(value: T): void;   // Resolves the promise on its first call.
  reject(error: unknown): void;   // Rejects the promise on its first call.
  settled(): boolean;   // Reports whether either settlement method has already won.
}
```

## KanbanDescriptorCacheKey

Complete semantic identity of one viewport-local descriptor projection.

```ts
interface KanbanDescriptorCacheKey {
  generation: number;   // Viewport read-generation owner.
  address: KanbanCellAddress;   // Source cell containing the card.
  cursorRevision: KanbanRevision;   // Equality-only cell cursor revision.
  cardKey: CardKey;   // Stable application-owned card identity.
  rendererRevision: KanbanRevision;   // Equality-only custom-renderer/configuration revision.
  presentationRevision?: KanbanRevision;   // Optional application presentation revision for this card.
  presentationPolicyRevision: KanbanRevision;   // Equality-only resolved presentation-policy revision.
  presentationSelectionFingerprint: string;   // Stable fingerprint of the resolved per-card optional-section selection.
  styleRevision?: KanbanRevision;   // Optional equality-only semantic style revision.
  width: number;   // Exact descriptor width in terminal cells.
  rowBudget: number;   // Maximum descriptor rows.
  density: KanbanCardDensity;   // Requested vertical density.
  themeRevision: KanbanRevision;   // Equality-only resolved-theme revision.
  capabilityRevision: KanbanRevision;   // Equality-only terminal-capability revision.
  interactionRevision: KanbanRevision;   // Equality-only focus/selection/operation-state revision.
}
```

## KanbanDescriptorCacheTestHarness

Counter-only testing seam over the real bounded descriptor cache.

```ts
interface KanbanDescriptorCacheTestHarness {
  getOrCreate: (key: KanbanDescriptorCacheKey, factory: () => KanbanCardDescriptor) => KanbanCardDescriptor;   // Returns an existing descriptor or creates it through the real owned computation.
  retain: (keys: readonly KanbanDescriptorCacheKey[]) => void;   // Retains only the supplied semantic keys.
  invalidate: (selector?: KanbanDescriptorInvalidation) => number;   // Invalidates matching semantic keys.
  snapshot: () => KanbanDescriptorCacheTestSnapshot;   // Returns detached frozen lifecycle counters.
  dispose: () => void;   // Disposes every computation and closes the harness.
}
```

## KanbanDescriptorCacheTestHarnessOptions

Options for one bounded descriptor-cache harness.

```ts
interface KanbanDescriptorCacheTestHarnessOptions {
  maximumEntries: number;   // Maximum retained computation count.
  onDescriptorInvalidated?: (key: Readonly<KanbanDescriptorCacheKey>) => void;   // Optional detached invalidation-key observer.
}
```

## KanbanDescriptorCacheTestSnapshot

Frozen lifecycle counters exposed by the descriptor-cache testing seam.

```ts
interface KanbanDescriptorCacheTestSnapshot {
  retained: number;   // Currently retained descriptors.
  created: number;   // Initial descriptor computations created for previously unseen semantic keys.
  rebuilt: number;   // Descriptor computations recreated or reactively republished after invalidation.
  disposed: number;   // Computation scopes disposed by retain, invalidation, eviction, or harness disposal.
  invalidations: number;   // Targeted or reactive invalidation notifications.
  activeComputations: number;   // Currently owned reactive computations.
}
```

## KanbanDescriptorInvalidation

Narrow targeted-invalidation selector; omitted fields match every value.

```ts
interface KanbanDescriptorInvalidation {
  generation?: number;   // Match one read generation.
  address?: KanbanCellAddress;   // Match one source cell.
  cardKey?: CardKey;   // Match one stable card identity.
  cursorRevision?: KanbanRevision;   // Match one owning cursor revision.
  rendererRevision?: KanbanRevision;   // Match one renderer revision.
  presentationRevision?: KanbanRevision;   // Match one optional card presentation revision.
  presentationPolicyRevision?: KanbanRevision;   // Match one resolved presentation-policy revision.
  presentationSelectionFingerprint?: string;   // Match one per-card optional-section selection fingerprint.
  styleRevision?: KanbanRevision;   // Match one semantic style revision.
  themeRevision?: KanbanRevision;   // Match one theme revision.
  capabilityRevision?: KanbanRevision;   // Match one capability revision.
  interactionRevision?: KanbanRevision;   // Match one interaction-state revision.
}
```

## KanbanDispatcherHarness

Deterministic dispatcher with explicit FIFO settlement and bounded call evidence.

```ts
interface KanbanDispatcherHarness {
  dispatcher: KanbanRequestDispatcher;   // Dispatcher passed to a real board.
  calls(): readonly KanbanDispatcherHarnessCall[];   // Returns detached payload-free calls in admission order.
  settleNext(result: KanbanRequestResult): boolean;   // Resolves the oldest unsettled dispatcher call.
  dispose(): void;   // Rejects and clears every unsettled call.
}
```

## KanbanDispatcherHarnessCall

Payload-free record of one dispatcher invocation.

```ts
interface KanbanDispatcherHarnessCall {
  operationId: KanbanOperationId;   // Coordinator-owned operation identity.
  kind: KanbanRequest['kind'];   // Closed standard or extension request discriminator.
  aborted: boolean;   // Whether the operation signal was already aborted at invocation.
}
```

## KanbanDragConfiguration

Public bounded drag configuration shared by board-owned pointer gestures.

```ts
type KanbanDragConfiguration = KanbanPointerRouterOptions
```

## KanbanDragFrameSnapshot

Counter-only drag frame evidence that never exposes card content or private overlay objects.

```ts
interface KanbanDragFrameSnapshot {
  transientOverlayMembers: number;   // Card and structural drag overlay members retained in the current frame.
  operationOverlays: number;   // Pending and terminal operation overlays retained in the current frame.
  damageRegions: number;   // Damage rectangles produced by the most recent frame projection.
}
```

## KanbanDragHarness

Detached decoded input retained by the deterministic drag harness.

```ts
interface KanbanDragHarness {
  accept(event: unknown): void;   // Appends one sanitized mouse or focus event and ignores payload-bearing input.
  events(): readonly KanbanDragHarnessEvent[];   // Returns a frozen copy of accepted payload-free events.
  dispose(): void;   // Clears all retained events.
}
```

## KanbanDragHarnessEvent

Payload-free input kinds retained by the public host harness.

```ts
type KanbanDragHarnessEvent = MouseEvent | FocusEvent
```

## KanbanDropCardInput

One resident card whose visible halves can act as fallback drop targets.

```ts
interface KanbanDropCardInput {
  cardKey: CardKey;   // Stable application-owned card identity.
  rect: Readonly<Rect>;   // Current clipped viewport-local card rectangle.
  before: unknown;   // Placement before the card.
  after: unknown;   // Placement after the card.
  beforeEligibility?: KanbanEligibility;   // Optional policy result for the upper half.
  afterEligibility?: KanbanEligibility;   // Optional policy result for the lower half.
}
```

## KanbanDropCellCompleteness

Source completeness that controls whether logical cell edges are authoritative.

```ts
interface KanbanDropCellCompleteness {
  leading: boolean;   // Whether logical start is known.
  trailing: boolean;   // Whether logical end is known.
  empty: boolean;   // Whether the complete cell is known to contain no cards.
}
```

## KanbanDropCellInput

Post-layout geometry and semantic evidence for one visible board cell.

```ts
interface KanbanDropCellInput {
  address: KanbanCellAddress;   // Workflow column and optional swimlane owning the cell.
  content: Readonly<Rect>;   // Clipped card-content rectangle.
  header: Readonly<Rect>;   // Header/chrome rectangle retained only to make its inert ownership explicit.
  postHeader?: KanbanDropRegionInput;   // Separate first slot immediately below header/chrome.
  leading?: KanbanDropRegionInput;   // Bounded logical-start zone.
  trailing?: KanbanDropRegionInput;   // Bounded logical-end zone.
  cards: readonly KanbanDropCardInput[];   // Visible resident cards in deterministic source order.
  gutters: readonly KanbanDropRegionInput[];   // Full-width resting gaps available outside compact density.
  complete: KanbanDropCellCompleteness;   // Current source completeness for this cell.
  unknownLeading?: KanbanUnknownDropEdgeInput;   // Optional unavailable edge before the retained source window.
  unknownTrailing?: KanbanUnknownDropEdgeInput;   // Optional unavailable edge after the retained source window.
  emptyEligibility?: KanbanEligibility;   // Optional policy result for a known empty cell.
}
```

## KanbanDropRegionInput

One semantic rectangle and placement owned by a cell edge or resting gap.

```ts
interface KanbanDropRegionInput {
  rect: Readonly<Rect>;   // Current clipped viewport-local geometry.
  position: unknown;   // Revision-bound semantic placement represented by the geometry.
  eligibility?: KanbanEligibility;   // Optional pure policy result; omitted regions are allowed.
}
```

## KanbanEagerFixture

Controllable reactive eager fixture returned from the testing entry.

```ts
interface KanbanEagerFixture<TCard> {
  source: KanbanDataSource<TCard>;   // Public eager source under test.
  cards: Signal<readonly TCard[]>;   // Reactive application-owned card publication.
  columns: Signal<readonly KanbanColumnMeta[]>;   // Reactive application-owned ordered columns.
}
```

## KanbanFakeClock

Small deterministic scheduler used by drag/autoscroll tests without wall-clock sleeps.

```ts
interface KanbanFakeClock {
  now(): number;   // Returns current virtual time in milliseconds.
  schedule(delayMs: number, callback: () => void): KanbanFakeClockHandle;   // Schedules one callback at or after the requested finite delay.
  advance(milliseconds: number): void;   // Advances virtual time and runs due callbacks in deadline/insertion order.
  pending(): number;   // Returns the number of live scheduled callbacks.
  dispose(): void;   // Cancels every retained callback.
}
```

## KanbanFakeClockHandle

Deterministic timer handle owned by KanbanFakeClock.

```ts
interface KanbanFakeClockHandle {
  cancel(): void;   // Cancels the scheduled callback idempotently.
}
```

## KanbanKeyInput

Normalized terminal key evidence accepted by the Phase B keyboard router.

```ts
interface KanbanKeyInput {
  key: string;   // Printable character or lowercase named key from the terminal decoder.
  ctrl: boolean;   // Whether the currently deliverable Ctrl modifier is present.
  alt: boolean;   // Whether the Alt modifier is present.
  shift: boolean;   // Whether the Shift modifier is present.
}
```

## KanbanKeyInputSink

Synchronous seams used to route one key without awaiting controller settlement.

```ts
interface KanbanKeyInputSink {
  snapshot: () => KanbanInteractionSnapshot;   // Reads the current detached focus and selection evidence.
  accept: (transition: KanbanInteractionTransition) => boolean;   // Queues one recognized transition and reports immediate acceptance.
  activate: (origin: KanbanInteractionOrigin) => boolean;   // Queues focused-card activation through the semantic intent boundary.
  moveFocused?: (direction: KanbanMoveDirection) => boolean;   // Starts one semantic focused-card move without synthesizing pointer visuals.
  cancelTransient?: () => boolean;   // Cancels the active drag or latest cancellable operation before selection Escape.
}
```

## KanbanMetricRange

Safe requested range retained by fixture metrics.

```ts
interface KanbanMetricRange {
  address: KanbanCellAddress;
  start: number;
  end: number;
}
```

## KanbanOperationLifecycleHarness

Bounded lifecycle collector that never retains request payloads or application errors.

```ts
interface KanbanOperationLifecycleHarness {
  accept(snapshot: KanbanOperationSnapshot): void;   // Accepts one already-sanitized operation snapshot.
  records(): readonly KanbanOperationLifecycleRecord[];   // Returns detached records in observation order.
  metrics(): KanbanOperationLifecycleMetrics;   // Returns scalar retained-identity and concurrency evidence without operation payloads.
  dispose(): void;   // Clears retained evidence and rejects later observations.
}
```

## KanbanOperationLifecycleMetrics

Bounded scalar evidence for lifecycle retention and concurrent operation pressure.

```ts
interface KanbanOperationLifecycleMetrics {
  retainedOperationIds: number;   // Number of distinct operation identities retained in the bounded record set.
  concurrentOperations: number;   // Number of operations whose latest observed state is currently non-terminal.
  maximumConcurrentOperations: number;   // Largest number of concurrently non-terminal operations observed.
  retainedRecords: number;   // Total lifecycle records accepted by the harness.
}
```

## KanbanOperationLifecycleRecord

Payload-free lifecycle record retained by the operation harness.

```ts
interface KanbanOperationLifecycleRecord {
  operationId: KanbanOperationId;   // Stable operation identity.
  state: KanbanOperationSnapshot['state'];   // Observed lifecycle state.
  affectedCount: number;   // Number of affected semantic subjects.
}
```

## KanbanPendingPress

Immutable primary-button evidence retained only until one matching up report.

```ts
interface KanbanPendingPress {
  target: KanbanActionTarget;   // Actionable target captured from the down report.
  sceneRevision: KanbanRevision;   // Revision that owned the target when the press began.
  priorSelection: KanbanSelectionSnapshot;   // Eligible application selection captured before focus changes.
  ctrl: boolean;   // Whether Ctrl requested toggle semantics for a card click.
  clickCount: 1 | 2;   // One for a single click or two for framework-confirmed double-click completion.
  generation: number;   // Monotonic gesture identity allocated before application callbacks.
  originPoint?: Readonly<Point>;   // Down coordinate retained only when mounted drag evidence is available.
  shift: boolean;   // Whether Shift was held when the press began.
  alt: boolean;   // Whether Alt was held when the press began.
}
```

## KanbanPendingRange

Safe pending half-open range exposed to deterministic fixture controllers.

```ts
interface KanbanPendingRange {
  requestId: number;
  sessionId: number;
  cursorId: number;
  address: KanbanCellAddress;
  start: number;
  end: number;
  sessionRevision: KanbanRevision;
  cursorRevision: KanbanRevision;
}
```

## KanbanPlacementInspection

Safe placement inspection with every opaque token value removed.

```ts
type KanbanPlacementInspection = | Exclude<KanbanPlacement, { readonly kind: 'window-edge' }>
  | {
      readonly kind: 'window-edge';
      readonly edge: 'before' | 'after';
      readonly neighborCardKey: CardKey;
      readonly token?: 'redacted';
      readonly cursorRevision: KanbanRevision;
    }
```

## KanbanPointerDragStart

Immutable threshold-crossing handoff to the render-neutral drag controller.

```ts
interface KanbanPointerDragStart {
  point: Readonly<Point>;   // Current coordinate that met the configured Manhattan threshold.
  capture: PointerCaptureLease;   // Generation-bound capture owned by the new drag.
  dragged: readonly KanbanSelectionEntry[];   // Ordered concrete selection entries represented by the drag.
}
```

## KanbanPointerInput

Normalized click-family input consumed by the bounded Phase B pointer router.

```ts
interface KanbanPointerInput {
  kind: 'down' | 'up' | 'move' | 'drag';   // Mouse report phase; move and drag reports cancel an incomplete press.
  button: number;   // Terminal mouse button, where zero is primary and two is context.
  ctrl: boolean;   // Whether Ctrl was delivered with this report.
  shift?: boolean;   // Whether Shift was delivered with this report.
  alt?: boolean;   // Whether Alt was delivered with this report.
  clickCount?: number;   // Framework-provided click count on a down report.
  target?: KanbanActionTarget;   // Current final clipped target under the pointer, when actionable.
  sceneRevision: KanbanRevision;   // Revision owning the current active hit map.
  point?: Readonly<Point>;   // Viewport-local terminal-cell coordinate supplied by a mounted dispatch envelope.
  gestureGeneration?: number;   // Optional old gesture identity carried by a queued report after capture loss.
  acquireCapture?: (onLost: PointerCaptureLostHandler) => PointerCaptureLease;   // Ephemeral event-loop capture acquisition available only during real dispatch.
}
```

## KanbanPointerRouter

Owns at most one bounded pending press for Phase B click-family interaction.

```ts
new KanbanPointerRouter(sink: KanbanPointerRouterSink, options: KanbanPointerRouterOptions = {})
// methods & signals:
gestureGenerationForCapture(captureGeneration: number | undefined): number | undefined
route(input: KanbanPointerInput): boolean
pending(): KanbanPendingPress | undefined
cancel(reason: Exclude<KanbanPointerDragCancellationReason, 'disposed'> = 'explicit'): boolean
dispose(): void
```

## KanbanPointerRouterOptions

Validated threshold configuration for one pointer-router instance.

```ts
interface KanbanPointerRouterOptions {
  dragThreshold?: number;   // Manhattan cells required to start dragging; defaults to one and is bounded to eight.
}
```

## KanbanPointerRouterSink

Serialized semantic seams used without capture, drag thresholds, or insertion geometry.

```ts
interface KanbanPointerRouterSink {
  snapshotSelection: () => KanbanSelectionSnapshot;   // Captures the current eligible application selection before focus changes.
  beginPrimary: (target: KanbanActionTarget) => boolean;   // Focuses or otherwise admits one current primary-down target synchronously.
  completeCard: (
    target: KanbanActionTarget,
    options: { readonly toggle: boolean; readonly activate: boolean },
  ) => boolean;   // Completes card selection and optional activation after one matching up report.
  completeCardAction: (target: KanbanActionTarget) => boolean;   // Completes one descriptor-local card action after a matching up report.
  completeScopedAction: (target: KanbanActionTarget) => boolean;   // Completes one application-owned header or state action.
  completeRetry: (target: KanbanActionTarget) => boolean;   // Invokes only the source-owned retry seam for a retry target.
  openContext: (target: KanbanActionTarget) => boolean;   // Focuses and opens context for the newly targeted card selection.
  snapshotCard?: (target: KanbanActionTarget) => KanbanSelectionEntry | undefined;   // Resolve current revision evidence for an unselected pointer-origin card.
  beginCardDrag?: (start: KanbanPointerDragStart) => boolean;   // Adopt one captured threshold-crossing handoff.
  updateCardDrag?: (
    generation: number,
    point: Readonly<Point>,
    target: KanbanActionTarget | undefined,
  ) => boolean;   // Recompute the current semantic destination for one captured move report.
  releaseCardDrag?: (generation: number) => boolean;   // Release one captured drag through its current semantic destination.
  cancelCardDrag?: (generation: number, reason: KanbanPointerDragCancellationReason) => void;   // Cancel a previously adopted generation before stale input can reach it.
  beginStructureDrag?: (start: KanbanPointerStructureDragStart) => boolean;   // Adopt one eligible structural header after threshold and capture acquisition.
  updateStructureDrag?: (
    generation: number,
    point: Readonly<Point>,
    target: KanbanActionTarget | undefined,
  ) => boolean;   // Recompute one current sibling structural destination.
  releaseStructureDrag?: (generation: number) => boolean;   // Release one captured structural reorder through exactly one proposal handoff.
  cancelStructureDrag?: (generation: number, reason: KanbanPointerDragCancellationReason) => void;   // Cancel structural capture before stale reports can reach it.
}
```

## KanbanPointerStructureDragStart

Threshold-crossing structural header evidence shared by columns and explicit swimlanes.

```ts
interface KanbanPointerStructureDragStart {
  point: Readonly<Point>;   // Current coordinate that met the configured Manhattan threshold.
  capture: PointerCaptureLease;   // Generation-bound capture owned by the new drag.
  structure: { readonly kind: 'column'; readonly columnId: string } | { readonly kind: 'swimlane'; readonly swimlaneId: string };   // Exact structural identity being reordered.
  cues: {
    readonly ghost: 'bounded-header';
    readonly placeholder: 'source-slot';
    readonly marker: 'sibling-insertion';
  };   // Stable renderer-neutral cue vocabulary used by structural overlays.
}
```

## KanbanQueryCellInspection

One bounded testing-only view of resident identities in an explicitly inspected cell.

```ts
interface KanbanQueryCellInspection {
  address: KanbanCellAddress;   // Detached collision-safe cell address.
  cards: readonly { readonly index: number; readonly cardKey: CardKey }[];   // Resident keys among the first bounded inspection slots.
}
```

## KanbanQueryInspection

Detached black-box snapshot of one active query session.

```ts
interface KanbanQueryInspection {
  query: KanbanQuery;   // Active detached semantic query.
  sessionRevision: KanbanRevision;   // Equality-only revision of the active session.
  state: KanbanSourceState;   // Validated board-wide source state.
  counts: KanbanBoardCounts;   // Validated honest board-wide counts.
  columns: readonly KanbanColumnMeta[];   // Ordered validated workflow columns.
  swimlanes: readonly KanbanSwimlaneMeta[];   // Ordered validated semantic swimlanes.
  inspectedCells: readonly KanbanQueryCellInspection[];   // Bounded resident identities read only from explicitly configured inspection cells.
}
```

## KanbanQueryLifecycleHarness

Public black-box query lifecycle harness.

```ts
interface KanbanQueryLifecycleHarness {
  replaceQuery(query: KanbanQuery): void;   // Replaces the semantic query and synchronously owns the new session.
  snapshot(): KanbanQueryInspection;   // Returns one detached active-session inspection.
  locateCard(key: CardKey, options?: { readonly signal?: AbortSignal }): Promise<KanbanCardLocation>;   // Performs one bounded lookup through the active session.
  observations(): readonly KanbanObservation[];   // Returns bounded already-redacted observations.
  dispose(): void;   // Invalidates and disposes the harness idempotently.
}
```

## KanbanQueryLifecycleHarnessOptions

Options for a testing-only query lifecycle harness.

```ts
interface KanbanQueryLifecycleHarnessOptions<TCard> {
  source: KanbanDataSource<TCard>;   // Ordinary public source fake or application adapter under test.
  initialQuery: KanbanQuery;   // Initial semantic query.
  observationCapacity?: number;   // Optional lower bounded observation capacity.
  inspectedAddresses?: readonly KanbanCellAddress[];   // Optional bounded cells whose resident card keys appear in snapshots.
  keyOf?: (card: TCard) => CardKey;   // Stable identity adapter required when inspected addresses are configured.
}
```

## KanbanRevisionController

Deterministic equality-only numeric revision controller.

```ts
interface KanbanRevisionController {
  revision(): number;   // Returns the active revision.
  next(): number;   // Advances and returns the next revision.
}
```

## KanbanSemanticHostEvidence

Sanitized proof of the real host path used for one replay.

```ts
interface KanbanSemanticHostEvidence {
  transport: KanbanSemanticTraceTransport;   // Host adapter selected by the caller.
  terminal: 'direct' | 'xterm-headless' | 'pty' | 'conpty';   // Concrete terminal implementation that decoded the input.
  pipeBacked: false;   // Always false; a pipe-backed child is never accepted as native evidence.
  platform: NodeJS.Platform;   // Runtime platform that produced the evidence.
}
```

## KanbanSemanticPointerResult

Payload-free semantic result shared by every supported host adapter.

```ts
interface KanbanSemanticPointerResult {
  evidence: KanbanSemanticHostEvidence;   // Host evidence kept separate from semantic equality.
  semantic: {
    readonly thresholdCrossed: boolean;
    readonly targetChanges: readonly string[];
    readonly autoscroll: readonly string[];
    readonly cancellations: readonly string[];
    readonly proposal: {
      readonly kind: 'card-move';
      readonly movedCardKeys: readonly (string | number)[];
      readonly columnId: string;
      readonly swimlaneId: string;
      readonly position: 'before' | 'after' | 'start' | 'end';
    };
  };   // Stable semantic facts derived from decoded input rather than raw transport bytes.
}
```

## KanbanSemanticPointerTrace

One immutable raw-input trace that carries no application card data.

```ts
interface KanbanSemanticPointerTrace {
  input: string;   // SGR mouse and focus bytes replayed by every host adapter.
}
```

## KanbanSemanticTraceTransport

Supported deterministic transports for the standard semantic pointer trace.

```ts
type KanbanSemanticTraceTransport = 'direct' | 'browser-xterm' | 'unix-pty' | 'windows-conpty'
```

## KanbanStabilizationCard

Card shape shared by stabilization geometry, interaction, and performance specifications.

```ts
type KanbanStabilizationCard = StandardCard<string, KanbanStabilizationCardData>
```

## KanbanStabilizationCardData

Application-owned metadata that makes the fixture resemble imported GitHub project items.

```ts
interface KanbanStabilizationCardData {
  repository: string;   // Repository that owns the simulated issue or pull request.
  reference: string;   // Compact source-system item reference.
  statusColor: KanbanStabilizationStatusColor;   // GitHub status color retained for application-level presentation tests.
}
```

## KanbanStabilizationFixture

Complete deterministic source data for the Kanban stabilization test matrix.

```ts
interface KanbanStabilizationFixture {
  columns: readonly KanbanColumnMeta[];   // Five ordered workflow columns, including one deliberately empty column.
  cards: readonly KanbanStabilizationCard[];   // Exactly 84 GitHub-shaped cards in deterministic source order.
  named: KanbanStabilizationNamedCards;   // Named identities for cases that tests need to target directly.
}
```

## KanbanStabilizationNamedCards

Stable identities for deliberately adversarial cards within the larger fixture.

```ts
interface KanbanStabilizationNamedCards {
  short: string;   // Small card used as the normal estimated-height control.
  tall: string;   // Checklist-heavy card expected to occupy substantially more rows.
  dense: string;   // Metadata-heavy card used to exercise bounded optional presentation.
  hostile: string;   // Card containing terminal controls and bidirectional formatting controls.
  unicode: string;   // Card containing wide and combining Unicode sequences.
  longestLocale: string;   // Card containing a deliberately long Dutch presentation string.
}
```

## KanbanStabilizationStatusColor

GitHub status colors represented by the deterministic stabilization fixture.

```ts
type KanbanStabilizationStatusColor = 'GRAY' | 'BLUE' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PINK' | 'PURPLE'
```

## KanbanTestingEventRing

Fixed-capacity FIFO used by testing instrumentation without retaining payload objects.

```ts
new KanbanTestingEventRing<TEvent>(capacity: number)
// methods & signals:
push(event: TEvent): void
values(): readonly TEvent[]
```

## KanbanUnknownDropEdgeInput

One unavailable loaded-window edge that may request bounded source evidence.

```ts
interface KanbanUnknownDropEdgeInput {
  prefetch: KanbanDragPrefetchHint;   // Bounded request used only while this edge remains the current target.
}
```

## KanbanViewportOperationObserver

One explicitly active testing observation of mounted viewport operations.

```ts
interface KanbanViewportOperationObserver {
  snapshot: () => KanbanViewportOperationSnapshot;   // Reads detached evidence accumulated by this observation.
  dispose: () => void;   // Stops the observation idempotently and releases retained evidence.
}
```

## KanbanViewportOperationSnapshot

Additive testing-only operation evidence kept separate from the stable scale snapshot.

```ts
interface KanbanViewportOperationSnapshot {
  projectionPasses: readonly KanbanViewportProjectionPassSnapshot[];   // Every projection attempt performed by the latest completed frame, in execution order.
}
```

## KanbanViewportProjectionPassSnapshot

Payload-free quality evidence for one projection pass in the latest completed viewport frame.

```ts
interface KanbanViewportProjectionPassSnapshot {
  ordinal: number;   // One-based pass position within the completed frame.
  heightQuality: 'estimated' | 'mixed' | 'measured';   // Whether this pass used only estimates, only exact measurements, or a mixture of both.
  measuredRows: number;   // Exact sparse rows consumed by this pass.
  estimatedRows: number;   // Estimated sparse rows consumed by this pass.
}
```

## KanbanViewportScaleSnapshot

Counter-only mounted scale evidence exposed exclusively through the testing package entry point.

```ts
interface KanbanViewportScaleSnapshot {
  retainedCursors: number;   // Retained sparse source cells/cursors.
  retainedAddresses: number;   // Unique retained semantic cell addresses.
  retainedDescriptors: number;   // Current descriptor cache entries.
  reactiveComputations: number;   // Current card-local reactive computations.
  heightAnchors: number;   // Sparse exact height anchors retained across cells.
  heightRuns: number;   // Sparse contiguous height runs retained across cells.
  heightAllocatedEntries: number;   // Total sparse height records retained across cells.
  damageRegions: number;   // Latest bounded damage rectangles.
  sceneWindowCells: number;   // Cells requested by the grouped preliminary layout window.
  descriptorOmissions: number;   // Exact loaded descriptor candidates omitted by the active mounted ceiling.
  projectedCards: number;   // Card faces retained in the final clipped projection.
  actionTargets: number;   // Final clipped actionable targets retained for pointer routing.
  operationOverlays: number;   // Pending and terminal operation overlays retained in the current frame.
  transientOverlayMembers: number;   // Card and structural drag overlay members retained in the current frame.
}
```

## KanbanWindowedFixture

Public source, settlement control, and safe metrics for one lazy fixture.

```ts
interface KanbanWindowedFixture<TCard> {
  source: KanbanDataSource<TCard>;
  controller: KanbanWindowedFixtureController;
  metrics(): KanbanWindowedFixtureMetrics;
  dispose(): void;
}
```

## KanbanWindowedFixtureController

Deterministic settlement controller for one windowed fixture.

```ts
interface KanbanWindowedFixtureController {
  pendingRanges(): readonly KanbanPendingRange[];
  resolveRange(requestId: number): void;
  rejectRange(requestId: number, error: { readonly code: string; readonly label?: string }): void;
  publishSession(publication: KanbanSessionPublication): void;
}
```

## KanbanWindowedFixtureEvent

Allowlisted payload-free event emitted by a windowed fixture.

```ts
interface KanbanWindowedFixtureEvent {
  kind: | 'open-session'
    | 'create-cursor'
    | 'ensure-range'
    | 'resolve-range'
    | 'reject-range'
    | 'abort-range'
    | 'publish'
    | 'dispose-cursor'
    | 'dispose-session';
  sessionId?: number;
  cursorId?: number;
  requestId?: number;
  address?: KanbanCellAddress;
  start?: number;
  end?: number;
  revision?: KanbanRevision;
  code?: string;
}
```

## KanbanWindowedFixtureMetrics

Frozen request-proportional metrics from a deterministic windowed fixture.

```ts
interface KanbanWindowedFixtureMetrics {
  logicalCardCount: number;
  openedSessions: number;
  disposedSessions: number;
  createdCursors: number;
  disposedCursors: number;
  ensureRangeCalls: number;
  requestedRanges: readonly KanbanMetricRange[];
  materializedCards: number;
  cardAtReads: number;
  abortedRequests: number;
  suppressedLateSettlements: number;
  publications: number;
  retainedEvents: readonly KanbanWindowedFixtureEvent[];
}
```

## KanbanWindowedFixtureOptions

Construction options for a lazy deterministic logical-card fixture.

```ts
interface KanbanWindowedFixtureOptions<TCard> {
  logicalCardCount: number;
  columns: readonly KanbanColumnMeta[];
  swimlanes?: readonly KanbanSwimlaneMeta[];
  initialRevision?: KanbanRevision;
  materialize: (request: {
    readonly address: KanbanCellAddress;
    readonly start: number;
    readonly end: number;
  }) => readonly TCard[];
  keyOf: (card: TCard) => CardKey;
  eventCapacity?: number;
}
```

## ProjectKanbanCardDropMapOptions

Inputs for one bounded immutable semantic drop-map projection.

```ts
interface ProjectKanbanCardDropMapOptions {
  density: KanbanCardDensity;   // Density controlling whether resting gutters exist.
  cells: readonly KanbanDropCellInput[];   // Visible cells in deterministic scene order.
  geometryGeneration?: number;   // Current geometry generation; defaults to the first generation.
  bounds?: Readonly<Rect>;   // Optional viewport clip applied to every target rectangle.
  activeGap?: KanbanActiveDropGapInput;   // Optional compact-density current proposal gap.
  maximumTargets?: number;   // Caller-selected target ceiling bounded by the package absolute limit.
}
```

## createEagerKanbanFixture

Creates a controllable reactive eager fixture while preserving application card references.

```ts
createEagerKanbanFixture<TCard>(initialCards: readonly TCard[], initialColumns: readonly KanbanColumnMeta[], options: Omit<EagerKanbanSourceOptions<TCard>, 'columns'>): KanbanEagerFixture<TCard>
```

## createKanbanBoardSetupHarness

Creates a deterministic board setup transaction with reverse-order rollback.

```ts
createKanbanBoardSetupHarness(options: KanbanBoardSetupHarnessOptions): KanbanBoardSetupHarness
```

## createKanbanCursorLifecycleHarness

Creates a black-box cursor lifecycle harness without exposing ranges, queues, or cursor identity.

```ts
createKanbanCursorLifecycleHarness<TCard>(options: KanbanCursorLifecycleHarnessOptions<TCard>): KanbanCursorLifecycleHarness
```

## createKanbanDeferred

Creates one deterministic deferred promise without timers.

```ts
createKanbanDeferred<T>(): KanbanDeferred<T>
```

## createKanbanDescriptorCacheTestHarness

Creates counter-only instrumentation over the production descriptor cache.

```ts
createKanbanDescriptorCacheTestHarness(options: KanbanDescriptorCacheTestHarnessOptions): KanbanDescriptorCacheTestHarness
```

## createKanbanDispatcherHarness

Creates a bounded application-dispatch harness with caller-controlled settlement.

```ts
createKanbanDispatcherHarness(maximumCalls = 512): KanbanDispatcherHarness
```

## createKanbanDragHarness

Creates a bounded decoded-event collector for host and drag tests.

```ts
createKanbanDragHarness(maximumEvents = 64): KanbanDragHarness
```

## createKanbanFakeClock

Creates an isolated deterministic drag clock.

```ts
createKanbanFakeClock(): KanbanFakeClock
```

## createKanbanOperationLifecycleHarness

Creates a payload-free operation lifecycle recorder.

```ts
createKanbanOperationLifecycleHarness(maximumRecords = 2_048): KanbanOperationLifecycleHarness
```

## createKanbanQueryLifecycleHarness

Creates a black-box query lifecycle harness without exposing generation internals.

```ts
createKanbanQueryLifecycleHarness<TCard>(options: KanbanQueryLifecycleHarnessOptions<TCard>): KanbanQueryLifecycleHarness
```

## createKanbanRevisionController

Creates a deterministic safe-integer revision sequence for fixtures.

```ts
createKanbanRevisionController(initialRevision = 0): KanbanRevisionController
```

## createKanbanStabilizationFixture

Creates the canonical 84-card mixed-height fixture used by stabilization tests and benchmarks.

```ts
createKanbanStabilizationFixture(): KanbanStabilizationFixture
```

## createKanbanStandardPointerTrace

Returns the canonical bounded SGR trace used for cross-host semantic parity.

```ts
createKanbanStandardPointerTrace(): KanbanSemanticPointerTrace
```

## createWindowedKanbanFixture

Creates a lazy 100,000-logical-card-capable source with explicit deterministic settlement.

```ts
createWindowedKanbanFixture<TCard>(options: KanbanWindowedFixtureOptions<TCard>): KanbanWindowedFixture<TCard>
```

## inspectKanbanDragFrame

Reads sanitized drag/operation overlay counts for one live mounted viewport.

```ts
inspectKanbanDragFrame(viewport: object): KanbanDragFrameSnapshot
```

## inspectKanbanViewportOperations

Reads payload-free projection-pass evidence for one live mounted viewport.

```ts
inspectKanbanViewportOperations(viewport: object): KanbanViewportOperationSnapshot
```

## inspectKanbanViewportScale

Reads counter-only bounded scale evidence for a live Kanban viewport.

```ts
inspectKanbanViewportScale(viewport: object): KanbanViewportScaleSnapshot
```

## observeKanbanViewportOperations

Enables payload-free projection diagnostics until the returned observer is disposed.

```ts
observeKanbanViewportOperations(viewport: object): KanbanViewportOperationObserver
```

## projectKanbanCardDropMap

Projects semantic card destinations independently from ordinary action hit testing.

```ts
projectKanbanCardDropMap(options: ProjectKanbanCardDropMapOptions): KanbanCardDropMap
```

## replayKanbanSemanticPointerTrace

Replays the standard trace through one honest host adapter and returns sanitized semantic evidence.

```ts
replayKanbanSemanticPointerTrace(trace: KanbanSemanticPointerTrace, options: { readonly transport: KanbanSemanticTraceTransport }): Promise<KanbanSemanticPointerResult>
```

## routeKanbanKeyInput

Routes the fixed Phase B keyboard subset and reports synchronous event-loop acceptance.

```ts
routeKanbanKeyInput(input: KanbanKeyInput, sink: KanbanKeyInputSink): boolean
```
