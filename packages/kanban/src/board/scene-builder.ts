import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanCardKey, createKanbanSwimlaneId } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import { snapshotKanbanCellState } from '../source/states.js';
import { snapshotKanbanColumnMeta } from '../source/validation.js';
import type { KanbanCellAddress } from '../source/types.js';
import type {
  KanbanScene,
  KanbanSceneCard,
  KanbanSceneCardDescriptor,
  KanbanSceneCell,
  KanbanSceneLimitState,
  KanbanSceneSwimlane,
} from './scene-model.js';

/** Options accepted by the canonical scene builder's untrusted pure boundary. */
export interface BuildKanbanSceneOptions {
  /** Equality-only scene revision. */
  readonly revision: KanbanRevision;
  /** Active query generation. */
  readonly queryGeneration: number;
  /** Owning query-session revision. */
  readonly sessionRevision: KanbanRevision;
  /** Source-ordered workflow-column metadata. */
  readonly columns: readonly unknown[];
  /** Source-ordered visible swimlane metadata. */
  readonly swimlanes: readonly unknown[];
  /** Occupied or explicitly retained source cells. */
  readonly cells: readonly unknown[];
  /** Hidden and collapsed evidence retained outside visible scene nodes. */
  readonly detached: unknown;
  /** Maximum resident descriptors allowed in the completed scene. */
  readonly descriptorLimit: number;
}

/** Exact top-level members accepted by the pure scene boundary. */
const BUILD_KEYS = new Set([
  'revision',
  'queryGeneration',
  'sessionRevision',
  'columns',
  'swimlanes',
  'cells',
  'detached',
  'descriptorLimit',
]);

/** Returns one non-negative safe integer no larger than a finite ceiling. */
function boundedInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Narrows one semantic snapshot to its immutable record branch. */
function isSemanticRecord(value: KanbanSemanticValue): value is { readonly [key: string]: KanbanSemanticValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Converts a semantic snapshot to its record form without an unsafe cast. */
function semanticRecord(value: KanbanSemanticValue): Readonly<Record<string, KanbanSemanticValue>> {
  if (!isSemanticRecord(value)) throw new KanbanInvalidGeometryError();
  return value;
}

/** Creates one bounded safe structural label. */
function safeLabel(value: unknown): string {
  if (typeof value !== 'string') throw new KanbanInvalidGeometryError();
  const label = sanitizeContractText(value, KANBAN_LIMITS.semanticStringBytes.safe)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  if (label.length === 0) throw new KanbanInvalidGeometryError();
  return label;
}

/** Snapshots one visible swimlane and optional aggregate evidence. */
function snapshotSwimlane(value: unknown): KanbanSceneSwimlane {
  try {
    const properties = snapshotKanbanDataProperties(value, 4);
    if (typeof properties.swimlaneId !== 'string') throw new KanbanInvalidGeometryError();
    const allowed = new Set(['swimlaneId', 'label', 'revision', 'count']);
    if (Object.keys(properties).some((key) => !allowed.has(key))) throw new KanbanInvalidGeometryError();
    return Object.freeze({
      swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
      label: safeLabel(properties.label),
      revision: snapshotKanbanRevision(properties.revision),
      ...(properties.count === undefined ? {} : { count: snapshotKanbanSemanticValue(properties.count) }),
    });
  } catch {
    throw new KanbanInvalidGeometryError();
  }
}

/** Snapshots the descriptor members needed before exact geometry projection. */
function snapshotDescriptor(value: unknown, expectedCardKey: CardKey): KanbanSceneCardDescriptor {
  try {
    const semantic = snapshotKanbanSemanticValue(value);
    const properties = semanticRecord(semantic);
    if (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') {
      throw new KanbanInvalidGeometryError();
    }
    const cardKey = createKanbanCardKey(properties.cardKey);
    if (cardKey !== expectedCardKey) throw new KanbanInvalidGeometryError();
    const width = boundedInteger(properties.width, 512);
    const measuredHeight = boundedInteger(properties.measuredHeight, KANBAN_LIMITS.descriptorRows.absolute);
    if (width === 0 || measuredHeight === 0) throw new KanbanInvalidGeometryError();
    const rawRevision = properties.presentationRevision;
    const presentationRevision = rawRevision === undefined ? undefined : snapshotKanbanRevision(rawRevision);
    return Object.freeze({
      cardKey,
      width,
      measuredHeight,
      ...(presentationRevision === undefined ? {} : { presentationRevision }),
      value: semantic,
    });
  } catch {
    throw new KanbanInvalidGeometryError();
  }
}

/** Snapshots one resident card under its already-validated semantic cell address. */
function snapshotCard(value: unknown, address: KanbanCellAddress): KanbanSceneCard {
  try {
    const properties = snapshotKanbanDataProperties(value, 6);
    const allowed = new Set(['cardKey', 'logicalIndex', 'entityRevision', 'descriptor', 'interaction', 'workflow']);
    if (Object.keys(properties).length !== allowed.size || Object.keys(properties).some((key) => !allowed.has(key))) {
      throw new KanbanInvalidGeometryError();
    }
    if (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') {
      throw new KanbanInvalidGeometryError();
    }
    const cardKey = createKanbanCardKey(properties.cardKey);
    return Object.freeze({
      cardKey,
      address,
      logicalIndex: boundedInteger(properties.logicalIndex),
      entityRevision: snapshotKanbanRevision(properties.entityRevision),
      descriptor: snapshotDescriptor(properties.descriptor, cardKey),
      interaction: snapshotKanbanSemanticValue(properties.interaction),
      workflow: snapshotKanbanSemanticValue(properties.workflow),
    });
  } catch {
    throw new KanbanInvalidGeometryError();
  }
}

/** Snapshots one occupied or explicitly retained cell and applies the global descriptor budget. */
function snapshotCell(value: unknown, remaining: number): { readonly cell: KanbanSceneCell; readonly omitted: number } {
  try {
    const properties = snapshotKanbanDataProperties(value, 4);
    const allowed = new Set(['address', 'cursorRevision', 'state', 'cards']);
    if (Object.keys(properties).length !== allowed.size || Object.keys(properties).some((key) => !allowed.has(key))) {
      throw new KanbanInvalidGeometryError();
    }
    const address = snapshotKanbanCellAddress(properties.address);
    const rawCards = snapshotKanbanDataArray(properties.cards, KANBAN_LIMITS.ensureRangeCards.absolute);
    const retainedCount = Math.min(remaining, rawCards.length);
    const cards = Object.freeze(rawCards.slice(0, retainedCount).map((card) => snapshotCard(card, address)));
    return Object.freeze({
      cell: Object.freeze({
        address,
        cursorRevision: snapshotKanbanRevision(properties.cursorRevision),
        state: snapshotKanbanCellState(properties.state),
        cards,
      }),
      omitted: rawCards.length - retainedCount,
    });
  } catch {
    throw new KanbanInvalidGeometryError();
  }
}

/**
 * Builds one immutable geometry-free semantic scene from bounded resident source data.
 *
 * Cells remain source ordered and sparse. Descriptor overflow clips deterministically before any
 * geometry or hit target exists, and detached hidden/collapsed evidence remains non-renderable.
 *
 * @example
 * ```ts
 * const scene = buildKanbanScene({
 *   revision: 'scene-v1',
 *   queryGeneration: 1,
 *   sessionRevision: 'session-v1',
 *   columns: [],
 *   swimlanes: [],
 *   cells: [],
 *   detached: { hidden: [], collapsed: [] },
 *   descriptorLimit: 256,
 * });
 * ```
 */
export function buildKanbanScene(options: BuildKanbanSceneOptions): KanbanScene {
  try {
    const properties = snapshotKanbanDataProperties(options, BUILD_KEYS.size);
    validateKanbanDataKeys(properties, BUILD_KEYS);
    if (Object.keys(properties).length !== BUILD_KEYS.size) throw new KanbanInvalidGeometryError();
    const descriptorLimit = boundedInteger(properties.descriptorLimit, KANBAN_LIMITS.retainedDescriptors.absolute);
    const columns = Object.freeze(
      snapshotKanbanDataArray(properties.columns, KANBAN_LIMITS.columns.absolute).map(snapshotKanbanColumnMeta),
    );
    const swimlanes = Object.freeze(
      snapshotKanbanDataArray(properties.swimlanes, KANBAN_LIMITS.swimlanes.absolute).map(snapshotSwimlane),
    );
    const rawCells = snapshotKanbanDataArray(properties.cells, KANBAN_LIMITS.retainedCursors.absolute);
    const cells: KanbanSceneCell[] = [];
    const cards: KanbanSceneCard[] = [];
    const states: KanbanSceneLimitState[] = [];
    let remaining = descriptorLimit;
    for (const rawCell of rawCells) {
      const resolved = snapshotCell(rawCell, remaining);
      cells.push(resolved.cell);
      cards.push(...resolved.cell.cards);
      remaining -= resolved.cell.cards.length;
      if (resolved.omitted > 0) {
        states.push(
          Object.freeze({
            code: 'descriptor-limit',
            scope: Object.freeze({ kind: 'cell', address: resolved.cell.address }),
            actionable: false,
            omittedCount: resolved.omitted,
          }),
        );
      }
    }
    if (new Set(columns.map(({ columnId }) => columnId)).size !== columns.length) {
      throw new KanbanInvalidGeometryError();
    }
    if (new Set(swimlanes.map(({ swimlaneId }) => swimlaneId)).size !== swimlanes.length) {
      throw new KanbanInvalidGeometryError();
    }
    if (new Set(cells.map(({ address }) => canonicalizeKanbanCellAddress(address))).size !== cells.length) {
      throw new KanbanInvalidGeometryError();
    }
    if (new Set(cards.map(({ cardKey }) => JSON.stringify([typeof cardKey, cardKey]))).size !== cards.length) {
      throw new KanbanInvalidGeometryError();
    }
    const columnIds = new Set(columns.map(({ columnId }) => columnId));
    const swimlaneIds = new Set(swimlanes.map(({ swimlaneId }) => swimlaneId));
    if (
      cells.some(
        ({ address }) =>
          !columnIds.has(address.columnId) ||
          (address.swimlaneId !== undefined && !swimlaneIds.has(address.swimlaneId)),
      )
    ) {
      throw new KanbanInvalidGeometryError();
    }
    return Object.freeze({
      revision: snapshotKanbanRevision(properties.revision),
      queryGeneration: boundedInteger(properties.queryGeneration),
      sessionRevision: snapshotKanbanRevision(properties.sessionRevision),
      columns,
      swimlanes,
      cells: Object.freeze(cells),
      cards: Object.freeze(cards),
      states: Object.freeze(states),
      detached: snapshotKanbanSemanticValue(properties.detached),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidGeometryError) throw error;
    throw new KanbanInvalidGeometryError();
  }
}
