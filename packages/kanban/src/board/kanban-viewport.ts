import { classicTheme } from '@jsvision/core';
import type { I18n } from '@jsvision/i18n';
import { View } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';

import type { KanbanCardAdapter } from '../card/adapter.js';
import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanTheme } from '../card/theme.js';
import { createKanbanTheme } from '../card/theme-resolver.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanLimitOptions } from '../contract/limits.js';
import type { KanbanObservation } from '../contract/observation.js';
import type {
  KanbanActionTarget,
  KanbanInspectedCard,
  KanbanInspectedCell,
  KanbanInspectedColumn,
} from '../layout/hit-map.js';
import type { KanbanViewportMetrics, KanbanViewportPoint } from '../layout/metrics.js';
import { createEnglishKanbanI18n } from '../i18n/catalog.js';
import type { KanbanDataSource, KanbanQuery } from '../source/types.js';
import { KanbanDescriptorCache } from './descriptor-cache.js';
import { projectKanbanViewport } from './viewport-projector.js';
import type { KanbanViewportProjection } from './viewport-projector.js';
import { drawKanbanViewport } from './viewport-render.js';
import type { KanbanCellState } from '../source/states.js';
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

/** Detached read-only viewport evidence for tests and modeless diagnostics. */
export interface KanbanViewportInspection {
  /** Retained source cells and their safe lifecycle states. */
  readonly cells: readonly KanbanInspectedCell[];
  /** Complete sanitized source columns intersecting the viewport. */
  readonly visibleColumns: readonly KanbanInspectedColumn[];
  /** Resident cards projected in the viewport. */
  readonly visibleCards: readonly KanbanInspectedCard[];
  /** Phase A exposes no actionable pointer targets. */
  readonly actionTargets: readonly KanbanActionTarget[];
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
  #metrics: KanbanViewportMetrics = emptyMetrics();
  readonly #descriptorCache = new KanbanDescriptorCache(KANBAN_VIEWPORT_DESCRIPTOR_LIMIT);
  readonly #defaultI18n = createEnglishKanbanI18n();
  readonly #defaultTheme = createKanbanTheme(classicTheme);
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
    this.#projection = projection;
    drawKanbanViewport(ctx, projection, theme);
  }

  /** Returns an immutable exact-cell metric snapshot from the latest projection. */
  metrics(): KanbanViewportMetrics {
    return this.#metrics;
  }

  /** Returns detached source-state evidence without application records or actionable targets. */
  inspection(): KanbanViewportInspection {
    const snapshot = this.#snapshot;
    if (snapshot === undefined) {
      return Object.freeze({
        cells: Object.freeze([]),
        visibleColumns: Object.freeze([]),
        visibleCards: Object.freeze([]),
        actionTargets: Object.freeze([]),
      });
    }
    return Object.freeze({
      cells: Object.freeze(
        snapshot.cells.map((cell) => {
          const sourceState = cell.cursor.state();
          const loaded = cell.cursor.counts().loaded;
          const state: KanbanCellState =
            sourceState.kind === 'partial' &&
            (cell.cursor.hasRange(cell.range.start, cell.range.end) ||
              (loaded.quality === 'exact' && loaded.value >= cell.range.end - cell.range.start))
              ? Object.freeze({ kind: 'ready' })
              : sourceState;
          return Object.freeze({ address: cell.address, state });
        }),
      ),
      visibleColumns: Object.freeze(
        (this.#projection?.columns ?? snapshot.visibleColumns).map((column) =>
          Object.freeze({ columnId: column.columnId, label: column.label }),
        ),
      ),
      visibleCards: Object.freeze(
        (this.#projection?.cards ?? []).map((card) => {
          const title = card.descriptor.rows
            .filter((row) => row.section === 'title')
            .flatMap((row) => row.spans.map((span) => span.text))
            .join(' ');
          return Object.freeze({
            cardKey: card.descriptor.cardKey,
            columnId: card.columnId,
            title,
            marker: Object.freeze({ cues: card.descriptor.marker.cues }),
          });
        }),
      ),
      actionTargets: this.#projection?.actionTargets ?? Object.freeze([]),
    });
  }

  /** Releases the complete standalone source lifecycle idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#descriptorCache.dispose();
    this.#source?.dispose();
    this.#source = undefined;
    this.#snapshot = undefined;
    this.#projection = undefined;
  }

  /** Performs one bounded refresh using current assigned geometry. */
  #refresh(collapsedColumnIds: readonly string[] | undefined, focusedColumnId: string | undefined) {
    return this.#source?.refresh({
      width: this.bounds.width,
      height: this.bounds.height,
      horizontalOffset: this.#metrics.offsets.x,
      ...(collapsedColumnIds === undefined ? {} : { collapsedColumnIds }),
      ...(focusedColumnId === undefined ? {} : { focusedColumnId }),
    });
  }

  /** Publishes a detached metric snapshot without leaking coordinator or cursor references. */
  #updateMetrics(snapshot: KanbanViewportSourceSnapshot<TCard> | undefined): void {
    if (snapshot === undefined) return;
    const offsets: KanbanViewportPoint = Object.freeze({ x: this.#metrics.offsets.x, y: this.#metrics.offsets.y });
    const extents: KanbanViewportPoint = Object.freeze({
      x: Math.max(0, snapshot.widths.contentWidth - this.bounds.width),
      y: 0,
    });
    this.#metrics = Object.freeze({
      assignedRect: Object.freeze({ ...this.bounds }),
      mode: snapshot.mode,
      offsets,
      extents,
      visibleColumnIds: Object.freeze(snapshot.visibleColumns.map((column) => column.columnId)),
      visibleCardRanges: Object.freeze(snapshot.cells.map((cell) => cell.range)),
      stickyRows: snapshot.visibleColumns.length === 0 ? 0 : 1,
      overscan: Object.freeze({ x: this.#options.overscan?.horizontal ?? 1, y: this.#options.overscan?.vertical ?? 1 }),
      generation: snapshot.generation,
      sourceRevision: snapshot.publication.revision,
    });
  }
}
