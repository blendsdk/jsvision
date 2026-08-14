import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanExtensionId } from '../contract/identity.js';
import { createKanbanPackageActions } from './actions.js';
import type {
  KanbanActionCategory,
  KanbanActionDefinition,
  KanbanActionHandler,
  KanbanActionRegistry,
  KanbanActionTargetKind,
} from './types.js';

/** Options accepted by the bounded package-plus-application action registry. */
export interface KanbanActionRegistryOptions {
  /** One board-owned execution seam shared by every package action. */
  readonly executePackageAction: KanbanActionHandler;
  /** Optional namespaced application actions appended after the package inventory. */
  readonly extensions?: readonly KanbanActionDefinition[];
}

/** Maximum application actions retained by one registry. */
const MAX_EXTENSION_ACTIONS = 256;
/** Maximum semantic bindings retained by one action. */
const MAX_ACTION_BINDINGS = 16;
/** Maximum UTF-8 bytes accepted for one action metadata string. */
const MAX_ACTION_TEXT_BYTES = 256;
/** Package namespace that application actions may not claim. */
const PACKAGE_ACTION_PREFIX = 'kanban.';
/** Action-definition members accepted at the application boundary. */
const ACTION_KEYS = new Set([
  'id',
  'category',
  'labelMessageId',
  'helpMessageId',
  'target',
  'capability',
  'bindings',
  'mutation',
  'handler',
]);
/** Closed action categories published by the package contract. */
const ACTION_CATEGORIES: ReadonlySet<string> = new Set([
  'navigation',
  'selection',
  'card',
  'structure',
  'view',
  'help',
  'history',
  'application',
]);
/** Closed logical target kinds published by the package contract. */
const ACTION_TARGETS: ReadonlySet<string> = new Set([
  'board',
  'card',
  'cell',
  'column',
  'swimlane',
  'selection',
  'any',
]);
/** Terminal control characters forbidden in action metadata and chords. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

/** Returns the encoded string size used by all action metadata bounds. */
function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Validates and returns one bounded, control-free action metadata string. */
function boundedText(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ACTION_TEXT_BYTES ||
    utf8Bytes(value) > MAX_ACTION_TEXT_BYTES ||
    CONTROL_CHARACTERS.test(value)
  ) {
    throw new KanbanInvalidSemanticValueError();
  }
  return value;
}

/** Narrows an unknown category through the package allowlist. */
function isActionCategory(value: unknown): value is KanbanActionCategory {
  return typeof value === 'string' && ACTION_CATEGORIES.has(value);
}

/** Narrows an unknown target kind through the package allowlist. */
function isActionTarget(value: unknown): value is KanbanActionTargetKind {
  return typeof value === 'string' && ACTION_TARGETS.has(value);
}

/** Narrows an unknown callable to the action handler contract retained by the registry. */
function isActionHandler(value: unknown): value is KanbanActionHandler {
  return typeof value === 'function';
}

/** Copies semantic chords without retaining a caller-owned array. */
function snapshotBindings(value: unknown): readonly string[] {
  return Object.freeze(snapshotKanbanDataArray(value, MAX_ACTION_BINDINGS).map((binding) => boundedText(binding)));
}

/** Validates and detaches one application action definition. */
function snapshotExtension(value: unknown): KanbanActionDefinition {
  const properties = snapshotKanbanDataProperties(value, ACTION_KEYS.size);
  validateKanbanDataKeys(properties, ACTION_KEYS);

  const id = createKanbanExtensionId(boundedText(properties.id));
  if (id.startsWith(PACKAGE_ACTION_PREFIX)) throw new KanbanInvalidSemanticValueError();
  const category = properties.category;
  const target = properties.target;
  if (!isActionCategory(category)) throw new KanbanInvalidSemanticValueError();
  if (!isActionTarget(target)) throw new KanbanInvalidSemanticValueError();
  if (!isActionHandler(properties.handler)) throw new KanbanInvalidSemanticValueError();
  if (properties.mutation !== undefined && typeof properties.mutation !== 'boolean') {
    throw new KanbanInvalidSemanticValueError();
  }

  return Object.freeze({
    id,
    category,
    labelMessageId: createKanbanExtensionId(boundedText(properties.labelMessageId)),
    helpMessageId: createKanbanExtensionId(boundedText(properties.helpMessageId)),
    target,
    capability: createKanbanExtensionId(boundedText(properties.capability)),
    bindings: snapshotBindings(properties.bindings),
    ...(properties.mutation === undefined ? {} : { mutation: properties.mutation }),
    handler: properties.handler,
  });
}

/**
 * Creates one immutable package-plus-application action inventory.
 *
 * Application definitions are copied through a descriptor-only boundary, must use a dotted
 * namespace outside `kanban.*`, and cannot replace an existing action.
 *
 * @example
 * ```ts
 * const registry = createKanbanActionRegistry({
 *   executePackageAction: () => ({ kind: 'handled' }),
 * });
 * registry.action('kanban.help.open');
 * ```
 */
export function createKanbanActionRegistry(options: KanbanActionRegistryOptions): KanbanActionRegistry {
  const optionProperties = snapshotKanbanDataProperties(options, 2);
  validateKanbanDataKeys(optionProperties, new Set(['executePackageAction', 'extensions']));
  if (!isActionHandler(optionProperties.executePackageAction)) throw new KanbanInvalidSemanticValueError();

  const packageActions = createKanbanPackageActions(optionProperties.executePackageAction);
  const extensions = snapshotKanbanDataArray(optionProperties.extensions ?? [], MAX_EXTENSION_ACTIONS).map(
    snapshotExtension,
  );
  const actions = Object.freeze([...packageActions, ...extensions]);
  const byId = new Map<string, KanbanActionDefinition>();
  for (const action of actions) {
    if (byId.has(action.id)) throw new KanbanInvalidSemanticValueError();
    byId.set(action.id, action);
  }

  return Object.freeze({
    actions: () => actions,
    action: (actionId: string) => (typeof actionId === 'string' ? byId.get(actionId) : undefined),
  });
}
