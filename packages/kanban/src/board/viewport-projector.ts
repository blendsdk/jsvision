import type { CapabilityProfile } from '@jsvision/core';
import type { I18n } from '@jsvision/i18n';

import { readKanbanCardAdapter } from '../card/adapter.js';
import type { KanbanCardPresentationAdapter, KanbanCardVisualState } from '../card/adapter.js';
import type {
  KanbanCardDensity,
  KanbanCardDescriptor,
  KanbanCardRenderContext,
  KanbanCardRenderer,
} from '../card/descriptor.js';
import type { KanbanCardFormattingContext } from '../card/formatting.js';
import type {
  KanbanCardPresentationSelection,
  KanbanPresentationInput,
  ResolvedKanbanPresentationBudget,
} from '../card/presentation-policy.js';
import { resolveKanbanPresentation } from '../card/presentation-policy.js';
import { renderKanbanCardSafely } from '../card/renderer.js';
import { renderConfiguredStandardKanbanCard } from '../card/standard-renderer.js';
import type { KanbanTheme } from '../card/theme.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanInteractionSnapshot } from '../interaction/types.js';
import type { KanbanActionTarget, KanbanLayoutRegion } from '../layout/hit-map.js';
import { projectKanbanSceneHits } from '../layout/hit-map.js';
import type { KanbanSceneGeometry, KanbanSceneGeometryVariant } from '../layout/swimlane-geometry.js';
import type { KanbanSceneCellHeightProjection } from '../layout/swimlane-geometry.js';
import { projectKanbanSceneGeometry } from '../layout/swimlane-geometry.js';
import type { KanbanSceneCustomChromeInput } from '../layout/swimlane-custom.js';
import type { KanbanColumnHeaderAlignment } from '../structure/policy.js';
import { projectKanbanMinimumGeometry } from '../layout/vertical-projector.js';
import type { KanbanCellAddress } from '../source/types.js';
import type { KanbanCount } from '../source/counts.js';
import {
  KANBAN_CARD_FRAME_INSET,
  framedKanbanCardHeight,
  framedKanbanCardWidth,
  kanbanCardContentWidth,
} from '../layout/card-geometry.js';
import { buildKanbanScene } from './scene-builder.js';
import type { KanbanScene } from './scene-model.js';
import type { KanbanIdentityInput } from './kanban-viewport.js';
import { KanbanDescriptorCache } from './descriptor-cache.js';
import type { KanbanDescriptorCacheKey } from './descriptor-cache.js';
import type { KanbanViewportSourceCell, KanbanViewportSourceSnapshot } from './viewport-source.js';
import type { KanbanOverlayProjection } from './overlay-projector.js';

/** Weak identity revisions keep reactive service/theme replacement cache-safe without retaining them. */
const REFERENCE_REVISIONS = new WeakMap<object, number>();
let nextReferenceRevision = 1;

/** Returns a process-local equality revision for one immutable service, renderer, or theme object. */
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
  readonly kind:
    'loading' | 'refreshing' | 'partial' | 'empty' | 'filtered-empty' | 'error' | 'no-columns' | 'minimum-size';
  /** Localized terminal-safe label. */
  readonly label: string;
  /** Optional source cell that owns a scoped state. */
  readonly columnId?: string;
  /** Optional complete source address for an actionable cell-local state. */
  readonly address?: KanbanCellAddress;
  /** Optional package-owned action shown by the state surface. */
  readonly actionId?: 'clear-filters';
}

/** One clipped visible card descriptor and its semantic source identity. */
export interface KanbanProjectedCard {
  /** Workflow column containing the card. */
  readonly columnId: string;
  /** Optional semantic swimlane containing the card. */
  readonly swimlaneId?: string;
  /** Logical index in the retained source cursor. */
  readonly index: number;
  /** Validated immutable descriptor. */
  readonly descriptor: KanbanCardDescriptor;
  /** Descriptor columns cropped from the left by viewport clipping. */
  readonly descriptorColumnOffset: number;
  /** Descriptor rows cropped from the top by viewport clipping. */
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
  /** Complete unclipped workflow-column width. */
  readonly contentWidth: number;
  /** Validated horizontal header-label alignment. */
  readonly headerAlignment: KanbanColumnHeaderAlignment;
  /** Honest same-publication count retained while this workflow column is collapsed. */
  readonly count?: KanbanCount;
  /** Clipped viewport-local column rectangle. */
  readonly rect: Readonly<{ x: number; y: number; width: number; height: number }>;
}

/** Immutable descriptor, semantic scene, and exact geometry consumed by drawing and inspection. */
export interface KanbanViewportProjection {
  /** Canonical geometry-free scene, absent for minimum-size and no-column states. */
  readonly scene?: KanbanScene;
  /** Exact final scene geometry, absent when no scene can be projected. */
  readonly geometry?: KanbanSceneGeometry;
  /** Visible source-ordered columns. */
  readonly columns: readonly KanbanProjectedColumn[];
  /** Visible resident card descriptors. */
  readonly cards: readonly KanbanProjectedCard[];
  /** Clipped inspection-only semantic geometry. */
  readonly regions: readonly KanbanLayoutRegion[];
  /** Bounded active targets derived from final clipped geometry. */
  readonly actionTargets: readonly KanbanActionTarget[];
  /** Board-wide and scoped source states requiring explicit non-color feedback. */
  readonly states: readonly KanbanProjectedState[];
  /** Optional transient drag and operation geometry composed over authoritative scene state. */
  readonly overlay?: KanbanOverlayProjection;
  /** Fixed safe failure evidence requiring the owning viewport to cancel transient authority. */
  readonly overlayFailure?: 'composition-failed';
}

/** Card-local presentation overrides supplied by the application or interaction facade. */
export interface KanbanViewportCardPresentation {
  /** Optional bounded field, summary, and checklist subset. */
  readonly selection?: KanbanCardPresentationSelection;
  /** Optional complete interaction state used by semantic styling. */
  readonly visualState?: KanbanCardVisualState;
}

/** Inputs needed for one bounded scene-based viewport projection pass. */
export interface ProjectKanbanViewportOptions<TCard> {
  /** Current retained source snapshot. */
  readonly source: KanbanViewportSourceSnapshot<TCard>;
  /** Exact viewport width. */
  readonly width: number;
  /** Exact viewport height. */
  readonly height: number;
  /** Current horizontal content offset. */
  readonly horizontalOffset: number;
  /** Current vertical content offset. */
  readonly verticalOffset: number;
  /** Generic application-record presentation adapter. */
  readonly card: KanbanCardPresentationAdapter<TCard>;
  /** Compatibility density used by custom renderer contexts. */
  readonly density: KanbanCardDensity;
  /** Resolved card presentation policy; defaults to the requested density preset. */
  readonly presentation?: KanbanPresentationInput;
  /** Optional application formatting context; defaults to the active I18n service. */
  readonly formatting?: KanbanCardFormattingContext;
  /** Optional card-local presentation selector. */
  readonly cardPresentation?: (card: TCard) => KanbanViewportCardPresentation | undefined;
  /** Optional custom descriptor renderer. */
  readonly renderer?: KanbanCardRenderer<TCard>;
  /** Equality-only custom renderer/configuration revision. */
  readonly rendererRevision?: string | number;
  /** Maximum descriptors, hit targets, and resident card computations retained by this viewport. */
  readonly descriptorLimit?: number;
  /** Requested scene presentation strategy. */
  readonly sceneVariant?: KanbanSceneGeometryVariant;
  /** Optional rail width selected by the normalized swimlane presentation. */
  readonly railWidth?: number;
  /** Optional bounded custom chrome, one descriptor for every visible swimlane. */
  readonly customChrome?: readonly KanbanSceneCustomChromeInput[];
  /** Optional presentation-adjusted workflow widths after rail reservation. */
  readonly presentationColumnWidths?: readonly { readonly columnId: string; readonly width: number }[];
  /** Optional bounded sparse-height evidence keyed by retained semantic cell. */
  readonly heightProjections?: readonly KanbanSceneCellHeightProjection[];
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
  /** Optional controller publication that supersedes legacy focus and selection hints. */
  readonly interaction?: KanbanInteractionSnapshot;
  /** Viewport-local descriptor cache. */
  readonly cache: KanbanDescriptorCache;
  /** Optional already-redacted diagnostic sink. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** One descriptor plus its cursor identity before canonical scene construction. */
interface ResidentDescriptor<TCard> {
  readonly cell: KanbanViewportSourceCell<TCard>;
  readonly index: number;
  readonly descriptor: KanbanCardDescriptor;
}

/** Exact bounded descriptor candidates omitted from one retained semantic cell. */
interface OmittedDescriptorDemand<TCard> {
  /** Retained cell whose loaded candidate descriptors exceeded the viewport ceiling. */
  readonly cell: KanbanViewportSourceCell<TCard>;
  /** Exact number of loaded candidates skipped before canonical scene construction. */
  readonly count: number;
}

/** Returns the localized label for one lifecycle state. */
function stateLabel(i18n: I18n, kind: KanbanProjectedState['kind']): string {
  const key =
    kind === 'no-columns'
      ? 'kanban.board.no-columns'
      : kind === 'filtered-empty'
        ? 'kanban.action.clear-filters'
        : kind === 'error'
          ? 'kanban.state.error'
          : `kanban.state.${kind}`;
  return i18n.t(key);
}

/** Adds current structure capabilities and filtered-empty controls to the final clipped target list. */
function scopedActionTargets<TCard>(
  source: KanbanViewportSourceSnapshot<TCard>,
  geometry: KanbanSceneGeometry,
  projected: readonly KanbanProjectedState[],
  base: readonly KanbanActionTarget[],
  maximum: number,
): readonly KanbanActionTarget[] {
  const headers = base.map((entry) => {
    if (entry.kind === 'workflow-header' && entry.columnId !== undefined) {
      const column = source.structure.columns.find((candidate) => candidate.columnId === entry.columnId);
      return Object.freeze({
        ...entry,
        ...(column?.capabilities.includes('collapse') === true ? { actionId: 'collapse' } : {}),
        reorder:
          column?.capabilities.includes('reorder') === true ? ('allowed' as const) : ('blocked-derived' as const),
      });
    }
    if (entry.kind === 'swimlane-header' && entry.swimlaneId !== undefined) {
      const explicitOrder = source.groupingPolicy?.order;
      return Object.freeze({
        ...entry,
        reorder:
          explicitOrder?.includes(entry.swimlaneId) === true ? ('allowed' as const) : ('blocked-derived' as const),
      });
    }
    return entry;
  });
  const stateActions = projected.flatMap((state): readonly KanbanActionTarget[] => {
    if (state.kind !== 'filtered-empty' || state.actionId === undefined || state.address === undefined) return [];
    const column = geometry.workflowHeaders.find((candidate) => candidate.columnId === state.address?.columnId);
    if (column === undefined || column.width < 1) return [];
    const address = Object.freeze({ ...state.address });
    return [
      Object.freeze({
        kind: 'state-action' as const,
        x: column.x,
        y: column.y + column.height,
        width: column.width,
        height: 1,
        scope: Object.freeze({ kind: 'state' as const, state: state.kind, address }),
        zIndex: 200,
        address,
        actionId: state.actionId,
        state: state.kind,
      }),
    ];
  });
  return Object.freeze(
    [...headers, ...stateActions].sort((left, right) => right.zIndex - left.zIndex).slice(0, maximum),
  );
}

/** Creates bounded application formatting backed by the selected I18n service. */
function defaultFormatting(i18n: I18n): KanbanCardFormattingContext {
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

/** Returns a descriptor width for one retained cell's workflow column. */
function columnWidth<TCard>(source: KanbanViewportSourceSnapshot<TCard>, columnId: string): number {
  return source.widths.columns.find((column) => column.columnId === columnId)?.width ?? 18;
}

/** Creates the default visual state before an optional card-local override is validated by snapshotting. */
function defaultVisualState<TCard>(
  options: ProjectKanbanViewportOptions<TCard>,
  cardKey: string | number,
): KanbanCardVisualState {
  const interaction = options.interaction;
  return Object.freeze({
    focused:
      interaction === undefined
        ? cardKey === options.identity?.focusedCardKey
        : interaction.focused.kind === 'card' && interaction.focused.cardKey === cardKey,
    selected:
      interaction?.selectedCardKeys.includes(cardKey) ?? options.identity?.selectedCardKeys?.includes(cardKey) ?? false,
    rangeAnchor: interaction?.rangeAnchor?.cardKey === cardKey,
    readOnly: false,
    invalid: false,
    operation: 'idle',
  });
}

/** Keeps application operation state while making the mounted controller authoritative for identity cues. */
function mergeControllerVisualState(
  configured: KanbanCardVisualState,
  controller: KanbanCardVisualState,
  hasController: boolean,
): KanbanCardVisualState {
  if (!hasController) return configured;
  return Object.freeze({
    ...configured,
    focused: controller.focused,
    selected: controller.selected,
    rangeAnchor: controller.rangeAnchor,
  });
}

/** Converts a validated descriptor into plain semantic data accepted by the canonical scene boundary. */
function semanticDescriptor(descriptor: KanbanCardDescriptor): KanbanSemanticValue {
  return {
    cardKey: descriptor.cardKey,
    width: framedKanbanCardWidth(descriptor.width),
    measuredHeight: framedKanbanCardHeight(descriptor.measuredHeight),
    ...(descriptor.presentationRevision === undefined ? {} : { presentationRevision: descriptor.presentationRevision }),
    surfaceRole: descriptor.surfaceRole,
    borderRole: descriptor.borderRole,
    marker: {
      row: descriptor.marker.row + KANBAN_CARD_FRAME_INSET,
      column: descriptor.marker.column + KANBAN_CARD_FRAME_INSET,
      glyph: descriptor.marker.glyph,
      role: descriptor.marker.role,
      cues: descriptor.marker.cues,
    },
    rows: descriptor.rows.map((row) => ({
      section: row.section,
      spans: row.spans.map((span) => ({ column: span.column, text: span.text, role: span.role })),
    })),
    sections: descriptor.sections.map((section) => ({
      id: section.id,
      kind: section.kind,
      startRow: section.startRow,
      rowCount: section.rowCount,
      priority: section.priority,
    })),
    actions: descriptor.actions.map((action) => ({
      actionId: action.actionId,
      label: action.label,
      enabled: action.enabled,
    })),
    regions: descriptor.regions.map((region) => ({
      regionId: region.regionId,
      kind: region.kind,
      x: region.x + KANBAN_CARD_FRAME_INSET,
      y: region.y + KANBAN_CARD_FRAME_INSET,
      width: region.width,
      height: region.height,
      ...(region.actionId === undefined ? {} : { actionId: region.actionId }),
    })),
    degradation: {
      level: descriptor.degradation.level,
      omittedSections: descriptor.degradation.omittedSections,
    },
  };
}

/** Projects bounded resident descriptors for every retained sparse source cell. */
function projectDescriptors<TCard>(
  options: ProjectKanbanViewportOptions<TCard>,
  budget: ResolvedKanbanPresentationBudget,
): {
  readonly residents: readonly ResidentDescriptor<TCard>[];
  readonly retainedKeys: readonly KanbanDescriptorCacheKey[];
  readonly omitted: readonly OmittedDescriptorDemand<TCard>[];
} {
  const residents: ResidentDescriptor<TCard>[] = [];
  const retainedKeys: KanbanDescriptorCacheKey[] = [];
  const omitted: OmittedDescriptorDemand<TCard>[] = [];
  const formatting = options.formatting ?? defaultFormatting(options.i18n);
  const descriptorLimit = options.descriptorLimit ?? KANBAN_LIMITS.retainedDescriptors.safe;
  const firstColumnId = options.source.widths.columns[0]?.columnId;
  for (const cell of options.source.cells) {
    const width = kanbanCardContentWidth(
      columnWidth(options.source, cell.address.columnId),
      cell.address.columnId === firstColumnId,
    );
    const maximum = Math.min(cell.range.end, cell.range.start + KANBAN_LIMITS.ensureRangeCards.safe);
    let omittedCount = 0;
    for (let index = cell.range.start; index < maximum; index += 1) {
      const record = cell.cursor.cardAt(index);
      if (record === undefined) continue;
      if (retainedKeys.length >= descriptorLimit) {
        omittedCount += 1;
        continue;
      }
      let mandatory;
      try {
        mandatory = readKanbanCardAdapter(record, options.card);
      } catch {
        continue;
      }
      const visualState = defaultVisualState(options, mandatory.cardKey);
      const context: KanbanCardRenderContext = Object.freeze({
        cardKey: mandatory.cardKey,
        ...(mandatory.presentationRevision === undefined
          ? {}
          : { presentationRevision: mandatory.presentationRevision }),
        width,
        rowBudget: budget.cardRows,
        density: options.density,
        focused: visualState.focused,
        selected: visualState.selected,
        readOnly: visualState.readOnly,
        operation: visualState.operation,
        theme: options.theme,
        capabilities: cardCapabilities(options.capabilities),
        formatting,
      });
      const rendererRevision =
        options.rendererRevision ??
        (options.renderer === undefined
          ? `standard-rich-v1:${String(referenceRevision(options.i18n))}`
          : referenceRevision(options.renderer));
      const key: KanbanDescriptorCacheKey = Object.freeze({
        generation: options.source.generation,
        address: cell.address,
        cursorRevision: cell.cursor.revision(),
        cardKey: mandatory.cardKey,
        rendererRevision,
        ...(mandatory.presentationRevision === undefined
          ? {}
          : { presentationRevision: mandatory.presentationRevision }),
        presentationPolicyRevision: budget.revision,
        presentationSelectionFingerprint: `card:${typeof mandatory.cardKey}:${String(mandatory.cardKey)}`,
        width,
        rowBudget: budget.cardRows,
        density: options.density,
        themeRevision: referenceRevision(options.theme),
        capabilityRevision: capabilityRevision(options.capabilities),
        interactionRevision: JSON.stringify(visualState),
      });
      const descriptor = options.cache.getOrCreate(key, () => {
        const selected = options.cardPresentation?.(record);
        const configuredVisualState = mergeControllerVisualState(
          selected?.visualState ?? visualState,
          visualState,
          options.interaction !== undefined,
        );
        const configuredContext = Object.freeze({
          ...context,
          focused: configuredVisualState.focused,
          selected: configuredVisualState.selected,
          readOnly: configuredVisualState.readOnly,
          operation: configuredVisualState.operation,
        });
        const renderer = options.renderer ?? {
          render: (card: TCard, renderContext: KanbanCardRenderContext) =>
            renderConfiguredStandardKanbanCard(card, options.card, renderContext, {
              budget,
              presentation: {
                visualState: configuredVisualState,
                ...(selected?.selection === undefined ? {} : { selection: selected.selection }),
              },
              ...(options.observe === undefined ? {} : { observe: options.observe }),
            }),
        };
        return renderKanbanCardSafely(record, renderer, configuredContext, {
          labels: {
            invalidCardTitle: options.i18n.t('kanban.card.invalid-title'),
            unknownStatus: options.i18n.t('kanban.card.unknown-status'),
          },
          observe: options.observe,
        });
      });
      retainedKeys.push(key);
      residents.push(Object.freeze({ cell, index, descriptor }));
    }
    if (omittedCount > 0) omitted.push(Object.freeze({ cell, count: omittedCount }));
  }
  return Object.freeze({
    residents: Object.freeze(residents),
    retainedKeys: Object.freeze(retainedKeys),
    omitted: Object.freeze(omitted),
  });
}

/** Converts canonical geometry kinds to the shared inspection-region contract. */
function sceneRegions(geometry: KanbanSceneGeometry): readonly KanbanLayoutRegion[] {
  return Object.freeze(geometry.regions.map((region) => Object.freeze({ ...region, actionable: false })));
}

/** Creates a state-only projection without a canonical scene. */
function stateOnly(kind: KanbanProjectedState['kind'], label: string): KanbanViewportProjection {
  return Object.freeze({
    columns: Object.freeze([]),
    cards: Object.freeze([]),
    regions: Object.freeze([]),
    actionTargets: Object.freeze([]),
    states: Object.freeze([Object.freeze({ kind, label })]),
  });
}

/**
 * Builds one canonical semantic scene and projects it into bounded exact terminal geometry.
 */
export function projectKanbanViewport<TCard>(options: ProjectKanbanViewportOptions<TCard>): KanbanViewportProjection {
  if (options.source.mode === 'minimum-size') {
    options.cache.retain([]);
    const requiredHeight = options.minimumRequiredHeight ?? 4;
    const minimum = projectKanbanMinimumGeometry({
      bounds: { x: 0, y: 0, width: options.width, height: options.height },
      requiredWidth: 18,
      requiredHeight,
      message: options.i18n.t('kanban.layout.minimum-size', { params: { width: 18, height: requiredHeight } }),
    });
    return stateOnly('minimum-size', minimum.message.text);
  }
  if (options.source.visibleColumns.length === 0) {
    options.cache.retain([]);
    return stateOnly('no-columns', stateLabel(options.i18n, 'no-columns'));
  }

  const budget = resolveKanbanPresentation(options.presentation ?? options.density);
  const descriptorLimit = options.descriptorLimit ?? KANBAN_LIMITS.retainedDescriptors.safe;
  const projected = projectDescriptors(options, budget);
  options.cache.retain(projected.retainedKeys);
  const residentsByCell = new Map<KanbanViewportSourceCell<TCard>, readonly ResidentDescriptor<TCard>[]>();
  const omittedByCell = new Map(projected.omitted.map(({ cell, count }) => [cell, count] as const));
  for (const cell of options.source.cells) {
    residentsByCell.set(
      cell,
      projected.residents.filter((resident) => resident.cell === cell),
    );
  }
  const scene = buildKanbanScene({
    revision: JSON.stringify([
      options.source.publication.revision,
      options.source.generation,
      options.source.structure.revision,
      budget.revision,
      options.rendererRevision ?? null,
      options.interaction?.revision ?? null,
    ]),
    queryGeneration: options.source.generation,
    sessionRevision: options.source.publication.revision,
    columns: options.source.widths.columns.flatMap((solved) => {
      const column = options.source.publication.columns.find((candidate) => candidate.columnId === solved.columnId);
      return column === undefined ? [] : [column];
    }),
    swimlanes: options.source.visibleSwimlanes,
    cells: options.source.cells.map((cell) => ({
      address: cell.address,
      cursorRevision: cell.cursor.revision(),
      state: cell.cursor.state(),
      cards: (residentsByCell.get(cell) ?? []).map(({ index, descriptor }) => ({
        cardKey: descriptor.cardKey,
        logicalIndex: index,
        entityRevision: descriptor.presentationRevision ?? cell.cursor.revision(),
        descriptor: semanticDescriptor(descriptor),
        interaction: { cues: descriptor.marker.cues },
        workflow: {},
      })),
      ...(omittedByCell.has(cell) ? { omittedCount: omittedByCell.get(cell) } : {}),
    })),
    detached: {
      columns: options.source.structure.detached.columns.map((column) => ({
        columnId: column.columnId,
        visibility: column.visibility,
        collapse: column.collapse,
      })),
      swimlanes: options.source.publication.swimlanes.map((swimlane) => ({
        swimlaneId: swimlane.swimlaneId,
        visibility: options.source.visibleSwimlanes.some((candidate) => candidate.swimlaneId === swimlane.swimlaneId)
          ? 'visible'
          : 'hidden',
        collapse: options.source.collapsedSwimlaneIds.includes(swimlane.swimlaneId) ? 'collapsed' : 'expanded',
      })),
    },
    descriptorLimit,
  });
  const geometry = projectKanbanSceneGeometry(scene, {
    bounds: { x: 0, y: 0, width: options.width, height: options.height },
    variant: options.sceneVariant ?? 'hybrid',
    offsets: { x: options.horizontalOffset, y: options.verticalOffset },
    minimumColumnWidth: 18,
    columnWidths: options.presentationColumnWidths ?? options.source.widths.columns,
    columnGap: options.source.widths.separatorWidth,
    cardGap: budget.cardGap,
    estimatedCardHeight: framedKanbanCardHeight(Math.min(1, budget.cardRows)),
    ...(options.heightProjections === undefined ? {} : { heightProjections: options.heightProjections }),
    ...(options.railWidth === undefined ? {} : { railWidth: options.railWidth }),
    ...(options.customChrome === undefined ? {} : { customChrome: options.customChrome }),
  });
  const hits = projectKanbanSceneHits(scene, geometry, { maximumTargets: descriptorLimit });
  const columns = Object.freeze(
    geometry.workflowHeaders.map((header) => {
      const structureColumn = options.source.structure.columns.find(
        (candidate) => candidate.columnId === header.columnId,
      );
      const count = options.source.knownColumnCounts.find((candidate) => candidate.columnId === header.columnId)?.count;
      return Object.freeze({
        columnId: header.columnId,
        label: header.label,
        contentOffset: header.contentOffset,
        contentWidth: header.contentWidth,
        headerAlignment: structureColumn?.headerAlignment ?? 'start',
        ...(structureColumn?.collapse === 'collapsed' && count !== undefined ? { count } : {}),
        rect: Object.freeze({ x: header.x, y: 0, width: header.width, height: options.height }),
      });
    }),
  );
  const descriptorByIdentity = new Map(
    projected.residents.map((resident) => [
      JSON.stringify([
        resident.descriptor.cardKey,
        resident.cell.address.columnId,
        resident.cell.address.swimlaneId ?? null,
        resident.index,
      ]),
      resident.descriptor,
    ]),
  );
  const cards = Object.freeze(
    geometry.cards.flatMap((card) => {
      const descriptor = descriptorByIdentity.get(
        JSON.stringify([card.cardKey, card.address.columnId, card.address.swimlaneId ?? null, card.logicalIndex]),
      );
      if (descriptor === undefined) return [];
      return [
        Object.freeze({
          columnId: card.address.columnId,
          ...(card.address.swimlaneId === undefined ? {} : { swimlaneId: card.address.swimlaneId }),
          index: card.logicalIndex,
          descriptor,
          descriptorColumnOffset: card.descriptorColumnOffset,
          descriptorRowOffset: card.descriptorRowOffset,
          rect: Object.freeze({ x: card.x, y: card.y, width: card.width, height: card.height }),
        }),
      ];
    }),
  );
  const states: KanbanProjectedState[] = [];
  for (const cell of options.source.cells) {
    const state = cell.cursor.state();
    const hasCards = (residentsByCell.get(cell)?.length ?? 0) > 0;
    if (state.kind === 'ready' && hasCards) continue;
    const kind: KanbanProjectedState['kind'] =
      state.kind === 'error'
        ? 'error'
        : state.kind === 'loading'
          ? 'loading'
          : state.kind === 'refreshing'
            ? 'refreshing'
            : !hasCards && state.kind === 'empty'
              ? options.source.filtered
                ? 'filtered-empty'
                : 'empty'
              : 'partial';
    states.push(
      Object.freeze({
        kind,
        label: stateLabel(options.i18n, kind),
        columnId: cell.address.columnId,
        address: Object.freeze({ ...cell.address }),
        ...(kind === 'filtered-empty' ? { actionId: 'clear-filters' as const } : {}),
      }),
    );
  }
  for (const limit of scene.states) {
    states.push(
      Object.freeze({
        kind: 'partial',
        label: options.i18n.t('kanban.state.descriptor-limit', { params: { count: limit.omittedCount } }),
        columnId: limit.scope.address.columnId,
      }),
    );
  }
  return Object.freeze({
    scene,
    geometry,
    columns,
    cards,
    regions: sceneRegions(geometry),
    actionTargets: scopedActionTargets(options.source, geometry, states, hits.targets, descriptorLimit),
    states: Object.freeze(states),
  });
}
