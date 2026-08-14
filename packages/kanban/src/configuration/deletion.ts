import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import type { KanbanColumnId, KanbanSwimlaneId } from '../contract/identity.js';
import type {
  KanbanColumnDeleteProposal,
  KanbanExtensionRequestProposal,
  KanbanRequestProposal,
  KanbanSwimlaneDeleteProposal,
} from '../contract/request.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import type { KanbanConfigurationOccupancy, KanbanConfigurationSnapshot } from './types.js';
import { createKanbanConfigurationSnapshot, snapshotKanbanConfigurationOccupancy } from './validation.js';

/** Exact input keys shared by programmatic deletion evaluators. */
const EVALUATION_KEYS = new Set(['snapshot', 'columnId', 'swimlaneId', 'occupancy', 'policy']);
/** Exact keys accepted by a built-in or custom atomic deletion policy. */
const POLICY_KEYS = new Set(['kind', 'destinationId', 'build']);

/** One immutable identity passed to an application custom deletion builder. */
export type KanbanConfigurationDeletionIdentity =
  | { readonly kind: 'column'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'swimlane'; readonly swimlaneId: KanbanSwimlaneId };

/** Bounded context passed to an application custom atomic-deletion builder. */
export interface KanbanConfigurationDeletionContext {
  /** Stable structural identity being deleted. */
  readonly identity: KanbanConfigurationDeletionIdentity;
  /** Exact authoritative non-zero occupancy. */
  readonly occupancy: Extract<KanbanConfigurationOccupancy, { readonly quality: 'exact' }>;
  /** Live signal reserved for application work performed by the custom builder. */
  readonly signal: AbortSignal;
}

/** Valid custom result for a column deletion. */
export type KanbanColumnDeletionProposal = KanbanColumnDeleteProposal | KanbanExtensionRequestProposal;

/** Valid custom result for a swimlane deletion. */
export type KanbanSwimlaneDeletionProposal = KanbanSwimlaneDeleteProposal | KanbanExtensionRequestProposal;

/** Application policy used to resolve one non-empty structural deletion atomically. */
export type KanbanConfigurationDeletionPolicy =
  | { readonly kind: 'reassign' | 'archive'; readonly destinationId: string }
  | {
      readonly kind: 'custom';
      readonly build: (context: KanbanConfigurationDeletionContext) => unknown;
    };

/** Safe eligibility result used by programmatic callers and package-owned dialogs. */
export type KanbanConfigurationDeletionEvaluation =
  | { readonly kind: 'confirmation-required'; readonly code: 'delete-empty-column' | 'delete-empty-swimlane' }
  | {
      readonly kind: 'disabled';
      readonly code: 'occupancy-unknown' | 'non-empty-policy-required' | 'derived-group-read-only';
    }
  | { readonly kind: 'ready' };

/** Raises one payload-free structural-deletion contract failure. */
function invalidDeletion(): never {
  throw new KanbanInvalidSemanticValueError();
}

/** Returns one string without invoking application coercion hooks. */
function requiredString(value: unknown): string {
  if (typeof value !== 'string') return invalidDeletion();
  return value;
}

/** Narrows an application callback without invoking it. */
function isDeletionBuilder(value: unknown): value is (context: KanbanConfigurationDeletionContext) => unknown {
  return typeof value === 'function';
}

/** Snapshots one optional atomic deletion policy without invoking a custom builder. */
export function snapshotKanbanConfigurationDeletionPolicy(
  value: unknown,
): KanbanConfigurationDeletionPolicy | undefined {
  if (value === undefined) return undefined;
  const properties = snapshotKanbanDataProperties(value, POLICY_KEYS.size);
  validateKanbanDataKeys(properties, POLICY_KEYS);
  if (
    (properties.kind === 'reassign' || properties.kind === 'archive') &&
    Object.keys(properties).length === 2 &&
    typeof properties.destinationId === 'string'
  ) {
    return Object.freeze({ kind: properties.kind, destinationId: properties.destinationId });
  }
  if (properties.kind === 'custom' && Object.keys(properties).length === 2 && isDeletionBuilder(properties.build)) {
    return Object.freeze({ kind: 'custom', build: properties.build });
  }
  return invalidDeletion();
}

/** Snapshots the exact common evaluator envelope. */
function evaluation(value: unknown) {
  const properties = snapshotKanbanDataProperties(value, EVALUATION_KEYS.size);
  validateKanbanDataKeys(properties, EVALUATION_KEYS);
  return Object.freeze({
    properties,
    snapshot: createKanbanConfigurationSnapshot(properties.snapshot),
    occupancy: snapshotKanbanConfigurationOccupancy(properties.occupancy),
    policy: snapshotKanbanConfigurationDeletionPolicy(properties.policy),
  });
}

/**
 * Evaluates whether a column deletion is confirmable, blocked, or ready for an atomic policy.
 *
 * @example
 * ```ts
 * evaluateKanbanColumnDeletion({ snapshot, columnId: 'done', occupancy: { quality: 'exact', count: 0 } });
 * ```
 */
export function evaluateKanbanColumnDeletion(value: unknown): KanbanConfigurationDeletionEvaluation {
  const { properties, snapshot, occupancy, policy } = evaluation(value);
  const columnId = requiredString(properties.columnId);
  if (!snapshot.columns.some((column) => column.columnId === columnId)) return invalidDeletion();
  if (occupancy.quality === 'unknown') return Object.freeze({ kind: 'disabled', code: 'occupancy-unknown' });
  if (occupancy.count === 0) {
    return Object.freeze({ kind: 'confirmation-required', code: 'delete-empty-column' });
  }
  return policy === undefined
    ? Object.freeze({ kind: 'disabled', code: 'non-empty-policy-required' })
    : Object.freeze({ kind: 'ready' });
}

/** Evaluates whether an explicit swimlane deletion is confirmable, blocked, or policy-ready. */
export function evaluateKanbanSwimlaneDeletion(value: unknown): KanbanConfigurationDeletionEvaluation {
  const { properties, snapshot, occupancy, policy } = evaluation(value);
  const swimlaneId = requiredString(properties.swimlaneId);
  const swimlane = snapshot.swimlanes.find((entry) => entry.swimlaneId === swimlaneId);
  if (swimlane === undefined) return invalidDeletion();
  if (swimlane.mode === 'derived') return Object.freeze({ kind: 'disabled', code: 'derived-group-read-only' });
  if (occupancy.quality === 'unknown') return Object.freeze({ kind: 'disabled', code: 'occupancy-unknown' });
  if (occupancy.count === 0) {
    return Object.freeze({ kind: 'confirmation-required', code: 'delete-empty-swimlane' });
  }
  return policy === undefined
    ? Object.freeze({ kind: 'disabled', code: 'non-empty-policy-required' })
    : Object.freeze({ kind: 'ready' });
}

/** Invokes a custom policy and validates its result as one deletion or namespaced extension proposal. */
function customProposal(
  policy: Extract<KanbanConfigurationDeletionPolicy, { readonly kind: 'custom' }>,
  identity: KanbanConfigurationDeletionIdentity,
  occupancy: Extract<KanbanConfigurationOccupancy, { readonly quality: 'exact' }>,
): KanbanRequestProposal {
  try {
    const result = policy.build(
      Object.freeze({ identity: Object.freeze(identity), occupancy, signal: new AbortController().signal }),
    );
    const proposal = snapshotKanbanRequestProposal(result);
    if (proposal.kind !== 'extension' && proposal.kind !== 'column-delete' && proposal.kind !== 'swimlane-delete') {
      return invalidDeletion();
    }
    return proposal;
  } catch {
    return invalidDeletion();
  }
}

/** Builds an empty or policy-backed atomic column deletion proposal. */
export function buildColumnDeletion(
  snapshot: KanbanConfigurationSnapshot,
  columnId: KanbanColumnId,
  occupancy: KanbanConfigurationOccupancy,
  policyValue: unknown,
): KanbanColumnDeletionProposal {
  const policy = snapshotKanbanConfigurationDeletionPolicy(policyValue);
  if (occupancy.quality === 'unknown' || (occupancy.count > 0 && policy === undefined)) return invalidDeletion();
  if (occupancy.count === 0) return snapshotKanbanRequestProposal({ kind: 'column-delete', columnId });
  if (policy?.kind === 'custom') {
    const proposal = customProposal(policy, { kind: 'column', columnId }, occupancy);
    if (proposal.kind !== 'extension' && (proposal.kind !== 'column-delete' || proposal.columnId !== columnId)) {
      return invalidDeletion();
    }
    if (
      proposal.kind === 'column-delete' &&
      proposal.reassignTo !== undefined &&
      (proposal.reassignTo === columnId || !snapshot.columns.some((column) => column.columnId === proposal.reassignTo))
    ) {
      return invalidDeletion();
    }
    return proposal;
  }
  const destinationId = policy?.destinationId;
  if (
    destinationId === undefined ||
    destinationId === columnId ||
    !snapshot.columns.some((column) => column.columnId === destinationId)
  ) {
    return invalidDeletion();
  }
  return snapshotKanbanRequestProposal({ kind: 'column-delete', columnId, reassignTo: destinationId });
}

/** Builds an empty or policy-backed atomic explicit-swimlane deletion proposal. */
export function buildSwimlaneDeletion(
  snapshot: KanbanConfigurationSnapshot,
  swimlaneId: KanbanSwimlaneId,
  occupancy: KanbanConfigurationOccupancy,
  policyValue: unknown,
): KanbanSwimlaneDeletionProposal {
  const current = snapshot.swimlanes.find((swimlane) => swimlane.swimlaneId === swimlaneId);
  if (current === undefined || current.mode !== 'explicit') return invalidDeletion();
  const policy = snapshotKanbanConfigurationDeletionPolicy(policyValue);
  if (occupancy.quality === 'unknown' || (occupancy.count > 0 && policy === undefined)) return invalidDeletion();
  if (occupancy.count === 0) return snapshotKanbanRequestProposal({ kind: 'swimlane-delete', swimlaneId });
  if (policy?.kind === 'custom') {
    const proposal = customProposal(policy, { kind: 'swimlane', swimlaneId }, occupancy);
    if (proposal.kind !== 'extension' && (proposal.kind !== 'swimlane-delete' || proposal.swimlaneId !== swimlaneId)) {
      return invalidDeletion();
    }
    if (proposal.kind === 'swimlane-delete' && proposal.reassignTo !== undefined) {
      const destination = snapshot.swimlanes.find((swimlane) => swimlane.swimlaneId === proposal.reassignTo);
      if (proposal.reassignTo === swimlaneId || destination?.mode !== 'explicit') return invalidDeletion();
    }
    return proposal;
  }
  const destinationId = policy?.destinationId;
  const destination = snapshot.swimlanes.find((swimlane) => swimlane.swimlaneId === destinationId);
  if (destinationId === undefined || destinationId === swimlaneId || destination?.mode !== 'explicit') {
    return invalidDeletion();
  }
  return snapshotKanbanRequestProposal({ kind: 'swimlane-delete', swimlaneId, reassignTo: destinationId });
}
