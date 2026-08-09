import type { I18n } from '@jsvision/i18n';
import { Group, Show, createRoot, effect, fixed, grow, runWithOwner, signal, spacer } from '@jsvision/ui';
import type { Rect } from '@jsvision/ui';

import type {
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
  KanbanRequest,
  KanbanRequestDispatcher,
  KanbanRequestResult,
} from '../contract/request.js';
import type { CardKey } from '../contract/identity.js';
import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { validateKanbanLimitOptions } from '../contract/limits.js';
import { createEnglishKanbanI18n } from '../i18n/catalog.js';
import {
  createKanbanInteractionController,
  createSeededKanbanInteractionController,
} from '../interaction/controller.js';
import type { KanbanInteractionControllerFactory, KanbanInteractionFacade } from '../interaction/facade.js';
import { KanbanInteractionFacadeOwner } from '../interaction/facade.js';
import { snapshotKanbanFocusTarget } from '../interaction/reconciliation.js';
import type {
  KanbanFocusTarget,
  KanbanInteractionAcquisitionRequest,
  KanbanInteractionAcquisitionResult,
  KanbanInteractionEnvironment,
  KanbanInteractionFeedback,
  KanbanInteractionFeedbackCode,
  KanbanInteractionSnapshot,
  KanbanSelectionSnapshot,
} from '../interaction/types.js';
import type { KanbanSourceState } from '../source/states.js';
import { KanbanBoardBindings, KanbanFocusedNavigatorView } from './board-bindings.js';
import { KanbanBoardFeedbackView, createKanbanBoardFeedbackState } from './board-feedback.js';
import type { KanbanBoardFeedbackState } from './board-feedback.js';
import { createKanbanDefaultInteractionSeed } from './board-state.js';
import { KanbanBoardAuthority } from './board-authority.js';
import type { KanbanNavigatorState } from './board-bindings.js';
import { KanbanViewport } from './kanban-viewport.js';
import type { KanbanIdentityInput, KanbanViewportOptions } from './kanban-viewport.js';
import type { KanbanViewportInspection } from './viewport-inspection.js';
import type { KanbanRevealAlignment, KanbanRevealResult, KanbanScrollTarget } from './viewport-scroll.js';
import { setViewportHostChromeRows } from './viewport-host-chrome.js';

/** Construction options for the responsive board shell and application authority seam. */
export interface KanbanBoardOptions<TCard> extends KanbanViewportOptions<TCard> {
  /** Optional application-owned request dispatcher; read projection never depends on it. */
  readonly dispatcher?: KanbanRequestDispatcher;
  /** Optional mount factory replacing the package default interaction controller. */
  readonly interactionFactory?: KanbanInteractionControllerFactory;
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
  interaction?: () => KanbanInteractionSnapshot,
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
  #disposed = false;

  /** Builds direct conditional navigator + growing viewport composition without opening a session. */
  constructor(options: KanbanBoardOptions<TCard>) {
    super();
    if (options.identity !== undefined && options.interactionFactory !== undefined) {
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
    this.#authority = new KanbanBoardAuthority(options.dispatcher, options.capabilities);
    this.#interactionFactory = options.interactionFactory;
    this.#hasLegacyIdentity = options.identity !== undefined;
    this.#interactionFacade = new KanbanInteractionFacadeOwner({
      snapshotEligibleSelection: () => this.#snapshotEligibleSelection(),
      invalidate: () => this.viewport.invalidate(),
      ...(options.observe === undefined ? {} : { observe: options.observe }),
    });
    this.viewport = new KanbanViewport(
      viewportOptions(
        options,
        this.#i18n,
        () => this.#interactionIdentity(),
        () => this.#interactionFacade.snapshot(),
      ),
    );
    setViewportHostChromeRows(this.viewport, 1);
    this.#navigator = new KanbanFocusedNavigatorView(() => this.#navigatorState());
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
      this.#disposeInteractionChrome = this.#interactionFacade.subscribe(() => this.#syncInteractionChrome());
      this.#disposeBindings = runWithOwner(this.viewport.scope, () =>
        createRoot((dispose) => {
          effect(() => {
            const snapshot = this.#bindings.read(this.viewport);
            const layoutChanged = this.#bindings.apply(snapshot);
            const identityChanged = this.#bindings.reconcileIdentityChanges(this.viewport.identityChanges());
            if (identityChanged) void this.#interactionFacade.transition({ kind: 'reconcile', reason: 'deletion' });
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
      this.viewport.onCleanup(() => {
        this.#interactionFacade.dispose();
        this.#disposeInteractionChrome?.();
        this.#disposeInteractionChrome = undefined;
        this.#disposeBindings?.();
        this.#disposeBindings = undefined;
        this.#authority.dispose();
      });
    });
  }

  /** Rejects remount after the board's terminal owned-resource lifecycle has been released. */
  override runPendingMounts(): void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
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
        this.viewport.focusedNavigator() === undefined ? 4 : 5,
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

  /** Dispatches one raw application-owned request without applying optimistic record changes. */
  request(request: KanbanRequest): Promise<KanbanRequestResult> {
    return this.#authority.request(request);
  }

  /** Clears pending metadata when matching or contradictory authoritative data is published. */
  reconcilePublication(notice: KanbanPublicationNotice): void {
    this.#authority.reconcilePublication(notice);
  }

  /** Delegates absolute terminal-cell scrolling to the board's single viewport. */
  scrollTo(target: KanbanScrollTarget): void {
    this.viewport.scrollTo(target);
  }

  /** Delegates relative terminal-cell scrolling to the board's single viewport. */
  scrollBy(delta: KanbanScrollTarget): void {
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
    this.#interactionFacade.dispose();
    this.#disposeInteractionChrome?.();
    this.#disposeInteractionChrome = undefined;
    this.#disposeBindings?.();
    this.#disposeBindings = undefined;
    this.#authority.dispose();
    this.viewport.dispose();
  }

  /** Mounts this board only while its single owned-resource lifecycle remains available. */
  override mount(...parameters: Parameters<Group['mount']>): void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    super.mount(...parameters);
  }

  /** Unmounts board-owned authority before descendant scopes tear down the viewport. */
  override unmount(): void {
    this.dispose();
    super.unmount();
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
    } catch {
      this.#interactionFacade.failSetup();
      this.#disposeBindings?.();
      this.#disposeBindings = undefined;
      this.#authority.dispose();
      this.viewport.dispose();
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

  /** Creates bounded payload-free feedback pending dedicated locale vocabulary. */
  #interactionFeedback(code: KanbanInteractionFeedbackCode, count?: number): KanbanInteractionFeedback {
    const safeCount = count !== undefined && Number.isSafeInteger(count) && count >= 0 ? count : undefined;
    const label =
      code === 'navigation-error' || code === 'navigation-unavailable'
        ? this.#i18n().t('kanban.reason.source-unavailable')
        : code.replaceAll('-', ' ');
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
    const eligible = new Map(
      this.viewport
        .interactionEligibleSelection()
        .map((entry) => [JSON.stringify([typeof entry.cardKey, entry.cardKey]), entry]),
    );
    const entries = Object.freeze(
      snapshot.selectedCardKeys.flatMap((key) => {
        const entry = eligible.get(JSON.stringify([typeof key, key]));
        return entry === undefined ? [] : [entry];
      }),
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
