import type { Rect } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import type { CardKey } from '../contract/identity.js';
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
  /** Fixed identity/count label safe for inspection. */
  readonly label: string;
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

/** Returns whether a card belongs to one semantic source cell. */
function inCell(card: KanbanProjectedCard, address: KanbanCellAddress): boolean {
  return card.columnId === address.columnId && card.swimlaneId === address.swimlaneId;
}

/** Maps validated policy evidence to fixed safe renderer vocabulary. */
function dropPresentation(
  eligibility: KanbanEligibility,
): Omit<KanbanProjectedDropGap, 'slotId' | 'address' | 'eligibility' | 'rect'> {
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
        messageKey: 'kanban.drop.warning',
        label: 'Warning',
        asciiMarker: '!' as const,
        unicodeMarker: '⚠' as const,
      });
    case 'blocked':
      return Object.freeze({
        visualState: 'invalid' as const,
        messageKey: 'kanban.drop.blocked',
        label: 'Blocked',
        asciiMarker: 'x' as const,
        unicodeMarker: '×' as const,
      });
    case 'unavailable':
      return Object.freeze({
        visualState: 'unavailable' as const,
        messageKey: 'kanban.drop.unavailable',
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

/** Creates one viewport-bounded ghost sized from the visible origin card or a compact fallback. */
function projectGhost(
  projection: KanbanViewportProjection,
  drag: KanbanDragOverlayEvidence,
  bounds: Readonly<Rect>,
): KanbanProjectedDragGhost | undefined {
  if (bounds.width < 1 || bounds.height < 1) return undefined;
  const origin = projection.cards.find((card) => sameCard(card.descriptor.cardKey, drag.ghost.cardKey));
  const width = Math.min(bounds.width, Math.max(3, Math.min(16, origin?.rect.width ?? 12)));
  const height = Math.min(bounds.height, Math.max(2, Math.min(3, origin?.rect.height ?? 3)));
  const x = Math.min(Math.max(bounds.x, drag.ghost.point.x + 1), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(bounds.y, drag.ghost.point.y + 1), bounds.y + bounds.height - height);
  const rect = clip({ x, y, width, height }, bounds);
  if (rect === undefined) return undefined;
  const identity = typeof drag.ghost.cardKey === 'number' ? String(drag.ghost.cardKey) : drag.ghost.cardKey;
  return Object.freeze({
    cardKey: drag.ghost.cardKey,
    count: drag.ghost.count,
    label: drag.ghost.count === 1 ? `#${identity}` : `${drag.ghost.count} cards`,
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
    if (drag === undefined && operations.pending.length === 0 && operations.feedback.length === 0) {
      return Object.freeze({ ...options.authoritative, overlay: EMPTY_OVERLAY });
    }
    const dragKeys = drag?.placeholders.flatMap(({ cardKeys }) => cardKeys) ?? [];
    const projectedKeys = [...dragKeys, ...operations.projectedCardKeys];
    const gap = drag === undefined ? undefined : projectGap(drag, options.density, options.bounds);
    const cards = Object.freeze(
      options.authoritative.cards
        .filter((card) => !projectedKeys.some((cardKey) => sameCard(card.descriptor.cardKey, cardKey)))
        .flatMap((card): readonly KanbanProjectedCard[] => {
          if (
            options.density !== 'compact' ||
            gap === undefined ||
            !inCell(card, gap.address) ||
            card.rect.y < gap.rect.y
          ) {
            return [card];
          }
          const rect = clip({ ...card.rect, y: card.rect.y + 1 }, options.bounds);
          return rect === undefined ? [] : [Object.freeze({ ...card, rect })];
        }),
    );
    const actionTargets = Object.freeze(
      options.authoritative.actionTargets.filter((target) => {
        const targetCardKey = target.cardKey;
        return targetCardKey === undefined || !projectedKeys.some((cardKey) => sameCard(targetCardKey, cardKey));
      }),
    );
    const placeholders =
      drag === undefined ? Object.freeze([]) : projectPlaceholders(options.authoritative, drag, options.bounds);
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
    return Object.freeze({ ...options.authoritative, overlay: EMPTY_OVERLAY });
  }
}
