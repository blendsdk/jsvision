import type { CapabilityProfile } from '@jsvision/core';
import type { I18n } from '@jsvision/i18n';

import { readKanbanCardAdapter } from '../card/adapter.js';
import type { KanbanCardAdapter } from '../card/adapter.js';
import type { KanbanCardDensity, KanbanCardDescriptor, KanbanCardRenderContext } from '../card/descriptor.js';
import type { KanbanCardFormattingContext } from '../card/formatting.js';
import { renderKanbanCardSafely } from '../card/renderer.js';
import { renderStandardKanbanCard } from '../card/standard-renderer.js';
import type { KanbanTheme } from '../card/theme.js';
import type { KanbanIdentityInput } from './kanban-viewport.js';
import type { KanbanObservation } from '../contract/observation.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanActionTarget, KanbanLayoutRegion } from '../layout/hit-map.js';
import { projectKanbanVerticalGeometry } from '../layout/vertical-projector.js';
import { projectKanbanMinimumGeometry } from '../layout/vertical-projector.js';
import type { KanbanViewportSourceCell, KanbanViewportSourceSnapshot } from './viewport-source.js';
import { KanbanDescriptorCache } from './descriptor-cache.js';
import type { KanbanDescriptorCacheKey } from './descriptor-cache.js';

/** Weak identity revisions keep reactive service/theme replacement cache-safe without retaining them. */
const REFERENCE_REVISIONS = new WeakMap<object, number>();
let nextReferenceRevision = 1;

/** Returns a process-local equality revision for one immutable service or theme object. */
function referenceRevision(value: object): number {
  const current = REFERENCE_REVISIONS.get(value);
  if (current !== undefined) return current;
  const revision = nextReferenceRevision;
  nextReferenceRevision = nextReferenceRevision === Number.MAX_SAFE_INTEGER ? 1 : nextReferenceRevision + 1;
  REFERENCE_REVISIONS.set(value, revision);
  return revision;
}

/** Safe board-level or cell-level state projected into the card content rectangle. */
export interface KanbanProjectedState {
  /** Stable state discriminator. */
  readonly kind: 'loading' | 'refreshing' | 'partial' | 'empty' | 'error' | 'no-columns' | 'minimum-size';
  /** Localized terminal-safe label. */
  readonly label: string;
  /** Optional source cell that owns a scoped state. */
  readonly columnId?: string;
}

/** One clipped visible card descriptor and its semantic source identity. */
export interface KanbanProjectedCard {
  /** Workflow column containing the card. */
  readonly columnId: string;
  /** Logical index in the retained source cursor. */
  readonly index: number;
  /** Validated immutable descriptor. */
  readonly descriptor: KanbanCardDescriptor;
  /** Descriptor columns cropped from the left by horizontal scrolling. */
  readonly descriptorColumnOffset: number;
  /** Descriptor rows cropped from the top by vertical scrolling. */
  readonly descriptorRowOffset: number;
  /** Clipped viewport-local card rectangle. */
  readonly rect: Readonly<{ x: number; y: number; width: number; height: number }>;
}

/** One clipped visible workflow column. */
export interface KanbanProjectedColumn {
  /** Stable source column identity. */
  readonly columnId: string;
  /** Sanitized complete header label. */
  readonly label: string;
  /** Header columns cropped from the left by horizontal scrolling. */
  readonly contentOffset: number;
  /** Clipped viewport-local column rectangle. */
  readonly rect: Readonly<{ x: number; y: number; width: number; height: number }>;
}

/** Immutable descriptor and state projection consumed by drawing and inspection. */
export interface KanbanViewportProjection {
  /** Visible source-ordered columns. */
  readonly columns: readonly KanbanProjectedColumn[];
  /** Visible resident card descriptors. */
  readonly cards: readonly KanbanProjectedCard[];
  /** Clipped inspection-only semantic geometry. */
  readonly regions: readonly KanbanLayoutRegion[];
  /** Phase A has no actionable card, insertion, or card-action targets. */
  readonly actionTargets: readonly KanbanActionTarget[];
  /** Board-wide and scoped source states requiring explicit non-color feedback. */
  readonly states: readonly KanbanProjectedState[];
}

/** Inputs needed for one bounded pure-enough viewport projection pass. */
export interface ProjectKanbanViewportOptions<TCard> {
  /** Current retained source snapshot. */
  readonly source: KanbanViewportSourceSnapshot<TCard>;
  /** Exact viewport width. */
  readonly width: number;
  /** Exact viewport height. */
  readonly height: number;
  /** Current horizontal content offset. */
  readonly horizontalOffset: number;
  /** Current vertical card-content offset. */
  readonly verticalOffset: number;
  /** Generic application-record adapter. */
  readonly card: KanbanCardAdapter<TCard>;
  /** Requested resting gap policy. */
  readonly density: KanbanCardDensity;
  /** Resolved semantic Kanban theme. */
  readonly theme: KanbanTheme;
  /** Current localization service. */
  readonly i18n: I18n;
  /** Current terminal capabilities. */
  readonly capabilities: CapabilityProfile;
  /** Localized minimum host height including package-owned chrome outside this viewport. */
  readonly minimumRequiredHeight?: number;
  /** Optional application-owned identity cues. */
  readonly identity?: KanbanIdentityInput;
  /** Viewport-local descriptor cache. */
  readonly cache: KanbanDescriptorCache;
  /** Optional already-redacted diagnostic sink. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Returns the localized label for one lifecycle state. */
function stateLabel(i18n: I18n, kind: KanbanProjectedState['kind']): string {
  const key =
    kind === 'no-columns'
      ? 'kanban.board.no-columns'
      : kind === 'error'
        ? 'kanban.state.error'
        : `kanban.state.${kind}`;
  return i18n.t(key);
}

/** Creates bounded application formatting backed by the selected I18n service. */
function formatting(i18n: I18n): KanbanCardFormattingContext {
  return Object.freeze({
    locale: i18n.locale,
    formatNumber: (value: number | bigint) => i18n.number(value),
    formatDate: (value: unknown) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) return i18n.date(value);
      if (typeof value === 'number' && Number.isFinite(value)) return i18n.date(value);
      return undefined;
    },
  });
}

/** Returns the descriptor row ceiling owned by one density. */
function rowBudget(density: KanbanCardDensity): number {
  if (density === 'compact') return KANBAN_LIMITS.cardRowsCompact.safe;
  if (density === 'comfortable') return KANBAN_LIMITS.cardRowsComfortable.safe;
  return KANBAN_LIMITS.cardRowsSpacious.safe;
}

/** Computes a stable capability revision without retaining the host profile. */
function capabilityRevision(capabilities: CapabilityProfile): string {
  return JSON.stringify([
    capabilities.colorDepth,
    capabilities.unicode.widthMode,
    capabilities.glyphs.boxDrawing,
    capabilities.glyphs.ambiguousWide,
  ]);
}

/** Converts current host features to the narrower card-render capability contract. */
function cardCapabilities(capabilities: CapabilityProfile): KanbanCardRenderContext['capabilities'] {
  return Object.freeze({
    colorDepth: capabilities.colorDepth,
    widthMode: capabilities.unicode.widthMode,
    boxDrawing: capabilities.glyphs.boxDrawing,
    ambiguousWide: capabilities.glyphs.ambiguousWide,
  });
}

/** Returns the cell retained for one visible workflow column. */
function cellForColumn<TCard>(
  cells: readonly KanbanViewportSourceCell<TCard>[],
  columnId: string,
): KanbanViewportSourceCell<TCard> | undefined {
  return cells.find((cell) => cell.address.columnId === columnId && cell.address.swimlaneId === undefined);
}

/** Projects bounded resident descriptors from one retained cell. */
function projectCellCards<TCard>(
  options: ProjectKanbanViewportOptions<TCard>,
  cell: KanbanViewportSourceCell<TCard>,
  columnWidth: number,
  retainedKeys: KanbanDescriptorCacheKey[],
): readonly { readonly index: number; readonly descriptor: KanbanCardDescriptor }[] {
  const projected: { readonly index: number; readonly descriptor: KanbanCardDescriptor }[] = [];
  const maximum = Math.min(cell.range.end, cell.range.start + KANBAN_LIMITS.ensureRangeCards.safe);
  for (
    let index = cell.range.start;
    index < maximum && retainedKeys.length < KANBAN_LIMITS.ensureRangeCards.safe;
    index += 1
  ) {
    const card = cell.cursor.cardAt(index);
    if (card === undefined) continue;
    let adapterSnapshot;
    try {
      adapterSnapshot = readKanbanCardAdapter(card, options.card);
    } catch {
      continue;
    }
    const focused = adapterSnapshot.cardKey === options.identity?.focusedCardKey;
    const selected = options.identity?.selectedCardKeys?.includes(adapterSnapshot.cardKey) ?? false;
    const context: KanbanCardRenderContext = Object.freeze({
      cardKey: adapterSnapshot.cardKey,
      ...(adapterSnapshot.presentationRevision === undefined
        ? {}
        : { presentationRevision: adapterSnapshot.presentationRevision }),
      width: columnWidth,
      rowBudget: rowBudget(options.density),
      density: options.density,
      focused,
      selected,
      readOnly: false,
      operation: 'idle',
      theme: options.theme,
      capabilities: cardCapabilities(options.capabilities),
      formatting: formatting(options.i18n),
    });
    const key: KanbanDescriptorCacheKey = Object.freeze({
      generation: options.source.generation,
      address: cell.address,
      cursorRevision: cell.cursor.revision(),
      cardKey: adapterSnapshot.cardKey,
      rendererRevision: `standard-v1:${String(referenceRevision(options.i18n))}`,
      ...(adapterSnapshot.presentationRevision === undefined
        ? {}
        : { presentationRevision: adapterSnapshot.presentationRevision }),
      presentationPolicyRevision: 'phase-a-mandatory-only-v1',
      presentationSelectionFingerprint: 'mandatory-only',
      width: columnWidth,
      rowBudget: context.rowBudget,
      density: options.density,
      themeRevision: referenceRevision(options.theme),
      capabilityRevision: capabilityRevision(options.capabilities),
      interactionRevision: JSON.stringify([focused, selected, false, 'idle']),
    });
    const descriptor = options.cache.getOrCreate(key, () =>
      renderKanbanCardSafely(
        card,
        { render: (record, renderContext) => renderStandardKanbanCard(record, options.card, renderContext) },
        context,
        {
          labels: {
            invalidCardTitle: options.i18n.t('kanban.card.invalid-title'),
            unknownStatus: options.i18n.t('kanban.card.unknown-status'),
          },
          observe: options.observe,
        },
      ),
    );
    retainedKeys.push(key);
    projected.push(Object.freeze({ index, descriptor }));
  }
  return Object.freeze(projected);
}

/**
 * Projects only visible resident cards and finite retained descriptors into clipped terminal cells.
 */
export function projectKanbanViewport<TCard>(options: ProjectKanbanViewportOptions<TCard>): KanbanViewportProjection {
  const columns: KanbanProjectedColumn[] = [];
  const cards: KanbanProjectedCard[] = [];
  const regions: KanbanLayoutRegion[] = [];
  const states: KanbanProjectedState[] = [];
  const retainedKeys: KanbanDescriptorCacheKey[] = [];
  if (options.source.mode === 'minimum-size') {
    options.cache.retain([]);
    const minimum = projectKanbanMinimumGeometry({
      bounds: { x: 0, y: 0, width: options.width, height: options.height },
      requiredWidth: 18,
      requiredHeight: options.minimumRequiredHeight ?? 4,
      message: options.i18n.t('kanban.layout.minimum-size', {
        params: { width: 18, height: options.minimumRequiredHeight ?? 4 },
      }),
    });
    return Object.freeze({
      columns: Object.freeze([]),
      cards: Object.freeze([]),
      regions: Object.freeze([]),
      actionTargets: Object.freeze([]),
      states: Object.freeze([Object.freeze({ kind: 'minimum-size', label: minimum.message.text })]),
    });
  }
  if (options.source.visibleColumns.length === 0) {
    options.cache.retain([]);
    return Object.freeze({
      columns: Object.freeze([]),
      cards: Object.freeze([]),
      regions: Object.freeze([]),
      actionTargets: Object.freeze([]),
      states: Object.freeze([Object.freeze({ kind: 'no-columns', label: stateLabel(options.i18n, 'no-columns') })]),
    });
  }

  let logicalX = 0;
  for (const solved of options.source.widths.columns) {
    const sourceColumn = options.source.visibleColumns.find((column) => column.columnId === solved.columnId);
    const rawX = logicalX - options.horizontalOffset;
    logicalX += solved.width + options.source.widths.separatorWidth;
    if (sourceColumn === undefined) continue;
    const clippedX = Math.max(0, rawX);
    const clippedRight = Math.min(options.width, rawX + solved.width);
    if (clippedRight <= clippedX) continue;
    const rect = Object.freeze({ x: clippedX, y: 0, width: clippedRight - clippedX, height: options.height });
    const contentOffset = clippedX - rawX;
    columns.push(Object.freeze({ columnId: sourceColumn.columnId, label: sourceColumn.label, contentOffset, rect }));
    const cell = cellForColumn(options.source.cells, sourceColumn.columnId);
    if (cell === undefined || rect.width < 2 || rect.height === 0) continue;
    const projectedCards = projectCellCards(options, cell, solved.width, retainedKeys);
    const vertical = projectKanbanVerticalGeometry({
      bounds: rect,
      stickyHeaderHeight: 1,
      scrollOffset: options.verticalOffset,
      contentOrigin: cell.range.start * (options.density === 'compact' ? 2 : 3),
      density: options.density,
      cards: projectedCards.map((entry) => ({
        cardKey: entry.descriptor.cardKey,
        height: entry.descriptor.measuredHeight,
      })),
      verticalOverscan: 0,
    });
    regions.push(...vertical.regions);
    for (const entry of projectedCards) {
      const anchor = vertical.anchors.find((candidate) => candidate.cardKey === entry.descriptor.cardKey);
      const cardRegion = vertical.regions.find(
        (region) => region.kind === 'card' && region.cardKey === entry.descriptor.cardKey,
      );
      if (cardRegion === undefined || anchor === undefined) continue;
      cards.push(
        Object.freeze({
          columnId: sourceColumn.columnId,
          index: entry.index,
          descriptor: entry.descriptor,
          descriptorColumnOffset: contentOffset,
          descriptorRowOffset: Math.max(0, vertical.scrollOffset - anchor.logicalRow),
          rect: Object.freeze({
            x: cardRegion.x,
            y: cardRegion.y,
            width: cardRegion.width,
            height: cardRegion.height,
          }),
        }),
      );
    }
    const sourceState = cell.cursor.state();
    if (projectedCards.length === 0 || sourceState.kind !== 'ready') {
      const kind: KanbanProjectedState['kind'] =
        sourceState.kind === 'error'
          ? 'error'
          : sourceState.kind === 'loading'
            ? 'loading'
            : sourceState.kind === 'refreshing'
              ? 'refreshing'
              : projectedCards.length === 0 && sourceState.kind === 'empty'
                ? 'empty'
                : 'partial';
      states.push(Object.freeze({ kind, label: stateLabel(options.i18n, kind), columnId: sourceColumn.columnId }));
      if (rect.height > 1) {
        regions.push(
          Object.freeze({
            kind: 'state',
            x: rect.x,
            y: 1,
            width: rect.width,
            height: rect.height - 1,
            actionable: false,
          }),
        );
      }
    }
  }
  options.cache.retain(retainedKeys);
  return Object.freeze({
    columns: Object.freeze(columns),
    cards: Object.freeze(cards),
    regions: Object.freeze(regions),
    actionTargets: Object.freeze([]),
    states: Object.freeze(states),
  });
}
