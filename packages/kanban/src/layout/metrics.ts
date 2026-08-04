import type { Rect } from '@jsvision/ui';

import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanCellAddress } from '../source/types.js';

/** Responsive viewport presentation mode. */
export type KanbanViewportMode = 'multi-column' | 'focused-column' | 'minimum-size';

/** Immutable horizontal and vertical cell coordinates or extents. */
export interface KanbanViewportPoint {
  /** Horizontal terminal-cell value. */
  readonly x: number;
  /** Vertical terminal-cell value. */
  readonly y: number;
}

/** Visible half-open logical card range for one retained source cell. */
export interface KanbanVisibleCardRange {
  /** Canonical column/swimlane address. */
  readonly address: KanbanCellAddress;
  /** First retained logical card index. */
  readonly start: number;
  /** Exclusive retained logical card index. */
  readonly end: number;
}

/** Read-only exact-cell projection metrics exposed by a mounted viewport. */
export interface KanbanViewportMetrics {
  /** Parent-relative rectangle currently assigned by layout. */
  readonly assignedRect: Readonly<Rect>;
  /** Active responsive presentation mode. */
  readonly mode: KanbanViewportMode;
  /** Clamped horizontal and vertical scroll offsets. */
  readonly offsets: KanbanViewportPoint;
  /** Greatest currently valid horizontal and vertical offsets. */
  readonly extents: KanbanViewportPoint;
  /** Source-ordered columns intersecting the retained projection. */
  readonly visibleColumnIds: readonly string[];
  /** Visible and overscan logical ranges keyed by cell address. */
  readonly visibleCardRanges: readonly KanbanVisibleCardRange[];
  /** Sticky rows removed from the scrolling card rectangle. */
  readonly stickyRows: number;
  /** Effective finite overscan retained around the visible projection. */
  readonly overscan: KanbanViewportPoint;
  /** Private lifecycle generation projected as an opaque monotone number for diagnostics. */
  readonly generation: number;
  /** Equality-only source revision represented by this snapshot. */
  readonly sourceRevision?: KanbanRevision;
}
