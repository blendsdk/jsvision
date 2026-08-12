import type { I18n } from '@jsvision/i18n';
import { Group, Show, createRoot, effect, fixed, grow, runWithOwner, signal, spacer } from '@jsvision/ui';
import type { Rect } from '@jsvision/ui';

import type {
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
  KanbanRequest,
  KanbanRequestDispatcher,
  KanbanRequestProposal,
  KanbanRequestResult,
} from '../contract/request.js';
import type { CardKey, KanbanOperationId } from '../contract/identity.js';
import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanRevision } from '../contract/revision.js';
import { createEnglishKanbanI18n } from '../i18n/catalog.js';
import type { KanbanPhaseBMessageMap } from '../i18n/catalog.js';
import { KANBAN_MINIMUM_VIEWPORT_ROWS } from '../layout/workflow-geometry.js';
import {
  createKanbanInteractionController,
  createSeededKanbanInteractionController,
} from '../interaction/controller.js';
import type { KanbanInteractionControllerFactory, KanbanInteractionFacade } from '../interaction/facade.js';
import { KanbanInteractionFacadeOwner } from '../interaction/facade.js';
import type { KanbanDragConfiguration } from '../interaction/pointer-router.js';
import type { KanbanInteractionHandler } from '../interaction/intent.js';
import { snapshotKanbanFocusTarget } from '../interaction/reconciliation.js';
import type {
  KanbanFocusTarget,
  KanbanInteractionAcquisitionRequest,
  KanbanInteractionAcquisitionResult,
  KanbanInteractionEnvironment,
  KanbanInteractionFeedback,
  KanbanInteractionFeedbackCode,
  KanbanInteractionRevisions,
  KanbanInteractionSnapshot,
  KanbanSelectionSnapshot,
} from '../interaction/types.js';
import type { KanbanSourceState } from '../source/states.js';
import type { KanbanIdentityChangeBatch } from '../source/types.js';
import type { KanbanEligibility } from '../operation/eligibility.js';
import type { KanbanOperationIdFactory } from '../operation/operation-id.js';
import type {
  KanbanConfirmer,
  KanbanInverseRequestBuilder,
  KanbanOperationSnapshot,
  KanbanOperationSubscriber,
} from '../operation/types.js';
import { KanbanBoardBindings, KanbanFocusedNavigatorView } from './board-bindings.js';
import { KanbanBoardFeedbackView, createKanbanBoardFeedbackState } from './board-feedback.js';
import type { KanbanBoardFeedbackState } from './board-feedback.js';
import { createKanbanDefaultInteractionSeed } from './board-state.js';
import { KanbanBoardAuthority } from './board-authority.js';
import type { KanbanNavigatorState } from './board-bindings.js';
import {
  activateKanbanViewportBoardInput,
  KanbanViewport,
  prepareKanbanViewportBoardInput,
  quiesceKanbanViewportInput,
  setKanbanViewportInteractionEvidenceListener,
} from './kanban-viewport.js';
import { disposeKanbanViewportOperations, prepareKanbanViewportOperations } from './viewport-operation-bridge.js';
import { resolveKanbanViewportCardMove } from './viewport-move-bridge.js';
import type { KanbanIdentityInput, KanbanViewportOptions } from './kanban-viewport.js';
import type { KanbanViewportInteractionAdapter } from './viewport-interaction.js';
import type { KanbanViewportInspection } from './viewport-inspection.js';
import type { KanbanRevealAlignment, KanbanRevealResult, KanbanScrollTarget } from './viewport-scroll.js';
import { setViewportHostChromeRows } from './viewport-host-chrome.js';

/** Typed locale key assigned to each closed interaction feedback category. */
const INTERACTION_FEEDBACK_MESSAGE_KEYS = Object.freeze({
  'navigation-pending': 'kanban.interaction.navigation-pending',
  'navigation-unavailable': 'kanban.interaction.navigation-unavailable',
  'navigation-error': 'kanban.interaction.navigation-error',
  'selection-limit-exceeded': 'kanban.interaction.selection-limit-exceeded',
  'selection-pruned': 'kanban.interaction.selection-pruned',
  'interaction-unavailable': 'kanban.interaction.unavailable',
}) satisfies Readonly<
  Record<KanbanInteractionFeedbackCode, Extract<keyof KanbanPhaseBMessageMap, `kanban.interaction.${string}`>>
>;

/** Construction options for the responsive board shell and application authority seam. */
export interface KanbanBoardOptions<TCard> extends Omit<KanbanViewportOptions<TCard>, 'interaction' | 'drag'> {
  /**
   * Optional compatibility seed captured once during construction for the default controller's mount.
   *
   * @deprecated Use {@link KanbanBoard.interaction} after construction. This seed cannot be combined
   * with `interactionFactory` and later getter changes do not control interaction state.
   */
  readonly identity?: () => KanbanIdentityInput;
  /** Optional application-owned request dispatcher; read projection never depends on it. */
  readonly dispatcher?: KanbanRequestDispatcher;
  /** Optional confirmation callback for warning and destructive operation proposals. */
  readonly confirmOperation?: KanbanConfirmer;
  /** Optional resolver that turns an opaque committed undo token into a fresh proposal. */
  readonly resolveUndo?: KanbanInverseRequestBuilder;
  /** Optional application operation-ID factory for lifecycle-free standard proposals. */
  readonly operationId?: KanbanOperationIdFactory;
  /** Optional pure current-policy evaluator shared by programmatic proposal and confirmation paths. */
  readonly operationEligibility?: (proposal: KanbanRequestProposal) => KanbanEligibility;
  /** Optional mount factory replacing the package default interaction controller. */
  readonly interactionFactory?: KanbanInteractionControllerFactory;
  /** Optional synchronous receiver for immutable, non-mutation semantic interaction intents. */
  readonly onInteraction?: KanbanInteractionHandler;
  /** Optional bounded threshold configuration for board-owned card and structural drags. */
  readonly drag?: KanbanDragConfiguration;
}

/** Conditional focused-column navigator evidence. */
export interface KanbanBoardNavigatorInspection {
  /** Whether the one-row navigator currently consumes layout space. */
  readonly visible: boolean;
  /** Active source column in focused mode. */
  readonly columnId?: string;
  /** One-based source-order position. */
  readonly position?: number;
  /** Complete visible-column count. */
  readonly total?: number;
}

/** Localized board-wide state shown by the board shell. */
export type KanbanBoardState =
  | { readonly kind: 'no-columns'; readonly label: string }
  | { readonly kind: 'minimum-size'; readonly label: string }
  | { readonly kind: KanbanSourceState['kind']; readonly label: string };

/** Detached board-level composition, identity, and viewport evidence. */
export interface KanbanBoardInspection extends KanbanViewportInspection {
  /** Localized accessible board label. */
  readonly label: string;
  /** Current localized board/source state. */
  readonly state: KanbanBoardState;
  /** Conditional focused-column navigator evidence. */
  readonly navigator: KanbanBoardNavigatorInspection;
  /** Current parent-relative viewport rectangle. */
  readonly viewportRect: Readonly<Rect>;
  /** Semantic one-reflow invalidation count for responsive/reactive binding changes. */
  readonly layoutReflows: number;
  /** Detached reconciled application identity hints. */
  readonly identity: KanbanIdentityInput;
  /** Accepted operations awaiting authoritative source publication. */
  readonly pendingOperations: readonly KanbanPublicationExpectation[];
  /** Most recent publication notice that cleared pending metadata. */
  readonly clearedPublication?: KanbanPublicationNotice;
}

/** Copies the shared viewport options while replacing identity with the board-owned detached signal. */
function viewportOptions<TCard>(
  options: KanbanBoardOptions<TCard>,
  i18n: () => I18n,
  identity: () => KanbanIdentityInput,
  interaction?: KanbanViewportInteractionAdapter,
): KanbanViewportOptions<TCard> {
  return {
    source: options.source,
    query: options.query,
    card: options.card,
    i18n,
    identity,
    ...(interaction === undefined ? {} : { interaction }),
    ...(options.density === undefined ? {} : { density: options.density }),
    ...(options.presentation === undefined ? {} : { presentation: options.presentation }),
    ...(options.structure === undefined ? {} : { structure: options.structure }),
    ...(options.formatting === undefined ? {} : { formatting: options.formatting }),
    ...(options.cardPresentation === undefined ? {} : { cardPresentation: options.cardPresentation }),
    ...(options.renderer === undefined ? {} : { renderer: options.renderer }),
    ...(options.rendererRevision === undefined ? {} : { rendererRevision: options.rendererRevision }),
    ...(options.theme === undefined ? {} : { theme: options.theme }),
    ...(options.limits === undefined ? {} : { limits: options.limits }),
    ...(options.overscan === undefined ? {} : { overscan: options.overscan }),
    ...(options.observe === undefined ? {} : { observe: options.observe }),
    ...(options.capabilities === undefined ? {} : { capabilities: options.capabilities }),
    ...(options.collapsedColumnIds === undefined ? {} : { collapsedColumnIds: options.collapsedColumnIds }),
    ...(options.drag === undefined ? {} : { drag: options.drag }),
  };
}

/** Returns the localized visible state without exposing a source-provided error payload. */
function boardState(
  i18n: I18n,
  source: KanbanSourceState | undefined,
  noColumns: boolean,
  minimumSize: boolean,
  minimumHeight: number,
): KanbanBoardState {
  if (minimumSize) {
    return Object.freeze({
      kind: 'minimum-size',
      label: i18n.t('kanban.layout.minimum-size', { params: { width: 18, height: minimumHeight } }),
    });
  }
  if (noColumns) return Object.freeze({ kind: 'no-columns', label: i18n.t('kanban.board.no-columns') });
  const kind = source?.kind ?? 'loading';
  const key =
    kind === 'error'
      ? 'kanban.state.error'
      : kind === 'ready'
        ? 'kanban.board.label'
        : kind === 'empty'
          ? 'kanban.state.empty'
          : `kanban.state.${kind}`;
  return Object.freeze({ kind, label: i18n.t(key) });
}

/** Last viewport evidence used to classify one automatic interaction reconciliation. */
interface KanbanInteractionReconcileEvidence {
  /** Source and query generation owning the scene. */
  readonly revisions: KanbanInteractionRevisions;
  /** Whether search or field filters narrow this query generation. */
  readonly queryFiltered: boolean;
  /** Structure policy revision controlling grouping, collapse, and visibility. */
  readonly structureRevision: KanbanRevision;
  /** Exact assigned geometry and responsive-mode revision used for resize reconciliation. */
  readonly geometryRevision: KanbanRevision;
  /** Exact authoritative deletion batch fingerprint already consumed. */
  readonly deletionFingerprint: string;
  /** Revision of the source identity batch, including empty non-deletion publications. */
  readonly identityRevision?: KanbanRevision;
}

/** Creates a type-preserving equality key for one bounded revision value. */
function revisionKey(value: KanbanRevision | undefined): string {
  return JSON.stringify([typeof value, value ?? null]);
}

/**
 * Responsive DSL-composed Kanban shell that owns exactly one public viewport.
 *
 * A board instance owns one terminal mount lifecycle. After unmount or explicit disposal, create a
 * new board instead of remounting its released reactive and source resource graph.
 */
export class KanbanBoard<TCard> extends Group {
  /** Single exact-cell read projection owned by this board. */
  readonly viewport: KanbanViewport<TCard>;
  readonly #i18n: () => I18n;
  readonly #bindings: KanbanBoardBindings<TCard>;
  readonly #authority: KanbanBoardAuthority;
  readonly #interactionFacade: KanbanInteractionFacadeOwner;
  readonly #interactionFactory: KanbanInteractionControllerFactory | undefined;
  readonly #hasLegacyIdentity: boolean;
  readonly #navigatorVisible = signal(false);
  readonly #feedbackVisible = signal(false);
  readonly #minimumReserveVisible = signal(false);
  readonly #navigator: KanbanFocusedNavigatorView;
  readonly #feedback: KanbanBoardFeedbackView;
  readonly #minimumReserve = spacer({ fixed: 1 });
  #layoutReflows = 0;
  #disposeBindings: (() => void) | undefined;
  #disposeInteractionChrome: (() => void) | undefined;
  #interactionReconcileEvidence: KanbanInteractionReconcileEvidence | undefined;
  #interactionReconcileGeneration = 0;
  #automaticReconcileReady: boolean;
  #disposed = false;
  #everMounted = false;
  #releasedLifecycle = false;

  /** Builds direct conditional navigator + growing viewport composition without opening a session. */
  constructor(options: KanbanBoardOptions<TCard>) {
    super();
    if (
      Reflect.has(options, 'interaction') ||
      (options.identity !== undefined && options.interactionFactory !== undefined)
    ) {
      throw new KanbanInvalidSourcePublicationError();
    }
    this.focusable = true;
    const fallbackI18n = createEnglishKanbanI18n();
    this.#i18n = options.i18n ?? (() => fallbackI18n);
    const bindingOptions: KanbanViewportOptions<TCard> = {
      ...viewportOptions(options, this.#i18n, options.identity ?? (() => Object.freeze({}))),
      ...(options.identity === undefined ? {} : { identity: options.identity }),
    };
    this.#bindings = new KanbanBoardBindings(bindingOptions);
    const operationEligibility = options.operationEligibility;
    this.#authority = new KanbanBoardAuthority(options.dispatcher, options.capabilities, {
      expected: () => {
        const revisions = this.viewport.interactionRevisions();
        return Object.freeze({ source: revisions.sessionRevision, query: revisions.queryGeneration });
      },
      ...(operationEligibility === undefined
        ? {}
        : {
            eligibility: operationEligibility,
          }),
      ...(options.confirmOperation === undefined ? {} : { confirm: options.confirmOperation }),
      ...(options.resolveUndo === undefined ? {} : { resolveUndo: options.resolveUndo }),
      ...(options.operationId === undefined ? {} : { operationId: options.operationId }),
      ...(options.limits === undefined ? {} : { limits: options.limits }),
      ...(options.observe === undefined ? {} : { observe: options.observe }),
    });
    this.#interactionFactory = options.interactionFactory;
    this.#automaticReconcileReady = options.interactionFactory === undefined;
    this.#hasLegacyIdentity = options.identity !== undefined;
    this.#interactionFacade = new KanbanInteractionFacadeOwner({
      snapshotEligibleSelection: () => this.#snapshotEligibleSelection(),
      invalidate: () => this.viewport.invalidate(),
      ...(options.observe === undefined ? {} : { observe: options.observe }),
      ...(options.onInteraction === undefined ? {} : { onInteraction: options.onInteraction }),
      operations: {
        selection: () => this.#snapshotEligibleSelection(),
        resolveCardMove: (cardKeys, moveOptions) => resolveKanbanViewportCardMove(this.viewport, cardKeys, moveOptions),
        request: (proposal) => this.#authority.request(proposal),
        cancel: (operationId) => {
          const current = operationId ?? this.#authority.snapshot().at(-1)?.operationId;
          return current === undefined ? false : this.#authority.cancel(current);
        },
        undo: (operationId) => this.#authority.undo(operationId),
        redo: (operationId) => this.#authority.undo(operationId),
      },
    });
    this.viewport = new KanbanViewport(
      viewportOptions(options, this.#i18n, () => this.#interactionIdentity(), this.#interactionFacade),
    );
    prepareKanbanViewportOperations(this.viewport, {
      snapshot: () => this.#authority.snapshot(),
      subscribe: (subscriber) => this.#authority.subscribe(subscriber),
      cancel: (operationId) => this.#authority.cancel(operationId),
    });
    prepareKanbanViewportBoardInput(this.viewport, {
      accept: (command) => this.#interactionFacade.accept(command),
      acceptSelectionActivate: (command, activateOptions) =>
        this.#interactionFacade.acceptSelectionActivate(command, activateOptions),
      acceptActivate: (activateOptions) => this.#interactionFacade.acceptActivate(activateOptions),
      acceptOpenContext: (contextOptions) => this.#interactionFacade.acceptOpenContext(contextOptions),
      acceptScopedAction: (actionId, scope, origin) =>
        this.#interactionFacade.acceptScopedAction(actionId, scope, origin),
      commitCardMove: (proposal) => this.#authority.commitProposal(proposal),
      commitStructureReorder: (proposal) => this.#authority.commitProposal(proposal),
      evaluateCardMove: (proposal) => this.#authority.evaluateProposal(proposal),
      moveFocused: (direction) => this.#interactionFacade.acceptMoveFocused(direction),
      cancelTransient: () => this.#interactionFacade.cancel(),
    });
    setKanbanViewportInteractionEvidenceListener(this.viewport, () =>
      this.#reconcileInteraction(this.viewport.identityChanges()),
    );
    setViewportHostChromeRows(this.viewport, 1);
    this.#navigator = new KanbanFocusedNavigatorView(
      () => this.#navigatorState(),
      (direction) => this.#interactionFacade.accept({ kind: 'navigate', direction }),
    );
    this.#feedback = new KanbanBoardFeedbackView(() => this.#feedbackState());
    this.setLayout({ direction: 'col' });
    this.add(grow(this.viewport));
    fixed(this.#feedback, 1);
    this.addDynamic(() =>
      Show(
        () => this.#feedbackVisible(),
        () => this.#feedback,
      ),
    );
    fixed(this.#navigator, 1);
    this.addDynamic(() =>
      Show(
        () => this.#navigatorVisible(),
        () => this.#navigator,
      ),
    );
    this.addDynamic(() =>
      Show(
        () => this.#minimumReserveVisible(),
        () => this.#minimumReserve,
      ),
    );

    this.viewport.onMount(() => this.#setupInteraction(options.limits));

    this.onMount(() => {
      this.#everMounted = true;
      this.#disposeInteractionChrome = this.#interactionFacade.subscribe(() => this.#syncInteractionChrome());
      this.#disposeBindings = runWithOwner(this.viewport.scope, () =>
        createRoot((dispose) => {
          effect(() => {
            const snapshot = this.#bindings.read(this.viewport);
            const layoutChanged = this.#bindings.apply(snapshot);
            const identityChanges = this.viewport.identityChanges();
            const identityChanged = this.#bindings.reconcileIdentityChanges(identityChanges);
            const minimumReserveVisible = this.viewport.focusedNavigator() !== undefined && this.bounds.height < 5;
            const navigatorVisible =
              this.viewport.metrics().mode === 'focused-column' &&
              !minimumReserveVisible &&
              !this.#feedbackVisible.peek();
            const navigatorChanged = navigatorVisible !== this.#navigatorVisible.peek();
            const reserveChanged = minimumReserveVisible !== this.#minimumReserveVisible.peek();
            if (navigatorChanged) this.#navigatorVisible.set(navigatorVisible);
            if (reserveChanged) this.#minimumReserveVisible.set(minimumReserveVisible);
            if (layoutChanged || identityChanged || navigatorChanged || reserveChanged) this.#layoutReflows += 1;
            this.invalidateLayout();
          });
          return dispose;
        }),
      );
      this.viewport.onCleanup(() => this.dispose());
    });
  }

  /** Rejects remount after the board's terminal owned-resource lifecycle has been released. */
  override runPendingMounts(): void {
    if (this.#disposed && (!this.#everMounted || this.#releasedLifecycle)) throw new KanbanDisposedResourceError();
    super.runPendingMounts();
  }

  /** Returns detached board composition and viewport evidence. */
  inspection(): KanbanBoardInspection {
    this.#reconcileIdentityChanges();
    const viewport = this.viewport.inspection();
    const navigator = this.viewport.focusedNavigator();
    const i18n = this.#i18n();
    return Object.freeze({
      ...viewport,
      label: i18n.t('kanban.board.label'),
      state: boardState(
        i18n,
        this.viewport.sourceState(),
        viewport.visibleColumns.length === 0,
        this.viewport.metrics().mode === 'minimum-size',
        KANBAN_MINIMUM_VIEWPORT_ROWS + (navigator === undefined ? 0 : 1),
      ),
      navigator: Object.freeze({
        visible: this.#navigatorVisible.peek(),
        ...(navigator === undefined
          ? {}
          : { columnId: navigator.columnId, position: navigator.position, total: navigator.total }),
      }),
      viewportRect: Object.freeze({
        ...this.viewport.bounds,
        y: 0,
        height: Math.max(
          0,
          this.bounds.height -
            (this.#navigatorVisible.peek() || this.#feedbackVisible.peek() || this.#minimumReserveVisible.peek()
              ? 1
              : 0),
        ),
      }),
      layoutReflows: this.#layoutReflows,
      identity: this.#bindings.identity(),
      pendingOperations: this.#authority.pendingOperations(),
      ...(this.#authority.clearedPublication() === undefined
        ? {}
        : { clearedPublication: this.#authority.clearedPublication() }),
    });
  }

  /** Returns the board's stable programmatic interaction facade before and after mount. */
  interaction(): KanbanInteractionFacade {
    return this.#interactionFacade;
  }

  /** Dispatches one standard proposal or complete compatibility request without mutating records. */
  request(request: KanbanRequest | KanbanRequestProposal): Promise<KanbanRequestResult> {
    return this.#authority.request(request);
  }

  /** Clears pending metadata when matching or contradictory authoritative data is published. */
  reconcilePublication(notice: KanbanPublicationNotice): void {
    this.#authority.reconcilePublication(notice);
  }

  /** Returns detached active operation projections in admission order. */
  operationSnapshot(): readonly KanbanOperationSnapshot[] {
    return this.#authority.snapshot();
  }

  /** Subscribes to immutable payload-free operation transitions. */
  subscribeOperations(subscriber: KanbanOperationSubscriber): () => void {
    return this.#authority.subscribe(subscriber);
  }

  /** Cancels one active application operation. */
  cancelOperation(operationId: KanbanOperationId): boolean {
    return this.#authority.cancel(operationId);
  }

  /** Requests a fresh inverse operation from one committed undo descriptor. */
  undo(operationId: KanbanOperationId): Promise<KanbanRequestResult> {
    return this.#authority.undo(operationId);
  }

  /** Delegates absolute terminal-cell scrolling to the board's single viewport. */
  scrollTo(target: KanbanScrollTarget): void {
    this.#cancelPendingNavigationForScroll();
    this.viewport.scrollTo(target);
  }

  /** Delegates relative terminal-cell scrolling to the board's single viewport. */
  scrollBy(delta: KanbanScrollTarget): void {
    this.#cancelPendingNavigationForScroll();
    this.viewport.scrollBy(delta);
  }

  /** Delegates bounded semantic reveal to the board's single viewport and source session. */
  revealCard(
    key: CardKey,
    alignment?: KanbanRevealAlignment,
    options?: { readonly signal?: AbortSignal },
  ): Promise<KanbanRevealResult> {
    return this.viewport.revealCard(key, alignment, options);
  }

  /** Disposes board-only bindings and its single viewport idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    quiesceKanbanViewportInput(this.viewport);
    setKanbanViewportInteractionEvidenceListener(this.viewport, undefined);
    disposeKanbanViewportOperations(this.viewport);
    this.#authority.dispose();
    this.#interactionFacade.dispose();
    this.#disposeInteractionChrome?.();
    this.#disposeInteractionChrome = undefined;
    this.#disposeBindings?.();
    this.#disposeBindings = undefined;
    this.viewport.dispose();
  }

  /** Mounts this board only while its single owned-resource lifecycle remains available. */
  override mount(...parameters: Parameters<Group['mount']>): void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    super.mount(...parameters);
  }

  /** Unmounts board-owned authority before descendant scopes tear down the viewport. */
  override unmount(): void {
    const wasMounted = this.mounted;
    this.dispose();
    super.unmount();
    if (wasMounted && this.#disposed) this.#releasedLifecycle = true;
  }

  /** Resolves current localized navigator content without retaining a service replacement. */
  #navigatorState(): KanbanNavigatorState | undefined {
    const navigator = this.viewport.focusedNavigator();
    return navigator === undefined ? undefined : Object.freeze({ i18n: this.#i18n(), navigator });
  }

  /** Resolves safe transient feedback content for the shared conditional chrome row. */
  #feedbackState(): KanbanBoardFeedbackState | undefined {
    return createKanbanBoardFeedbackState(this.#interactionFacade.snapshot(), this.#i18n());
  }

  /** Reconciles feedback precedence over focused-column navigation without reserving another row. */
  #syncInteractionChrome(): void {
    this.#feedback.invalidate();
    const feedbackVisible = this.#feedbackState() !== undefined;
    const feedbackChanged = feedbackVisible !== this.#feedbackVisible.peek();
    if (feedbackChanged) this.#feedbackVisible.set(feedbackVisible);
    const navigatorVisible =
      this.viewport.metrics().mode === 'focused-column' && !this.#minimumReserveVisible.peek() && !feedbackVisible;
    const navigatorChanged = navigatorVisible !== this.#navigatorVisible.peek();
    if (navigatorChanged) this.#navigatorVisible.set(navigatorVisible);
    if (feedbackChanged || navigatorChanged) {
      this.#layoutReflows += 1;
      this.invalidateLayout();
    }
  }

  /** Reconciles the latest source deletion facts at the board's public state boundary. */
  #reconcileIdentityChanges(): void {
    if (this.#bindings.reconcileIdentityChanges(this.viewport.identityChanges())) this.#layoutReflows += 1;
  }

  /** Schedules one classified reconciliation whenever authoritative or visible evidence changes. */
  #reconcileInteraction(identityChanges: KanbanIdentityChangeBatch | undefined): void {
    const revisions = this.viewport.interactionRevisions();
    const structureRevision = this.viewport.interactionStructureRevision();
    const metrics = this.viewport.metrics();
    const geometryRevision = JSON.stringify([metrics.assignedRect.width, metrics.assignedRect.height, metrics.mode]);
    const deletionFingerprint =
      identityChanges === undefined
        ? 'none'
        : JSON.stringify([
            identityChanges.changes.map((change) =>
              change.kind === 'deleted-card'
                ? [change.kind, typeof change.cardKey, change.cardKey]
                : change.kind === 'deleted-column'
                  ? [change.kind, change.columnId]
                  : [change.kind, change.swimlaneId],
            ),
          ]);
    const current = Object.freeze({
      revisions,
      queryFiltered: this.viewport.interactionQueryFiltered(),
      structureRevision,
      geometryRevision,
      deletionFingerprint,
      ...(identityChanges === undefined ? {} : { identityRevision: identityChanges.revision }),
    });
    const previous = this.#interactionReconcileEvidence;
    if (!this.#automaticReconcileReady) {
      this.#interactionReconcileEvidence = current;
      return;
    }
    if (previous === undefined) {
      this.#interactionReconcileEvidence = current;
      return;
    }

    const queryChanged = previous.revisions.queryGeneration !== revisions.queryGeneration;
    const structureChanged = revisionKey(previous.structureRevision) !== revisionKey(structureRevision);
    const sourceChanged =
      revisionKey(previous.revisions.sessionRevision) !== revisionKey(revisions.sessionRevision) ||
      revisionKey(previous.identityRevision) !== revisionKey(current.identityRevision);
    const geometryChanged = revisionKey(previous.geometryRevision) !== revisionKey(geometryRevision);
    const deletionsChanged = previous.deletionFingerprint !== deletionFingerprint;
    if (this.#interactionFacade.snapshot().pendingNavigation !== undefined) return;
    this.#interactionReconcileEvidence = current;
    if (!queryChanged && !structureChanged && !sourceChanged && !geometryChanged && !deletionsChanged) return;
    if (queryChanged && previous.queryFiltered && !current.queryFiltered && !structureChanged && !deletionsChanged) {
      return;
    }
    const changes = deletionsChanged ? (identityChanges?.changes ?? []) : [];
    const deletedCardKeys = changes.flatMap((change) => (change.kind === 'deleted-card' ? [change.cardKey] : []));
    const deletedColumnIds = changes.flatMap((change) => (change.kind === 'deleted-column' ? [change.columnId] : []));
    const deletedSwimlaneIds = changes.flatMap((change) =>
      change.kind === 'deleted-swimlane' ? [change.swimlaneId] : [],
    );
    const reason = queryChanged
      ? 'query'
      : structureChanged
        ? 'visibility'
        : deletionsChanged
          ? 'deletion'
          : sourceChanged
            ? 'source-publication'
            : 'geometry';
    const command = Object.freeze({
      kind: 'reconcile' as const,
      reason,
      ...(deletedCardKeys.length === 0 ? {} : { deletedCardKeys }),
      ...(deletedColumnIds.length === 0 ? {} : { deletedColumnIds }),
      ...(deletedSwimlaneIds.length === 0 ? {} : { deletedSwimlaneIds }),
    });
    const reconciliationGeneration = ++this.#interactionReconcileGeneration;
    void Promise.resolve().then(async () => {
      if (this.#disposed || this.#interactionReconcileGeneration !== reconciliationGeneration) return;
      await this.#interactionFacade.transition(command);
    });
  }

  /** Lets explicit application scrolling supersede automatic reveal without changing selection. */
  #cancelPendingNavigationForScroll(): void {
    void this.#interactionFacade.transition({
      kind: 'escape',
      transient: { kind: 'synthetic', cancel: () => undefined },
    });
  }

  /** Attaches one controller only after the viewport has acquired its source/session resources. */
  #setupInteraction(limits: KanbanBoardOptions<TCard>['limits']): void {
    try {
      const environment = this.#interactionEnvironment();
      const controller =
        this.#interactionFactory === undefined
          ? this.#hasLegacyIdentity
            ? createSeededKanbanInteractionController(
                environment,
                validateKanbanLimitOptions(limits).selectedKeys,
                createKanbanDefaultInteractionSeed(this.#bindings.seed()),
              )
            : createKanbanInteractionController(environment, validateKanbanLimitOptions(limits).selectedKeys)
          : this.#interactionFactory(environment);
      this.#interactionFacade.attach(controller);
      this.#interactionReconcileEvidence = undefined;
      this.#reconcileInteraction(this.viewport.identityChanges());
      activateKanbanViewportBoardInput(this.viewport);
      if (this.#interactionFactory !== undefined) {
        void Promise.resolve().then(() => {
          if (!this.#disposed) this.#automaticReconcileReady = true;
        });
      }
    } catch {
      this.#interactionFacade.failSetup();
      this.dispose();
    }
  }

  /** Creates the exact bounded service object supplied to one mount-owned controller factory. */
  #interactionEnvironment(): KanbanInteractionEnvironment {
    return Object.freeze({
      scene: () => this.viewport.interactionScene(),
      revisions: () => this.viewport.interactionRevisions(),
      reveal: (target: KanbanFocusTarget, options?: { readonly signal?: AbortSignal }) =>
        this.viewport.revealInteractionTarget(snapshotKanbanFocusTarget(target), options),
      acquire: (request: KanbanInteractionAcquisitionRequest, options?: { readonly signal?: AbortSignal }) =>
        this.#acquireInteractionTarget(request, options),
      feedback: (code: KanbanInteractionFeedbackCode, count?: number) => this.#interactionFeedback(code, count),
      invalidate: () => this.viewport.invalidate(),
    });
  }

  /** Validates one acquisition request before delegating bounded viewport work. */
  #acquireInteractionTarget(
    request: KanbanInteractionAcquisitionRequest,
    options?: { readonly signal?: AbortSignal },
  ): Promise<KanbanInteractionAcquisitionResult> | KanbanInteractionAcquisitionResult {
    if (request.kind !== 'reveal' && request.kind !== 'acquire') {
      return Object.freeze({ kind: 'unavailable', retry: 'unavailable' });
    }
    return this.viewport.revealInteractionTarget(snapshotKanbanFocusTarget(request.target), options);
  }

  /** Creates bounded payload-free feedback from the complete typed locale vocabulary. */
  #interactionFeedback(code: KanbanInteractionFeedbackCode, count?: number): KanbanInteractionFeedback {
    const safeCount = count !== undefined && Number.isSafeInteger(count) && count >= 0 ? count : undefined;
    const label = this.#i18n().t(INTERACTION_FEEDBACK_MESSAGE_KEYS[code]);
    return Object.freeze({ code, label, ...(safeCount === undefined ? {} : { count: safeCount }) });
  }

  /** Projects controller state into the legacy viewport identity carrier during migration. */
  #interactionIdentity(): KanbanIdentityInput {
    const snapshot = this.#interactionFacade.snapshot();
    if (snapshot.revision === 0) return this.#bindings.identity();
    const pendingColumnId =
      snapshot.pendingNavigation?.kind === 'reveal' && snapshot.pendingNavigation.target.kind === 'column-header'
        ? snapshot.pendingNavigation.target.columnId
        : undefined;
    return Object.freeze({
      selectedCardKeys: snapshot.selectedCardKeys,
      ...(snapshot.focused.kind === 'card'
        ? {
            focusedCardKey: snapshot.focused.cardKey,
            focusedColumnId: pendingColumnId ?? snapshot.focused.address.columnId,
          }
        : snapshot.focused.kind === 'column-header'
          ? { focusedColumnId: pendingColumnId ?? snapshot.focused.columnId }
          : pendingColumnId === undefined
            ? {}
            : { focusedColumnId: pendingColumnId }),
    });
  }

  /** Captures ordered eligible selection with exact current card and query revisions. */
  #snapshotEligibleSelection(): KanbanSelectionSnapshot {
    const snapshot: KanbanInteractionSnapshot = this.#interactionFacade.snapshot();
    const selectedKeys = new Set(snapshot.selectedCardKeys.map((key) => JSON.stringify([typeof key, key])));
    const entries = Object.freeze(
      this.viewport
        .interactionEligibleSelection()
        .filter((entry) => selectedKeys.has(JSON.stringify([typeof entry.cardKey, entry.cardKey]))),
    );
    const revisions = this.viewport.interactionRevisions();
    return Object.freeze({
      entries,
      sessionRevision: revisions.sessionRevision,
      queryGeneration: revisions.queryGeneration,
      ...(revisions.viewRevision === undefined ? {} : { viewRevision: revisions.viewRevision }),
    });
  }
}
