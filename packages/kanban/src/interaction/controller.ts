import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { createKanbanCardKey, createPlacementToken } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import { KanbanAcquisitionCoordinator } from './acquisition.js';
import type { KanbanInteractionController } from './facade.js';
import { resolveKanbanNavigation } from './navigation.js';
import {
  canonicalizeKanbanFocusTarget,
  reconcileKanbanFocus,
  resolveInitialKanbanFocus,
  snapshotKanbanFocusTarget,
  snapshotKanbanNavigationSnapshot,
} from './reconciliation.js';
import { KanbanSelectionModel } from './selection.js';
import type { KanbanEligibleSelectionCandidate } from './selection.js';
import { KANBAN_SYNTHETIC_TRANSIENT_PRIORITY, KanbanTransientOwner } from './transient.js';
import type {
  KanbanFocusTarget,
  KanbanInteractionEnvironment,
  KanbanInteractionFeedback,
  KanbanInteractionFeedbackCode,
  KanbanInteractionResult,
  KanbanInteractionSnapshot,
  KanbanInteractionTransition,
  KanbanRangeAnchor,
  KanbanServerSelectionReference,
} from './types.js';
import { KANBAN_NEUTRAL_INTERACTION_SNAPSHOT } from './types.js';

/** Deprecated application identity captured once for the package default controller. */
export interface KanbanDefaultInteractionSeed {
  /** Preferred initial card identity when it is eligible in the first usable scene. */
  readonly focusedCardKey?: CardKey;
  /** Preferred initial workflow column when no seeded card is eligible. */
  readonly focusedColumnId?: string;
  /** Ordered initial selected identities intersected with the first usable scene. */
  readonly selectedCardKeys: readonly CardKey[];
}

/** Exact top-level members accepted from an injected controller snapshot. */
const SNAPSHOT_KEYS = new Set([
  'revision',
  'focused',
  'selectedCardKeys',
  'rangeAnchor',
  'preferredCenterRow',
  'pendingNavigation',
  'feedback',
  'serverSelection',
]);
/** Exact members accepted by one range anchor. */
const RANGE_KEYS = new Set(['cardKey', 'address']);
/** Exact members accepted by pending navigation. */
const PENDING_KEYS = new Set(['kind', 'target']);
/** Exact members accepted by interaction feedback. */
const FEEDBACK_KEYS = new Set(['code', 'label', 'count', 'retry']);
/** Exact members accepted by opaque server selection. */
const SERVER_KEYS = new Set(['token', 'revision', 'label']);
/** Exact members accepted by one controller result. */
const RESULT_KEYS = new Set(['kind', 'snapshot', 'code', 'retry']);
/** Narrows one unknown value to a stable interaction feedback code. */
function isFeedbackCode(value: unknown): value is KanbanInteractionFeedbackCode {
  return (
    value === 'navigation-pending' ||
    value === 'navigation-unavailable' ||
    value === 'navigation-error' ||
    value === 'selection-limit-exceeded' ||
    value === 'selection-pruned' ||
    value === 'interaction-unavailable'
  );
}

/** Raises a bounded source-publication error without retaining rejected controller data. */
function invalidPublication(): never {
  throw new KanbanInvalidSourcePublicationError();
}

/** Validates one interaction revision counter. */
function interactionRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalidPublication();
  return value;
}

/** Validates one finite visual row. */
function visualRow(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalidPublication();
  return Object.is(value, -0) ? 0 : value;
}

/** Validates one type-preserving card identity. */
function cardKey(value: unknown): CardKey {
  if (typeof value !== 'string' && typeof value !== 'number') return invalidPublication();
  try {
    return createKanbanCardKey(value);
  } catch {
    return invalidPublication();
  }
}

/** Copies ordered selected identities and rejects duplicates atomically. */
function selectedKeys(value: unknown): readonly CardKey[] {
  const selected = snapshotKanbanDataArray(value, KANBAN_LIMITS.selectedKeys.absolute).map(cardKey);
  const keys = selected.map((key) => JSON.stringify([typeof key, key]));
  if (new Set(keys).size !== keys.length) return invalidPublication();
  return Object.freeze(selected);
}

/** Snapshots one optional explicit range anchor. */
function rangeAnchor(value: unknown): KanbanRangeAnchor {
  const properties = snapshotKanbanDataProperties(value, RANGE_KEYS.size);
  validateKanbanDataKeys(properties, RANGE_KEYS);
  if (Object.keys(properties).length !== RANGE_KEYS.size) return invalidPublication();
  const target = snapshotKanbanFocusTarget({
    kind: 'card',
    cardKey: properties.cardKey,
    address: properties.address,
  });
  if (target.kind !== 'card') return invalidPublication();
  return Object.freeze({ cardKey: target.cardKey, address: target.address });
}

/** Snapshots one optional pending reveal/acquisition marker. */
function pendingNavigation(value: unknown): NonNullable<KanbanInteractionSnapshot['pendingNavigation']> {
  const properties = snapshotKanbanDataProperties(value, PENDING_KEYS.size);
  validateKanbanDataKeys(properties, PENDING_KEYS);
  if (Object.keys(properties).length !== PENDING_KEYS.size) return invalidPublication();
  if (properties.kind !== 'reveal' && properties.kind !== 'acquire') return invalidPublication();
  return Object.freeze({ kind: properties.kind, target: snapshotKanbanFocusTarget(properties.target) });
}

/** Snapshots localized payload-free controller feedback. */
function feedback(value: unknown): KanbanInteractionFeedback {
  const properties = snapshotKanbanDataProperties(value, FEEDBACK_KEYS.size);
  validateKanbanDataKeys(properties, FEEDBACK_KEYS);
  if (!isFeedbackCode(properties.code) || typeof properties.label !== 'string') {
    return invalidPublication();
  }
  const code = properties.code;
  const label = sanitizeContractText(properties.label, KANBAN_LIMITS.semanticStringBytes.safe).trim();
  if (label.length === 0) return invalidPublication();
  const count =
    properties.count === undefined
      ? undefined
      : typeof properties.count === 'number' && Number.isSafeInteger(properties.count) && properties.count >= 0
        ? properties.count
        : invalidPublication();
  const retry = properties.retry;
  if (retry !== undefined && retry !== 'available' && retry !== 'unavailable') return invalidPublication();
  return Object.freeze({
    code,
    label,
    ...(count === undefined ? {} : { count }),
    ...(retry === undefined ? {} : { retry }),
  });
}

/** Snapshots one opaque server-wide selection reference. */
function serverSelection(value: unknown): KanbanServerSelectionReference {
  const properties = snapshotKanbanDataProperties(value, SERVER_KEYS.size);
  validateKanbanDataKeys(properties, SERVER_KEYS);
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
}

/**
 * Validates and deeply detaches one interaction snapshot returned by an injected controller.
 */
export function snapshotKanbanInteractionSnapshot(value: unknown): KanbanInteractionSnapshot {
  try {
    const properties = snapshotKanbanDataProperties(value, SNAPSHOT_KEYS.size);
    validateKanbanDataKeys(properties, SNAPSHOT_KEYS);
    for (const required of ['revision', 'focused', 'selectedCardKeys']) {
      if (!(required in properties)) return invalidPublication();
    }
    return Object.freeze({
      revision: interactionRevision(properties.revision),
      focused: snapshotKanbanFocusTarget(properties.focused),
      selectedCardKeys: selectedKeys(properties.selectedCardKeys),
      ...(properties.rangeAnchor === undefined ? {} : { rangeAnchor: rangeAnchor(properties.rangeAnchor) }),
      ...(properties.preferredCenterRow === undefined
        ? {}
        : { preferredCenterRow: visualRow(properties.preferredCenterRow) }),
      ...(properties.pendingNavigation === undefined
        ? {}
        : { pendingNavigation: pendingNavigation(properties.pendingNavigation) }),
      ...(properties.feedback === undefined ? {} : { feedback: feedback(properties.feedback) }),
      ...(properties.serverSelection === undefined
        ? {}
        : { serverSelection: serverSelection(properties.serverSelection) }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates and detaches one injected controller settlement. */
export function snapshotKanbanInteractionResult(value: unknown): KanbanInteractionResult {
  try {
    const properties = snapshotKanbanDataProperties(value, RESULT_KEYS.size);
    validateKanbanDataKeys(properties, RESULT_KEYS);
    const snapshot = snapshotKanbanInteractionSnapshot(properties.snapshot);
    if (properties.kind === 'changed' || properties.kind === 'unchanged' || properties.kind === 'pending') {
      if (Object.keys(properties).length !== 2) return invalidPublication();
      return Object.freeze({ kind: properties.kind, snapshot });
    }
    if (properties.kind !== 'unavailable' || !isFeedbackCode(properties.code)) {
      return invalidPublication();
    }
    const code = properties.code;
    const retry = properties.retry;
    if (retry !== undefined && retry !== 'available' && retry !== 'unavailable') return invalidPublication();
    return Object.freeze({ kind: properties.kind, code, snapshot, ...(retry === undefined ? {} : { retry }) });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Returns one selection candidate from current navigation evidence. */
function candidateFor(
  target: KanbanFocusTarget,
  scene: ReturnType<typeof snapshotKanbanNavigationSnapshot>,
  entityRevision: KanbanRevision,
): KanbanEligibleSelectionCandidate | undefined {
  if (target.kind !== 'card') return undefined;
  const retained = scene.targets.find(
    (entry) => canonicalizeKanbanFocusTarget(entry.target) === canonicalizeKanbanFocusTarget(target),
  );
  if (retained === undefined || !retained.enabled) return undefined;
  return Object.freeze({
    cardKey: target.cardKey,
    address: target.address,
    entityRevision,
  });
}

/** Default single-owner interaction state machine used when no factory is supplied. */
class DefaultKanbanInteractionController implements KanbanInteractionController {
  readonly #environment: KanbanInteractionEnvironment;
  readonly #selection: KanbanSelectionModel;
  readonly #seed: KanbanDefaultInteractionSeed | undefined;
  readonly #acquisition = new KanbanAcquisitionCoordinator();
  readonly #transient = new KanbanTransientOwner();
  readonly #subscribers = new Set<() => void>();
  #snapshot: KanbanInteractionSnapshot = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT;
  #previousScene = snapshotKanbanNavigationSnapshot({ revision: 0, targets: [], viewportContentHeight: 0 });
  #disposed = false;

  /** Creates an empty controller and defers initial focus until usable scene evidence exists. */
  constructor(
    environment: KanbanInteractionEnvironment,
    maximumSelectedKeys: number,
    seed?: KanbanDefaultInteractionSeed,
  ) {
    this.#environment = environment;
    this.#selection = new KanbanSelectionModel(maximumSelectedKeys);
    this.#seed = seed;
  }

  /** Returns current immutable state, choosing initial focus once usable evidence exists. */
  snapshot(): KanbanInteractionSnapshot {
    this.#ensureInitialFocus();
    return this.#snapshot;
  }

  /** Applies one closed transition without exposing source records or host objects. */
  transition(command: KanbanInteractionTransition): ReturnType<KanbanInteractionController['transition']> {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    this.#ensureInitialFocus();
    this.#acquisition.cancel();
    if (command.kind === 'focus') return this.#focus(command.target);
    if (command.kind === 'navigate') return this.#navigate(command.direction, command.extendSelection === true);
    if (command.kind === 'selection') return this.#select(command);
    if (command.kind === 'reconcile') return this.#reconcile(command.reason);
    return this.#escape(command);
  }

  /** Registers one semantic-state listener. */
  subscribe(invalidate: () => void): () => void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    this.#subscribers.add(invalidate);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.#subscribers.delete(invalidate);
    };
  }

  /** Releases acquisition and subscriptions idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#transient.dispose();
    this.#acquisition.dispose();
    this.#subscribers.clear();
  }

  /** Selects initial focus only while the controller remains at its neutral initial state. */
  #ensureInitialFocus(): void {
    if (this.#snapshot.revision !== 0 || this.#snapshot.focused.kind !== 'board-state') return;
    const scene = snapshotKanbanNavigationSnapshot(this.#environment.scene());
    this.#previousScene = scene;
    const seededCardKey = this.#seed?.focusedCardKey;
    const seededCard =
      seededCardKey === undefined
        ? undefined
        : scene.targets.find(
            (entry) =>
              entry.enabled &&
              entry.target.kind === 'card' &&
              typeof entry.target.cardKey === typeof seededCardKey &&
              entry.target.cardKey === seededCardKey,
          );
    const seededColumn =
      seededCard !== undefined || this.#seed?.focusedColumnId === undefined
        ? undefined
        : scene.targets.find(
            (entry) =>
              entry.enabled &&
              entry.target.kind === 'column-header' &&
              entry.target.columnId === this.#seed?.focusedColumnId,
          );
    const focused = seededCard?.target ?? seededColumn?.target ?? resolveInitialKanbanFocus(scene);
    const seedOrder = new Map(
      (this.#seed?.selectedCardKeys ?? []).map((key, index) => [JSON.stringify([typeof key, key]), index]),
    );
    const entityRevision = snapshotKanbanRevision(this.#environment.revisions().sessionRevision);
    const selectedCandidates = scene.targets
      .flatMap((entry) => {
        const value = candidateFor(entry.target, scene, entityRevision);
        return value === undefined ? [] : [value];
      })
      .filter((candidate) => seedOrder.has(JSON.stringify([typeof candidate.cardKey, candidate.cardKey])))
      .sort(
        (left, right) =>
          (seedOrder.get(JSON.stringify([typeof left.cardKey, left.cardKey])) ?? Number.MAX_SAFE_INTEGER) -
          (seedOrder.get(JSON.stringify([typeof right.cardKey, right.cardKey])) ?? Number.MAX_SAFE_INTEGER),
      );
    const seededSelection = this.#selection.selectLoadedVisibleMatching(selectedCandidates);
    if (focused.kind === 'board-state' && seededSelection.selectedCardKeys.length === 0) return;
    this.#snapshot = Object.freeze({
      ...this.#snapshot,
      revision: 1,
      focused,
      selectedCardKeys: seededSelection.selectedCardKeys,
      ...(seededSelection.rangeAnchor === undefined ? {} : { rangeAnchor: seededSelection.rangeAnchor }),
    });
  }

  /** Applies direct semantic focus or begins bounded acquisition for an absent card. */
  #focus(target: KanbanFocusTarget): KanbanInteractionResult {
    const focused = snapshotKanbanFocusTarget(target);
    const scene = snapshotKanbanNavigationSnapshot(this.#environment.scene());
    const visible = scene.targets.find(
      (entry) =>
        entry.enabled && canonicalizeKanbanFocusTarget(entry.target) === canonicalizeKanbanFocusTarget(focused),
    );
    if (visible !== undefined) {
      return this.#publish({
        focused,
        ...(focused.kind === 'card' ? { preferredCenterRow: visible.centerRow } : {}),
      });
    }
    if (focused.kind !== 'card') return Object.freeze({ kind: 'unchanged', snapshot: this.#snapshot });
    const prior = this.#snapshot.focused;
    const pending = Object.freeze({ kind: 'acquire' as const, target: focused });
    const pendingResult = this.#publish({
      focused,
      pendingNavigation: pending,
      feedback: this.#safeFeedback('navigation-pending'),
    });
    const handle = this.#acquisition.start({
      request: pending,
      revisions: this.#environment.revisions(),
      currentRevisions: this.#environment.revisions,
      execute: ({ signal }) => this.#environment.acquire(pending, { signal }),
    });
    void handle.settlement.then((settlement) => {
      if (this.#disposed || this.#snapshot.pendingNavigation?.target !== focused) return;
      if (settlement.kind === 'available')
        this.#publish({ focused, pendingNavigation: undefined, feedback: undefined });
      else if (settlement.kind === 'unavailable') {
        this.#publish({
          focused: prior,
          pendingNavigation: undefined,
          feedback: this.#safeFeedback(settlement.code, undefined, settlement.retry),
        });
      }
    });
    return Object.freeze({ kind: 'pending', snapshot: pendingResult.snapshot });
  }

  /** Resolves one visible navigation transition and preserves its preferred row. */
  #navigate(
    direction: Extract<KanbanInteractionTransition, { readonly kind: 'navigate' }>['direction'],
    extendSelection: boolean,
  ): Promise<KanbanInteractionResult> | KanbanInteractionResult {
    const scene = snapshotKanbanNavigationSnapshot(this.#environment.scene());
    const resolved = resolveKanbanNavigation({
      current: this.#snapshot.focused,
      direction,
      scene,
      ...(this.#snapshot.preferredCenterRow === undefined
        ? {}
        : { preferredCenterRow: this.#snapshot.preferredCenterRow }),
    });
    if (
      (direction === 'previous-column' || direction === 'next-column') &&
      this.#snapshot.focused.kind === 'card' &&
      resolved.focused.kind === 'column-header'
    ) {
      return this.#revealColumnNavigation(direction, resolved.focused, scene);
    }
    this.#previousScene = scene;
    if (resolved.kind === 'unchanged') return Object.freeze({ kind: resolved.kind, snapshot: this.#snapshot });
    if (!extendSelection) {
      return this.#publish({ focused: resolved.focused, preferredCenterRow: resolved.preferredCenterRow });
    }
    const anchor = this.#selection.rangeAnchor();
    if (anchor === undefined || resolved.focused.kind !== 'card') {
      const ended = this.#selection.endRangeExtension();
      return this.#publish({
        focused: resolved.focused,
        preferredCenterRow: resolved.preferredCenterRow,
        selectedCardKeys: ended.selectedCardKeys,
        rangeAnchor: ended.rangeAnchor,
      });
    }
    const entityRevision = snapshotKanbanRevision(this.#environment.revisions().sessionRevision);
    const destinationAddress = resolved.focused.address;
    const destinationCardKey = resolved.focused.cardKey;
    const cellCandidates = scene.targets.flatMap((entry) => {
      if (
        entry.target.kind !== 'card' ||
        entry.target.address.columnId !== destinationAddress.columnId ||
        entry.target.address.swimlaneId !== destinationAddress.swimlaneId
      ) {
        return [];
      }
      const candidate = candidateFor(entry.target, scene, entityRevision);
      return candidate === undefined ? [] : [candidate];
    });
    const selected = this.#selection.range(cellCandidates, anchor, destinationCardKey);
    return this.#publish({
      focused: resolved.focused,
      preferredCenterRow: resolved.preferredCenterRow,
      selectedCardKeys: selected.selectedCardKeys,
      rangeAnchor: selected.rangeAnchor,
      ...(selected.kind === 'limit-exceeded' ? { feedback: this.#safeFeedback('selection-limit-exceeded') } : {}),
    });
  }

  /** Reveals a responsive destination column before publishing its now-visible card or header. */
  async #revealColumnNavigation(
    direction: 'previous-column' | 'next-column',
    target: KanbanFocusTarget & { readonly kind: 'column-header' },
    previousScene: ReturnType<typeof snapshotKanbanNavigationSnapshot>,
  ): Promise<KanbanInteractionResult> {
    const priorFocus = this.#snapshot.focused;
    const pending = Object.freeze({ kind: 'reveal' as const, target });
    this.#publish({ pendingNavigation: pending, feedback: this.#safeFeedback('navigation-pending') });
    const handle = this.#acquisition.start({
      request: pending,
      revisions: this.#environment.revisions(),
      currentRevisions: this.#environment.revisions,
      execute: ({ signal }) => this.#environment.reveal(target, { signal }),
    });
    const settlement = await handle.settlement;
    if (this.#disposed || (settlement.kind === 'stale' && settlement.reason !== 'revision-changed')) {
      return Object.freeze({ kind: 'unchanged', snapshot: this.#snapshot });
    }
    if (settlement.kind === 'unavailable') {
      const published = this.#publish({
        pendingNavigation: undefined,
        feedback: this.#safeFeedback(settlement.code, undefined, settlement.retry),
      });
      return Object.freeze({
        kind: 'unavailable',
        code: settlement.code,
        retry: settlement.retry,
        snapshot: published.snapshot,
      });
    }
    await Promise.resolve();
    await Promise.resolve();
    const scene = snapshotKanbanNavigationSnapshot(this.#environment.scene());
    // A reveal may itself refresh an eager publication. Re-resolving against the new detached scene
    // is safe only while the requested structural destination still exists and remains enabled.
    const destinationStillExists = scene.targets.some(
      (entry) => entry.enabled && entry.target.kind === 'column-header' && entry.target.columnId === target.columnId,
    );
    if (!destinationStillExists) {
      return this.#publish({ pendingNavigation: undefined, feedback: undefined });
    }
    const resolved = resolveKanbanNavigation({
      current: priorFocus,
      direction,
      scene,
      ...(this.#snapshot.preferredCenterRow === undefined
        ? {}
        : { preferredCenterRow: this.#snapshot.preferredCenterRow }),
    });
    this.#previousScene = previousScene;
    return this.#publish({
      focused: resolved.focused,
      preferredCenterRow: resolved.preferredCenterRow,
      pendingNavigation: undefined,
      feedback: undefined,
    });
  }

  /** Applies one ordered selection operation against current visible card evidence. */
  #select(command: Extract<KanbanInteractionTransition, { readonly kind: 'selection' }>): KanbanInteractionResult {
    const scene = snapshotKanbanNavigationSnapshot(this.#environment.scene());
    const entityRevision = snapshotKanbanRevision(this.#environment.revisions().sessionRevision);
    const current = candidateFor(this.#snapshot.focused, scene, entityRevision);
    const candidates = scene.targets.flatMap((entry) => {
      const candidate = candidateFor(entry.target, scene, entityRevision);
      return candidate === undefined ? [] : [candidate];
    });
    let selected;
    if (command.operation === 'replace')
      selected = current === undefined ? undefined : this.#selection.replace(current);
    else if (command.operation === 'toggle')
      selected = current === undefined ? undefined : this.#selection.toggle(current);
    else if (command.operation === 'range') {
      const anchor = this.#selection.rangeAnchor();
      selected =
        current === undefined || anchor === undefined
          ? undefined
          : this.#selection.range(candidates, anchor, current.cardKey);
    } else if (command.operation === 'select-loaded-visible-matching') {
      selected = this.#selection.selectLoadedVisibleMatching(candidates);
    } else if (command.operation === 'clear-multiple') selected = this.#selection.clearMultiple();
    else if (command.operation === 'set-server-selection') {
      selected =
        command.serverSelection === undefined ? undefined : this.#selection.setServerSelection(command.serverSelection);
    } else selected = this.#selection.clearServerSelection();
    if (selected === undefined) return Object.freeze({ kind: 'unchanged', snapshot: this.#snapshot });
    if (selected.kind === 'limit-exceeded') {
      return Object.freeze({
        kind: 'unavailable',
        code: 'selection-limit-exceeded',
        snapshot: this.#withFeedback('selection-limit-exceeded'),
      });
    }
    return this.#publish({
      selectedCardKeys: selected.selectedCardKeys,
      rangeAnchor: selected.rangeAnchor,
      serverSelection: this.#selection.serverSelection(),
    });
  }

  /** Gives one registered transient first refusal, then clears only explicit multi-selection. */
  #escape(command: Extract<KanbanInteractionTransition, { readonly kind: 'escape' }>): KanbanInteractionResult {
    if (command.transient !== undefined) {
      this.#transient.register({
        kind: command.transient.kind,
        priority: KANBAN_SYNTHETIC_TRANSIENT_PRIORITY,
        cancel: command.transient.cancel,
      });
    }
    if (this.#transient.cancel()) return Object.freeze({ kind: 'unchanged', snapshot: this.#snapshot });
    const cleared = this.#selection.clearMultiple();
    if (cleared.kind === 'unchanged') return Object.freeze({ kind: 'unchanged', snapshot: this.#snapshot });
    return this.#publish({
      selectedCardKeys: cleared.selectedCardKeys,
      rangeAnchor: cleared.rangeAnchor,
    });
  }

  /** Reconciles focus and selection from current geometry and source authority. */
  #reconcile(
    reason: Extract<KanbanInteractionTransition, { readonly kind: 'reconcile' }>['reason'],
  ): KanbanInteractionResult {
    const scene = snapshotKanbanNavigationSnapshot(this.#environment.scene());
    const reconciled = reconcileKanbanFocus({
      current: this.#snapshot.focused,
      scene,
      previousScene: this.#previousScene,
      reason,
      ...(this.#snapshot.preferredCenterRow === undefined
        ? {}
        : { preferredCenterRow: this.#snapshot.preferredCenterRow }),
    });
    const visibleKeys = scene.targets.flatMap((entry) =>
      entry.enabled && entry.target.kind === 'card' ? [entry.target.cardKey] : [],
    );
    const pruned = this.#selection.prune(visibleKeys, reason === 'cursor-unload' ? 'cursor-unload' : 'visibility');
    this.#previousScene = scene;
    return this.#publish({
      focused: reconciled.focused,
      selectedCardKeys: pruned.selectedCardKeys,
      rangeAnchor: pruned.rangeAnchor,
      ...(pruned.removedCount === undefined || pruned.removedCount === 0
        ? {}
        : { feedback: this.#safeFeedback('selection-pruned', pruned.removedCount) }),
    });
  }

  /** Builds safe localized feedback through the bounded environment seam. */
  #safeFeedback(
    code: KanbanInteractionFeedbackCode,
    count?: number,
    retry?: 'available' | 'unavailable',
  ): KanbanInteractionFeedback {
    try {
      return feedback({ ...this.#environment.feedback(code, count), ...(retry === undefined ? {} : { retry }) });
    } catch {
      return Object.freeze({
        code,
        label: code,
        ...(count === undefined ? {} : { count }),
        ...(retry === undefined ? {} : { retry }),
      });
    }
  }

  /** Publishes feedback while retaining every other semantic field. */
  #withFeedback(code: KanbanInteractionFeedbackCode): KanbanInteractionSnapshot {
    this.#snapshot = Object.freeze({
      ...this.#snapshot,
      revision: this.#snapshot.revision + 1,
      feedback: this.#safeFeedback(code),
    });
    this.#notify();
    return this.#snapshot;
  }

  /** Commits one semantic patch with optional-property removal and one invalidation. */
  #publish(patch: {
    readonly focused?: KanbanFocusTarget;
    readonly selectedCardKeys?: readonly CardKey[];
    readonly rangeAnchor?: KanbanRangeAnchor;
    readonly preferredCenterRow?: number;
    readonly pendingNavigation?: KanbanInteractionSnapshot['pendingNavigation'];
    readonly feedback?: KanbanInteractionFeedback;
    readonly serverSelection?: KanbanServerSelectionReference;
  }): KanbanInteractionResult {
    const owns = (key: keyof typeof patch): boolean => Object.prototype.hasOwnProperty.call(patch, key);
    const rangeAnchor = owns('rangeAnchor') ? patch.rangeAnchor : this.#snapshot.rangeAnchor;
    const preferredCenterRow = owns('preferredCenterRow')
      ? patch.preferredCenterRow
      : this.#snapshot.preferredCenterRow;
    const pendingNavigation = owns('pendingNavigation') ? patch.pendingNavigation : this.#snapshot.pendingNavigation;
    const currentFeedback = owns('feedback') ? patch.feedback : this.#snapshot.feedback;
    const serverSelection = owns('serverSelection') ? patch.serverSelection : this.#snapshot.serverSelection;
    const next = Object.freeze({
      revision: this.#snapshot.revision + 1,
      focused: patch.focused ?? this.#snapshot.focused,
      selectedCardKeys: patch.selectedCardKeys ?? this.#snapshot.selectedCardKeys,
      ...(rangeAnchor === undefined ? {} : { rangeAnchor }),
      ...(preferredCenterRow === undefined ? {} : { preferredCenterRow }),
      ...(pendingNavigation === undefined ? {} : { pendingNavigation }),
      ...(currentFeedback === undefined ? {} : { feedback: currentFeedback }),
      ...(serverSelection === undefined ? {} : { serverSelection }),
    });
    this.#snapshot = next;
    this.#notify();
    return Object.freeze({ kind: 'changed', snapshot: next });
  }

  /** Notifies subscribers; the board facade owns the single mounted invalidation. */
  #notify(): void {
    for (const subscriber of [...this.#subscribers]) {
      try {
        subscriber();
      } catch {
        // Subscriber isolation preserves the already-committed semantic state.
      }
    }
  }
}

/** Creates the package default interaction controller. */
export function createKanbanInteractionController(
  environment: KanbanInteractionEnvironment,
  maximumSelectedKeys = KANBAN_LIMITS.selectedKeys.safe,
): KanbanInteractionController {
  return new DefaultKanbanInteractionController(environment, maximumSelectedKeys);
}

/** Creates the package default controller with one already-detached legacy compatibility seed. */
export function createSeededKanbanInteractionController(
  environment: KanbanInteractionEnvironment,
  maximumSelectedKeys: number,
  seed: KanbanDefaultInteractionSeed,
): KanbanInteractionController {
  return new DefaultKanbanInteractionController(environment, maximumSelectedKeys, seed);
}
