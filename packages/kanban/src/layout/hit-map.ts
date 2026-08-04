import type { Rect } from '@jsvision/ui';

import type { CardKey } from '../contract/identity.js';
import type { KanbanCellState } from '../source/states.js';
import type { KanbanCellAddress } from '../source/types.js';

/** Semantic rectangle emitted by pure layout projection for inspection or future interaction. */
export interface KanbanLayoutRegion extends Readonly<Rect> {
  /** Region meaning; Phase A keeps every emitted region non-actionable. */
  readonly kind:
    'workflow-header' | 'swimlane-header' | 'insertion-gutter' | 'card' | 'card-gap' | 'state' | 'minimum-size';
  /** Whether current input may target this region. */
  readonly actionable: boolean;
  /** Stable card identity for card rectangles. */
  readonly cardKey?: CardKey;
}

/** Future-proof actionable hit entry; Phase A viewport snapshots always expose an empty list. */
export interface KanbanActionTarget extends Readonly<Rect> {
  /** Stable allowlisted target kind. */
  readonly kind: 'retry';
  /** Source cell that owns the action. */
  readonly address?: KanbanCellAddress;
}

/** Bounded changed rectangle returned by viewport damage calculation. */
export interface KanbanDamageRegion extends Readonly<Rect> {
  /** Stable source of the damage request. */
  readonly kind: 'descriptor' | 'sticky' | 'state' | 'scroll-exposed' | 'whole-viewport';
}

/** Detached inspection state for one retained source cell. */
export interface KanbanInspectedCell {
  /** Canonical source coordinate. */
  readonly address: KanbanCellAddress;
  /** Safe source state with no application record payload. */
  readonly state: KanbanCellState;
}

/** Detached visible-card evidence suitable for tests and modeless inspectors. */
export interface KanbanInspectedCard {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Containing workflow column identity. */
  readonly columnId: string;
  /** Sanitized visible title projection. */
  readonly title: string;
  /** Non-color marker projected with the visible descriptor. */
  readonly marker: { readonly cues: readonly string[] };
}

/** Detached visible-column evidence with the complete sanitized semantic label. */
export interface KanbanInspectedColumn {
  /** Stable workflow-column identity. */
  readonly columnId: string;
  /** Complete bounded sanitized label before visual ellipsis. */
  readonly label: string;
}
