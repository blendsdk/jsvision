import type { Rect } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import type { CardKey } from '../contract/identity.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import type { KanbanDragOverlayEvidence } from '../interaction/drag-types.js';
import type { KanbanStructuralDragOverlayEvidence } from '../interaction/structural-drag.js';
import type { KanbanEligibility } from '../operation/eligibility.js';
import { KANBAN_PHASE_C_ENGLISH_MESSAGES } from '../i18n/catalog.js';
import type { KanbanOperationSnapshot } from '../operation/types.js';
import type { KanbanCellAddress } from '../source/types.js';
import { projectKanbanOperations } from './operation-projector.js';
import type { KanbanProjectedOperationFeedback, KanbanProjectedPendingBlock } from './operation-projector.js';
import type { KanbanProjectedCard, KanbanViewportProjection } from './viewport-projector.js';

/** One stable source placeholder occupying the removed card geometry. */
export interface KanbanProjectedSourcePlaceholder {
  /** Semantic source cell. */
  readonly address: KanbanCellAddress;
  /** Ordered moved identities represented by this placeholder fragment. */
  readonly cardKeys: readonly CardKey[];
  /** Clipped viewport-local rectangle. */
  readonly rect: Readonly<Rect>;
}

/** Closed visual classification for a semantic drop target. */
export type KanbanDropVisualState = 'valid' | 'warning' | 'invalid' | 'unavailable';

/** One visible insertion target with redundant non-color evidence. */
export interface KanbanProjectedDropGap {
  /** Stable semantic slot identity. */
  readonly slotId: string;
  /** Semantic target cell owning the insertion cue. */
  readonly address: KanbanCellAddress;
  /** Current validated policy eligibility. */
  readonly eligibility: Readonly<{ readonly kind: KanbanEligibility['kind'] }>;
  /** Theme-facing visual classification. */
  readonly visualState: KanbanDropVisualState;
  /** Fixed package-owned localization key. */
  readonly messageKey: string;
  /** Fixed safe label used by inspection and fallback rendering. */
  readonly label: string;
  /** ASCII-safe non-color cue. */
  readonly asciiMarker: '>' | '!' | 'x' | '?';
  /** Unicode non-color cue. */
  readonly unicodeMarker: '▶' | '⚠' | '×' | '?';
  /** Clipped viewport-local target rectangle. */
  readonly rect: Readonly<Rect>;
}

/** Bounded recognizable drag ghost that contains no application record or card-body text. */
export interface KanbanProjectedDragGhost {
  /** Pointer-origin card identity. */
  readonly cardKey: CardKey;
  /** Number of cards represented atomically. */
  readonly count: number;
  /** Current viewport-local pointer anchor retained for exact frame damage. */
  readonly anchor: Readonly<{ x: number; y: number }>;
  /** Fixed identity/count label safe for inspection. */
  readonly label: string;
  /** Bounded safe resident title cue, absent for identity fallback. */
  readonly title?: string;
  /** Bounded safe resident status cue, absent for identity fallback. */
  readonly status?: string;
  /** Clipped viewport-local rectangle. */
  readonly rect: Readonly<Rect>;
}

/** One affected visible stack that may require repaint after overlay changes. */
export interface KanbanOverlayAffectedStack {
  /** Workflow column owning the stack. */
  readonly columnId: string;
  /** Optional explicit swimlane owning the stack. */
  readonly swimlaneId?: string;
  /** Clipped union rectangle. */
  readonly rect: Readonly<Rect>;
}

/** Clipped structural source, insertion marker, and pointer-following header ghost. */
export interface KanbanProjectedStructuralDrag {
  /** Structural kind retained as a non-color cue. */
  readonly kind: 'column' | 'swimlane';
  /** Stable identity rendered inside the bounded ghost. */
  readonly id: string;
  /** Source header placeholder. */
  readonly placeholder: Readonly<Rect>;
  /** Current sibling insertion marker. */
  readonly marker?: Readonly<Rect>;
  /** Bounded pointer-following header ghost. */
  readonly ghost: Readonly<Rect>;
}

/** Complete immutable overlay geometry consumed by drawing and damage calculation. */
export interface KanbanOverlayProjection {
  /** Stable source placeholders. */
  readonly placeholders: readonly KanbanProjectedSourcePlaceholder[];
  /** Current insertion target. */
  readonly gap?: KanbanProjectedDropGap;
  /** Bounded pointer-following ghost. */
  readonly ghost?: KanbanProjectedDragGhost;
  /** Pending and accepted operation blocks. */
  readonly pending: readonly KanbanProjectedPendingBlock[];
  /** Terminal operation feedback outside card bodies. */
  readonly feedback: readonly KanbanProjectedOperationFeedback[];
  /** Visible stacks whose composition differs from authority. */
  readonly affectedStacks: readonly KanbanOverlayAffectedStack[];
  /** Active structural header reorder visuals. */
  readonly structure?: KanbanProjectedStructuralDrag;
}

/** Inputs for one pure authoritative-scene plus transient-overlay composition. */
export interface ComposeKanbanViewportOverlayOptions {
  /** Complete immutable authoritative viewport projection. */
  readonly authoritative: KanbanViewportProjection;
  /** Current viewport-local clipping rectangle. */
  readonly bounds: Readonly<Rect>;
  /** Active card density. */
  readonly density: KanbanCardDensity;
  /** Optional current renderer-neutral drag evidence. */
  readonly drag?: KanbanDragOverlayEvidence;
  /** Optional current renderer-neutral structural drag evidence. */
  readonly structuralDrag?: KanbanStructuralDragOverlayEvidence;
  /** Bounded payload-free operation snapshots in admission order. */
  readonly operations?: readonly KanbanOperationSnapshot[];
  /** Optional internal observer used to prove composition work remains linear at configured limits. */
  readonly inspectWork?: (work: KanbanOverlayProjectionWork) => void;
  /** Optional locale service adapter used to resolve the fixed package-owned drop vocabulary. */
  readonly translate?: (messageKey: string) => string;
}

/** Internal counters that expose index construction and lookup work without timing-sensitive tests. */
export interface KanbanOverlayProjectionWork {
  /** Number of authoritative cards indexed once for this composition. */
  readonly indexedCards: number;
  /** Number of distinct source-card cells looked up for placeholder projection. */
  readonly cardLookups: number;
  /** Number of authoritative columns indexed once for this composition. */
  readonly indexedColumns: number;
  /** Number of distinct affected columns looked up for damage projection. */
  readonly columnLookups: number;
  /** Visible cards indexed once for semantic operation placement. */
  readonly operationIndexedCards: number;
  /** Constant-time semantic cell lookups performed by pending operations. */
  readonly operationCellLookups: number;
  /** Pending insertion thresholds indexed once for vertical reflow. */
  readonly operationShiftEvents: number;
  /** Binary-search shift lookups performed for authoritative cards. */
  readonly operationShiftLookups: number;
}

/** Mutable counters remain local to one synchronous composition and are frozen before observation. */
interface MutableKanbanOverlayProjectionWork {
  indexedCards: number;
  cardLookups: number;
  indexedColumns: number;
  columnLookups: number;
  operationIndexedCards: number;
  operationCellLookups: number;
  operationShiftEvents: number;
  operationShiftLookups: number;
}

/** Empty immutable overlay shared only by value, not by mutable state. */
const EMPTY_OVERLAY: KanbanOverlayProjection = Object.freeze({
  placeholders: Object.freeze([]),
  pending: Object.freeze([]),
  feedback: Object.freeze([]),
  affectedStacks: Object.freeze([]),
});

/** Projects bounded structural evidence without retaining source models or labels. */
function projectStructuralDrag(
  drag: KanbanStructuralDragOverlayEvidence,
  bounds: Readonly<Rect>,
): KanbanProjectedStructuralDrag | undefined {
  const placeholder = clip(drag.sourceRect, bounds);
  if (placeholder === undefined || bounds.width < 1 || bounds.height < 1) return undefined;
  const width = Math.min(bounds.width, Math.max(3, Math.min(20, drag.sourceRect.width)));
  const height = Math.min(bounds.height, Math.max(1, Math.min(3, drag.sourceRect.height)));
  const x = Math.min(Math.max(bounds.x, drag.point.x + 1), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(bounds.y, drag.point.y + 1), bounds.y + bounds.height - height);
  const ghost = clip({ x, y, width, height }, bounds);
  if (ghost === undefined) return undefined;
  const structure = drag.structure;
  const id = structure.kind === 'column' ? structure.columnId : structure.swimlaneId;
  const marker = drag.markerRect === undefined ? undefined : clip(drag.markerRect, bounds);
  return Object.freeze({
    kind: structure.kind,
    id,
    placeholder,
    ...(marker === undefined ? {} : { marker }),
    ghost,
  });
}

/** Clips a rectangle to current viewport-local bounds. */
function clip(rect: Readonly<Rect>, bounds: Readonly<Rect>): Readonly<Rect> | undefined {
  const x = Math.max(bounds.x, rect.x);
  const y = Math.max(bounds.y, rect.y);
  const right = Math.min(bounds.x + bounds.width, rect.x + rect.width);
  const bottom = Math.min(bounds.y + bounds.height, rect.y + rect.height);
  return right <= x || bottom <= y ? undefined : Object.freeze({ x, y, width: right - x, height: bottom - y });
}

/** Returns a collision-safe type-preserving identity for bounded set membership. */
function cardIdentity(cardKey: CardKey): string {
  return JSON.stringify([typeof cardKey, cardKey]);
}

/** Returns a collision-safe identity for one card in one semantic cell. */
function cardCellIdentity(cardKey: CardKey, address: KanbanCellAddress): string {
  return JSON.stringify([typeof cardKey, cardKey, address.columnId, address.swimlaneId ?? null]);
}

/** Returns whether a card belongs to one semantic source cell. */
function inCell(card: KanbanProjectedCard, address: KanbanCellAddress): boolean {
  return card.columnId === address.columnId && card.swimlaneId === address.swimlaneId;
}

/** Maps validated policy evidence to fixed safe renderer vocabulary. */
function dropPresentation(
  eligibility: KanbanEligibility,
  translate?: (messageKey: string) => string,
): Omit<KanbanProjectedDropGap, 'slotId' | 'address' | 'eligibility' | 'rect'> {
  const reasonKey = eligibility.kind === 'allowed' ? undefined : dropReasonMessageKey(eligibility.code);
  /** Resolves a reason-specific label, falling back to the closed Phase C English vocabulary. */
  const label = (
    messageKey: keyof typeof KANBAN_PHASE_C_ENGLISH_MESSAGES,
    preferredKey: string | undefined = messageKey,
  ): string => {
    const translated = translate?.(preferredKey);
    return translated === undefined || translated === preferredKey
      ? KANBAN_PHASE_C_ENGLISH_MESSAGES[messageKey]
      : translated;
  };
  switch (eligibility.kind) {
    case 'allowed':
      return Object.freeze({
        visualState: 'valid' as const,
        messageKey: 'kanban.drop.allowed',
        label: label('kanban.drop.allowed'),
        asciiMarker: '>' as const,
        unicodeMarker: '▶' as const,
      });
    case 'warning':
      return Object.freeze({
        visualState: 'warning' as const,
        messageKey: reasonKey ?? 'kanban.drop.warning',
        label: label('kanban.drop.warning', reasonKey),
        asciiMarker: '!' as const,
        unicodeMarker: '⚠' as const,
      });
    case 'blocked':
      return Object.freeze({
        visualState: 'invalid' as const,
        messageKey: reasonKey ?? 'kanban.drop.blocked',
        label: label('kanban.drop.blocked', reasonKey),
        asciiMarker: 'x' as const,
        unicodeMarker: '×' as const,
      });
    case 'unavailable':
      return Object.freeze({
        visualState: 'unavailable' as const,
        messageKey: reasonKey ?? 'kanban.drop.unavailable',
        label: label('kanban.drop.unavailable', reasonKey),
        asciiMarker: '?' as const,
        unicodeMarker: '?' as const,
      });
  }
}

/** Maps the eligibility pipeline's canonical closed codes to concise package-owned messages. */
function dropReasonMessageKey(code: string): string | undefined {
  const exact = new Map<string, string>([
    ['wip-minimum-not-met', 'kanban.workflow.wip-minimum-not-met'],
    ['wip-maximum-exceeded', 'kanban.workflow.wip-maximum-exceeded'],
    ['wip-count-unavailable', 'kanban.workflow.wip-count-unavailable'],
    ['transition-unavailable', 'kanban.reason.transition-unavailable'],
    ['transition-blocked', 'kanban.operation.transition-blocked'],
    ['definition-of-done-not-met', 'kanban.operation.definition-of-done'],
    ['sorted-manual-order', 'kanban.operation.sorted-placement'],
    ['filtered-placement-unavailable', 'kanban.operation.filtered-placement'],
  ]).get(code);
  if (exact !== undefined) return exact;
  if (
    code.startsWith('stale-') ||
    code === 'placement-revision-stale' ||
    code === 'placement-anchor-stale' ||
    code === 'placement-token-stale' ||
    code === 'source-placement-revision-stale' ||
    code === 'source-placement-anchor-stale' ||
    code === 'source-placement-token-stale'
  ) {
    return 'kanban.operation.stale-placement';
  }
  return undefined;
}

/** Reports optional internal work evidence without letting diagnostic code affect rendering. */
function reportProjectionWork(
  inspectWork: ComposeKanbanViewportOverlayOptions['inspectWork'],
  work: MutableKanbanOverlayProjectionWork,
): void {
  try {
    inspectWork?.(Object.freeze({ ...work }));
  } catch {
    // Diagnostic observation is deliberately outside renderer correctness and failure containment.
  }
}

/** One sorted insertion threshold and its cumulative downward shift. */
interface KanbanPendingShiftEvent {
  readonly y: number;
  readonly cumulativeShift: number;
}

/** Creates one collision-safe identity for a semantic cell. */
function addressIdentity(address: KanbanCellAddress): string {
  return JSON.stringify([address.columnId, address.swimlaneId ?? null]);
}

/** Indexes pending block shifts once so card projection never rescans every operation. */
function indexPendingShifts(
  pending: readonly KanbanProjectedPendingBlock[],
  work: MutableKanbanOverlayProjectionWork,
): ReadonlyMap<string, readonly KanbanPendingShiftEvent[]> {
  const grouped = new Map<string, { y: number; shift: number }[]>();
  for (const block of pending) {
    if (block.offscreen) continue;
    const identity = addressIdentity(block.target);
    const events = grouped.get(identity) ?? [];
    events.push({ y: block.rect.y, shift: block.rect.height + 1 });
    grouped.set(identity, events);
    work.operationShiftEvents += 1;
  }
  const result = new Map<string, readonly KanbanPendingShiftEvent[]>();
  for (const [identity, events] of grouped) {
    events.sort((left, right) => left.y - right.y);
    let cumulativeShift = 0;
    result.set(
      identity,
      Object.freeze(
        events.map(({ y, shift }) => {
          cumulativeShift += shift;
          return Object.freeze({ y, cumulativeShift });
        }),
      ),
    );
  }
  return result;
}

/** Finds the cumulative shift for one card with logarithmic indexed work. */
function pendingShiftAt(
  index: ReadonlyMap<string, readonly KanbanPendingShiftEvent[]>,
  card: KanbanProjectedCard,
  work: MutableKanbanOverlayProjectionWork,
): number {
  work.operationShiftLookups += 1;
  const events = index.get(
    addressIdentity({
      columnId: card.columnId,
      ...(card.swimlaneId === undefined ? {} : { swimlaneId: card.swimlaneId }),
    }),
  );
  if (events === undefined) return 0;
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const event = events[middle];
    if (event !== undefined && event.y <= card.rect.y) low = middle + 1;
    else high = middle;
  }
  return low === 0 ? 0 : (events[low - 1]?.cumulativeShift ?? 0);
}

/** Creates placeholder fragments from current visible moved-card geometry. */
function projectPlaceholders(
  cardsByCell: ReadonlyMap<string, KanbanProjectedCard>,
  drag: KanbanDragOverlayEvidence,
  bounds: Readonly<Rect>,
  work: MutableKanbanOverlayProjectionWork,
): readonly KanbanProjectedSourcePlaceholder[] {
  const result: KanbanProjectedSourcePlaceholder[] = [];
  const visited = new Set<string>();
  for (const placeholder of drag.placeholders) {
    for (const cardKey of placeholder.cardKeys) {
      const identity = cardCellIdentity(cardKey, placeholder.address);
      if (visited.has(identity)) continue;
      visited.add(identity);
      work.cardLookups += 1;
      const card = cardsByCell.get(identity);
      const rect = card === undefined ? undefined : clip(card.rect, bounds);
      if (rect === undefined) continue;
      result.push(
        Object.freeze({
          address: placeholder.address,
          cardKeys: Object.freeze([cardKey]),
          rect,
        }),
      );
    }
  }
  return Object.freeze(result);
}

/** Creates stable source placeholders for visible cards awaiting authoritative publication. */
function projectPendingPlaceholders(
  cardsByCell: ReadonlyMap<string, KanbanProjectedCard>,
  pending: readonly KanbanProjectedPendingBlock[],
  bounds: Readonly<Rect>,
  work: MutableKanbanOverlayProjectionWork,
): readonly KanbanProjectedSourcePlaceholder[] {
  const result: KanbanProjectedSourcePlaceholder[] = [];
  for (const block of pending) {
    const visited = new Set<string>();
    block.cardKeys.forEach((cardKey, index) => {
      const address = block.visibleSources[index];
      if (address === undefined) return;
      const identity = cardCellIdentity(cardKey, address);
      if (visited.has(identity)) return;
      visited.add(identity);
      work.cardLookups += 1;
      const card = cardsByCell.get(identity);
      const rect = card === undefined ? undefined : clip(card.rect, bounds);
      if (rect !== undefined) result.push(Object.freeze({ address, cardKeys: Object.freeze([cardKey]), rect }));
    });
  }
  return Object.freeze(result);
}

/** Removes complete ANSI control sequences and remaining terminal controls from one bounded cue. */
function safeGhostCue(value: string): string | undefined {
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(value)) return undefined;
  const withoutAnsi = value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '');
  const safe = sanitizeContractText(withoutAnsi, 96)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  return safe.length === 0 ? undefined : safe;
}

/** Reads one bounded descriptor section without retaining the descriptor itself in overlay state. */
function descriptorCue(card: KanbanProjectedCard | undefined, section: 'title' | 'status'): string | undefined {
  const row = card?.descriptor.rows.find((candidate) => candidate.section === section);
  return row === undefined ? undefined : safeGhostCue(row.spans.map(({ text }) => text).join(' '));
}

/** Creates one viewport-bounded ghost sized from the visible origin card or a compact fallback. */
function projectGhost(
  projection: KanbanViewportProjection,
  drag: KanbanDragOverlayEvidence,
  bounds: Readonly<Rect>,
): KanbanProjectedDragGhost | undefined {
  if (bounds.width < 1 || bounds.height < 1) return undefined;
  const ghostIdentity = cardIdentity(drag.ghost.cardKey);
  const origin = projection.cards.find((card) => cardIdentity(card.descriptor.cardKey) === ghostIdentity);
  const width = Math.min(bounds.width, Math.max(3, Math.min(20, origin?.rect.width ?? 12)));
  const height = Math.min(bounds.height, Math.max(2, Math.min(4, origin?.rect.height ?? 3)));
  const clampX = (x: number): number => Math.min(Math.max(bounds.x, x), bounds.x + bounds.width - width);
  const clampY = (y: number): number => Math.min(Math.max(bounds.y, y), bounds.y + bounds.height - height);
  const candidates = [
    { x: clampX(drag.ghost.point.x + 1), y: clampY(drag.ghost.point.y + 1) },
    { x: clampX(drag.ghost.point.x + 1), y: clampY(drag.ghost.point.y - height - 1) },
    { x: clampX(drag.ghost.point.x + 1), y: clampY(bounds.y + bounds.height - height) },
    { x: clampX(drag.ghost.point.x - width - 1), y: clampY(drag.ghost.point.y + 1) },
    { x: clampX(drag.ghost.point.x - width - 1), y: clampY(bounds.y + bounds.height - height) },
  ];
  const moved = new Set(drag.placeholders.flatMap(({ cardKeys }) => cardKeys.map(cardIdentity)));
  const obstacles = [
    ...projection.cards.flatMap((card) => (moved.has(cardIdentity(card.descriptor.cardKey)) ? [] : [card.rect])),
    ...(drag.gap === undefined ? [] : [drag.gap.rect]),
  ];
  const overlap = (candidate: Readonly<{ x: number; y: number }>): number =>
    obstacles.reduce((total, obstacle) => {
      const overlapWidth = Math.max(
        0,
        Math.min(candidate.x + width, obstacle.x + obstacle.width) - Math.max(candidate.x, obstacle.x),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(candidate.y + height, obstacle.y + obstacle.height) - Math.max(candidate.y, obstacle.y),
      );
      return total + overlapWidth * overlapHeight;
    }, 0);
  const preferred = candidates[0]!;
  const score = (candidate: Readonly<{ x: number; y: number }>): number =>
    overlap(candidate) * 2 + Math.abs(candidate.x - preferred.x) + Math.abs(candidate.y - preferred.y);
  const placement = candidates.reduce((best, candidate) => (score(candidate) < score(best) ? candidate : best));
  const rect = clip({ ...placement, width, height }, bounds);
  if (rect === undefined) return undefined;
  const identity = typeof drag.ghost.cardKey === 'number' ? String(drag.ghost.cardKey) : drag.ghost.cardKey;
  const title = descriptorCue(origin, 'title');
  const status = descriptorCue(origin, 'status');
  return Object.freeze({
    cardKey: drag.ghost.cardKey,
    count: drag.ghost.count,
    anchor: drag.ghost.point,
    label: drag.ghost.count === 1 ? `#${identity}` : `${drag.ghost.count} cards`,
    ...(title === undefined ? {} : { title }),
    ...(status === undefined ? {} : { status }),
    rect,
  });
}

/** Creates one clipped active gap; compact mode guarantees at least one visible target row. */
function projectGap(
  drag: KanbanDragOverlayEvidence,
  density: KanbanCardDensity,
  bounds: Readonly<Rect>,
  translate?: (messageKey: string) => string,
): KanbanProjectedDropGap | undefined {
  const gap = drag.gap;
  if (gap === undefined) return undefined;
  const expanded = {
    ...gap.rect,
    y: Math.max(bounds.y, gap.rect.y - (density === 'compact' ? 2 : 1)),
    height: 1,
  };
  const rect = clip(expanded, bounds);
  return rect === undefined
    ? undefined
    : Object.freeze({
        slotId: gap.slotId,
        address: gap.address,
        eligibility: Object.freeze({ kind: gap.eligibility.kind }),
        rect,
        ...dropPresentation(gap.eligibility, translate),
      });
}

/** Returns clipped visible column stacks affected by a drag or pending block. */
function affectedStacks(
  columnsById: ReadonlyMap<string, KanbanViewportProjection['columns'][number]>,
  drag: KanbanDragOverlayEvidence | undefined,
  pending: readonly KanbanProjectedPendingBlock[],
  bounds: Readonly<Rect>,
  work: MutableKanbanOverlayProjectionWork,
): readonly KanbanOverlayAffectedStack[] {
  const addresses = new Map<string, KanbanCellAddress>();
  const retain = (address: KanbanCellAddress): void => {
    addresses.set(JSON.stringify([address.columnId, address.swimlaneId ?? null]), address);
  };
  for (const placeholder of drag?.placeholders ?? []) {
    retain(placeholder.address);
  }
  if (drag?.gap !== undefined) {
    retain(drag.gap.address);
  }
  for (const block of pending) retain(block.target);
  for (const block of pending) {
    for (const source of block.sources) retain(source);
  }
  const result: KanbanOverlayAffectedStack[] = [];
  for (const address of addresses.values()) {
    work.columnLookups += 1;
    const column = columnsById.get(address.columnId);
    const rect = column === undefined ? undefined : clip(column.rect, bounds);
    if (rect === undefined) continue;
    result.push(
      Object.freeze({
        columnId: address.columnId,
        ...(address.swimlaneId === undefined ? {} : { swimlaneId: address.swimlaneId }),
        rect,
      }),
    );
  }
  return Object.freeze(result);
}

/**
 * Composes transient drag and operation visuals over immutable authoritative scene geometry.
 *
 * The returned projection shares immutable authoritative values where safe, removes projected card
 * faces from ordinary drawing, and contains only bounded semantic overlay evidence.
 */
export function composeKanbanViewportOverlay(
  options: ComposeKanbanViewportOverlayOptions,
): KanbanViewportProjection & { readonly overlay: KanbanOverlayProjection } {
  try {
    const operations = projectKanbanOperations(options.authoritative, options.operations ?? [], options.bounds);
    const drag = options.drag;
    const structure =
      options.structuralDrag === undefined ? undefined : projectStructuralDrag(options.structuralDrag, options.bounds);
    if (
      drag === undefined &&
      structure === undefined &&
      operations.pending.length === 0 &&
      operations.feedback.length === 0 &&
      operations.blockedCardKeys.size === 0 &&
      operations.blockedColumnIds.size === 0 &&
      operations.blockedSwimlaneIds.size === 0
    ) {
      return Object.freeze({ ...options.authoritative, overlay: EMPTY_OVERLAY });
    }
    const work: MutableKanbanOverlayProjectionWork = {
      indexedCards: options.authoritative.cards.length,
      cardLookups: 0,
      indexedColumns: options.authoritative.columns.length,
      columnLookups: 0,
      operationIndexedCards: operations.work.indexedCards,
      operationCellLookups:
        operations.work.cardCellLookups + operations.work.cellLookups + operations.work.columnLookups,
      operationShiftEvents: 0,
      operationShiftLookups: 0,
    };
    const pendingShifts = indexPendingShifts(operations.pending, work);
    const cardsByCell = new Map(
      options.authoritative.cards.map((card) => [
        cardCellIdentity(card.descriptor.cardKey, {
          columnId: card.columnId,
          ...(card.swimlaneId === undefined ? {} : { swimlaneId: card.swimlaneId }),
        }),
        card,
      ]),
    );
    const columnsById = new Map(options.authoritative.columns.map((column) => [column.columnId, column]));
    const visibleIdentities = new Set(
      options.authoritative.cards.map(({ descriptor }) => cardIdentity(descriptor.cardKey)),
    );
    const projectedIdentities = new Set(operations.projectedCardKeys.map(cardIdentity));
    for (const placeholder of drag?.placeholders ?? []) {
      for (const cardKey of placeholder.cardKeys) {
        const identity = cardIdentity(cardKey);
        if (visibleIdentities.has(identity)) projectedIdentities.add(identity);
      }
    }
    const gap = drag === undefined ? undefined : projectGap(drag, options.density, options.bounds, options.translate);
    const cards = Object.freeze(
      options.authoritative.cards
        .filter((card) => !projectedIdentities.has(cardIdentity(card.descriptor.cardKey)))
        .flatMap((card): readonly KanbanProjectedCard[] => {
          let verticalShift = 0;
          if (
            options.density === 'compact' &&
            gap !== undefined &&
            inCell(card, gap.address) &&
            card.rect.y >= gap.rect.y
          ) {
            verticalShift += 1;
          }
          verticalShift += pendingShiftAt(pendingShifts, card, work);
          if (verticalShift === 0) return [card];
          const rect = clip({ ...card.rect, y: card.rect.y + verticalShift }, options.bounds);
          return rect === undefined ? [] : [Object.freeze({ ...card, rect })];
        }),
    );
    const actionTargets = Object.freeze(
      options.authoritative.actionTargets.filter((target) => {
        const targetCardKey = target.cardKey;
        if (targetCardKey !== undefined && operations.blockedCardKeys.has(cardIdentity(targetCardKey))) return false;
        if (target.columnId !== undefined && operations.blockedColumnIds.has(target.columnId)) return false;
        if (target.swimlaneId !== undefined && operations.blockedSwimlaneIds.has(target.swimlaneId)) return false;
        if (target.address !== undefined) {
          if (operations.blockedColumnIds.has(target.address.columnId)) return false;
          if (target.address.swimlaneId !== undefined && operations.blockedSwimlaneIds.has(target.address.swimlaneId)) {
            return false;
          }
        }
        return targetCardKey === undefined || !projectedIdentities.has(cardIdentity(targetCardKey));
      }),
    );
    const placeholders = Object.freeze([
      ...(drag === undefined ? [] : projectPlaceholders(cardsByCell, drag, options.bounds, work)),
      ...projectPendingPlaceholders(cardsByCell, operations.pending, options.bounds, work),
    ]);
    const overlay: KanbanOverlayProjection = Object.freeze({
      placeholders,
      ...(gap === undefined ? {} : { gap }),
      ...(drag === undefined ? {} : { ghost: projectGhost(options.authoritative, drag, options.bounds) }),
      pending: operations.pending,
      feedback: operations.feedback,
      affectedStacks: affectedStacks(columnsById, drag, operations.pending, options.bounds, work),
      ...(structure === undefined ? {} : { structure }),
    });
    reportProjectionWork(options.inspectWork, work);
    return Object.freeze({ ...options.authoritative, cards, actionTargets, overlay });
  } catch {
    return Object.freeze({
      ...options.authoritative,
      actionTargets: Object.freeze([]),
      overlay: EMPTY_OVERLAY,
      overlayFailure: 'composition-failed' as const,
    });
  }
}
