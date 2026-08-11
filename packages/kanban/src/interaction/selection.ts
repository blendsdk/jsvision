import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidSourcePublicationError } from '../contract/error.js';
import {
  createKanbanCardKey,
  createKanbanColumnId,
  createKanbanSwimlaneId,
  createPlacementToken,
} from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import type {
  KanbanRangeAnchor,
  KanbanSelectionEntry,
  KanbanSelectionSnapshot,
  KanbanServerSelectionReference,
} from './types.js';

/** Exact accepted members of one eligible selection candidate. */
const CANDIDATE_KEYS = new Set(['cardKey', 'address', 'entityRevision']);
/** Exact accepted members of one explicit range anchor. */
const RANGE_ANCHOR_KEYS = new Set(['cardKey', 'address']);
/** Exact accepted members of one opaque server-wide selection reference. */
const SERVER_SELECTION_KEYS = new Set(['token', 'revision', 'label']);
/** Exact accepted members of one selection-capture revision envelope. */
const CAPTURE_REVISION_KEYS = new Set(['sessionRevision', 'queryGeneration', 'viewRevision']);

/** One currently eligible card available to selection and immutable capture. */
export type KanbanEligibleSelectionCandidate = KanbanSelectionEntry;

/** Current source/query revisions attached to one eligible selection capture. */
export interface KanbanSelectionCaptureRevisions {
  /** Active query-session revision. */
  readonly sessionRevision: KanbanRevision;
  /** Active query generation. */
  readonly queryGeneration: number;
  /** Optional application saved-view revision. */
  readonly viewRevision?: KanbanRevision;
}

/** Immutable outcome from one ordered selection mutation. */
export interface KanbanSelectionUpdate {
  /** Whether the requested operation committed, changed nothing, or exceeded the configured limit. */
  readonly kind: 'changed' | 'unchanged' | 'limit-exceeded';
  /** Ordered type-preserving selected identities after settlement. */
  readonly selectedCardKeys: readonly CardKey[];
  /** Current explicit range anchor, when one remains active. */
  readonly rangeAnchor?: KanbanRangeAnchor;
  /** Exact number removed by a visibility prune. */
  readonly removedCount?: number;
}

/** Creates a collision-safe membership key while preserving numeric and string identity. */
function membershipKey(cardKey: CardKey): string {
  return JSON.stringify([typeof cardKey, cardKey]);
}

/** Raises the bounded public error used for malformed interaction evidence. */
function invalidPublication(): never {
  throw new KanbanInvalidSourcePublicationError();
}

/** Validates a type-preserving card key read from detached contract data. */
function cardKey(value: unknown): CardKey {
  if (typeof value !== 'string' && typeof value !== 'number') return invalidPublication();
  try {
    return createKanbanCardKey(value);
  } catch {
    return invalidPublication();
  }
}

/** Validates one deleted structural identity without exposing rejected input. */
function structuralId(value: unknown, kind: 'column' | 'swimlane'): string {
  if (typeof value !== 'string') return invalidPublication();
  try {
    return kind === 'column' ? createKanbanColumnId(value) : createKanbanSwimlaneId(value);
  } catch {
    return invalidPublication();
  }
}

/** Validates one candidate without retaining application-owned objects or invoking accessors. */
export function snapshotKanbanSelectionEntry(value: unknown): KanbanEligibleSelectionCandidate {
  try {
    const properties = snapshotKanbanDataProperties(value, CANDIDATE_KEYS.size);
    validateKanbanDataKeys(properties, CANDIDATE_KEYS);
    if (Object.keys(properties).length !== CANDIDATE_KEYS.size) return invalidPublication();
    return Object.freeze({
      cardKey: cardKey(properties.cardKey),
      address: snapshotKanbanCellAddress(properties.address),
      entityRevision: snapshotKanbanRevision(properties.entityRevision),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates one non-negative query generation. */
function generation(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new KanbanInvalidSourcePublicationError();
  return value;
}

/** Validates and detaches a range anchor without reading application-owned accessors. */
function rangeAnchor(value: unknown): KanbanRangeAnchor {
  try {
    const properties = snapshotKanbanDataProperties(value, RANGE_ANCHOR_KEYS.size);
    validateKanbanDataKeys(properties, RANGE_ANCHOR_KEYS);
    if (Object.keys(properties).length !== RANGE_ANCHOR_KEYS.size) return invalidPublication();
    return Object.freeze({
      cardKey: cardKey(properties.cardKey),
      address: snapshotKanbanCellAddress(properties.address),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates and detaches revisions attached to one immutable selection capture. */
function captureRevisions(value: unknown): KanbanSelectionCaptureRevisions {
  try {
    const properties = snapshotKanbanDataProperties(value, CAPTURE_REVISION_KEYS.size);
    validateKanbanDataKeys(properties, CAPTURE_REVISION_KEYS);
    if (properties.sessionRevision === undefined || typeof properties.queryGeneration !== 'number') {
      return invalidPublication();
    }
    return Object.freeze({
      sessionRevision: snapshotKanbanRevision(properties.sessionRevision),
      queryGeneration: generation(properties.queryGeneration),
      ...(properties.viewRevision === undefined
        ? {}
        : { viewRevision: snapshotKanbanRevision(properties.viewRevision) }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Detaches a bounded candidate sequence and rejects duplicate identities. */
function candidates(values: readonly KanbanEligibleSelectionCandidate[]): readonly KanbanEligibleSelectionCandidate[] {
  const snapshot = snapshotKanbanDataArray(values, KANBAN_LIMITS.selectedKeys.absolute).map(
    snapshotKanbanSelectionEntry,
  );
  const keys = snapshot.map((entry) => membershipKey(entry.cardKey));
  if (new Set(keys).size !== keys.length) throw new KanbanInvalidSourcePublicationError();
  return Object.freeze(snapshot);
}

/** Snapshots a bounded server-wide token without invoking accessors, interpreting, or expanding it. */
function serverSelection(value: unknown): KanbanServerSelectionReference {
  try {
    const properties = snapshotKanbanDataProperties(value, SERVER_SELECTION_KEYS.size);
    validateKanbanDataKeys(properties, SERVER_SELECTION_KEYS);
    if (typeof properties.token !== 'string') return invalidPublication();
    if (properties.label !== undefined && typeof properties.label !== 'string') return invalidPublication();
    const label =
      properties.label === undefined
        ? undefined
        : sanitizeContractText(properties.label, KANBAN_LIMITS.semanticStringBytes.safe).trim();
    return Object.freeze({
      token: createPlacementToken(properties.token),
      ...(properties.revision === undefined ? {} : { revision: snapshotKanbanRevision(properties.revision) }),
      ...(label === undefined || label.length === 0 ? {} : { label }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Creates one detached mutation outcome from current model state. */
function update(
  kind: KanbanSelectionUpdate['kind'],
  selected: readonly KanbanEligibleSelectionCandidate[],
  anchor: KanbanRangeAnchor | undefined,
  removedCount?: number,
): KanbanSelectionUpdate {
  return Object.freeze({
    kind,
    selectedCardKeys: Object.freeze(selected.map((entry) => entry.cardKey)),
    ...(anchor === undefined ? {} : { rangeAnchor: anchor }),
    ...(removedCount === undefined ? {} : { removedCount }),
  });
}

/**
 * Bounded ordered selection state used by one interaction controller.
 *
 * The model stores a sequence for public order and a separate membership map for constant-time
 * lookup. Every multi-entry operation validates and counts its complete candidate set before commit,
 * so a limit failure never publishes a truncated selection.
 */
export class KanbanSelectionModel {
  readonly #maximumSelectedKeys: number;
  #selected: readonly KanbanEligibleSelectionCandidate[] = Object.freeze([]);
  #membership = new Map<string, KanbanEligibleSelectionCandidate>();
  #rangeAnchor: KanbanRangeAnchor | undefined;
  #serverSelection: KanbanServerSelectionReference | undefined;

  /** Creates an empty model under one already-resolved selected-key ceiling. */
  constructor(maximumSelectedKeys: number) {
    if (
      !Number.isSafeInteger(maximumSelectedKeys) ||
      maximumSelectedKeys < 0 ||
      maximumSelectedKeys > KANBAN_LIMITS.selectedKeys.absolute
    ) {
      throw new KanbanInvalidSourcePublicationError();
    }
    this.#maximumSelectedKeys = maximumSelectedKeys;
  }

  /** Returns current ordered keys without exposing the internal membership map. */
  selectedCardKeys(): readonly CardKey[] {
    return Object.freeze(this.#selected.map((entry) => entry.cardKey));
  }

  /** Returns the current detached range anchor. */
  rangeAnchor(): KanbanRangeAnchor | undefined {
    return this.#rangeAnchor;
  }

  /** Returns the separate opaque server-wide reference. */
  serverSelection(): KanbanServerSelectionReference | undefined {
    return this.#serverSelection;
  }

  /** Replaces ordered selection with exactly one eligible candidate. */
  replace(value: KanbanEligibleSelectionCandidate): KanbanSelectionUpdate {
    if (this.#maximumSelectedKeys === 0) return update('limit-exceeded', this.#selected, this.#rangeAnchor);
    const entry = snapshotKanbanSelectionEntry(value);
    const unchanged =
      this.#selected.length === 1 && membershipKey(this.#selected[0]!.cardKey) === membershipKey(entry.cardKey);
    this.#commit(Object.freeze([entry]));
    this.#rangeAnchor = Object.freeze({ cardKey: entry.cardKey, address: entry.address });
    return update(unchanged ? 'unchanged' : 'changed', this.#selected, this.#rangeAnchor);
  }

  /** Toggles one eligible candidate without changing the relative order of other members. */
  toggle(value: KanbanEligibleSelectionCandidate): KanbanSelectionUpdate {
    const entry = snapshotKanbanSelectionEntry(value);
    const key = membershipKey(entry.cardKey);
    if (this.#membership.has(key)) {
      this.#commit(Object.freeze(this.#selected.filter((selected) => membershipKey(selected.cardKey) !== key)));
      if (this.#rangeAnchor?.cardKey === entry.cardKey) this.#rangeAnchor = undefined;
      return update('changed', this.#selected, this.#rangeAnchor);
    }
    if (this.#selected.length >= this.#maximumSelectedKeys) {
      return update('limit-exceeded', this.#selected, this.#rangeAnchor);
    }
    this.#commit(Object.freeze([...this.#selected, entry]));
    this.#rangeAnchor = Object.freeze({ cardKey: entry.cardKey, address: entry.address });
    return update('changed', this.#selected, this.#rangeAnchor);
  }

  /** Replaces selection with the contiguous visible range between anchor and destination in one cell. */
  range(
    visibleCell: readonly KanbanEligibleSelectionCandidate[],
    anchor: KanbanRangeAnchor,
    destination: CardKey,
  ): KanbanSelectionUpdate {
    const visible = candidates(visibleCell);
    const safeAnchor = rangeAnchor(anchor);
    const destinationKey = membershipKey(cardKey(destination));
    const sameCell = visible.every(
      (entry) => canonicalizeKanbanCellAddress(entry.address) === canonicalizeKanbanCellAddress(safeAnchor.address),
    );
    const anchorIndex = visible.findIndex(
      (entry) => membershipKey(entry.cardKey) === membershipKey(safeAnchor.cardKey),
    );
    const destinationIndex = visible.findIndex((entry) => membershipKey(entry.cardKey) === destinationKey);
    if (!sameCell || anchorIndex < 0 || destinationIndex < 0) {
      this.#rangeAnchor = undefined;
      return update('unchanged', this.#selected, undefined);
    }
    const start = Math.min(anchorIndex, destinationIndex);
    const end = Math.max(anchorIndex, destinationIndex) + 1;
    const replacement = Object.freeze(visible.slice(start, end));
    if (replacement.length > this.#maximumSelectedKeys) {
      return update('limit-exceeded', this.#selected, this.#rangeAnchor);
    }
    this.#commit(replacement);
    this.#rangeAnchor = safeAnchor;
    return update('changed', this.#selected, this.#rangeAnchor);
  }

  /** Atomically selects exactly the bounded loaded visible matching candidates in scene order. */
  selectLoadedVisibleMatching(values: readonly KanbanEligibleSelectionCandidate[]): KanbanSelectionUpdate {
    const replacement = candidates(values);
    if (replacement.length > this.#maximumSelectedKeys) {
      return update('limit-exceeded', this.#selected, this.#rangeAnchor);
    }
    const unchanged =
      replacement.length === this.#selected.length &&
      replacement.every(
        (entry, index) => membershipKey(entry.cardKey) === membershipKey(this.#selected[index]!.cardKey),
      );
    this.#commit(replacement);
    this.#rangeAnchor = replacement[0]
      ? Object.freeze({ cardKey: replacement[0].cardKey, address: replacement[0].address })
      : undefined;
    return update(unchanged ? 'unchanged' : 'changed', this.#selected, this.#rangeAnchor);
  }

  /** Clears an explicit multi-selection while leaving zero-or-one implicit focus membership intact. */
  clearMultiple(): KanbanSelectionUpdate {
    if (this.#selected.length <= 1) return update('unchanged', this.#selected, this.#rangeAnchor);
    this.#commit(Object.freeze([]));
    this.#rangeAnchor = undefined;
    return update('changed', this.#selected, undefined);
  }

  /** Ends range extension without changing current ordered membership. */
  endRangeExtension(): KanbanSelectionUpdate {
    if (this.#rangeAnchor === undefined) return update('unchanged', this.#selected, undefined);
    this.#rangeAnchor = undefined;
    return update('changed', this.#selected, undefined);
  }

  /** Prunes view-hidden membership, while a cursor unload deliberately removes nothing. */
  prune(visibleCardKeys: readonly CardKey[], reason: 'visibility' | 'cursor-unload'): KanbanSelectionUpdate {
    if (reason === 'cursor-unload') return update('unchanged', this.#selected, this.#rangeAnchor, 0);
    if (reason !== 'visibility') return invalidPublication();
    const visible = new Set(
      snapshotKanbanDataArray(visibleCardKeys, KANBAN_LIMITS.selectedKeys.absolute).map((key) =>
        membershipKey(cardKey(key)),
      ),
    );
    const replacement = Object.freeze(this.#selected.filter((entry) => visible.has(membershipKey(entry.cardKey))));
    const removedCount = this.#selected.length - replacement.length;
    if (removedCount === 0) return update('unchanged', this.#selected, this.#rangeAnchor, 0);
    this.#commit(replacement);
    if (this.#rangeAnchor !== undefined && !visible.has(membershipKey(this.#rangeAnchor.cardKey))) {
      this.#rangeAnchor = undefined;
    }
    return update('changed', this.#selected, this.#rangeAnchor, removedCount);
  }

  /** Removes only cards or containing structures named by authoritative source deletion evidence. */
  pruneDeleted(deletions: {
    readonly cardKeys: readonly CardKey[];
    readonly columnIds: readonly string[];
    readonly swimlaneIds: readonly string[];
  }): KanbanSelectionUpdate {
    const deleted = new Set(
      snapshotKanbanDataArray(deletions.cardKeys, KANBAN_LIMITS.selectedKeys.absolute).map((key) =>
        membershipKey(cardKey(key)),
      ),
    );
    const deletedColumns = new Set(
      snapshotKanbanDataArray(deletions.columnIds, KANBAN_LIMITS.columns.absolute).map((id) =>
        structuralId(id, 'column'),
      ),
    );
    const deletedSwimlanes = new Set(
      snapshotKanbanDataArray(deletions.swimlaneIds, KANBAN_LIMITS.swimlanes.absolute).map((id) =>
        structuralId(id, 'swimlane'),
      ),
    );
    if (deleted.size === 0 && deletedColumns.size === 0 && deletedSwimlanes.size === 0) {
      return update('unchanged', this.#selected, this.#rangeAnchor, 0);
    }
    const isDeleted = (entry: KanbanEligibleSelectionCandidate): boolean =>
      deleted.has(membershipKey(entry.cardKey)) ||
      deletedColumns.has(entry.address.columnId) ||
      (entry.address.swimlaneId !== undefined && deletedSwimlanes.has(entry.address.swimlaneId));
    const replacement = Object.freeze(this.#selected.filter((entry) => !isDeleted(entry)));
    const removedCount = this.#selected.length - replacement.length;
    if (removedCount === 0) return update('unchanged', this.#selected, this.#rangeAnchor, 0);
    this.#commit(replacement);
    if (
      this.#rangeAnchor !== undefined &&
      (deleted.has(membershipKey(this.#rangeAnchor.cardKey)) ||
        deletedColumns.has(this.#rangeAnchor.address.columnId) ||
        (this.#rangeAnchor.address.swimlaneId !== undefined &&
          deletedSwimlanes.has(this.#rangeAnchor.address.swimlaneId)))
    ) {
      this.#rangeAnchor = undefined;
    }
    return update('changed', this.#selected, this.#rangeAnchor, removedCount);
  }

  /** Replaces the separate opaque server-wide selection reference. */
  setServerSelection(value: KanbanServerSelectionReference): KanbanSelectionUpdate {
    this.#serverSelection = serverSelection(value);
    return update('changed', this.#selected, this.#rangeAnchor);
  }

  /** Clears the separate opaque server-wide selection reference. */
  clearServerSelection(): KanbanSelectionUpdate {
    if (this.#serverSelection === undefined) return update('unchanged', this.#selected, this.#rangeAnchor);
    this.#serverSelection = undefined;
    return update('changed', this.#selected, this.#rangeAnchor);
  }

  /** Captures current eligible members with immutable revision evidence. */
  snapshotEligibleSelection(
    eligible: readonly KanbanEligibleSelectionCandidate[],
    revisions: KanbanSelectionCaptureRevisions,
  ): KanbanSelectionSnapshot {
    const safeRevisions = captureRevisions(revisions);
    const byKey = new Map(candidates(eligible).map((entry) => [membershipKey(entry.cardKey), entry]));
    const entries = Object.freeze(
      this.#selected.flatMap((selected) => {
        const current = byKey.get(membershipKey(selected.cardKey));
        return current === undefined ? [] : [current];
      }),
    );
    return Object.freeze({
      entries,
      sessionRevision: safeRevisions.sessionRevision,
      queryGeneration: safeRevisions.queryGeneration,
      ...(safeRevisions.viewRevision === undefined ? {} : { viewRevision: safeRevisions.viewRevision }),
    });
  }

  /** Replaces both sequence and membership only after a complete candidate operation validates. */
  #commit(replacement: readonly KanbanEligibleSelectionCandidate[]): void {
    this.#selected = replacement;
    this.#membership = new Map(replacement.map((entry) => [membershipKey(entry.cardKey), entry]));
  }
}
