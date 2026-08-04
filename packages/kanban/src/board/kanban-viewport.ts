import { classicTheme } from '@jsvision/core';
import type { I18n } from '@jsvision/i18n';
import { View } from '@jsvision/ui';
import type { DispatchEvent, DrawContext } from '@jsvision/ui';

import type { KanbanCardAdapter } from '../card/adapter.js';
import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanTheme } from '../card/theme.js';
import { createKanbanTheme } from '../card/theme-resolver.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import { KanbanDisposedResourceError } from '../contract/error.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanLimitOptions } from '../contract/limits.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { KanbanDamageRegion } from '../layout/hit-map.js';
import type { KanbanViewportMetrics, KanbanViewportPoint } from '../layout/metrics.js';
import { createEnglishKanbanI18n } from '../i18n/catalog.js';
import type { KanbanDataSource, KanbanQuery } from '../source/types.js';
import { KanbanDescriptorCache } from './descriptor-cache.js';
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
 * The viewport opens its source only after mount and releases it on unmount. It does not create host
 * windows, dialogs, shadows, or application mutations.
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
  readonly #defaultI18n = createEnglishKanbanI18n();
  readonly #defaultTheme = createKanbanTheme(classicTheme);
  #requestedOffsets: KanbanViewportPoint = Object.freeze({ x: 0, y: 0 });
  #locatedVerticalExtent = 0;
  #revealController: AbortController | undefined;
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
      });
      this.bind(
        () => {
          const query = options.query();
          const collapsedColumnIds = options.collapsedColumnIds?.();
          const identity = options.identity?.();
          this.#source?.replaceQuery(query);
          return this.#refresh(collapsedColumnIds, identity?.focusedColumnId);
        },
        (snapshot) => {
          this.#snapshot = snapshot;
          this.#updateMetrics(snapshot);
        },
      );
      this.onCleanup(() => this.dispose());
    });
  }

  /** Refreshes bounded source acquisition; visual descriptor drawing is added by the render task. */
  override draw(ctx: DrawContext): void {
    if (this.#source === undefined || this.#disposed) return;
    const snapshot = this.#refresh(this.#options.collapsedColumnIds?.(), this.#options.identity?.().focusedColumnId);
    this.#snapshot = snapshot;
    this.#updateMetrics(snapshot);
    if (snapshot === undefined) return;
    const theme = this.#options.theme?.() ?? this.#defaultTheme;
    const projection = projectKanbanViewport({
      source: snapshot,
      width: this.bounds.width,
      height: this.bounds.height,
      horizontalOffset: this.#metrics.offsets.x,
      verticalOffset: this.#metrics.offsets.y,
      card: this.#options.card,
      density: this.#options.density?.() ?? 'comfortable',
      theme,
      i18n: this.#options.i18n?.() ?? this.#defaultI18n,
      capabilities: ctx.caps,
      cache: this.#descriptorCache,
      ...(this.#options.identity === undefined ? {} : { identity: this.#options.identity() }),
      ...(this.#options.observe === undefined ? {} : { observe: this.#options.observe }),
    });
    this.#damage = calculateKanbanViewportDamage({
      ...(this.#projection === undefined ? {} : { previous: this.#projection }),
      current: projection,
      bounds: { x: 0, y: 0, width: this.bounds.width, height: this.bounds.height },
      previousOffsets: this.#projectionOffsets,
      currentOffsets: this.#metrics.offsets,
    });
    this.#projection = projection;
    this.#projectionOffsets = this.#metrics.offsets;
    drawKanbanViewport(ctx, projection, theme);
    this.#updateMetrics(snapshot, projection);
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

  /** Scrolls to an absolute partial terminal-cell target and clamps both axes to live extents. */
  scrollTo(target: KanbanScrollTarget): void {
    this.#requestedOffsets = resolveKanbanScrollTo(this.#requestedOffsets, this.#metrics.extents, target);
    this.#metrics = Object.freeze({ ...this.#metrics, offsets: this.#requestedOffsets });
    this.invalidate();
  }

  /** Scrolls by a signed partial terminal-cell delta and clamps both axes to live extents. */
  scrollBy(delta: KanbanScrollTarget): void {
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
    this.#revealController?.abort();
    const controller = new AbortController();
    this.#revealController = controller;
    const abort = (): void => controller.abort();
    if (options?.signal?.aborted === true) controller.abort();
    else options?.signal?.addEventListener('abort', abort, { once: true });
    try {
      const before = this.#requestedOffsets;
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
        this.#locatedVerticalExtent = Math.max(this.#locatedVerticalExtent, alignedY);
        this.#metrics = Object.freeze({
          ...this.#metrics,
          extents: Object.freeze({
            x: this.#metrics.extents.x,
            y: Math.max(this.#metrics.extents.y, this.#locatedVerticalExtent),
          }),
        });
        let columnX = 0;
        const widths = this.#snapshot?.widths;
        if (widths !== undefined && widths.mode === 'multi-column') {
          for (const column of widths.columns) {
            if (column.columnId === location.address.columnId) break;
            columnX += column.width + widths.separatorWidth;
          }
        }
        this.scrollTo({ x: columnX, y: alignedY });
      }
      return Object.freeze({
        location,
        scrolled: before.x !== this.#requestedOffsets.x || before.y !== this.#requestedOffsets.y,
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
    this.#descriptorCache.dispose();
    this.#source?.dispose();
    this.#source = undefined;
    this.#snapshot = undefined;
    this.#projection = undefined;
    this.#damage = Object.freeze([]);
  }

  /** Performs one bounded refresh using current assigned geometry. */
  #refresh(collapsedColumnIds: readonly string[] | undefined, focusedColumnId: string | undefined) {
    return this.#source?.refresh({
      width: this.bounds.width,
      height: this.bounds.height,
      horizontalOffset: this.#requestedOffsets.x,
      verticalOffset: this.#requestedOffsets.y,
      ...(collapsedColumnIds === undefined ? {} : { collapsedColumnIds }),
      ...(focusedColumnId === undefined ? {} : { focusedColumnId }),
    });
  }

  /** Publishes a detached metric snapshot without leaking coordinator or cursor references. */
  #updateMetrics(
    snapshot: KanbanViewportSourceSnapshot<TCard> | undefined,
    projection?: KanbanViewportProjection,
  ): void {
    if (snapshot === undefined) return;
    this.#metrics = createKanbanViewportMetrics({
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
    this.#requestedOffsets = this.#metrics.offsets;
  }
}
