import { snapshotKanbanLabel, snapshotKanbanReasonCode } from '../contract/capability.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { createKanbanCardKey, createKanbanColumnId, createKanbanSwimlaneId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import { evaluateKanbanActionCapability } from './capability.js';
import type {
  KanbanActionAffordance,
  KanbanActionCapability,
  KanbanActionDefinition,
  KanbanActionInvocation,
  KanbanActionOrigin,
  KanbanActionRegistry,
  KanbanActionRouter,
  KanbanActionSourceSnapshot,
  KanbanActionInvocationTarget,
  KanbanActionTerminalOutcome,
  KanbanCapabilityProvider,
} from './types.js';

/** Options accepted by the bounded shared action router. */
export interface KanbanActionRouterOptions {
  /** Stable action inventory used for exact route lookup. */
  readonly registry: KanbanActionRegistry;
  /** Optional synchronous UI capability policy. */
  readonly capability?: KanbanCapabilityProvider;
  /** Maximum distinct synchronous nesting depth; defaults to 16 and cannot exceed 64. */
  readonly maxDepth?: number;
}

/** Exact native Promise method captured before application code can replace an instance method. */
const NATIVE_PROMISE_THEN = Promise.prototype.then;
/** Default distinct-action synchronous nesting depth. */
const DEFAULT_ACTION_DEPTH = 16;
/** Hard package ceiling for distinct-action synchronous nesting. */
const MAX_ACTION_DEPTH = 64;
/** Maximum UTF-8 size of one exact routed action identity. */
const MAX_ACTION_ID_BYTES = 256;
/** Control characters forbidden in routed action identities. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
/** Closed action-origin inventory. */
const ACTION_ORIGINS: ReadonlySet<string> = new Set([
  'keyboard',
  'menu',
  'context-menu',
  'status',
  'pointer',
  'programmatic',
]);
/** Exact members accepted in one invocation. */
const INVOCATION_KEYS = new Set(['actionId', 'origin', 'target', 'selection', 'source', 'view']);
/** Exact members accepted in one selection summary. */
const SELECTION_KEYS = new Set(['count']);
/** Exact members accepted in one source summary. */
const SOURCE_KEYS = new Set(['state', 'revision']);
/** Exact members accepted in one view summary. */
const VIEW_KEYS = new Set(['revision']);
/** Exact members accepted by every target variant. */
const TARGET_KEYS: Readonly<Record<KanbanActionInvocationTarget['kind'], ReadonlySet<string>>> = Object.freeze({
  board: new Set(['kind']),
  card: new Set(['kind', 'cardKey', 'revision']),
  cell: new Set(['kind', 'columnId', 'swimlaneId']),
  column: new Set(['kind', 'columnId', 'revision']),
  swimlane: new Set(['kind', 'swimlaneId', 'revision']),
});
/** Exact keys accepted from each handler outcome variant. */
const HANDLED_KEYS = new Set(['kind']);
/** Exact keys accepted from disabled handler outcomes. */
const DISABLED_KEYS = new Set(['kind', 'code', 'label']);
/** Exact keys accepted from unavailable handler outcomes. */
const UNAVAILABLE_KEYS = new Set(['kind', 'code']);
/** Closed unavailable codes handlers may return. */
const UNAVAILABLE_CODES: ReadonlySet<string> = new Set([
  'action-unavailable',
  'router-disposed',
  'action-depth-exceeded',
  'action-reentrant',
]);

/** Shared payload-free outcomes returned without allocating on hot paths. */
const ACTION_UNAVAILABLE: KanbanActionTerminalOutcome = Object.freeze({
  kind: 'unavailable',
  code: 'action-unavailable',
});
const ROUTER_DISPOSED: KanbanActionTerminalOutcome = Object.freeze({
  kind: 'unavailable',
  code: 'router-disposed',
});
const ACTION_DEPTH_EXCEEDED: KanbanActionTerminalOutcome = Object.freeze({
  kind: 'unavailable',
  code: 'action-depth-exceeded',
});
const ACTION_REENTRANT: KanbanActionTerminalOutcome = Object.freeze({
  kind: 'unavailable',
  code: 'action-reentrant',
});
const ACTION_FAILED: KanbanActionTerminalOutcome = Object.freeze({
  kind: 'disabled',
  code: 'action-failed',
});

/** Narrows one unknown origin through the package allowlist. */
function isActionOrigin(value: unknown): value is KanbanActionOrigin {
  return typeof value === 'string' && ACTION_ORIGINS.has(value);
}

/** Rejects oversized or control-bearing action identities before registry lookup. */
function isBoundedActionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ACTION_ID_BYTES &&
    !CONTROL_CHARACTERS.test(value) &&
    new TextEncoder().encode(value).byteLength <= MAX_ACTION_ID_BYTES
  );
}

/** Narrows an unknown target discriminator without coercing application input. */
function isActionTargetKind(value: unknown): value is KanbanActionInvocationTarget['kind'] {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TARGET_KEYS, value);
}

/** Snapshots one optional equality-only revision. */
function optionalRevision(value: unknown): ReturnType<typeof snapshotKanbanRevision> | undefined {
  return value === undefined ? undefined : snapshotKanbanRevision(value);
}

/** Copies and validates one closed logical target. */
function snapshotTarget(value: unknown): KanbanActionInvocationTarget {
  const properties = snapshotKanbanDataProperties(value, 3);
  const kind = properties.kind;
  if (!isActionTargetKind(kind)) throw new Error('Invalid action target.');
  const keys = TARGET_KEYS[kind];
  validateKanbanDataKeys(properties, keys);
  if (kind === 'board') return Object.freeze({ kind });
  if (kind === 'card') {
    if (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') {
      throw new Error('Invalid card target.');
    }
    const revision = optionalRevision(properties.revision);
    return Object.freeze({
      kind,
      cardKey: createKanbanCardKey(properties.cardKey),
      ...(revision === undefined ? {} : { revision }),
    });
  }
  if (kind === 'cell') {
    if (typeof properties.columnId !== 'string') throw new Error('Invalid cell target.');
    if (properties.swimlaneId !== undefined && typeof properties.swimlaneId !== 'string') {
      throw new Error('Invalid cell target.');
    }
    return Object.freeze({
      kind,
      columnId: createKanbanColumnId(properties.columnId),
      ...(properties.swimlaneId === undefined ? {} : { swimlaneId: createKanbanSwimlaneId(properties.swimlaneId) }),
    });
  }
  if (kind === 'column') {
    if (typeof properties.columnId !== 'string') throw new Error('Invalid column target.');
    const revision = optionalRevision(properties.revision);
    return Object.freeze({
      kind,
      columnId: createKanbanColumnId(properties.columnId),
      ...(revision === undefined ? {} : { revision }),
    });
  }
  if (typeof properties.swimlaneId !== 'string') throw new Error('Invalid swimlane target.');
  const revision = optionalRevision(properties.revision);
  return Object.freeze({
    kind: 'swimlane',
    swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
    ...(revision === undefined ? {} : { revision }),
  });
}

/** Copies one bounded record-free invocation before policy or handler code can observe it. */
function snapshotInvocation(value: unknown): KanbanActionInvocation {
  const properties = snapshotKanbanDataProperties(value, INVOCATION_KEYS.size);
  validateKanbanDataKeys(properties, INVOCATION_KEYS);
  if (!isBoundedActionId(properties.actionId) || !isActionOrigin(properties.origin)) {
    throw new Error('Invalid action invocation.');
  }
  const selection = snapshotKanbanDataProperties(properties.selection, SELECTION_KEYS.size);
  validateKanbanDataKeys(selection, SELECTION_KEYS);
  if (
    typeof selection.count !== 'number' ||
    !Number.isSafeInteger(selection.count) ||
    selection.count < 0 ||
    selection.count > KANBAN_LIMITS.selectedKeys.absolute
  ) {
    throw new Error('Invalid action selection summary.');
  }
  const source = snapshotKanbanDataProperties(properties.source, SOURCE_KEYS.size);
  validateKanbanDataKeys(source, SOURCE_KEYS);
  if (
    source.state !== 'ready' &&
    source.state !== 'loading' &&
    source.state !== 'error' &&
    source.state !== 'disposed'
  ) {
    throw new Error('Invalid action source summary.');
  }
  const sourceRevision = optionalRevision(source.revision);
  const sourceSnapshot: KanbanActionSourceSnapshot = Object.freeze({
    state: source.state,
    ...(sourceRevision === undefined ? {} : { revision: sourceRevision }),
  });
  const view = snapshotKanbanDataProperties(properties.view, VIEW_KEYS.size);
  validateKanbanDataKeys(view, VIEW_KEYS);
  const viewRevision = optionalRevision(view.revision);
  return Object.freeze({
    actionId: properties.actionId,
    origin: properties.origin,
    target: snapshotTarget(properties.target),
    selection: Object.freeze({ count: selection.count }),
    source: sourceSnapshot,
    view: Object.freeze(viewRevision === undefined ? {} : { revision: viewRevision }),
  });
}

/** Returns true only for a direct native Promise with its original `then` method. */
function isExactNativePromise(value: unknown): value is Promise<KanbanActionTerminalOutcome> {
  try {
    return (
      value instanceof Promise &&
      Object.getPrototypeOf(value) === Promise.prototype &&
      Object.getOwnPropertyDescriptor(value, 'then') === undefined
    );
  } catch {
    return false;
  }
}

/** Copies one closed terminal handler outcome or returns redacted failure. */
function snapshotTerminalOutcome(value: unknown): KanbanActionTerminalOutcome {
  try {
    const properties = snapshotKanbanDataProperties(value, 3);
    if (properties.kind === 'handled') {
      validateKanbanDataKeys(properties, HANDLED_KEYS);
      return Object.freeze({ kind: 'handled' });
    }
    if (properties.kind === 'hidden') {
      validateKanbanDataKeys(properties, HANDLED_KEYS);
      return Object.freeze({ kind: 'hidden' });
    }
    if (properties.kind === 'disabled') {
      validateKanbanDataKeys(properties, DISABLED_KEYS);
      const code = snapshotKanbanReasonCode(properties.code);
      if (code === undefined) return ACTION_FAILED;
      const label = snapshotKanbanLabel(properties.label);
      return Object.freeze({ kind: 'disabled', code, ...(label === undefined ? {} : { label }) });
    }
    if (properties.kind === 'unavailable') {
      validateKanbanDataKeys(properties, UNAVAILABLE_KEYS);
      if (typeof properties.code !== 'string' || !UNAVAILABLE_CODES.has(properties.code)) return ACTION_FAILED;
      if (properties.code === 'router-disposed') return ROUTER_DISPOSED;
      if (properties.code === 'action-depth-exceeded') return ACTION_DEPTH_EXCEEDED;
      if (properties.code === 'action-reentrant') return ACTION_REENTRANT;
      return ACTION_UNAVAILABLE;
    }
  } catch {
    return ACTION_FAILED;
  }
  return ACTION_FAILED;
}

/** Converts one capability result to the corresponding terminal route outcome. */
function deniedOutcome(capability: KanbanActionCapability): KanbanActionTerminalOutcome | undefined {
  if (capability.state === 'allowed') return undefined;
  if (capability.state === 'hidden') return Object.freeze({ kind: 'hidden' });
  return Object.freeze({
    kind: 'disabled',
    code: capability.reasonCode,
    ...(capability.label === undefined ? {} : { label: capability.label }),
  });
}

/** Evaluates one exact action capability over the detached invocation. */
function eligibility(
  provider: KanbanCapabilityProvider | undefined,
  definition: KanbanActionDefinition,
  invocation: KanbanActionInvocation,
): KanbanActionCapability {
  return evaluateKanbanActionCapability(provider, Object.freeze({ ...invocation, definition }));
}

/**
 * Creates the one shared action router for keyboard, pointer, chrome, and programmatic origins.
 *
 * @example
 * ```ts
 * const router = createKanbanActionRouter({ registry });
 * const outcome = router.invoke(invocation);
 * ```
 */
export function createKanbanActionRouter(options: KanbanActionRouterOptions): KanbanActionRouter {
  const maxDepth = options.maxDepth ?? DEFAULT_ACTION_DEPTH;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > MAX_ACTION_DEPTH) {
    throw new Error('Invalid Kanban action router depth.');
  }
  const activeActions = new Set<string>();
  let depth = 0;
  let generation = 0;
  let isDisposed = false;

  const resolve = (
    input: KanbanActionInvocation,
  ): { readonly invocation: KanbanActionInvocation; readonly definition: KanbanActionDefinition } | undefined => {
    try {
      const invocation = snapshotInvocation(input);
      const definition = options.registry.action(invocation.actionId);
      return definition === undefined ? undefined : Object.freeze({ invocation, definition });
    } catch {
      return undefined;
    }
  };

  const router: KanbanActionRouter = {
    invoke: (input) => {
      if (isDisposed) return ROUTER_DISPOSED;
      const route = resolve(input);
      if (route === undefined) return ACTION_UNAVAILABLE;
      if (depth >= maxDepth) return ACTION_DEPTH_EXCEEDED;
      if (activeActions.has(route.definition.id)) return ACTION_REENTRANT;
      const denied = deniedOutcome(eligibility(options.capability, route.definition, route.invocation));
      if (denied !== undefined) return denied;

      activeActions.add(route.definition.id);
      depth += 1;
      const admittedGeneration = generation;
      try {
        const result = route.definition.handler(route.invocation);
        if (!isExactNativePromise(result)) return snapshotTerminalOutcome(result);
        const completion = new Promise<KanbanActionTerminalOutcome>((resolveCompletion) => {
          NATIVE_PROMISE_THEN.call(
            result,
            (outcome) => {
              resolveCompletion(
                isDisposed || generation !== admittedGeneration ? ROUTER_DISPOSED : snapshotTerminalOutcome(outcome),
              );
            },
            () => {
              resolveCompletion(isDisposed || generation !== admittedGeneration ? ROUTER_DISPOSED : ACTION_FAILED);
            },
          );
        });
        return Object.freeze({ kind: 'pending', actionId: route.definition.id, completion });
      } catch {
        return ACTION_FAILED;
      } finally {
        depth -= 1;
        activeActions.delete(route.definition.id);
      }
    },
    affordance: (input): KanbanActionAffordance => {
      if (isDisposed) return Object.freeze({ visible: false, enabled: false });
      const route = resolve(input);
      if (route === undefined) return Object.freeze({ visible: false, enabled: false });
      const capability = eligibility(options.capability, route.definition, route.invocation);
      return capability.state === 'hidden'
        ? Object.freeze({ visible: false, enabled: false })
        : Object.freeze({ visible: true, enabled: capability.state === 'allowed' });
    },
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      generation += 1;
      activeActions.clear();
      depth = 0;
    },
    disposed: () => isDisposed,
  };
  return Object.freeze(router);
}
