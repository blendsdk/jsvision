import { classicTheme } from '@jsvision/core';
import type { I18n } from '@jsvision/i18n';
import { View, signal } from '@jsvision/ui';
import type { DispatchEvent, DrawContext, Signal, Size2D } from '@jsvision/ui';

import type { KanbanCardAdapter } from '../card/adapter.js';
import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanTheme } from '../card/theme.js';
import { createKanbanTheme } from '../card/theme-resolver.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import { KanbanDisposedResourceError } from '../contract/error.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanLimitOptions } from '../contract/limits.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanDamageRegion } from '../layout/hit-map.js';
import type { KanbanViewportMetrics, KanbanViewportPoint } from '../layout/metrics.js';
import type { KanbanFocusedColumnNavigator } from '../layout/width-solver.js';
import { createEnglishKanbanI18n } from '../i18n/catalog.js';
import type { KanbanSourceState } from '../source/states.js';
import type { KanbanDataSource, KanbanIdentityChangeBatch, KanbanQuery } from '../source/types.js';
import { KanbanDescriptorCache } from './descriptor-cache.js';
import { readKanbanIdentityInput } from './board-state.js';
import { calculateKanbanViewportDamage } from './viewport-damage.js';
import { createKanbanViewportInspection } from './viewport-inspection.js';
import type { KanbanViewportInspection } from './viewport-inspection.js';
import { createKanbanViewportMetrics } from './viewport-metrics.js';
import { projectKanbanViewport } from './viewport-projector.js';
import type { KanbanViewportProjection } from './viewport-projector.js';
import { drawKanbanViewport } from './viewport-render.js';
import {
  resolveKanbanScrollBy,
  resolveKanbanScrollTo,
  snapshotKanbanRevealAlignment,
  snapshotKanbanRevealKey,
} from './viewport-scroll.js';
import type { KanbanRevealAlignment, KanbanRevealResult, KanbanScrollTarget } from './viewport-scroll.js';
import { KanbanViewportSource } from './viewport-source.js';
import type { KanbanOverscanOptions, KanbanViewportSourceSnapshot } from './viewport-source.js';

/** Hard viewport-local descriptor ceiling independent of logical source length. */
const KANBAN_VIEWPORT_DESCRIPTOR_LIMIT = 256;

/** Package-internal host chrome rows included only in localized minimum-host guidance. */
const KANBAN_VIEWPORT_HOST_CHROME_ROWS = new WeakMap<View, number>();

/**
 * Records package-owned host chrome without expanding the public viewport construction contract.
 *
 * @internal
 * @example
 * ```ts
 * setKanbanViewportHostChromeRows(viewport, 1);
 * ```
 */
export function setKanbanViewportHostChromeRows(viewport: View, rows: number): void {
  KANBAN_VIEWPORT_HOST_CHROME_ROWS.set(viewport, rows);
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

/** Construction options shared by standalone viewports and the board shell. */
export interface KanbanViewportOptions<TCard> {
  /** Application-owned sparse or eager source. */
  readonly source: KanbanDataSource<TCard>;
  /** Reactive semantic query getter. */
  readonly query: () => KanbanQuery;
  /** Generic application-record adapter. */
  readonly card: KanbanCardAdapter<TCard>;
  /** Optional reactive localization service getter. */
  readonly i18n?: () => I18n;
  /** Optional reactive card-density getter. */
  readonly density?: () => KanbanCardDensity;
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
  /** Optional reactive application-owned identity hints. */
  readonly identity?: () => KanbanIdentityInput;
  /** Optional reactive column-collapse projection applied before cursor acquisition. */
  readonly collapsedColumnIds?: () => readonly string[];
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

/**
 * Exact-cell read-only Kanban projection that owns one query/session/cursor coordinator.
 *
 * The viewport opens its source only after mount and releases it on unmount. The instance owns one
 * terminal mount lifecycle; create a new viewport after unmount instead of remounting disposed
 * resources. It does not create host windows, dialogs, shadows, or application mutations.
 */
export class KanbanViewport<TCard> extends View {
  readonly #options: KanbanViewportOptions<TCard>;
  #source: KanbanViewportSource<TCard> | undefined;
  #snapshot: KanbanViewportSourceSnapshot<TCard> | undefined;
  #projection: KanbanViewportProjection | undefined;
  #projectionOffsets: KanbanViewportPoint = Object.freeze({ x: 0, y: 0 });
  #damage: readonly KanbanDamageRegion[] = Object.freeze([]);
  #metrics: KanbanViewportMetrics = emptyMetrics();
  readonly #descriptorCache = new KanbanDescriptorCache(KANBAN_VIEWPORT_DESCRIPTOR_LIMIT);
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
  #verticalAnchor: { readonly cardKey: CardKey; readonly index: number; readonly relativeRow: number } | undefined;
  #horizontalAnchorOffset = 0;
  #anchorSourceRevision: KanbanRevision | undefined;
  #anchorSourceGeneration: number | undefined;
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
  #disposed = false;

  /** Stores configuration without opening application resources before mount. */
  constructor(options: KanbanViewportOptions<TCard>) {
    super();
    this.#options = options;
    this.focusable = true;
    this.onMount(() => {
      if (this.#disposed) return;
      this.#source = new KanbanViewportSource({
        source: options.source,
        query: options.query(),
        card: options.card,
        limits: options.limits,
        overscan: options.overscan,
        observe: options.observe,
        invalidate: () => this.invalidate(),
        beforeCursorDispose: (address) => {
          if (!this.#descriptorCacheDisposed) this.#descriptorCache.invalidate({ address });
        },
      });
      this.bind(
        () => {
          const query = options.query();
          const collapsedColumnIds = options.collapsedColumnIds?.();
          const identity = readKanbanIdentityInput(options.identity);
          const density = options.density?.() ?? 'comfortable';
          void options.i18n?.();
          void options.theme?.();
          void options.capabilities?.();
          this.#source?.replaceQuery(query);
          return this.#refresh(collapsedColumnIds, identity.focusedColumnId, density);
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

  /** Rejects remount after the viewport's terminal owned-resource lifecycle has been released. */
  override runPendingMounts(): void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    super.runPendingMounts();
  }

  /** Refreshes bounded source acquisition; visual descriptor drawing is added by the render task. */
  override draw(ctx: DrawContext): void {
    if (this.#source === undefined || this.#disposed) return;
    const identity = readKanbanIdentityInput(this.#options.identity);
    const density = this.#options.density?.() ?? 'comfortable';
    const theme = this.#options.theme?.() ?? this.#defaultTheme;
    const i18n = this.#options.i18n?.() ?? this.#defaultI18n;
    const layoutChanged = this.#restoreVerticalAnchor(density, i18n, theme, ctx.caps);
    const collapsedColumnIds = this.#options.collapsedColumnIds?.();
    let snapshot = this.#refreshClamped(collapsedColumnIds, identity.focusedColumnId, density);
    this.#snapshot = snapshot;
    if (snapshot === undefined) return;
    const sourceChanged =
      this.#anchorSourceRevision !== undefined &&
      (this.#anchorSourceRevision !== snapshot.publication.revision ||
        this.#anchorSourceGeneration !== snapshot.generation);
    const shouldRestoreIdentity = layoutChanged || sourceChanged;
    if (shouldRestoreIdentity && this.#restoreHorizontalAnchor(snapshot)) {
      snapshot = this.#refreshClamped(collapsedColumnIds, identity.focusedColumnId, density) ?? snapshot;
      this.#snapshot = snapshot;
    }
    const project = (source: KanbanViewportSourceSnapshot<TCard>): KanbanViewportProjection =>
      projectKanbanViewport({
        source,
        width: this.bounds.width,
        height: this.bounds.height,
        horizontalOffset: this.#metrics.offsets.x,
        verticalOffset: this.#metrics.offsets.y,
        card: this.#options.card,
        density,
        theme,
        i18n,
        capabilities: ctx.caps,
        minimumRequiredHeight: 4 + (KANBAN_VIEWPORT_HOST_CHROME_ROWS.get(this) ?? 0),
        cache: this.#descriptorCache,
        identity,
        ...(this.#options.observe === undefined ? {} : { observe: this.#options.observe }),
      });
    let projection = project(snapshot);
    if (shouldRestoreIdentity && this.#restoreVerticalIdentity(projection, density)) {
      snapshot = this.#refreshClamped(collapsedColumnIds, identity.focusedColumnId, density) ?? snapshot;
      this.#snapshot = snapshot;
      projection = project(snapshot);
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
    this.#damage = calculateKanbanViewportDamage({
      ...(this.#projection === undefined ? {} : { previous: this.#projection }),
      current: projection,
      bounds: { x: 0, y: 0, width: this.bounds.width, height: this.bounds.height },
      previousOffsets: this.#projectionOffsets,
      currentOffsets: this.#metrics.offsets,
    });
    this.#projection = projection;
    this.#projectionOffsets = this.#metrics.offsets;
    this.#anchorSourceRevision = snapshot.publication.revision;
    this.#anchorSourceGeneration = snapshot.generation;
    if (!relocatingAnchor) this.#rememberVerticalAnchor(projection, identity, density);
    this.#rememberHorizontalAnchor(snapshot);
    drawKanbanViewport(ctx, projection, theme);
    this.#updateMetrics(snapshot, projection);
  }

  /** Reports the exact parent-assigned space consumed by this exact-cell projection leaf. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  /** Maps independent terminal wheel directions to bounded three-cell scrolling. */
  override onEvent(event: DispatchEvent): void {
    if (event.event.type !== 'wheel') return;
    const direction = event.event.dir;
    this.scrollBy(
      direction === 'up' ? { y: -3 } : direction === 'down' ? { y: 3 } : direction === 'left' ? { x: -3 } : { x: 3 },
    );
    event.handled = true;
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
      this.#refresh(this.#options.collapsedColumnIds?.(), identity.focusedColumnId, density)?.publication
        .identityChanges ?? this.#snapshot?.publication.identityChanges
    );
  }

  /** Returns current focused-column navigator metadata for the owning DSL shell. */
  focusedNavigator(): KanbanFocusedColumnNavigator | undefined {
    return this.#snapshot?.widths.navigator;
  }

  /** Scrolls to an absolute partial terminal-cell target and clamps both axes to live extents. */
  scrollTo(target: KanbanScrollTarget): void {
    this.#cancelAnchorRelocation();
    this.#requestedOffsets = resolveKanbanScrollTo(this.#requestedOffsets, this.#metrics.extents, target);
    this.#metrics = Object.freeze({ ...this.#metrics, offsets: this.#requestedOffsets });
    this.invalidate();
  }

  /** Scrolls by a signed partial terminal-cell delta and clamps both axes to live extents. */
  scrollBy(delta: KanbanScrollTarget): void {
    this.#cancelAnchorRelocation();
    this.#requestedOffsets = resolveKanbanScrollBy(this.#requestedOffsets, this.#metrics.extents, delta);
    this.#metrics = Object.freeze({ ...this.#metrics, offsets: this.#requestedOffsets });
    this.invalidate();
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
    this.#cancelAnchorRelocation();
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
      if ((location.kind === 'found' || location.kind === 'unloaded') && location.index !== undefined) {
        const stride = (this.#options.density?.() ?? 'comfortable') === 'compact' ? 2 : 3;
        const top = Math.min(Number.MAX_SAFE_INTEGER, location.index * stride);
        const viewportHeight = Math.max(1, this.bounds.height - this.#metrics.stickyRows);
        const alignedY =
          resolvedAlignment === 'start'
            ? top
            : resolvedAlignment === 'center'
              ? Math.max(0, top - Math.floor(viewportHeight / 2))
              : resolvedAlignment === 'end'
                ? Math.max(0, top - viewportHeight + stride)
                : top < before.y
                  ? top
                  : top + stride > before.y + viewportHeight
                    ? Math.max(0, top - viewportHeight + stride)
                    : before.y;
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
    return createKanbanViewportInspection(this.#snapshot, this.#projection, this.#damage);
  }

  /** Releases the complete standalone source lifecycle idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#revealController?.abort();
    this.#revealController = undefined;
    this.#anchorController?.abort();
    this.#anchorController = undefined;
    this.#source?.cancelPendingWork();
    this.#descriptorCache.dispose();
    this.#descriptorCacheDisposed = true;
    this.#source?.dispose();
    this.#source = undefined;
    this.#snapshot = undefined;
    this.#projection = undefined;
    this.#damage = Object.freeze([]);
  }

  /** Performs one bounded refresh using current assigned geometry. */
  #refresh(
    collapsedColumnIds: readonly string[] | undefined,
    focusedColumnId: string | undefined,
    density: KanbanCardDensity,
  ) {
    if (focusedColumnId !== this.#lastApplicationFocusedColumnId) {
      this.#lastApplicationFocusedColumnId = focusedColumnId;
      this.#imperativeFocusedColumnAnchor = undefined;
    }
    const effectiveFocusedColumnId =
      this.#imperativeFocusedColumnAnchor ?? focusedColumnId ?? this.#focusedColumnAnchor;
    return this.#source?.refresh({
      width: this.bounds.width,
      height: this.bounds.height,
      horizontalOffset: this.#requestedOffsets.x,
      verticalOffset: this.#requestedOffsets.y,
      cardStride: density === 'compact' ? 2 : 3,
      ...(collapsedColumnIds === undefined ? {} : { collapsedColumnIds }),
      ...(effectiveFocusedColumnId === undefined ? {} : { focusedColumnId: effectiveFocusedColumnId }),
    });
  }

  /** Reacquires once when live extents clamp offsets used by the first bounded refresh. */
  #refreshClamped(
    collapsedColumnIds: readonly string[] | undefined,
    focusedColumnId: string | undefined,
    density: KanbanCardDensity,
  ): KanbanViewportSourceSnapshot<TCard> | undefined {
    const acquisitionOffsets = this.#requestedOffsets;
    let snapshot = this.#refresh(collapsedColumnIds, focusedColumnId, density);
    this.#updateMetrics(snapshot);
    if (
      snapshot !== undefined &&
      (acquisitionOffsets.x !== this.#requestedOffsets.x || acquisitionOffsets.y !== this.#requestedOffsets.y)
    ) {
      snapshot = this.#refresh(collapsedColumnIds, focusedColumnId, density);
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
      const stride = density === 'compact' ? 2 : 3;
      this.#requestedOffsets = Object.freeze({
        ...this.#requestedOffsets,
        y: Math.max(0, this.#verticalAnchor.index * stride - this.#verticalAnchor.relativeRow),
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
    const stride = density === 'compact' ? 2 : 3;
    const target = Math.max(0, card.index * stride - anchor.relativeRow);
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
          return;
        }
        const stride = density === 'compact' ? 2 : 3;
        const y = Math.max(0, location.index * stride - anchor.relativeRow);
        this.#recordLocatedExtent(y);
        this.#focusedColumnAnchor = location.address.columnId;
        this.#imperativeFocusedColumnAnchor = location.address.columnId;
        this.#horizontalColumnAnchor = location.address.columnId;
        this.#horizontalAnchorOffset = 0;
        this.#requestedOffsets = Object.freeze({ x: this.#columnStart(location.address.columnId), y });
        this.invalidate();
      },
      () => {
        // Cancellation and unsupported locators leave the last bounded projection intact.
      },
    );
    return true;
  }

  /** Cancels an automatic reorder relocation when newer imperative navigation owns the viewport. */
  #cancelAnchorRelocation(): void {
    this.#anchorController?.abort();
    this.#anchorController = undefined;
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
    const stride = density === 'compact' ? 2 : 3;
    this.#verticalAnchor = Object.freeze({
      cardKey: nearest.descriptor.cardKey,
      index: nearest.index,
      relativeRow: nearest.index * stride - this.#requestedOffsets.y,
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
      ...(projection === undefined ? {} : { projection }),
      offsets: this.#requestedOffsets,
      density: this.#options.density?.() ?? 'comfortable',
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
    ]);
    if (fingerprint !== this.#metricsFingerprint) {
      this.#metricsFingerprint = fingerprint;
      this.#metricsVersion.update((version) => (version === Number.MAX_SAFE_INTEGER ? 0 : version + 1));
    }
  }
}
