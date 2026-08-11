import type { Rect } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import type { CardKey } from '../contract/identity.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import type { KanbanDragOverlayEvidence } from '../interaction/drag-types.js';
import type { KanbanEligibility } from '../operation/eligibility.js';
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
  /** Bounded payload-free operation snapshots in admission order. */
  readonly operations?: readonly KanbanOperationSnapshot[];
}

/** Empty immutable overlay shared only by value, not by mutable state. */
const EMPTY_OVERLAY: KanbanOverlayProjection = Object.freeze({
  placeholders: Object.freeze([]),
  pending: Object.freeze([]),
  feedback: Object.freeze([]),
  affectedStacks: Object.freeze([]),
});

/** Clips a rectangle to current viewport-local bounds. */
function clip(rect: Readonly<Rect>, bounds: Readonly<Rect>): Readonly<Rect> | undefined {
  const x = Math.max(bounds.x, rect.x);
  const y = Math.max(bounds.y, rect.y);
  const right = Math.min(bounds.x + bounds.width, rect.x + rect.width);
  const bottom = Math.min(bounds.y + bounds.height, rect.y + rect.height);
  return right <= x || bottom <= y ? undefined : Object.freeze({ x, y, width: right - x, height: bottom - y });
}

/** Checks type-preserving card identity equality. */
function sameCard(left: CardKey, right: CardKey): boolean {
  return typeof left === typeof right && left === right;
}

/** Returns a collision-safe type-preserving identity for bounded set membership. */
function cardIdentity(cardKey: CardKey): string {
  return JSON.stringify([typeof cardKey, cardKey]);
}

/** Returns whether a card belongs to one semantic source cell. */
function inCell(card: KanbanProjectedCard, address: KanbanCellAddress): boolean {
  return card.columnId === address.columnId && card.swimlaneId === address.swimlaneId;
}

/** Maps validated policy evidence to fixed safe renderer vocabulary. */
function dropPresentation(
  eligibility: KanbanEligibility,
): Omit<KanbanProjectedDropGap, 'slotId' | 'address' | 'eligibility' | 'rect'> {
  const reasonKey =
    eligibility.kind === 'allowed'
      ? undefined
      : new Map<string, string>([
          ['wip-minimum-not-met', 'kanban.workflow.wip-minimum-not-met'],
          ['wip-maximum-exceeded', 'kanban.workflow.wip-maximum-exceeded'],
          ['wip-count-unavailable', 'kanban.workflow.wip-count-unavailable'],
          ['transition-unavailable', 'kanban.reason.transition-unavailable'],
          ['transition-blocked', 'kanban.operation.transition-blocked'],
          ['definition-of-done-not-met', 'kanban.operation.definition-of-done'],
          ['stale-placement', 'kanban.operation.stale-placement'],
          ['sorted-placement', 'kanban.operation.sorted-placement'],
          ['filtered-placement', 'kanban.operation.filtered-placement'],
        ]).get(eligibility.code);
  switch (eligibility.kind) {
    case 'allowed':
      return Object.freeze({
        visualState: 'valid' as const,
        messageKey: 'kanban.drop.allowed',
        label: 'Move here',
        asciiMarker: '>' as const,
        unicodeMarker: '▶' as const,
      });
    case 'warning':
      return Object.freeze({
        visualState: 'warning' as const,
        messageKey: reasonKey ?? 'kanban.drop.warning',
        label: 'Warning',
        asciiMarker: '!' as const,
        unicodeMarker: '⚠' as const,
      });
    case 'blocked':
      return Object.freeze({
        visualState: 'invalid' as const,
        messageKey: reasonKey ?? 'kanban.drop.blocked',
        label: 'Blocked',
        asciiMarker: 'x' as const,
        unicodeMarker: '×' as const,
      });
    case 'unavailable':
      return Object.freeze({
        visualState: 'unavailable' as const,
        messageKey: reasonKey ?? 'kanban.drop.unavailable',
        label: 'Unavailable',
        asciiMarker: '?' as const,
        unicodeMarker: '?' as const,
      });
  }
}

/** Creates placeholder fragments from current visible moved-card geometry. */
function projectPlaceholders(
  projection: KanbanViewportProjection,
  drag: KanbanDragOverlayEvidence,
  bounds: Readonly<Rect>,
): readonly KanbanProjectedSourcePlaceholder[] {
  const result: KanbanProjectedSourcePlaceholder[] = [];
  for (const placeholder of drag.placeholders) {
    for (const cardKey of placeholder.cardKeys) {
      const card = projection.cards.find(
        (candidate) => sameCard(candidate.descriptor.cardKey, cardKey) && inCell(candidate, placeholder.address),
      );
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
  projection: KanbanViewportProjection,
  pending: readonly KanbanProjectedPendingBlock[],
  bounds: Readonly<Rect>,
): readonly KanbanProjectedSourcePlaceholder[] {
  const result: KanbanProjectedSourcePlaceholder[] = [];
  for (const block of pending) {
    block.cardKeys.forEach((cardKey, index) => {
      const address = block.visibleSources[index];
      if (address === undefined) return;
      const card = projection.cards.find(
        (candidate) => sameCard(candidate.descriptor.cardKey, cardKey) && inCell(candidate, address),
      );
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
  const origin = projection.cards.find((card) => sameCard(card.descriptor.cardKey, drag.ghost.cardKey));
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
        ...dropPresentation(gap.eligibility),
      });
}

/** Returns clipped visible column stacks affected by a drag or pending block. */
function affectedStacks(
  projection: KanbanViewportProjection,
  drag: KanbanDragOverlayEvidence | undefined,
  pending: readonly KanbanProjectedPendingBlock[],
  bounds: Readonly<Rect>,
): readonly KanbanOverlayAffectedStack[] {
  const identities = new Set<string>();
  for (const placeholder of drag?.placeholders ?? []) {
    identities.add(JSON.stringify([placeholder.address.columnId, placeholder.address.swimlaneId ?? null]));
  }
  if (drag?.gap !== undefined) {
    identities.add(JSON.stringify([drag.gap.address.columnId, drag.gap.address.swimlaneId ?? null]));
  }
  for (const block of pending) identities.add(JSON.stringify([block.columnId, block.swimlaneId ?? null]));
  for (const block of pending) {
    for (const source of block.sources) {
      identities.add(JSON.stringify([source.columnId, source.swimlaneId ?? null]));
    }
  }
  const result: KanbanOverlayAffectedStack[] = [];
  for (const identity of identities) {
    const [columnId, swimlaneId] = JSON.parse(identity) as [string, string | null];
    const column = projection.columns.find((candidate) => candidate.columnId === columnId);
    const rect = column === undefined ? undefined : clip(column.rect, bounds);
    if (rect === undefined) continue;
    result.push(
      Object.freeze({
        columnId,
        ...(swimlaneId === null ? {} : { swimlaneId }),
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
    if (
      drag === undefined &&
      operations.pending.length === 0 &&
      operations.feedback.length === 0 &&
      operations.blockedCardKeys.size === 0 &&
      operations.blockedColumnIds.size === 0 &&
      operations.blockedSwimlaneIds.size === 0
    ) {
      return Object.freeze({ ...options.authoritative, overlay: EMPTY_OVERLAY });
    }
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
    const gap = drag === undefined ? undefined : projectGap(drag, options.density, options.bounds);
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
          for (const block of operations.pending) {
            if (!block.offscreen && inCell(card, block.target) && card.rect.y >= block.rect.y) {
              verticalShift += block.rect.height + 1;
            }
          }
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
      ...(drag === undefined ? [] : projectPlaceholders(options.authoritative, drag, options.bounds)),
      ...projectPendingPlaceholders(options.authoritative, operations.pending, options.bounds),
    ]);
    const overlay: KanbanOverlayProjection = Object.freeze({
      placeholders,
      ...(gap === undefined ? {} : { gap }),
      ...(drag === undefined ? {} : { ghost: projectGhost(options.authoritative, drag, options.bounds) }),
      pending: operations.pending,
      feedback: operations.feedback,
      affectedStacks: affectedStacks(options.authoritative, drag, operations.pending, options.bounds),
    });
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
