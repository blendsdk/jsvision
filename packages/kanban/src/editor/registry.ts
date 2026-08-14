import { View } from '@jsvision/ui';

import { snapshotKanbanDataArray, snapshotKanbanDataProperties } from '../contract/data-snapshot.js';
import { KanbanInvalidEditorSchemaError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type {
  KanbanEditorControlContext,
  KanbanEditorControlInstance,
  KanbanEditorControlMeasurement,
  KanbanEditorControlRegistration,
  KanbanEditorControlRegistry,
  KanbanEditorDiagnostic,
} from './types.js';

/** Input accepted by the bounded custom-control registry constructor. */
export interface KanbanEditorControlRegistryOptions {
  /** Finite application control registrations. */
  readonly controls?: readonly KanbanEditorControlRegistration[];
}

/** Successful or payload-free failed application callback invocation. */
export type KanbanEditorCallbackOutcome<TResult> =
  | { readonly kind: 'value'; readonly value: TResult }
  | { readonly kind: 'failure'; readonly diagnostic: KanbanEditorDiagnostic };

/** Exact registry-envelope members. */
const REGISTRY_KEYS = new Set(['controls']);
/** Exact custom-control registration members. */
const REGISTRATION_KEYS = new Set(['controlId', 'create']);
/** Exact custom-control instance members. */
const INSTANCE_KEYS = new Set(['view', 'measure', 'dispose']);
/** Exact measurement members. */
const MEASUREMENT_KEYS = new Set(['minimumWidth', 'preferredWidth', 'rows']);
/** Namespaced identities select registered behavior but never module or host paths. */
const CONTROL_ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/u;
/** Factory-owned registries accepted by schema construction without invoking caller methods. */
const OWNED_REGISTRIES = new WeakSet<object>();
/** Safe callback failure shared by field and control isolation. */
const CALLBACK_FAILURE: KanbanEditorDiagnostic = Object.freeze({ code: 'callback-failed' });

/** Converts unsafe registration and instance data into one payload-free public error. */
function invalidRegistry(): never {
  throw new KanbanInvalidEditorSchemaError();
}

/** Validates one terminal-cell measurement without coercion. */
function measurement(value: unknown): KanbanEditorControlMeasurement {
  const properties = snapshotKanbanDataProperties(value, MEASUREMENT_KEYS.size);
  if (Object.keys(properties).some((key) => !MEASUREMENT_KEYS.has(key))) return invalidRegistry();
  const minimumWidth = properties.minimumWidth;
  const preferredWidth = properties.preferredWidth;
  const rows = properties.rows;
  if (
    typeof minimumWidth !== 'number' ||
    !Number.isSafeInteger(minimumWidth) ||
    minimumWidth < 1 ||
    typeof preferredWidth !== 'number' ||
    !Number.isSafeInteger(preferredWidth) ||
    preferredWidth < minimumWidth ||
    preferredWidth > KANBAN_LIMITS.semanticStringBytes.safe ||
    typeof rows !== 'number' ||
    !Number.isSafeInteger(rows) ||
    rows < 1 ||
    rows > KANBAN_LIMITS.descriptorRows.absolute
  ) {
    return invalidRegistry();
  }
  return Object.freeze({ minimumWidth, preferredWidth, rows });
}

/** Wraps a validated control instance so measurement and disposal remain bounded and isolated. */
function wrapInstance(value: unknown): KanbanEditorControlInstance {
  const properties = snapshotKanbanDataProperties(value, INSTANCE_KEYS.size);
  const disposeCallback = properties.dispose;
  if (
    Object.keys(properties).some((key) => !INSTANCE_KEYS.has(key)) ||
    !(properties.view instanceof View) ||
    typeof properties.measure !== 'function' ||
    typeof disposeCallback !== 'function'
  ) {
    if (typeof disposeCallback === 'function') {
      try {
        Reflect.apply(disposeCallback, value, []);
      } catch {
        // A malformed instance still gets one best-effort cleanup without exposing callback data.
      }
    }
    return invalidRegistry();
  }
  const measureCallback = properties.measure;
  let disposed = false;
  return Object.freeze({
    view: properties.view,
    measure: (availableWidth: number) => {
      if (!Number.isSafeInteger(availableWidth) || availableWidth < 1 || availableWidth > 32_768) {
        return invalidRegistry();
      }
      try {
        return measurement(Reflect.apply(measureCallback, value, [availableWidth]));
      } catch (error) {
        if (error instanceof KanbanInvalidEditorSchemaError) throw error;
        return invalidRegistry();
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try {
        Reflect.apply(disposeCallback, value, []);
      } catch {
        // Cleanup is best-effort and idempotent; thrown application values never cross this boundary.
      }
    },
  });
}

/** Snapshots one registration and wraps its factory without invoking it during registry construction. */
function snapshotRegistration(value: unknown): KanbanEditorControlRegistration {
  const properties = snapshotKanbanDataProperties(value, REGISTRATION_KEYS.size);
  if (
    Object.keys(properties).some((key) => !REGISTRATION_KEYS.has(key)) ||
    typeof properties.controlId !== 'string' ||
    !CONTROL_ID.test(properties.controlId) ||
    new TextEncoder().encode(properties.controlId).byteLength > KANBAN_LIMITS.idBytes.safe ||
    typeof properties.create !== 'function'
  ) {
    return invalidRegistry();
  }
  const create = properties.create;
  return Object.freeze({
    controlId: properties.controlId,
    create: (context?: KanbanEditorControlContext) => {
      try {
        return wrapInstance(Reflect.apply(create, undefined, context === undefined ? [] : [context]));
      } catch (error) {
        if (error instanceof KanbanInvalidEditorSchemaError) throw error;
        return invalidRegistry();
      }
    },
  });
}

/**
 * Creates a finite immutable registry whose inert IDs are the only custom-control selectors.
 *
 * Factories are not invoked until a mounted editor requests one control. Returned instances are then
 * validated, measurement-bounded, and wrapped with idempotent cleanup.
 *
 * @example
 * ```ts
 * const registry = createKanbanEditorControlRegistry({
 *   controls: [{
 *     controlId: 'example.controls.owner',
 *     create: () => ({ view, measure: () => ({ minimumWidth: 8, preferredWidth: 20, rows: 1 }), dispose }),
 *   }],
 * });
 * ```
 */
export function createKanbanEditorControlRegistry(
  options: KanbanEditorControlRegistryOptions = {},
): KanbanEditorControlRegistry {
  try {
    const properties = snapshotKanbanDataProperties(options, REGISTRY_KEYS.size);
    if (Object.keys(properties).some((key) => !REGISTRY_KEYS.has(key))) return invalidRegistry();
    const controls = Object.freeze(
      snapshotKanbanDataArray(properties.controls ?? [], KANBAN_LIMITS.cardFields.safe).map(snapshotRegistration),
    );
    const byId = new Map<string, KanbanEditorControlRegistration>();
    for (const control of controls) {
      if (byId.has(control.controlId)) return invalidRegistry();
      byId.set(control.controlId, control);
    }
    const registry = Object.freeze({
      controls,
      control: (controlId: string) => byId.get(controlId),
    });
    OWNED_REGISTRIES.add(registry);
    return registry;
  } catch (error) {
    if (error instanceof KanbanInvalidEditorSchemaError) throw error;
    return invalidRegistry();
  }
}

/** Returns true only for immutable registries created by this module. */
export function isKanbanEditorControlRegistry(value: unknown): value is KanbanEditorControlRegistry {
  return typeof value === 'object' && value !== null && OWNED_REGISTRIES.has(value);
}

/** Invokes one synchronous application callback without exposing thrown data. */
export function invokeKanbanEditorCallback<TArgs extends readonly unknown[], TResult>(
  callback: (...args: TArgs) => TResult,
  args: TArgs,
): KanbanEditorCallbackOutcome<TResult> {
  try {
    return Object.freeze({ kind: 'value', value: callback(...args) });
  } catch {
    return Object.freeze({ kind: 'failure', diagnostic: CALLBACK_FAILURE });
  }
}

/** Invokes one asynchronous application callback and contains thrown or rejected data. */
export async function invokeKanbanEditorAsyncCallback<TArgs extends readonly unknown[], TResult>(
  callback: (...args: TArgs) => Promise<TResult>,
  args: TArgs,
): Promise<KanbanEditorCallbackOutcome<TResult>> {
  try {
    return Object.freeze({ kind: 'value', value: await callback(...args) });
  } catch {
    return Object.freeze({ kind: 'failure', diagnostic: CALLBACK_FAILURE });
  }
}
