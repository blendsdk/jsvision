import { classicTheme } from '@jsvision/core';
import type { I18n } from '@jsvision/i18n';
import { View, signal } from '@jsvision/ui';
import type { DispatchEvent, DrawContext, Signal, Size2D } from '@jsvision/ui';

import type { KanbanCardPresentationAdapter } from '../card/adapter.js';
import type { KanbanCardDensity, KanbanCardRenderer } from '../card/descriptor.js';
import type { KanbanCardFormattingContext } from '../card/formatting.js';
import type { KanbanPresentationInput, ResolvedKanbanPresentationBudget } from '../card/presentation-policy.js';
import { resolveKanbanPresentation } from '../card/presentation-policy.js';
import type { KanbanTheme } from '../card/theme.js';
import { createKanbanTheme } from '../card/theme-resolver.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import { KanbanDisposedResourceError } from '../contract/error.js';
import { createKanbanExtensionId } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanLimitOptions, KanbanResolvedLimits } from '../contract/limits.js';
import type { KanbanObservation } from '../contract/observation.js';
import { kanbanRevisionsEqual } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { routeKanbanKeyInput } from '../interaction/input-router.js';
import type { KanbanScopedActionId } from '../interaction/intent.js';
import { KanbanPointerRouter } from '../interaction/pointer-router.js';
import type { KanbanDragConfiguration } from '../interaction/pointer-router.js';
import type { KanbanEligibleSelectionCandidate } from '../interaction/selection.js';
import { KanbanStructuralDragController } from '../interaction/structural-drag.js';
import type { KanbanStructuralDragScene } from '../interaction/structural-drag.js';
import type {
  KanbanFocusTarget,
  KanbanInteractionAcquisitionResult,
  KanbanInteractionRevisions,
  KanbanNavigationSnapshot,
  KanbanNavigationTarget,
  KanbanSelectionSnapshot,
} from '../interaction/types.js';
import { KANBAN_NEUTRAL_INTERACTION_SNAPSHOT } from '../interaction/types.js';
import type { KanbanActionTarget, KanbanDamageRegion } from '../layout/hit-map.js';
import type { KanbanViewportMetrics, KanbanViewportPoint } from '../layout/metrics.js';
import type { KanbanSceneCustomChromeInput } from '../layout/swimlane-custom.js';
import { createKanbanSparseHeightIndex } from '../layout/sparse-height-index.js';
import type { KanbanSparseHeightIndex } from '../layout/sparse-height-index.js';
import {
  createKanbanVerticalHeightProjection,
  resolveKanbanVerticalProjectionExtentWithGap,
} from '../layout/vertical-projector.js';
import type { KanbanFocusedColumnNavigator } from '../layout/width-solver.js';
import { createEnglishKanbanI18n } from '../i18n/catalog.js';
import type { KanbanSourceState } from '../source/states.js';
import type { KanbanCellAddress, KanbanDataSource, KanbanIdentityChangeBatch, KanbanQuery } from '../source/types.js';
import { snapshotKanbanQuery } from '../source/validation.js';
import { canonicalizeKanbanCellAddress } from '../source/address.js';
import type { KanbanStructurePolicy } from '../structure/policy.js';
import { createKanbanSwimlanePresentationResolver } from '../structure/swimlane-presentation.js';
import type { KanbanSwimlanePresentationResolver } from '../structure/swimlane-presentation.js';
import { framedKanbanCardHeight } from '../layout/card-geometry.js';
import { KANBAN_MINIMUM_VIEWPORT_ROWS, KANBAN_WORKFLOW_HEADER_ROWS } from '../layout/workflow-geometry.js';
import { KanbanDescriptorCache } from './descriptor-cache.js';
import { readKanbanIdentityInput } from './board-state.js';
import { calculateKanbanViewportDamage } from './viewport-damage.js';
import { resolveKanbanProjectionConvergenceFailure } from './viewport-convergence.js';
import { composeKanbanViewportOverlay } from './overlay-projector.js';
import { createKanbanViewportInspection } from './viewport-inspection.js';
import type { KanbanViewportInspection } from './viewport-inspection.js';
import { createKanbanFocusedDetailSnapshot } from './board-feedback.js';
import { createKanbanViewportMetrics } from './viewport-metrics.js';
import { projectKanbanViewport } from './viewport-projector.js';
import type { KanbanViewportCardPresentation, KanbanViewportProjection } from './viewport-projector.js';
import type { KanbanViewportCellHeightProjection } from './viewport-metrics.js';
import { drawKanbanViewport } from './viewport-render.js';
import {
  resolveKanbanScrollBy,
  resolveKanbanScrollTo,
  resolveKanbanRevealOffset,
  snapshotKanbanRevealAlignment,
  snapshotKanbanRevealKey,
} from './viewport-scroll.js';
import type { KanbanRevealAlignment, KanbanRevealResult, KanbanScrollTarget } from './viewport-scroll.js';
import { KanbanViewportSource } from './viewport-source.js';
import type {
  KanbanCardRangeWindow,
  KanbanGroupedAxisWindow,
  KanbanOverscanOptions,
  KanbanSceneWindowLayoutHint,
  KanbanViewportSourceSnapshot,
} from './viewport-source.js';
import { readViewportHostChromeRows } from './viewport-host-chrome.js';
import {
  registerKanbanViewportOperationReader,
  registerKanbanViewportScaleReader,
  unregisterKanbanViewportOperationReader,
  unregisterKanbanViewportScaleReader,
} from './viewport-scale-inspection.js';
import type {
  KanbanViewportOperationSnapshot,
  KanbanViewportProjectionPassSnapshot,
  KanbanViewportScaleSnapshot,
} from './viewport-scale-inspection.js';
import { KanbanViewportInteractionBinding } from './viewport-interaction.js';
import type { KanbanViewportInputAdapter, KanbanViewportInteractionAdapter } from './viewport-interaction.js';
import { normalizeKanbanViewportPointerInput } from './viewport-input.js';
import { KanbanViewportDragController } from './viewport-drag.js';
import type { KanbanViewportDragScene } from './viewport-drag.js';
import {
  cancelKanbanViewportOperations,
  disposeKanbanViewportOperations,
  mountKanbanViewportOperations,
  readKanbanViewportOperations,
} from './viewport-operation-bridge.js';
import { disposeKanbanViewportMoveReader, prepareKanbanViewportMoveReader } from './viewport-move-bridge.js';

/** Board-owned listeners notified after viewport evidence changes semantically. */
const INTERACTION_EVIDENCE_LISTENERS = new WeakMap<object, () => void>();

/** Registers or clears one owning board listener without widening consumer construction options. */
export function setKanbanViewportInteractionEvidenceListener<TCard>(
  viewport: KanbanViewport<TCard>,
  listener: (() => void) | undefined,
): void {
  if (listener === undefined) INTERACTION_EVIDENCE_LISTENERS.delete(viewport);
  else INTERACTION_EVIDENCE_LISTENERS.set(viewport, listener);
}

/** Application-owned identity hints projected by a read-only board. */
export interface KanbanIdentityInput {
  /** Card that should retain the primary non-color focus cue when resident. */
  readonly focusedCardKey?: CardKey;
  /** Workflow column preferred when responsive geometry can show only one column. */
  readonly focusedColumnId?: string;
  /** Application-owned selected identities retained through ordinary source unload. */
  readonly selectedCardKeys?: readonly CardKey[];
}

/** Returns the smallest valid framed descriptor used for conservative bootstrap acquisition. */
function bootstrapCardHeight(presentation: ResolvedKanbanPresentationBudget): number {
  return framedKanbanCardHeight(Math.min(1, presentation.cardRows));
}

/** Maps one full stack row, including presentation gaps, to a logical card in logarithmic work. */
function logicalIndexAtStackRow(index: KanbanSparseHeightIndex, row: number, cardGap: number): number {
  const logicalLength = index.snapshot().logicalLength;
  if (logicalLength === 0) return 0;
  let low = 0;
  let high = logicalLength - 1;
  while (low < high) {
    const middle = low + Math.ceil((high - low) / 2);
    const descriptorRow = index.rowAt(middle).value;
    const gapRows =
      middle > Math.floor((Number.MAX_SAFE_INTEGER - descriptorRow) / Math.max(1, cardGap))
        ? Number.MAX_SAFE_INTEGER
        : middle * cardGap;
    const stackRow = Math.min(Number.MAX_SAFE_INTEGER, descriptorRow + gapRows);
    if (stackRow <= row) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** Stable process-local identities for reactive objects that lack equality revisions. */
const PROJECTION_INPUT_IDENTITIES = new WeakMap<object, number>();
let nextProjectionInputIdentity = 1;

/** Returns one stable opaque identity without inspecting a reactive object's implementation. */
function projectionInputIdentity(value: object): number {
  const retained = PROJECTION_INPUT_IDENTITIES.get(value);
  if (retained !== undefined) return retained;
  const created = nextProjectionInputIdentity;
  nextProjectionInputIdentity = nextProjectionInputIdentity === Number.MAX_SAFE_INTEGER ? 1 : created + 1;
  PROJECTION_INPUT_IDENTITIES.set(value, created);
  return created;
}

/** Construction options shared by standalone viewports and the board shell. */
export interface KanbanViewportOptions<TCard> {
  /** Application-owned sparse or eager source. */
  readonly source: KanbanDataSource<TCard>;
  /** Reactive semantic query getter. */
  readonly query: () => KanbanQuery;
  /** Generic application-record adapter. */
  readonly card: KanbanCardPresentationAdapter<TCard>;
  /** Optional reactive localization service getter. */
  readonly i18n?: () => I18n;
  /** Optional reactive card-density getter. */
  readonly density?: () => KanbanCardDensity;
  /** Optional reactive rich-card presentation policy getter. */
  readonly presentation?: () => KanbanPresentationInput;
  /** Optional reactive workflow-column and swimlane structure policy getter. */
  readonly structure?: () => KanbanStructurePolicy<TCard>;
  /** Optional reactive application formatting context getter. */
  readonly formatting?: () => KanbanCardFormattingContext;
  /** Optional card-local selection and visual-state projection. */
  readonly cardPresentation?: (card: TCard) => KanbanViewportCardPresentation | undefined;
  /** Optional reactive custom descriptor renderer getter. */
  readonly renderer?: () => KanbanCardRenderer<TCard>;
  /** Optional reactive custom renderer/configuration revision getter. */
  readonly rendererRevision?: () => KanbanRevision;
  /** Optional reactive semantic theme getter. */
  readonly theme?: () => KanbanTheme;
  /** Optional lower resource limits. */
  readonly limits?: KanbanLimitOptions;
  /** Optional finite visible-projection expansion. */
  readonly overscan?: KanbanOverscanOptions;
  /** Optional already-redacted observation sink. */
  readonly observe?: (observation: KanbanObservation) => void;
  /** Optional reactive UX capability descriptions. */
  readonly capabilities?: () => KanbanCapabilities;
  /**
   * Optional reactive compatibility identity projection for a standalone viewport.
   *
   * @deprecated Supply `interaction` for validated focus and selection state. A board treats its
   * separately documented `identity` option as a one-time default-controller seed.
   */
  readonly identity?: () => KanbanIdentityInput;
  /** Optional non-owning interaction publication adapter for scene cues and inspection. */
  readonly interaction?: KanbanViewportInteractionAdapter;
  /** Optional reactive column-collapse projection applied before cursor acquisition. */
  readonly collapsedColumnIds?: () => readonly string[];
  /** Optional bounded board-owned drag threshold configuration. */
  readonly drag?: KanbanDragConfiguration;
}

/** Creates an immutable empty metric snapshot before the first mounted projection. */
function emptyMetrics(): KanbanViewportMetrics {
  return Object.freeze({
    assignedRect: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
    mode: 'minimum-size',
    offsets: Object.freeze({ x: 0, y: 0 }),
    extents: Object.freeze({ x: 0, y: 0 }),
    extentQuality: Object.freeze({ x: 'exact', y: 'unknown' }),
    visibleColumnIds: Object.freeze([]),
    visibleCardRanges: Object.freeze([]),
    stickyRows: 0,
    overscan: Object.freeze({ x: 0, y: 0 }),
    generation: 0,
  });
}

/** Preserves package-owned action IDs and validates every application-namespaced action. */
function scopedActionId(value: string): KanbanScopedActionId {
  if (value === 'collapse' || value === 'clear-filters' || value === 'configure' || value === 'add-card') return value;
  return createKanbanExtensionId(value);
}

/** Mount-lifetime input controls kept outside the public viewport API surface. */
interface KanbanViewportInputLifecycle {
  /** Whether a board mount transaction, rather than the standalone viewport, enables input. */
  managed: boolean;
  /** Subscription/input gate owned by the viewport. */
  readonly binding: KanbanViewportInteractionBinding;
  /** Pending-press owner that must cancel before facade/controller disposal. */
  readonly pointer: KanbanPointerRouter;
}

/** Internal input controls keyed weakly so released viewports are never retained. */
const VIEWPORT_INPUT_LIFECYCLES = new WeakMap<object, KanbanViewportInputLifecycle>();

/**
 * Defers input until the owning board finishes its controller mount transaction.
 *
 * @internal
 */
export function prepareKanbanViewportBoardInput<TCard>(
  viewport: KanbanViewport<TCard>,
  input: KanbanViewportInputAdapter,
): void {
  const lifecycle = VIEWPORT_INPUT_LIFECYCLES.get(viewport);
  if (lifecycle === undefined) throw new KanbanDisposedResourceError();
  lifecycle.binding.attachInput(input);
  lifecycle.managed = true;
  lifecycle.binding.disableInput();
  lifecycle.pointer.cancel();
}

/**
 * Enables input after the board controller and its subscriptions are fully attached.
 *
 * @internal
 */
export function activateKanbanViewportBoardInput<TCard>(viewport: KanbanViewport<TCard>): void {
  const lifecycle = VIEWPORT_INPUT_LIFECYCLES.get(viewport);
  if (lifecycle?.managed === true) lifecycle.binding.enableInput();
}

/**
 * Rejects input and cancels pending press state before board-owned resources are released.
 *
 * @internal
 */
export function quiesceKanbanViewportInput<TCard>(viewport: KanbanViewport<TCard>): void {
  const lifecycle = VIEWPORT_INPUT_LIFECYCLES.get(viewport);
  if (lifecycle === undefined) return;
  lifecycle.binding.disableInput();
  lifecycle.pointer.dispose();
}

/**
 * Exact-cell read-only Kanban projection that owns one query/session/cursor coordinator.
 *
 * The viewport opens its source only after mount and releases it on unmount. The instance owns one
 * terminal mount lifecycle; create a new viewport after unmount instead of remounting disposed
 * resources. It does not create host windows, dialogs, host-surface shadows, or application
 * mutations; focused-card chrome remains inside the assigned viewport.
 */
export class KanbanViewport<TCard> extends View {
  readonly #options: KanbanViewportOptions<TCard>;
  readonly #limits: KanbanResolvedLimits;
  #source: KanbanViewportSource<TCard> | undefined;
  #snapshot: KanbanViewportSourceSnapshot<TCard> | undefined;
  #projection: KanbanViewportProjection | undefined;
  #projectionCandidate: KanbanViewportProjection | undefined;
  #completedAuthoritativeProjection: KanbanViewportProjection | undefined;
  #completedProjectionFingerprint: string | undefined;
  #failedProjectionFingerprint: string | undefined;
  #failedProjectionFallback: KanbanViewportProjection | undefined;
  #projectionOffsets: KanbanViewportPoint = Object.freeze({ x: 0, y: 0 });
  #damage: readonly KanbanDamageRegion[] = Object.freeze([]);
  #metrics: KanbanViewportMetrics = emptyMetrics();
  readonly #descriptorCache: KanbanDescriptorCache;
  readonly #interactionBinding: KanbanViewportInteractionBinding;
  readonly #pointerRouter: KanbanPointerRouter;
  readonly #dragController: KanbanViewportDragController<TCard>;
  readonly #structuralDragController: KanbanStructuralDragController;
  readonly #swimlanePresentationResolver: KanbanSwimlanePresentationResolver;
  readonly #heightIndices = new Map<
    string,
    { readonly logicalLength: number; readonly index: KanbanSparseHeightIndex }
  >();
  #heightProjections: readonly KanbanViewportCellHeightProjection[] = Object.freeze([]);
  #projectionPasses: KanbanViewportProjectionPassSnapshot[] = [];
  #operationInspectionEnabled = false;
  #projectionPassLimit = 2;
  #descriptorCacheDisposed = false;
  readonly #defaultI18n = createEnglishKanbanI18n();
  readonly #defaultTheme = createKanbanTheme(classicTheme);
  readonly #metricsVersion = signal(0);
  #requestedOffsets: KanbanViewportPoint = Object.freeze({ x: 0, y: 0 });
  #locatedVerticalExtent = 0;
  #locatedExtentGeneration: number | undefined;
  #locatedExtentRevision: KanbanRevision | undefined;
  #focusedColumnAnchor: string | undefined;
  #imperativeFocusedColumnAnchor: string | undefined;
  #lastApplicationFocusedColumnId: string | undefined;
  #horizontalColumnAnchor: string | undefined;
  #verticalAnchor:
    | {
        readonly cardKey: CardKey;
        readonly address: KanbanCellAddress;
        readonly index: number;
        readonly relativeRow: number;
      }
    | undefined;
  #pendingVerticalAnchorRow: number | undefined;
  #horizontalAnchorOffset = 0;
  #anchorSourceRevision: KanbanRevision | undefined;
  #anchorSourceGeneration: number | undefined;
  #interactionStructureRevision: KanbanRevision = 'default';
  #lastDragPolicyRevision: KanbanRevision | undefined;
  #queryViewRevision: KanbanRevision | undefined;
  #anchorInputs:
    | {
        readonly width: number;
        readonly height: number;
        readonly density: KanbanCardDensity;
        readonly i18n: I18n;
        readonly theme: KanbanTheme;
        readonly capabilities: object;
      }
    | undefined;
  #metricsFingerprint = '';
  #revealController: AbortController | undefined;
  #anchorController: AbortController | undefined;
  #everMounted = false;
  #releasedLifecycle = false;
  #disposed = false;
  #lastDragBounds: Readonly<Size2D> | undefined;

  /** Stores configuration without opening application resources before mount. */
  constructor(options: KanbanViewportOptions<TCard>) {
    super();
    this.#options = options;
    this.#limits = validateKanbanLimitOptions(options.limits);
    this.#descriptorCache = new KanbanDescriptorCache(Math.max(1, this.#limits.retainedDescriptors), {
      onReactiveInvalidated: () => this.invalidate(),
    });
    this.#interactionBinding = new KanbanViewportInteractionBinding(options.interaction);
    if (options.interaction === undefined) {
      // A standalone viewport keeps ordinary hit acknowledgement available for read-only tools.
      // Mutation methods are deliberately absent, so crossing a drag threshold still fails closed.
      this.#interactionBinding.attachInput({
        accept: () => true,
        acceptActivate: () => false,
        acceptOpenContext: () => false,
        acceptScopedAction: () => false,
      });
    }
    this.#dragController = new KanbanViewportDragController({
      readScene: () => this.#dragScene(),
      commitProposal: (proposal) => this.#interactionBinding.input()?.commitCardMove?.(proposal) ?? false,
      evaluateProposal: (proposal) =>
        this.#interactionBinding.input()?.evaluateCardMove?.(proposal) ??
        Object.freeze({ kind: 'unavailable', code: 'dispatcher-unavailable' }),
      scroll: (step) => {
        const before = this.#metrics.offsets;
        this.scrollBy(step);
        const after = this.#metrics.offsets;
        return Object.freeze({ x: after.x - before.x, y: after.y - before.y });
      },
      invalidate: () => this.invalidate(),
    });
    this.#structuralDragController = new KanbanStructuralDragController({
      readScene: () => this.#structuralDragScene(),
      commitProposal: (proposal) => this.#interactionBinding.input()?.commitStructureReorder?.(proposal) ?? false,
      scroll: (step) => {
        const before = this.#metrics.offsets;
        this.scrollBy(step);
        const after = this.#metrics.offsets;
        return Object.freeze({ x: after.x - before.x, y: after.y - before.y });
      },
      invalidate: () => this.invalidate(),
    });
    this.#pointerRouter = new KanbanPointerRouter(
      {
        snapshotSelection: () => this.#snapshotInputSelection(),
        beginPrimary: (target) => this.#beginPrimary(target),
        completeCard: (target, completion) => this.#completeCard(target, completion),
        completeCardAction: (target) => this.#completeCardAction(target),
        completeScopedAction: (target) => this.#completeScopedAction(target),
        completeRetry: (target) => this.#completeRetry(target),
        openContext: (target) => this.#openContext(target),
        snapshotCard: (target) => this.#snapshotDragCard(target),
        beginCardDrag: (start) => this.#dragController.begin(start),
        updateCardDrag: (generation, point, target) => this.#dragController.update(generation, point, target),
        releaseCardDrag: (generation) => this.#dragController.release(generation),
        cancelCardDrag: (generation, reason) => this.#dragController.cancel(generation, reason),
        beginStructureDrag: (start) => this.#structuralDragController.begin(start),
        updateStructureDrag: (generation, point) => this.#structuralDragController.update(generation, point),
        releaseStructureDrag: (generation) => this.#structuralDragController.release(generation),
        cancelStructureDrag: (generation, reason) => this.#structuralDragController.cancel(generation, reason),
      },
      options.drag,
    );
    prepareKanbanViewportMoveReader(this, () => {
      const scene = this.#dragScene();
      return scene === undefined
        ? undefined
        : Object.freeze({
            scene,
            ...(this.#queryViewRevision === undefined ? {} : { viewRevision: this.#queryViewRevision }),
          });
    });
    VIEWPORT_INPUT_LIFECYCLES.set(this, {
      managed: false,
      binding: this.#interactionBinding,
      pointer: this.#pointerRouter,
    });
    this.#swimlanePresentationResolver = createKanbanSwimlanePresentationResolver({
      ...(options.observe === undefined ? {} : { observe: options.observe }),
    });
    registerKanbanViewportScaleReader(this, () => this.#scaleSnapshot());
    registerKanbanViewportOperationReader(this, {
      enable: () => {
        this.#operationInspectionEnabled = true;
        this.#projectionPasses.length = 0;
      },
      disable: () => {
        this.#operationInspectionEnabled = false;
        this.#projectionPasses.length = 0;
      },
      read: () => this.#operationSnapshot(),
      setProjectionPassLimit: (limit) => {
        this.#projectionPassLimit = limit;
      },
    });
    this.focusable = true;
    this.onMount(() => {
      this.#everMounted = true;
      if (this.#disposed) return;
      const initialQuery = snapshotKanbanQuery(options.query());
      this.#queryViewRevision = initialQuery.viewRevision;
      this.#source = new KanbanViewportSource({
        source: options.source,
        query: initialQuery,
        card: options.card,
        limits: options.limits,
        overscan: options.overscan,
        observe: options.observe,
        invalidate: () => this.invalidate(),
        beforeCursorDispose: (address) => {
          if (!this.#descriptorCacheDisposed) this.#descriptorCache.invalidate({ address });
        },
      });
      try {
        this.#interactionBinding.mount(() => this.invalidate());
        mountKanbanViewportOperations(this, () => this.invalidate());
        if (VIEWPORT_INPUT_LIFECYCLES.get(this)?.managed !== true) this.#interactionBinding.enableInput();
      } catch (error) {
        this.dispose();
        throw error;
      }
      this.bind(
        () => {
          const query = snapshotKanbanQuery(options.query());
          this.#queryViewRevision = query.viewRevision;
          const collapsedColumnIds = options.collapsedColumnIds?.();
          const identity = readKanbanIdentityInput(options.identity);
          const density = options.density?.() ?? 'comfortable';
          const structure = this.#structurePolicy();
          void options.i18n?.();
          void options.theme?.();
          void options.capabilities?.();
          void options.presentation?.();
          void options.formatting?.();
          void options.renderer?.();
          void options.rendererRevision?.();
          this.#source?.replaceQuery(query);
          return this.#refresh(collapsedColumnIds, identity.focusedColumnId, density, structure);
        },
        (snapshot) => {
          this.#snapshot = snapshot;
          this.#updateMetrics(snapshot);
        },
        { relayout: true },
      );
      this.onCleanup(() => this.dispose());
    });
  }

  /** Mounts only while this viewport's terminal owned-resource lifecycle remains available. */
  override mount(...parameters: Parameters<View['mount']>): void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    super.mount(...parameters);
  }

  /** Rejects remount after the viewport's terminal owned-resource lifecycle has been released. */
  override runPendingMounts(): void {
    if (this.#disposed && (!this.#everMounted || this.#releasedLifecycle)) {
      throw new KanbanDisposedResourceError();
    }
    super.runPendingMounts();
  }

  /** Records release of a disposed mount so a later remount remains invalid. */
  override unmount(): void {
    const wasMounted = this.mounted;
    super.unmount();
    if (wasMounted && this.#disposed) this.#releasedLifecycle = true;
  }

  /** Refreshes bounded source acquisition; visual descriptor drawing is added by the render task. */
  override draw(ctx: DrawContext): void {
    if (this.#source === undefined || this.#disposed) return;
    const currentBounds = Object.freeze({ width: this.bounds.width, height: this.bounds.height });
    if (
      this.#lastDragBounds !== undefined &&
      (this.#lastDragBounds.width !== currentBounds.width || this.#lastDragBounds.height !== currentBounds.height)
    ) {
      this.#pointerRouter.cancel('resize');
    }
    this.#lastDragBounds = currentBounds;
    const identity = readKanbanIdentityInput(this.#options.identity);
    const interaction = this.#options.interaction === undefined ? undefined : this.#interactionBinding.snapshot();
    const density = this.#options.density?.() ?? 'comfortable';
    const theme = this.#options.theme?.() ?? this.#defaultTheme;
    const i18n = this.#options.i18n?.() ?? this.#defaultI18n;
    const presentation = this.#options.presentation?.();
    const formatting = this.#options.formatting?.();
    const renderer = this.#options.renderer?.();
    const rendererRevision = this.#options.rendererRevision?.();
    const applicationStructure = this.#options.structure?.();
    const applicationPolicyRevision = applicationStructure?.revision ?? 'default';
    if (
      this.#lastDragPolicyRevision !== undefined &&
      !kanbanRevisionsEqual(this.#lastDragPolicyRevision, applicationPolicyRevision)
    ) {
      this.#pointerRouter.cancel('policy-change');
    }
    this.#lastDragPolicyRevision = applicationPolicyRevision;
    const structure = this.#structurePolicy(applicationStructure, true);
    this.#interactionStructureRevision = structure?.revision ?? 'default';
    const layoutChanged = this.#restoreVerticalAnchor(density, i18n, theme, ctx.caps);
    const collapsedColumnIds = this.#options.collapsedColumnIds?.();
    let snapshot = this.#refreshClamped(collapsedColumnIds, identity.focusedColumnId, density, structure);
    this.#snapshot = snapshot;
    if (snapshot === undefined) return;
    const sourceChanged =
      this.#anchorSourceRevision !== undefined &&
      (this.#anchorSourceRevision !== snapshot.publication.revision ||
        this.#anchorSourceGeneration !== snapshot.generation);
    if (this.#dragController.sourceChangeRelevant()) this.#pointerRouter.cancel('source-change');
    if (sourceChanged && this.#structuralDragController.snapshot().kind !== 'idle') {
      this.#pointerRouter.cancel('source-change');
    }
    const shouldRestoreIdentity = layoutChanged || sourceChanged;
    if (shouldRestoreIdentity && this.#restoreHorizontalAnchor(snapshot)) {
      snapshot = this.#refreshClamped(collapsedColumnIds, identity.focusedColumnId, density, structure) ?? snapshot;
      this.#snapshot = snapshot;
    }
    const resolvedPresentation = resolveKanbanPresentation(presentation ?? density, this.#limits);
    let projectionFingerprint = this.#projectionFingerprint(
      snapshot,
      resolvedPresentation,
      theme,
      i18n,
      ctx.caps,
      interaction,
      rendererRevision,
      formatting,
    );
    let projectionAttempts = 0;
    let convergenceContained = false;
    let latestAttempt: KanbanViewportProjection | undefined;
    const project = (
      source: KanbanViewportSourceSnapshot<TCard>,
      heightProjections: readonly KanbanViewportCellHeightProjection[],
    ): KanbanViewportProjection => {
      if (this.#failedProjectionFingerprint === projectionFingerprint && this.#failedProjectionFallback !== undefined) {
        convergenceContained = true;
        return this.#failedProjectionFallback;
      }
      if (projectionAttempts >= this.#projectionPassLimit) {
        convergenceContained = true;
        return this.#containProjectionConvergence(projectionFingerprint, latestAttempt);
      }
      projectionAttempts += 1;
      const swimlanePresentation = this.#resolveSwimlanePresentation(source);
      const projected = projectKanbanViewport({
        source,
        width: this.bounds.width,
        height: this.bounds.height,
        horizontalOffset: this.#metrics.offsets.x,
        verticalOffset: this.#metrics.offsets.y,
        card: this.#options.card,
        density,
        ...(presentation === undefined ? {} : { presentation }),
        ...(formatting === undefined ? {} : { formatting }),
        ...(this.#options.cardPresentation === undefined ? {} : { cardPresentation: this.#options.cardPresentation }),
        ...(renderer === undefined ? {} : { renderer }),
        ...(rendererRevision === undefined ? {} : { rendererRevision }),
        descriptorLimit: this.#limits.retainedDescriptors,
        ...(heightProjections.length === 0 ? {} : { heightProjections }),
        ...(swimlanePresentation === undefined ? {} : swimlanePresentation),
        theme,
        i18n,
        capabilities: ctx.caps,
        minimumRequiredHeight: KANBAN_MINIMUM_VIEWPORT_ROWS + readViewportHostChromeRows(this),
        cache: this.#descriptorCache,
        identity,
        ...(interaction === undefined ? {} : { interaction }),
        ...(this.#options.observe === undefined ? {} : { observe: this.#options.observe }),
      });
      latestAttempt = projected;
      this.#recordProjectionPass(source, heightProjections, projected);
      return projected;
    };
    if (this.#operationInspectionEnabled) this.#projectionPasses.length = 0;
    let activeHeightProjections = this.#heightProjections;
    let projection = project(snapshot, activeHeightProjections);
    const measured = convergenceContained
      ? Object.freeze({ projections: activeHeightProjections, corrected: false })
      : this.#measureSparseHeights(
          snapshot,
          projection,
          resolvedPresentation.revision,
          resolvedPresentation.cardGap,
          bootstrapCardHeight(resolvedPresentation),
        );
    activeHeightProjections = measured.projections;
    this.#heightProjections = activeHeightProjections;
    const restoredVerticalIdentity = shouldRestoreIdentity && this.#restoreVerticalIdentity(projection, density);
    if (restoredVerticalIdentity) {
      snapshot = this.#refreshClamped(collapsedColumnIds, identity.focusedColumnId, density, structure) ?? snapshot;
      this.#snapshot = snapshot;
    }
    projectionFingerprint = this.#projectionFingerprint(
      snapshot,
      resolvedPresentation,
      theme,
      i18n,
      ctx.caps,
      interaction,
      rendererRevision,
      formatting,
    );
    if (measured.corrected || restoredVerticalIdentity) {
      projection = project(snapshot, activeHeightProjections);
    }
    if (!convergenceContained && projectionAttempts === 2) {
      const verified = this.#measureSparseHeights(
        snapshot,
        projection,
        resolvedPresentation.revision,
        resolvedPresentation.cardGap,
        bootstrapCardHeight(resolvedPresentation),
      );
      activeHeightProjections = verified.projections;
      this.#heightProjections = activeHeightProjections;
      if (verified.corrected) {
        projectionFingerprint = this.#projectionFingerprint(
          snapshot,
          resolvedPresentation,
          theme,
          i18n,
          ctx.caps,
          interaction,
          rendererRevision,
          formatting,
        );
        projection = project(snapshot, activeHeightProjections);
      }
    }
    if (!convergenceContained) {
      this.#completedAuthoritativeProjection = projection;
      this.#completedProjectionFingerprint = projectionFingerprint;
      this.#failedProjectionFingerprint = undefined;
      this.#failedProjectionFallback = undefined;
    }
    const anchoredCardDeleted =
      this.#verticalAnchor !== undefined &&
      snapshot.publication.identityChanges.changes.some(
        (change) => change.kind === 'deleted-card' && change.cardKey === this.#verticalAnchor?.cardKey,
      );
    if (anchoredCardDeleted) this.#verticalAnchor = undefined;
    const relocatingAnchor =
      sourceChanged &&
      this.#relocateMissingVerticalAnchor(projection, snapshot.generation, snapshot.publication.revision, density);
    const focusedCardKey = identity.focusedCardKey;
    const focusedCard = projection.cards.find((card) => card.descriptor.cardKey === focusedCardKey);
    if (focusedCard !== undefined) this.#focusedColumnAnchor = focusedCard.columnId;
    if (
      focusedCardKey !== undefined &&
      snapshot.publication.identityChanges.changes.some(
        (change) => change.kind === 'deleted-card' && change.cardKey === focusedCardKey,
      )
    ) {
      this.#focusedColumnAnchor = undefined;
    }
    const operationRead = readKanbanViewportOperations(
      this,
      this.#limits.pendingOperations,
      this.#limits.retainedDescriptors,
    );
    if (operationRead.kind === 'failed') this.#containOverlayFailure();
    this.#projectionCandidate = projection;
    try {
      this.#dragController.reproject();
      this.#structuralDragController.reproject();
    } finally {
      this.#projectionCandidate = undefined;
    }
    const dragSnapshot = this.#dragController.snapshot();
    const structuralDragSnapshot = this.#structuralDragController.snapshot();
    const operationSnapshots = operationRead.kind === 'ready' ? operationRead.snapshots : Object.freeze([]);
    const composedProjection = composeKanbanViewportOverlay({
      authoritative: projection,
      bounds: { x: 0, y: 0, width: this.bounds.width, height: this.bounds.height },
      density,
      ...(dragSnapshot.kind === 'idle' ? {} : { drag: dragSnapshot.overlay }),
      ...(structuralDragSnapshot.kind === 'idle' ? {} : { structuralDrag: structuralDragSnapshot.overlay }),
      operations: operationSnapshots,
      translate: (messageKey) => i18n.t(messageKey),
    });
    if (composedProjection.overlayFailure !== undefined) this.#containOverlayFailure();
    this.#damage = calculateKanbanViewportDamage({
      ...(this.#projection === undefined ? {} : { previous: this.#projection }),
      current: composedProjection,
      bounds: { x: 0, y: 0, width: this.bounds.width, height: this.bounds.height },
      previousOffsets: this.#projectionOffsets,
      currentOffsets: this.#metrics.offsets,
    });
    this.#projection = composedProjection;
    this.#projectionOffsets = this.#metrics.offsets;
    this.#anchorSourceRevision = snapshot.publication.revision;
    this.#anchorSourceGeneration = snapshot.generation;
    const anchorRelocationPending = this.#anchorController !== undefined && !this.#anchorController.signal.aborted;
    if (!relocatingAnchor && !anchorRelocationPending) this.#rememberVerticalAnchor(projection, identity, density);
    this.#rememberHorizontalAnchor(snapshot);
    drawKanbanViewport(ctx, composedProjection, theme, (key, params) =>
      i18n.t(key, params === undefined ? undefined : { params }),
    );
    this.#updateMetrics(snapshot, projection);
    try {
      INTERACTION_EVIDENCE_LISTENERS.get(this)?.();
    } catch {
      // Reconciliation failure cannot corrupt viewport projection or source ownership.
    }
  }

  /** Builds a complete equality fingerprint for authoritative geometry reuse. */
  #projectionFingerprint(
    snapshot: KanbanViewportSourceSnapshot<TCard>,
    presentation: ResolvedKanbanPresentationBudget,
    theme: KanbanTheme,
    i18n: I18n,
    capabilities: object,
    interaction: ReturnType<KanbanViewportInteractionBinding['snapshot']> | undefined,
    rendererRevision: KanbanRevision | undefined,
    formatting: KanbanCardFormattingContext | undefined,
  ): string {
    return JSON.stringify([
      this.bounds,
      this.#requestedOffsets,
      snapshot.generation,
      snapshot.publication.revision,
      this.#queryViewRevision ?? null,
      snapshot.structure.revision,
      snapshot.widths,
      snapshot.cells.map((cell) => [cell.address, cell.range, cell.cursor.revision()]),
      presentation.revision,
      rendererRevision ?? null,
      projectionInputIdentity(theme),
      projectionInputIdentity(i18n),
      formatting === undefined ? null : projectionInputIdentity(formatting),
      projectionInputIdentity(capabilities),
      interaction ?? null,
      this.#options.cardPresentation === undefined ? null : projectionInputIdentity(this.#options.cardPresentation),
      this.#options.renderer === undefined ? null : projectionInputIdentity(this.#options.renderer),
    ]);
  }

  /** Contains an unexpected third projection attempt without publishing stale interactive geometry. */
  #containProjectionConvergence(
    fingerprint: string,
    latestAttempt: KanbanViewportProjection | undefined,
  ): KanbanViewportProjection {
    this.#pointerRouter.cancel('explicit');
    cancelKanbanViewportOperations(this);
    const containment = resolveKanbanProjectionConvergenceFailure({
      fingerprint,
      ...(this.#completedProjectionFingerprint === undefined
        ? {}
        : { completedFingerprint: this.#completedProjectionFingerprint }),
      ...(this.#completedAuthoritativeProjection === undefined
        ? {}
        : { completed: this.#completedAuthoritativeProjection }),
      ...(latestAttempt === undefined ? {} : { latest: latestAttempt }),
      bounds: { x: 0, y: 0, width: this.bounds.width, height: this.bounds.height },
    });
    if (containment.reusedCompleted) return containment.projection;
    const fallback = containment.projection;
    this.#failedProjectionFingerprint = fingerprint;
    this.#failedProjectionFallback = fallback;
    try {
      this.#options.observe?.(Object.freeze({ code: 'projection-convergence-failed', scope: 'renderer' }));
    } catch {
      // Diagnostic callbacks cannot prevent safe noninteractive containment.
    }
    return fallback;
  }

  /** Cancels hidden transient ownership and emits one fixed redacted overlay failure observation. */
  #containOverlayFailure(): void {
    this.#pointerRouter.cancel('explicit');
    cancelKanbanViewportOperations(this);
    try {
      this.#options.observe?.(Object.freeze({ code: 'overlay-composition-failed', scope: 'renderer' }));
    } catch {
      // Diagnostic callbacks cannot prevent capture and operation cancellation.
    }
  }

  /** Reports the exact parent-assigned space consumed by this exact-cell projection leaf. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  /** Routes wheel input first, then the fixed keyboard and bounded click-family interaction subsets. */
  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'wheel') {
      this.#pointerRouter.cancel();
      if (this.#disposed || this.#metrics.mode === 'minimum-size') return;
      const direction = event.event.dir;
      this.scrollBy(
        direction === 'up' ? { y: -3 } : direction === 'down' ? { y: 3 } : direction === 'left' ? { x: -3 } : { x: 3 },
      );
      event.handled = true;
      return;
    }
    if (event.event.type === 'focus') {
      if (!event.event.focused) this.#pointerRouter.cancel('host-lost');
      return;
    }
    if (event.event.type === 'key') {
      const cancelledDrag = this.#pointerRouter.cancel(event.event.key === 'escape' ? 'escape' : 'explicit');
      const input = this.#interactionBinding.input();
      if (input === undefined || this.#metrics.mode === 'minimum-size') return;
      event.handled = routeKanbanKeyInput(event.event, {
        snapshot: () => this.#interactionBinding.snapshot(),
        accept: (transition) => input.accept(transition),
        activate: (origin) => input.acceptActivate({ origin }),
        moveFocused: (direction) => input.moveFocused?.(direction) ?? false,
        cancelTransient: () => cancelledDrag || (input.cancelTransient?.() ?? false),
      });
      return;
    }
    if (event.event.type !== 'mouse') {
      this.#pointerRouter.cancel();
      return;
    }
    const local = event.local;
    const input = this.#interactionBinding.input();
    if (local === undefined || input === undefined || this.#metrics.mode === 'minimum-size') {
      this.#pointerRouter.cancel();
      return;
    }
    const pointer = normalizeKanbanViewportPointerInput(event, {
      owner: this,
      target: this.#actionTargetAt(local.x, local.y),
      sceneRevision: this.#inputSceneRevision(),
      gestureGeneration: this.#pointerRouter.gestureGenerationForCapture(event.pointerCaptureGeneration),
    });
    event.handled = pointer === undefined ? false : this.#pointerRouter.route(pointer);
  }

  /** Returns an immutable exact-cell metric snapshot from the latest projection. */
  metrics(): KanbanViewportMetrics {
    return this.#metrics;
  }

  /** Internal reactive tick used by the owning board to reconcile conditional DSL chrome. */
  metricsSignal(): Signal<number> {
    return this.#metricsVersion;
  }

  /** Returns the current detached board-wide source state for board-level inspection. */
  sourceState(): KanbanSourceState | undefined {
    return this.#snapshot?.publication.state;
  }

  /** Returns current authoritative identity changes without exposing the query session. */
  identityChanges(): KanbanIdentityChangeBatch | undefined {
    if (this.#disposed) return undefined;
    const identity = readKanbanIdentityInput(this.#options.identity);
    const density = this.#options.density?.() ?? 'comfortable';
    return (
      this.#refresh(this.#options.collapsedColumnIds?.(), identity.focusedColumnId, density, this.#structurePolicy())
        ?.publication.identityChanges ?? this.#snapshot?.publication.identityChanges
    );
  }

  /** Returns current focused-column navigator metadata for the owning DSL shell. */
  focusedNavigator(): KanbanFocusedColumnNavigator | undefined {
    return this.#snapshot?.widths.navigator;
  }

  /** Returns detached bounded navigation geometry for the owning board interaction adapter. */
  interactionScene(): KanbanNavigationSnapshot {
    const projection = this.#projection;
    const geometry = projection?.geometry;
    const revision =
      this.#snapshot === undefined
        ? 0
        : JSON.stringify([
            this.#snapshot.publication.revision,
            this.#snapshot.generation,
            this.#snapshot.structure.revision,
            this.#snapshot.widths.columns.map((column) => column.columnId),
            this.bounds.width,
            this.bounds.height,
          ]);
    if (geometry === undefined) {
      return Object.freeze({
        revision,
        targets: Object.freeze([
          Object.freeze({
            target: Object.freeze({ kind: 'board-state' as const }),
            sceneIndex: 0,
            centerColumn: Math.max(0, (this.bounds.width - 1) / 2),
            centerRow: Math.max(0, (this.bounds.height - 1) / 2),
            enabled: true,
          }),
        ]),
        viewportContentHeight: Math.max(0, this.bounds.height - this.#metrics.stickyRows),
      });
    }
    const targets: KanbanNavigationTarget[] = [];
    let sceneIndex = 0;
    const visibleColumns = new Map((projection?.columns ?? []).map((column) => [column.columnId, column]));
    for (const [columnIndex, column] of (this.#snapshot?.publication.columns ?? []).entries()) {
      const visible = visibleColumns.get(column.columnId);
      targets.push(
        Object.freeze({
          target: Object.freeze({ kind: 'column-header' as const, columnId: column.columnId }),
          sceneIndex,
          centerColumn: visible === undefined ? columnIndex * 18 + 8.5 : visible.rect.x + (visible.rect.width - 1) / 2,
          centerRow: visible === undefined ? 0 : visible.rect.y + (visible.rect.height - 1) / 2,
          enabled: visible !== undefined,
        }),
      );
      sceneIndex += 1;
    }
    for (const header of geometry.swimlaneChrome) {
      targets.push(
        Object.freeze({
          target: Object.freeze({ kind: 'swimlane-header' as const, swimlaneId: header.swimlaneId }),
          sceneIndex,
          centerColumn: header.x + (header.width - 1) / 2,
          centerRow: header.y + (header.height - 1) / 2,
          enabled: true,
        }),
      );
      sceneIndex += 1;
    }
    for (const card of projection?.cards ?? []) {
      const address = Object.freeze({
        columnId: card.columnId,
        ...(card.swimlaneId === undefined ? {} : { swimlaneId: card.swimlaneId }),
      });
      targets.push(
        Object.freeze({
          target: Object.freeze({ kind: 'card' as const, cardKey: card.descriptor.cardKey, address }),
          sceneIndex,
          centerColumn: card.rect.x + (card.rect.width - 1) / 2,
          centerRow: card.rect.y + (card.rect.height - 1) / 2,
          enabled: true,
        }),
      );
      sceneIndex += 1;
    }
    if (targets.length === 0) {
      targets.push(
        Object.freeze({
          target: Object.freeze({ kind: 'board-state' as const }),
          sceneIndex,
          centerColumn: Math.max(0, (this.bounds.width - 1) / 2),
          centerRow: Math.max(0, (this.bounds.height - 1) / 2),
          enabled: true,
        }),
      );
    }
    return Object.freeze({
      revision: JSON.stringify([
        revision,
        targets.map((entry) => {
          const target = entry.target;
          if (target.kind === 'board-state') return [target.kind, entry.enabled];
          if (target.kind === 'column-header') return [target.kind, target.columnId, entry.enabled];
          if (target.kind === 'swimlane-header') return [target.kind, target.swimlaneId, entry.enabled];
          return [
            target.kind,
            typeof target.cardKey,
            target.cardKey,
            target.address.columnId,
            target.address.swimlaneId ?? null,
            entry.enabled,
          ];
        }),
      ]),
      targets: Object.freeze(targets),
      viewportContentHeight: Math.max(0, this.bounds.height - geometry.contentOrigin.y),
    });
  }

  /** Returns current query/session revision evidence without exposing source resources. */
  interactionRevisions(): KanbanInteractionRevisions {
    return Object.freeze({
      sessionRevision: this.#snapshot?.publication.revision ?? 0,
      queryGeneration: this.#snapshot?.generation ?? 0,
      ...(this.#queryViewRevision === undefined ? {} : { viewRevision: this.#queryViewRevision }),
    });
  }

  /** Returns the current structure-policy revision used to classify visibility reconciliation. */
  interactionStructureRevision(): KanbanRevision {
    return this.#interactionStructureRevision;
  }

  /** Returns visible eligible cards with exact current entity revisions. */
  interactionEligibleSelection(): readonly KanbanEligibleSelectionCandidate[] {
    const scene = this.#projection?.scene;
    const geometry = this.#projection?.geometry;
    if (scene === undefined || geometry === undefined) return Object.freeze([]);
    const visible = new Set(geometry.cards.map((card) => JSON.stringify([typeof card.cardKey, card.cardKey])));
    return Object.freeze(
      scene.cards.flatMap((card) =>
        visible.has(JSON.stringify([typeof card.cardKey, card.cardKey]))
          ? [
              Object.freeze({
                cardKey: card.cardKey,
                address: card.address,
                entityRevision: card.entityRevision,
              }),
            ]
          : [],
      ),
    );
  }

  /** Reveals one bounded semantic interaction target without transferring viewport ownership. */
  async revealInteractionTarget(
    target: KanbanFocusTarget,
    options?: { readonly signal?: AbortSignal },
  ): Promise<KanbanInteractionAcquisitionResult> {
    if (target.kind === 'board-state') return Object.freeze({ kind: 'available' });
    if (target.kind === 'card') {
      const result = await this.revealCard(target.cardKey, 'nearest', options);
      return result.location.kind === 'found' || result.location.kind === 'unloaded'
        ? Object.freeze({ kind: 'available' })
        : Object.freeze({ kind: 'unavailable', retry: 'available' });
    }
    if (target.kind === 'column-header') {
      const exists = this.#snapshot?.publication.columns.some((column) => column.columnId === target.columnId) ?? false;
      if (!exists) return Object.freeze({ kind: 'unavailable', retry: 'unavailable' });
      this.#imperativeFocusedColumnAnchor = target.columnId;
      this.#focusedColumnAnchor = target.columnId;
      this.scrollTo({ x: this.#columnStart(target.columnId) });
      const refreshed = this.#refresh(
        this.#options.collapsedColumnIds?.(),
        target.columnId,
        this.#options.density?.() ?? 'comfortable',
        this.#structurePolicy(),
      );
      if (refreshed !== undefined) {
        this.#snapshot = refreshed;
        this.#updateMetrics(refreshed);
      }
      return Object.freeze({ kind: 'available' });
    }
    const exists = this.#snapshot?.visibleSwimlanes.some((lane) => lane.swimlaneId === target.swimlaneId) ?? false;
    return exists ? Object.freeze({ kind: 'available' }) : Object.freeze({ kind: 'unavailable', retry: 'unavailable' });
  }

  /** Scrolls to an absolute partial terminal-cell target and clamps both axes to live extents. */
  scrollTo(target: KanbanScrollTarget): void {
    this.#cancelAnchorRelocation();
    const next = resolveKanbanScrollTo(this.#requestedOffsets, this.#metrics.extents, target);
    this.#shiftVerticalAnchor(this.#requestedOffsets.y, next.y);
    this.#requestedOffsets = next;
    this.#metrics = Object.freeze({ ...this.#metrics, offsets: this.#requestedOffsets });
    this.invalidate();
  }

  /** Scrolls by a signed partial terminal-cell delta and clamps both axes to live extents. */
  scrollBy(delta: KanbanScrollTarget): void {
    this.#cancelAnchorRelocation();
    const next = resolveKanbanScrollBy(this.#requestedOffsets, this.#metrics.extents, delta);
    this.#shiftVerticalAnchor(this.#requestedOffsets.y, next.y);
    this.#requestedOffsets = next;
    this.#metrics = Object.freeze({ ...this.#metrics, offsets: this.#requestedOffsets });
    this.invalidate();
  }

  /** Keeps the retained anchor's screen row consistent with an explicit scroll request. */
  #shiftVerticalAnchor(previousOffset: number, nextOffset: number): void {
    const anchor = this.#verticalAnchor;
    if (anchor === undefined || previousOffset === nextOffset) return;
    this.#verticalAnchor = Object.freeze({
      ...anchor,
      relativeRow: anchor.relativeRow - (nextOffset - previousOffset),
    });
  }

  /** Reveals one card through the optional bounded source locator without scanning cursor contents. */
  async revealCard(
    key: CardKey,
    alignment?: KanbanRevealAlignment,
    options?: { readonly signal?: AbortSignal },
  ): Promise<KanbanRevealResult> {
    const source = this.#source;
    if (source === undefined || this.#disposed) throw new KanbanDisposedResourceError();
    const cardKey = snapshotKanbanRevealKey(key);
    const resolvedAlignment = snapshotKanbanRevealAlignment(alignment);
    const anchorOwnsRelocation =
      this.#anchorController !== undefined &&
      !this.#anchorController.signal.aborted &&
      this.#verticalAnchor?.cardKey === cardKey;
    if (!anchorOwnsRelocation) this.#cancelAnchorRelocation();
    this.#revealController?.abort();
    const controller = new AbortController();
    this.#revealController = controller;
    const abort = (): void => controller.abort();
    if (options?.signal?.aborted === true) controller.abort();
    else options?.signal?.addEventListener('abort', abort, { once: true });
    try {
      const before = this.#requestedOffsets;
      const beforeColumn = this.#focusedColumnAnchor;
      const location = await source.locateCard(cardKey, controller.signal);
      if (anchorOwnsRelocation) return Object.freeze({ location, scrolled: false });
      if ((location.kind === 'found' || location.kind === 'unloaded') && location.index !== undefined) {
        const density = this.#options.density?.() ?? 'comfortable';
        const top = this.#logicalCardRow(location.address, location.index, density);
        const viewportHeight = Math.max(1, this.bounds.height - this.#metrics.stickyRows);
        const alignedY = resolveKanbanRevealOffset({
          cardTop: top,
          cardHeight: 2,
          currentOffset: before.y,
          viewportHeight,
          alignment: resolvedAlignment,
        });
        this.#recordLocatedExtent(alignedY);
        this.#metrics = Object.freeze({
          ...this.#metrics,
          extents: Object.freeze({
            x: this.#metrics.extents.x,
            y: Math.max(this.#metrics.extents.y, this.#locatedVerticalExtent),
          }),
        });
        this.#focusedColumnAnchor = location.address.columnId;
        this.#imperativeFocusedColumnAnchor = location.address.columnId;
        this.#horizontalColumnAnchor = location.address.columnId;
        this.#horizontalAnchorOffset = 0;
        const columnX = this.#columnStart(location.address.columnId);
        this.scrollTo({ x: columnX, y: alignedY });
      }
      return Object.freeze({
        location,
        scrolled:
          before.x !== this.#requestedOffsets.x ||
          before.y !== this.#requestedOffsets.y ||
          beforeColumn !== this.#focusedColumnAnchor,
      });
    } finally {
      options?.signal?.removeEventListener('abort', abort);
      if (this.#revealController === controller) this.#revealController = undefined;
    }
  }

  /** Returns detached source-state evidence without application records or actionable targets. */
  inspection(): KanbanViewportInspection {
    const interaction =
      this.#options.interaction === undefined
        ? KANBAN_NEUTRAL_INTERACTION_SNAPSHOT
        : this.#interactionBinding.snapshot();
    const i18n = this.#options.i18n?.() ?? this.#defaultI18n;
    const focusedDetail = createKanbanFocusedDetailSnapshot({
      interaction,
      ...(this.#snapshot === undefined ? {} : { source: this.#snapshot }),
      ...(this.#projection === undefined ? {} : { projection: this.#projection }),
      card: this.#options.card,
      limits: this.#limits,
      i18n,
      ...(this.#options.formatting === undefined ? {} : { formatting: this.#options.formatting() }),
      ...(this.#options.observe === undefined ? {} : { observe: this.#options.observe }),
    });
    const inspection = createKanbanViewportInspection(
      this.#snapshot,
      this.#projection,
      this.#damage,
      interaction,
      focusedDetail,
    );
    return this.#options.interaction === undefined
      ? Object.freeze({
          ...inspection,
          operation: Object.freeze({ kind: 'unavailable' as const, code: 'dispatcher-unavailable' as const }),
        })
      : inspection;
  }

  /** Releases the complete standalone source lifecycle idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    quiesceKanbanViewportInput(this);
    this.#dragController.dispose();
    this.#structuralDragController.dispose();
    disposeKanbanViewportOperations(this);
    this.#revealController?.abort();
    this.#revealController = undefined;
    this.#anchorController?.abort();
    this.#anchorController = undefined;
    this.#interactionBinding.dispose();
    this.#source?.cancelPendingWork();
    this.#descriptorCache.dispose();
    this.#swimlanePresentationResolver.dispose();
    for (const entry of this.#heightIndices.values()) entry.index.dispose();
    this.#heightIndices.clear();
    this.#heightProjections = Object.freeze([]);
    this.#projectionPasses.length = 0;
    this.#operationInspectionEnabled = false;
    unregisterKanbanViewportOperationReader(this);
    unregisterKanbanViewportScaleReader(this);
    disposeKanbanViewportMoveReader(this);
    this.#descriptorCacheDisposed = true;
    this.#source?.dispose();
    this.#source = undefined;
    this.#snapshot = undefined;
    this.#projection = undefined;
    this.#projectionCandidate = undefined;
    this.#completedAuthoritativeProjection = undefined;
    this.#completedProjectionFingerprint = undefined;
    this.#failedProjectionFingerprint = undefined;
    this.#failedProjectionFallback = undefined;
    this.#damage = Object.freeze([]);
  }

  /** Returns the highest-priority current target containing one viewport-local point. */
  #actionTargetAt(x: number, y: number): KanbanActionTarget | undefined {
    return this.#projection?.actionTargets.find(
      (target) => x >= target.x && y >= target.y && x < target.x + target.width && y < target.y + target.height,
    );
  }

  /** Returns current post-layout evidence required by the viewport-local drag owner. */
  #dragScene(): KanbanViewportDragScene<TCard> | undefined {
    const projection = this.#projectionCandidate ?? this.#projection;
    const scene = projection?.scene;
    const geometry = projection?.geometry;
    const source = this.#snapshot;
    if (scene === undefined || geometry === undefined || source === undefined || this.#disposed) return undefined;
    return Object.freeze({
      scene,
      geometry,
      source,
      density: this.#options.density?.() ?? 'comfortable',
      sceneRevision: this.#inputSceneRevision(),
      geometryGeneration: Math.max(1, this.#metrics.generation),
      viewport: Object.freeze({
        x: 0,
        y: this.#metrics.stickyRows,
        width: Math.max(1, this.bounds.width),
        height: Math.max(1, this.bounds.height - this.#metrics.stickyRows),
      }),
    });
  }

  /** Returns current sibling order and visible header geometry for structural reordering. */
  #structuralDragScene(): KanbanStructuralDragScene | undefined {
    const current = this.#dragScene();
    if (current === undefined) return undefined;
    const order = current.source.groupingPolicy?.order;
    return Object.freeze({
      sceneRevision: current.sceneRevision,
      geometryGeneration: current.geometryGeneration,
      viewport: current.viewport,
      columnOrder: Object.freeze(current.source.structure.columns.map(({ columnId }) => columnId)),
      columns: Object.freeze(
        current.geometry.workflowHeaders.map((header) =>
          Object.freeze({ id: header.columnId, x: header.x, y: header.y, width: header.width, height: header.height }),
        ),
      ),
      ...(order === undefined ? {} : { swimlaneOrder: Object.freeze([...order]) }),
      swimlanes: Object.freeze(
        current.geometry.swimlaneChrome.map((header) =>
          Object.freeze({
            id: header.swimlaneId,
            x: header.x,
            y: header.y,
            width: header.width,
            height: header.height,
          }),
        ),
      ),
    });
  }

  /** Resolves current entity evidence for the pointer-origin card without retaining its record. */
  #snapshotDragCard(target: KanbanActionTarget) {
    if (target.cardKey === undefined || target.address === undefined) return undefined;
    return this.interactionEligibleSelection().find(
      (entry) =>
        typeof entry.cardKey === typeof target.cardKey &&
        entry.cardKey === target.cardKey &&
        entry.address.columnId === target.address?.columnId &&
        entry.address.swimlaneId === target.address?.swimlaneId,
    );
  }

  /** Identifies hit-map ownership without treating focus-only repaint as structural staleness. */
  #inputSceneRevision(): KanbanRevision {
    const revisions = this.interactionRevisions();
    return JSON.stringify([
      typeof revisions.sessionRevision,
      revisions.sessionRevision,
      revisions.queryGeneration,
      typeof this.#interactionStructureRevision,
      this.#interactionStructureRevision,
      this.#metrics.offsets.x,
      this.#metrics.offsets.y,
      this.bounds.width,
      this.bounds.height,
    ]);
  }

  /** Focuses one card or header on primary down while admitting state/retry presses without focus. */
  #beginPrimary(target: KanbanActionTarget): boolean {
    const input = this.#interactionBinding.input();
    if (input === undefined) return false;
    if (target.scope.kind === 'card') {
      return input.accept({
        kind: 'focus',
        target: { kind: 'card', cardKey: target.scope.cardKey, address: target.scope.address },
      });
    }
    if (target.kind === 'workflow-header' && target.columnId !== undefined) {
      return input.accept({ kind: 'focus', target: { kind: 'column-header', columnId: target.columnId } });
    }
    if (target.kind === 'swimlane-header' && target.swimlaneId !== undefined) {
      return input.accept({ kind: 'focus', target: { kind: 'swimlane-header', swimlaneId: target.swimlaneId } });
    }
    return target.kind === 'state-action' || target.kind === 'retry';
  }

  /** Completes one matching card click and optionally queues activation behind selection settlement. */
  #completeCard(
    target: KanbanActionTarget,
    completion: { readonly toggle: boolean; readonly activate: boolean },
  ): boolean {
    const input = this.#interactionBinding.input();
    if (input === undefined || target.scope.kind !== 'card') return false;
    const transition = {
      kind: 'selection' as const,
      operation: completion.toggle ? ('toggle' as const) : ('replace' as const),
    };
    if (completion.activate && input.acceptSelectionActivate !== undefined) {
      return input.acceptSelectionActivate(transition, { origin: 'pointer', scope: target.scope });
    }
    if (!input.accept(transition)) return false;
    return !completion.activate || input.acceptActivate({ origin: 'pointer', scope: target.scope });
  }

  /** Completes one descriptor action through focused-card activation without editing card data. */
  #completeCardAction(target: KanbanActionTarget): boolean {
    const input = this.#interactionBinding.input();
    if (input === undefined || target.scope.kind !== 'card' || target.actionId === undefined) return false;
    return input.acceptActivate({ origin: 'pointer', scope: target.scope, actionId: target.actionId });
  }

  /** Completes one capable header or state action while keeping focus-only headers consumable. */
  #completeScopedAction(target: KanbanActionTarget): boolean {
    const input = this.#interactionBinding.input();
    if (input === undefined) return false;
    if (target.actionId === undefined) {
      return target.kind === 'workflow-header' || target.kind === 'swimlane-header';
    }
    return input.acceptScopedAction(scopedActionId(target.actionId), target.scope, 'pointer');
  }

  /** Focuses a right-clicked card, reconciles its eligible selection, then queues context exactly once. */
  #openContext(target: KanbanActionTarget): boolean {
    const input = this.#interactionBinding.input();
    if (input === undefined || target.scope.kind !== 'card') return false;
    const scope = target.scope;
    const selected = this.#snapshotInputSelection().entries.some(
      (entry) => typeof entry.cardKey === typeof scope.cardKey && entry.cardKey === scope.cardKey,
    );
    if (
      !input.accept({ kind: 'focus', target: { kind: 'card', cardKey: scope.cardKey, address: scope.address } }) ||
      (!selected && !input.accept({ kind: 'selection', operation: 'replace' }))
    ) {
      return false;
    }
    return input.acceptOpenContext({ origin: 'pointer', scope });
  }

  /** Invokes only the owning cell cursor's retry seam and contains asynchronous failure. */
  #completeRetry(target: KanbanActionTarget): boolean {
    if (target.kind !== 'retry' || target.address === undefined) return false;
    const cell = this.#snapshot?.cells.find(
      (candidate) =>
        candidate.address.columnId === target.address?.columnId &&
        candidate.address.swimlaneId === target.address?.swimlaneId,
    );
    if (cell === undefined) return false;
    try {
      void Promise.resolve(cell.cursor.retry()).catch(() => undefined);
    } catch {
      // The source coordinator owns payload-free retry observations.
    }
    return true;
  }

  /** Captures ordered selected cards that remain eligible in the current visible scene. */
  #snapshotInputSelection(): KanbanSelectionSnapshot {
    const selected = this.#interactionBinding.snapshot().selectedCardKeys;
    const selectedKeys = new Set(selected.map((key) => JSON.stringify([typeof key, key])));
    const revisions = this.interactionRevisions();
    return Object.freeze({
      entries: Object.freeze(
        this.interactionEligibleSelection().filter((entry) =>
          selectedKeys.has(JSON.stringify([typeof entry.cardKey, entry.cardKey])),
        ),
      ),
      sessionRevision: revisions.sessionRevision,
      queryGeneration: revisions.queryGeneration,
      ...(revisions.viewRevision === undefined ? {} : { viewRevision: revisions.viewRevision }),
    });
  }

  /** Removes one drag-hover swimlane from the projected collapse set without mutating caller policy. */
  #structurePolicy(
    current?: KanbanStructurePolicy<TCard>,
    currentWasRead = false,
  ): KanbanStructurePolicy<TCard> | undefined {
    const policy = currentWasRead ? current : this.#options.structure?.();
    const swimlaneId = this.#dragController.temporaryExpandedSwimlaneId();
    const grouping = policy?.grouping;
    if (policy === undefined || grouping === undefined || swimlaneId === undefined) return policy;
    const collapsedSwimlaneIds = grouping.collapsedSwimlaneIds?.filter((candidate) => candidate !== swimlaneId) ?? [];
    return Object.freeze({
      ...policy,
      revision: JSON.stringify([policy.revision, 'temporary-drag-expansion', swimlaneId]),
      grouping: Object.freeze({ ...grouping, collapsedSwimlaneIds: Object.freeze(collapsedSwimlaneIds) }),
    });
  }

  /** Performs one bounded refresh using current assigned geometry. */
  #refresh(
    collapsedColumnIds: readonly string[] | undefined,
    focusedColumnId: string | undefined,
    density: KanbanCardDensity,
    structure: KanbanStructurePolicy<TCard> | undefined,
  ) {
    if (focusedColumnId !== this.#lastApplicationFocusedColumnId) {
      this.#lastApplicationFocusedColumnId = focusedColumnId;
      this.#imperativeFocusedColumnAnchor = undefined;
    }
    const effectiveFocusedColumnId =
      this.#imperativeFocusedColumnAnchor ?? focusedColumnId ?? this.#focusedColumnAnchor;
    const presentation = resolveKanbanPresentation(this.#options.presentation?.() ?? density, this.#limits);
    const groupedAxis = this.#groupedAxisProjection(presentation, structure);
    const rangeWindow = groupedAxis === undefined ? this.#cardRangeWindow(presentation) : undefined;
    return this.#source?.refresh({
      width: this.bounds.width,
      height: this.bounds.height,
      horizontalOffset: this.#requestedOffsets.x,
      verticalOffset: this.#requestedOffsets.y,
      estimatedCardHeight: bootstrapCardHeight(presentation),
      cardGap: presentation.cardGap,
      presentationRevision: presentation.revision,
      ...(groupedAxis === undefined
        ? {}
        : { sceneWindowLayoutHint: groupedAxis.hint, groupedAxisWindow: groupedAxis.window }),
      ...(structure === undefined ? {} : { structure }),
      ...(rangeWindow === undefined ? {} : { cardRangeWindow: rangeWindow }),
      ...(collapsedColumnIds === undefined ? {} : { collapsedColumnIds }),
      ...(effectiveFocusedColumnId === undefined ? {} : { focusedColumnId: effectiveFocusedColumnId }),
    });
  }

  /**
   * Maps global grouped scrolling through revision-compatible learned row extents.
   *
   * Only a contiguous prefix is published. This keeps a distant row explicitly unavailable until
   * every preceding row has either exact empty evidence or a bounded sparse height projection.
   */
  #groupedAxisProjection(
    presentation: ResolvedKanbanPresentationBudget,
    structure: KanbanStructurePolicy<TCard> | undefined,
  ): { readonly hint: KanbanSceneWindowLayoutHint; readonly window: KanbanGroupedAxisWindow } | undefined {
    const snapshot = this.#snapshot;
    if (snapshot === undefined || snapshot.visibleSwimlanes.length === 0) return undefined;
    if ((structure?.revision ?? snapshot.publication.revision) !== snapshot.structure.revision) return undefined;
    const collapsed = new Set(snapshot.collapsedSwimlaneIds);
    const projectedColumnIds = new Set(snapshot.widths.columns.map((column) => column.columnId));
    const projectedActiveColumnIds = new Set(
      snapshot.structure.columns
        .filter((column) => column.cardRegion === 'active' && projectedColumnIds.has(column.columnId))
        .map((column) => column.columnId),
    );
    const activeColumnIds = Object.freeze([
      ...new Set(
        snapshot.cells
          .map((cell) => cell.address.columnId)
          .filter((columnId) => projectedActiveColumnIds.has(columnId)),
      ),
    ]);
    if (activeColumnIds.length === 0 && projectedActiveColumnIds.size > 0) return undefined;
    const rows: KanbanSceneWindowLayoutHint['rows'][number][] = [];
    for (const [index, swimlane] of snapshot.visibleSwimlanes.entries()) {
      if (collapsed.has(swimlane.swimlaneId) || activeColumnIds.length === 0) {
        rows.push(Object.freeze({ start: index, end: index + 1, extent: 1, quality: 'exact' }));
        continue;
      }
      let extent = 0;
      let quality: 'exact' | 'unknown' = 'exact';
      let complete = true;
      for (const columnId of activeColumnIds) {
        const address = Object.freeze({ columnId, swimlaneId: swimlane.swimlaneId });
        const cell = snapshot.cells.find(
          (candidate) => canonicalizeKanbanCellAddress(candidate.address) === canonicalizeKanbanCellAddress(address),
        );
        if (cell === undefined) {
          complete = false;
          break;
        }
        const projection = this.#heightProjections.find(
          (candidate) => canonicalizeKanbanCellAddress(candidate.address) === canonicalizeKanbanCellAddress(address),
        );
        if (projection === undefined) {
          const length = cell.cursor.length();
          if (length.kind === 'exact' && length.value === 0) continue;
          if (length.kind === 'unknown') {
            complete = false;
            break;
          }
          const stride = bootstrapCardHeight(presentation) + presentation.cardGap;
          const trailingGap = presentation.cardGap;
          const estimated =
            length.value > Math.floor(Number.MAX_SAFE_INTEGER / stride)
              ? Number.MAX_SAFE_INTEGER
              : Math.max(0, length.value * stride - trailingGap);
          extent = Math.max(extent, estimated);
          quality = 'unknown';
          continue;
        }
        const resolved = resolveKanbanVerticalProjectionExtentWithGap(projection.projection, presentation.cardGap);
        extent = Math.max(extent, resolved.value);
        if (resolved.quality !== 'exact') quality = 'unknown';
      }
      if (!complete) break;
      rows.push(Object.freeze({ start: index, end: index + 1, extent: extent + 1, quality }));
    }
    if (rows.length === 0) return undefined;
    const offset = this.#requestedOffsets.y;
    let rowTop = 0;
    let activeIndex = 0;
    for (const row of rows) {
      if (offset < rowTop + row.extent) {
        activeIndex = row.start;
        break;
      }
      rowTop += row.extent;
      activeIndex = Math.min(rows.length - 1, row.end);
    }
    const active = rows[activeIndex];
    if (active === undefined) return undefined;
    const withinRowOffset = Math.max(0, offset - rowTop);
    let remainingRows = Math.max(1, this.bounds.height - KANBAN_WORKFLOW_HEADER_ROWS);
    let end = activeIndex;
    for (let index = activeIndex; index < rows.length && remainingRows > 0; index += 1) {
      const row = rows[index];
      if (row === undefined) break;
      remainingRows -= index === activeIndex ? Math.max(1, row.extent - withinRowOffset) : row.extent;
      end = index + 1;
    }
    const activeSwimlane = snapshot.visibleSwimlanes[activeIndex];
    if (activeSwimlane === undefined) return undefined;
    const cardOffset = Math.max(0, withinRowOffset - 1);
    const overscanRows = this.bounds.height * (this.#options.overscan?.vertical ?? 1);
    const cardRanges = Object.freeze(
      activeColumnIds.flatMap((columnId) => {
        const address = Object.freeze({ columnId, swimlaneId: activeSwimlane.swimlaneId });
        const retained = this.#heightIndices.get(canonicalizeKanbanCellAddress(address));
        if (retained === undefined || retained.logicalLength === 0) return [];
        const start = logicalIndexAtStackRow(
          retained.index,
          Math.max(0, cardOffset - overscanRows),
          presentation.cardGap,
        );
        const end = Math.min(
          retained.logicalLength,
          logicalIndexAtStackRow(retained.index, cardOffset + this.bounds.height + overscanRows, presentation.cardGap) +
            1,
        );
        return [Object.freeze({ address, start, end })];
      }),
    );
    const hint = Object.freeze({
      queryGeneration: snapshot.generation,
      sessionRevision: snapshot.publication.revision,
      rows: Object.freeze(rows),
    });
    return Object.freeze({
      hint,
      window: Object.freeze({
        queryGeneration: snapshot.generation,
        sessionRevision: snapshot.publication.revision,
        presentationRevision: presentation.revision,
        requestedSwimlaneRange: Object.freeze({ start: activeIndex, end: Math.max(activeIndex + 1, end) }),
        cardRanges,
      }),
    });
  }

  /** Projects bounded ungrouped logical ranges from revision-compatible sparse height indices. */
  #cardRangeWindow(presentation: ResolvedKanbanPresentationBudget): KanbanCardRangeWindow | undefined {
    const snapshot = this.#snapshot;
    if (snapshot === undefined || snapshot.visibleSwimlanes.length > 0) return undefined;
    const overscanRows = this.bounds.height * (this.#options.overscan?.vertical ?? 1);
    const startRow = Math.max(0, this.#requestedOffsets.y - overscanRows);
    const endRow = this.#requestedOffsets.y + this.bounds.height + overscanRows;
    const ranges = Object.freeze(
      snapshot.cells.flatMap((cell) => {
        const retained = this.#heightIndices.get(canonicalizeKanbanCellAddress(cell.address));
        if (retained === undefined || retained.logicalLength === 0) return [];
        const start = logicalIndexAtStackRow(retained.index, startRow, presentation.cardGap);
        const end = Math.min(
          retained.logicalLength,
          logicalIndexAtStackRow(retained.index, endRow, presentation.cardGap) + 1,
        );
        return [Object.freeze({ address: Object.freeze({ ...cell.address }), start, end })];
      }),
    );
    if (ranges.length === 0) return undefined;
    return Object.freeze({
      queryGeneration: snapshot.generation,
      sessionRevision: snapshot.publication.revision,
      presentationRevision: presentation.revision,
      ranges,
    });
  }

  /** Resolves one revision-consistent built-in or custom swimlane chrome projection. */
  #resolveSwimlanePresentation(snapshot: KanbanViewportSourceSnapshot<TCard>):
    | {
        readonly sceneVariant: 'hybrid' | 'separator' | 'band' | 'rail' | 'custom';
        readonly railWidth?: number;
        readonly customChrome?: readonly KanbanSceneCustomChromeInput[];
        readonly presentationColumnWidths?: readonly { readonly columnId: string; readonly width: number }[];
      }
    | undefined {
    const grouping = snapshot.groupingPolicy;
    if (grouping?.presentation === undefined || snapshot.visibleSwimlanes.length === 0) return undefined;
    const resolved = snapshot.visibleSwimlanes.map((swimlane) =>
      this.#swimlanePresentationResolver.resolve({
        presentation: grouping.presentation ?? 'hybrid',
        swimlane,
        availableWidth: Math.max(1, this.bounds.width),
        columns: snapshot.widths.columns.map((column) => ({
          columnId: column.columnId,
          minimumWidth: column.minimumWidth,
        })),
        ...(grouping.railWidth === undefined ? {} : { railWidth: grouping.railWidth }),
      }),
    );
    const first = resolved[0];
    if (first === undefined) return undefined;
    if (resolved.some((entry) => entry.resolvedVariant !== first.resolvedVariant)) {
      return Object.freeze({ sceneVariant: 'hybrid' });
    }
    const presentationColumnWidths = Object.freeze(
      first.columns.map((column) => Object.freeze({ columnId: column.columnId, width: column.availableWidth })),
    );
    if (first.resolvedVariant !== 'custom') {
      const railWidth = first.chrome.kind === 'custom' ? 0 : first.chrome.railWidth;
      return Object.freeze({
        sceneVariant: first.resolvedVariant,
        ...(railWidth === 0 ? {} : { railWidth, presentationColumnWidths }),
      });
    }
    const customChrome = Object.freeze(
      resolved.flatMap((entry) => {
        if (entry.chrome.kind !== 'custom') return [];
        return [
          Object.freeze({
            swimlaneId: entry.semantic.swimlaneId,
            descriptor: entry.chrome.descriptor,
          }),
        ];
      }),
    );
    return Object.freeze({ sceneVariant: 'custom', customChrome, presentationColumnWidths });
  }

  /** Reacquires once when live extents clamp offsets used by the first bounded refresh. */
  #refreshClamped(
    collapsedColumnIds: readonly string[] | undefined,
    focusedColumnId: string | undefined,
    density: KanbanCardDensity,
    structure: KanbanStructurePolicy<TCard> | undefined,
  ): KanbanViewportSourceSnapshot<TCard> | undefined {
    const acquisitionOffsets = this.#requestedOffsets;
    let snapshot = this.#refresh(collapsedColumnIds, focusedColumnId, density, structure);
    this.#updateMetrics(snapshot);
    if (
      snapshot !== undefined &&
      (acquisitionOffsets.x !== this.#requestedOffsets.x || acquisitionOffsets.y !== this.#requestedOffsets.y)
    ) {
      snapshot = this.#refresh(collapsedColumnIds, focusedColumnId, density, structure);
      this.#updateMetrics(snapshot);
    }
    return snapshot;
  }

  /** Restores a stable card's preferred row only when geometry-affecting inputs changed. */
  #restoreVerticalAnchor(density: KanbanCardDensity, i18n: I18n, theme: KanbanTheme, capabilities: object): boolean {
    const previous = this.#anchorInputs;
    const changed =
      previous !== undefined &&
      (previous.width !== this.bounds.width ||
        previous.height !== this.bounds.height ||
        previous.density !== density ||
        previous.i18n !== i18n ||
        previous.theme !== theme ||
        previous.capabilities !== capabilities);
    if (changed && this.#verticalAnchor !== undefined) {
      this.#requestedOffsets = Object.freeze({
        ...this.#requestedOffsets,
        y: Math.max(
          0,
          this.#logicalCardRow(this.#verticalAnchor.address, this.#verticalAnchor.index, density) -
            this.#verticalAnchor.relativeRow,
        ),
      });
    }
    this.#anchorInputs = Object.freeze({
      width: this.bounds.width,
      height: this.bounds.height,
      density,
      i18n,
      theme,
      capabilities,
    });
    return changed;
  }

  /** Restores the same source column and within-column screen offset after width/order changes. */
  #restoreHorizontalAnchor(snapshot: KanbanViewportSourceSnapshot<TCard>): boolean {
    if (this.#horizontalColumnAnchor === undefined || snapshot.widths.mode !== 'multi-column') return false;
    let columnStart = 0;
    let found = false;
    for (const column of snapshot.widths.columns) {
      if (column.columnId === this.#horizontalColumnAnchor) {
        found = true;
        break;
      }
      columnStart += column.width + snapshot.widths.separatorWidth;
    }
    if (!found) return false;
    const target = Math.max(0, columnStart + this.#horizontalAnchorOffset);
    if (target === this.#requestedOffsets.x) return false;
    this.#requestedOffsets = Object.freeze({ ...this.#requestedOffsets, x: target });
    return true;
  }

  /** Corrects a stable card anchor after authoritative insertion, removal, or reorder changed its index. */
  #restoreVerticalIdentity(projection: KanbanViewportProjection, density: KanbanCardDensity): boolean {
    const anchor = this.#verticalAnchor;
    if (anchor === undefined) return false;
    const card = projection.cards.find((candidate) => candidate.descriptor.cardKey === anchor.cardKey);
    if (card === undefined) return false;
    const address = Object.freeze({
      columnId: card.columnId,
      ...(card.swimlaneId === undefined ? {} : { swimlaneId: card.swimlaneId }),
    });
    const target = Math.max(0, this.#logicalCardRow(address, card.index, density) - anchor.relativeRow);
    if (target === this.#requestedOffsets.y) return false;
    this.#requestedOffsets = Object.freeze({ ...this.#requestedOffsets, y: target });
    return true;
  }

  /** Uses the optional bounded locator when a source reorder moves the anchor outside the retained range. */
  #relocateMissingVerticalAnchor(
    projection: KanbanViewportProjection,
    sourceGeneration: number,
    sourceRevision: KanbanRevision,
    density: KanbanCardDensity,
  ): boolean {
    const source = this.#source;
    const anchor = this.#verticalAnchor;
    if (
      source === undefined ||
      anchor === undefined ||
      projection.cards.some((candidate) => candidate.descriptor.cardKey === anchor.cardKey)
    ) {
      return false;
    }
    this.#anchorController?.abort();
    const controller = new AbortController();
    this.#anchorController = controller;
    void source.locateCard(anchor.cardKey, controller.signal).then(
      (location) => {
        if (
          controller.signal.aborted ||
          this.#disposed ||
          this.#anchorController !== controller ||
          this.#snapshot?.generation !== sourceGeneration ||
          this.#snapshot?.publication.revision !== sourceRevision ||
          this.#verticalAnchor?.cardKey !== anchor.cardKey ||
          (location.kind !== 'found' && location.kind !== 'unloaded') ||
          location.index === undefined
        ) {
          if (this.#anchorController === controller) this.#anchorController = undefined;
          return;
        }
        this.#anchorController = undefined;
        const y = Math.max(0, this.#logicalCardRow(location.address, location.index, density) - anchor.relativeRow);
        this.#recordLocatedExtent(y);
        this.#pendingVerticalAnchorRow = anchor.relativeRow;
        this.#focusedColumnAnchor = location.address.columnId;
        this.#imperativeFocusedColumnAnchor = location.address.columnId;
        this.#horizontalColumnAnchor = location.address.columnId;
        this.#horizontalAnchorOffset = 0;
        this.#requestedOffsets = Object.freeze({ x: this.#columnStart(location.address.columnId), y });
        this.invalidate();
      },
      () => {
        if (this.#anchorController === controller) this.#anchorController = undefined;
        // Cancellation and unsupported locators leave the last bounded projection intact.
      },
    );
    return true;
  }

  /** Cancels an automatic reorder relocation when newer imperative navigation owns the viewport. */
  #cancelAnchorRelocation(): void {
    this.#anchorController?.abort();
    this.#anchorController = undefined;
    this.#pendingVerticalAnchorRow = undefined;
  }

  /** Returns one source column's logical horizontal start without opening an unretained cursor. */
  #columnStart(columnId: string): number {
    const widths = this.#snapshot?.widths;
    if (widths === undefined || widths.mode !== 'multi-column') return 0;
    let x = 0;
    for (const column of widths.columns) {
      if (column.columnId === columnId) return x;
      x += column.width + widths.separatorWidth;
    }
    return 0;
  }

  /** Resolves one logical card top from retained sparse evidence or the bounded preset estimate. */
  #logicalCardRow(address: KanbanCellAddress, logicalIndex: number, density: KanbanCardDensity): number {
    const presentation = resolveKanbanPresentation(this.#options.presentation?.() ?? density);
    const retained = this.#heightIndices.get(canonicalizeKanbanCellAddress(address));
    if (retained !== undefined && logicalIndex <= retained.logicalLength) {
      const descriptorRow = retained.index.rowAt(logicalIndex).value;
      const gaps =
        presentation.cardGap === 0 || logicalIndex === 0
          ? 0
          : logicalIndex > Math.floor(Number.MAX_SAFE_INTEGER / presentation.cardGap)
            ? Number.MAX_SAFE_INTEGER
            : logicalIndex * presentation.cardGap;
      return descriptorRow > Number.MAX_SAFE_INTEGER - gaps ? Number.MAX_SAFE_INTEGER : descriptorRow + gaps;
    }
    const stride = bootstrapCardHeight(presentation) + presentation.cardGap;
    return logicalIndex > Math.floor(Number.MAX_SAFE_INTEGER / stride)
      ? Number.MAX_SAFE_INTEGER
      : logicalIndex * stride;
  }

  /** Records a locator-proven lower bound only for the generation and revision that proved it. */
  #recordLocatedExtent(y: number): void {
    const snapshot = this.#snapshot;
    if (snapshot === undefined) return;
    if (
      this.#locatedExtentGeneration !== snapshot.generation ||
      this.#locatedExtentRevision !== snapshot.publication.revision
    ) {
      this.#locatedVerticalExtent = 0;
    }
    this.#locatedExtentGeneration = snapshot.generation;
    this.#locatedExtentRevision = snapshot.publication.revision;
    this.#locatedVerticalExtent = Math.max(this.#locatedVerticalExtent, y);
  }

  /** Captures focused-card or nearest-visible vertical identity for the next responsive reflow. */
  #rememberVerticalAnchor(
    projection: KanbanViewportProjection,
    identity: KanbanIdentityInput,
    density: KanbanCardDensity,
  ): void {
    const focused = projection.cards.find((card) => card.descriptor.cardKey === identity.focusedCardKey);
    const nearest = focused ?? [...projection.cards].sort((left, right) => left.rect.y - right.rect.y)[0];
    if (nearest === undefined) return;
    if (this.#focusedColumnAnchor === undefined) this.#focusedColumnAnchor = nearest.columnId;
    const address = Object.freeze({
      columnId: nearest.columnId,
      ...(nearest.swimlaneId === undefined ? {} : { swimlaneId: nearest.swimlaneId }),
    });
    const logicalRow = this.#logicalCardRow(address, nearest.index, density);
    const projectedRelativeRow = logicalRow - this.#requestedOffsets.y;
    const retainedRelativeRow = this.#pendingVerticalAnchorRow ?? projectedRelativeRow;
    if (this.#pendingVerticalAnchorRow !== undefined) {
      if (projectedRelativeRow === this.#pendingVerticalAnchorRow) {
        this.#pendingVerticalAnchorRow = undefined;
      } else {
        this.#requestedOffsets = Object.freeze({
          ...this.#requestedOffsets,
          y: Math.max(0, logicalRow - this.#pendingVerticalAnchorRow),
        });
        this.invalidate();
      }
    }
    this.#verticalAnchor = Object.freeze({
      cardKey: nearest.descriptor.cardKey,
      address,
      index: nearest.index,
      relativeRow: retainedRelativeRow,
    });
  }

  /** Captures source-column identity plus signed within-column viewport offset. */
  #rememberHorizontalAnchor(snapshot: KanbanViewportSourceSnapshot<TCard>): void {
    if (snapshot.widths.mode !== 'multi-column') return;
    let columnStart = 0;
    let lastColumn: (typeof snapshot.widths.columns)[number] | undefined;
    let lastStart = 0;
    for (const column of snapshot.widths.columns) {
      lastColumn = column;
      lastStart = columnStart;
      if (this.#requestedOffsets.x < columnStart + column.width + snapshot.widths.separatorWidth) {
        this.#horizontalColumnAnchor = column.columnId;
        this.#horizontalAnchorOffset = Math.min(
          Math.max(0, column.width - 1),
          Math.max(0, this.#requestedOffsets.x - columnStart),
        );
        return;
      }
      columnStart += column.width + snapshot.widths.separatorWidth;
    }
    if (lastColumn !== undefined) {
      this.#horizontalColumnAnchor = lastColumn.columnId;
      this.#horizontalAnchorOffset = Math.max(0, lastColumn.width - 1);
      if (this.#requestedOffsets.x < lastStart) this.#horizontalAnchorOffset = 0;
    }
  }

  /** Publishes a detached metric snapshot without leaking coordinator or cursor references. */
  #updateMetrics(
    snapshot: KanbanViewportSourceSnapshot<TCard> | undefined,
    projection?: KanbanViewportProjection,
  ): void {
    if (snapshot === undefined) return;
    const priorProjectionCompatible =
      projection === undefined &&
      this.#snapshot?.generation === snapshot.generation &&
      this.#snapshot.publication.revision === snapshot.publication.revision &&
      this.#snapshot.structure.revision === snapshot.structure.revision &&
      this.#projection?.scene?.cells.length === snapshot.cells.length &&
      snapshot.cells.every((cell) => {
        const previous = this.#projection?.scene?.cells.find(
          (candidate) =>
            canonicalizeKanbanCellAddress(candidate.address) === canonicalizeKanbanCellAddress(cell.address),
        );
        return previous?.cursorRevision === cell.cursor.revision();
      });
    const effectiveProjection = projection ?? (priorProjectionCompatible ? this.#projection : undefined);
    if (
      this.#locatedExtentGeneration !== snapshot.generation ||
      this.#locatedExtentRevision !== snapshot.publication.revision
    ) {
      this.#locatedVerticalExtent = 0;
      this.#locatedExtentGeneration = undefined;
      this.#locatedExtentRevision = undefined;
    }
    const metrics = createKanbanViewportMetrics({
      bounds: this.bounds,
      source: snapshot,
      ...(effectiveProjection === undefined ? {} : { projection: effectiveProjection }),
      ...(projection === undefined || this.#heightProjections.length === 0
        ? {}
        : { heightProjections: this.#heightProjections }),
      offsets: this.#requestedOffsets,
      density: this.#options.density?.() ?? 'comfortable',
      presentation: this.#options.presentation?.() ?? this.#options.density?.() ?? 'comfortable',
      overscan: {
        x: this.#options.overscan?.horizontal ?? 1,
        y: this.#options.overscan?.vertical ?? 1,
      },
      minimumVerticalExtent: this.#locatedVerticalExtent,
    });
    this.#metrics = metrics;
    this.#requestedOffsets = this.#metrics.offsets;
    const fingerprint = JSON.stringify([
      metrics.assignedRect,
      metrics.mode,
      metrics.visibleColumnIds,
      metrics.stickyRows,
      metrics.generation,
      typeof metrics.sourceRevision,
      metrics.sourceRevision ?? null,
      snapshot.structure.revision,
    ]);
    if (fingerprint !== this.#metricsFingerprint) {
      this.#metricsFingerprint = fingerprint;
      this.#metricsVersion.update((version) => (version === Number.MAX_SAFE_INTEGER ? 0 : version + 1));
    }
  }

  /**
   * Records exact resident descriptor heights and returns one immutable correction projection.
   *
   * The caller may reproject at most once with this result. Unknown logical spans remain arithmetic
   * estimates, so neither storage nor correction work grows with the source's logical length.
   */
  #measureSparseHeights(
    snapshot: KanbanViewportSourceSnapshot<TCard>,
    projection: KanbanViewportProjection,
    presentationRevision: KanbanRevision,
    cardGap: number,
    estimatedCardHeight: number,
  ): { readonly projections: readonly KanbanViewportCellHeightProjection[]; readonly corrected: boolean } {
    const activeKeys = new Set(snapshot.cells.map((cell) => canonicalizeKanbanCellAddress(cell.address)));
    for (const [key, entry] of [...this.#heightIndices]) {
      if (activeKeys.has(key)) continue;
      entry.index.dispose();
      this.#heightIndices.delete(key);
    }

    let corrected = false;
    const projections: KanbanViewportCellHeightProjection[] = [];
    for (const cell of snapshot.cells) {
      const cards =
        projection.scene === undefined
          ? projection.cards
              .filter((card) => card.columnId === cell.address.columnId && card.swimlaneId === cell.address.swimlaneId)
              .map((card) =>
                Object.freeze({
                  cardKey: card.descriptor.cardKey,
                  index: card.index,
                  height: framedKanbanCardHeight(card.descriptor.measuredHeight),
                }),
              )
          : projection.scene.cards
              .filter(
                (card) =>
                  card.address.columnId === cell.address.columnId &&
                  card.address.swimlaneId === cell.address.swimlaneId,
              )
              .map((card) =>
                Object.freeze({
                  cardKey: card.cardKey,
                  index: card.logicalIndex,
                  height: card.descriptor.measuredHeight,
                }),
              );
      const length = cell.cursor.length();
      const highestResident = cards.reduce((maximum, card) => Math.max(maximum, card.index + 1), 0);
      const logicalLength = Math.max(cell.range.end, highestResident, length.kind === 'unknown' ? 0 : length.value);
      const key = canonicalizeKanbanCellAddress(cell.address);
      let retained = this.#heightIndices.get(key);
      if (retained === undefined || retained.logicalLength !== logicalLength) {
        retained?.index.dispose();
        retained = Object.freeze({
          logicalLength,
          index: createKanbanSparseHeightIndex({
            logicalLength,
            estimatedHeight: estimatedCardHeight,
            maximumAnchors: Math.max(1, this.#limits.retainedDescriptors),
            maximumRuns: Math.max(1, this.#limits.retainedDescriptors),
            sourceRevision: snapshot.publication.revision,
            cursorRevision: cell.cursor.revision(),
            presentationRevision,
          }),
        });
        this.#heightIndices.set(key, retained);
      } else {
        if (
          retained.index.invalidateRevisions({
            sourceRevision: snapshot.publication.revision,
            cursorRevision: cell.cursor.revision(),
            presentationRevision,
          }) > 0
        ) {
          corrected = true;
        }
      }
      for (const card of cards) {
        const before = retained.index.anchorFor(card.cardKey);
        const stable = this.#verticalAnchor?.cardKey === card.cardKey;
        retained.index.measure({
          cardKey: card.cardKey,
          logicalIndex: card.index,
          height: card.height,
          ...(stable
            ? {
                anchor: {
                  cardKey: card.cardKey,
                  logicalIndex: card.index,
                  viewportRow: Math.max(0, this.#verticalAnchor?.relativeRow ?? 0),
                },
              }
            : {}),
        });
        if (
          (before === undefined && card.height !== estimatedCardHeight) ||
          (before !== undefined && before.quality === 'exact' && before.height !== card.height)
        ) {
          corrected = true;
        }
      }
      if (cards.length > 0) {
        const nextProjection = createKanbanVerticalHeightProjection({
          index: retained.index,
          cards: retained.index.identitiesInRange(cell.range.start, cell.range.end),
        });
        const previousProjection = this.#heightProjections.find(
          ({ address }) => address.columnId === cell.address.columnId && address.swimlaneId === cell.address.swimlaneId,
        )?.projection;
        if (JSON.stringify(previousProjection) !== JSON.stringify(nextProjection)) corrected = true;
        projections.push(Object.freeze({ address: Object.freeze({ ...cell.address }), projection: nextProjection }));
      }
    }

    const anchor = this.#verticalAnchor;
    if (corrected && anchor !== undefined) {
      const owner = snapshot.cells.find((cell) =>
        projection.cards.some(
          (card) =>
            card.descriptor.cardKey === anchor.cardKey &&
            card.columnId === cell.address.columnId &&
            card.swimlaneId === cell.address.swimlaneId,
        ),
      );
      const retained =
        owner === undefined ? undefined : this.#heightIndices.get(canonicalizeKanbanCellAddress(owner.address));
      const exact = retained?.index.anchorFor(anchor.cardKey);
      if (exact !== undefined) {
        const target = Math.max(
          0,
          retained!.index.rowAt(exact.logicalIndex).value + exact.logicalIndex * cardGap - anchor.relativeRow,
        );
        this.#requestedOffsets = Object.freeze({ ...this.#requestedOffsets, y: target });
        this.#metrics = Object.freeze({ ...this.#metrics, offsets: this.#requestedOffsets });
      }
    }
    return Object.freeze({ projections: Object.freeze(projections), corrected });
  }

  /** Creates a detached counter-only scale snapshot without card values or retained internal objects. */
  #scaleSnapshot(): KanbanViewportScaleSnapshot {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    let heightAnchors = 0;
    let heightRuns = 0;
    let heightAllocatedEntries = 0;
    for (const entry of this.#heightIndices.values()) {
      const snapshot = entry.index.snapshot();
      heightAnchors += snapshot.retainedAnchors;
      heightRuns += snapshot.retainedRuns;
      heightAllocatedEntries += snapshot.allocatedEntries;
    }
    const cells = this.#snapshot?.cells ?? [];
    const sceneWindow = this.#snapshot?.sceneWindow;
    const overlay = this.#projection?.overlay;
    const cardDrag = this.#dragController.snapshot();
    const structuralDrag = this.#structuralDragController.snapshot();
    const cardDragMembers =
      cardDrag.kind === 'idle'
        ? 0
        : cardDrag.overlay.placeholders.length + 1 + (cardDrag.overlay.gap === undefined ? 0 : 1);
    const structuralDragMembers =
      structuralDrag.kind === 'idle' ? 0 : 2 + (structuralDrag.overlay.markerRect === undefined ? 0 : 1);
    return Object.freeze({
      retainedCursors: cells.length,
      retainedAddresses: new Set(cells.map((cell) => canonicalizeKanbanCellAddress(cell.address))).size,
      retainedDescriptors: this.#descriptorCache.size,
      reactiveComputations: this.#descriptorCache.size,
      heightAnchors,
      heightRuns,
      heightAllocatedEntries,
      damageRegions: this.#damage.length,
      sceneWindowCells: sceneWindow?.kind === 'available' ? sceneWindow.requestedCells.length : 0,
      descriptorOmissions: this.#projection?.scene?.states.reduce((total, state) => total + state.omittedCount, 0) ?? 0,
      projectedCards: this.#projection?.cards.length ?? 0,
      actionTargets: this.#projection?.actionTargets.length ?? 0,
      operationOverlays: (overlay?.pending.length ?? 0) + (overlay?.feedback.length ?? 0),
      transientOverlayMembers: cardDragMembers + structuralDragMembers,
    });
  }

  /** Records measured-versus-estimated sparse row use for one projection attempt. */
  #recordProjectionPass(
    source: KanbanViewportSourceSnapshot<TCard>,
    projections: readonly KanbanViewportCellHeightProjection[],
    projected: KanbanViewportProjection,
  ): void {
    if (!this.#operationInspectionEnabled) return;
    let measuredRows = 0;
    let estimatedRows = 0;
    for (const cell of source.cells) {
      const logicalRows = Math.max(0, cell.range.end - cell.range.start);
      const heightProjection = projections.find(
        ({ address }) => address.columnId === cell.address.columnId && address.swimlaneId === cell.address.swimlaneId,
      )?.projection;
      if (heightProjection === undefined) {
        const residentRows =
          projected.scene?.cells.find(
            ({ address }) =>
              address.columnId === cell.address.columnId && address.swimlaneId === cell.address.swimlaneId,
          )?.cards.length ?? 0;
        measuredRows += Math.min(logicalRows, residentRows);
        estimatedRows += Math.max(0, logicalRows - residentRows);
        continue;
      }
      const exactRows = new Set(
        heightProjection.rows
          .filter(
            ({ logicalIndex, descriptorRow }) =>
              descriptorRow.quality === 'exact' && logicalIndex >= cell.range.start && logicalIndex < cell.range.end,
          )
          .map(({ logicalIndex }) => logicalIndex),
      ).size;
      measuredRows += Math.min(logicalRows, exactRows);
      estimatedRows += Math.max(0, logicalRows - exactRows);
    }
    const heightQuality = measuredRows === 0 ? 'estimated' : estimatedRows === 0 ? 'measured' : 'mixed';
    this.#projectionPasses.push(
      Object.freeze({
        ordinal: this.#projectionPasses.length + 1,
        heightQuality,
        measuredRows,
        estimatedRows,
      }),
    );
  }

  /** Returns detached projection-pass evidence for the latest completed frame. */
  #operationSnapshot(): KanbanViewportOperationSnapshot {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    return Object.freeze({
      projectionPasses: Object.freeze(this.#projectionPasses.map((pass) => Object.freeze({ ...pass }))),
    });
  }
}
