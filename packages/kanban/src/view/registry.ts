import { KanbanInvalidViewRegistryError } from '../contract/error.js';
import { createKanbanExtensionId } from '../contract/identity.js';
import type { KanbanExtensionId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { snapshotKanbanDataArray, snapshotKanbanDataProperties } from '../contract/data-snapshot.js';

/** Parameter boundary for one registered quick filter. */
export interface KanbanQuickFilterParameterCodec {
  /** Validates and detaches application input before it enters view state. */
  readonly snapshot: (value: unknown) => KanbanSemanticValue;
}

/** Application metadata and behavior for one named quick filter. */
export interface KanbanQuickFilterRegistration<TCard = unknown> {
  /** Stable application-namespaced quick-filter identity. */
  readonly id: KanbanExtensionId;
  /** Stable localized message identity displayed by package chrome. */
  readonly labelId: string;
  /** Evaluates one card; registered code never enters a saved view. */
  readonly predicate: (card: TCard, value?: KanbanSemanticValue) => boolean;
  /** Optional detached parameter validator. */
  readonly parameterCodec?: KanbanQuickFilterParameterCodec;
  /** Whether diagnostics must suppress the parameter value. */
  readonly sensitive?: boolean;
  /** Optional pure availability predicate for application context. */
  readonly applicable?: () => boolean;
}

/** Input accepted by the bounded view registry constructor. */
export interface KanbanViewRegistryOptions<TCard = unknown> {
  /** Finite named quick-filter registrations. */
  readonly quickFilters?: readonly KanbanQuickFilterRegistration<TCard>[];
}

/** Immutable behavior registry used by view state and standard chrome. */
export interface KanbanViewRegistry<TCard = unknown> {
  /** Detached ordered quick-filter registrations. */
  readonly quickFilters: readonly KanbanQuickFilterRegistration<TCard>[];
  /** Looks up a quick filter without interpreting untrusted view data. */
  quickFilter(id: KanbanExtensionId): KanbanQuickFilterRegistration<TCard> | undefined;
}

/** Exact allowed fields for one quick-filter registration. */
const QUICK_FILTER_KEYS = new Set(['id', 'labelId', 'predicate', 'parameterCodec', 'sensitive', 'applicable']);
/** Conservative grammar for application or package localization message identities. */
const MESSAGE_ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/u;

/** Converts any unsafe registry input into the public payload-free error. */
function invalidRegistry(): never {
  throw new KanbanInvalidViewRegistryError();
}

/** Snapshots one registration without invoking accessors or registered behavior. */
function snapshotQuickFilter<TCard>(value: unknown): KanbanQuickFilterRegistration<TCard> {
  try {
    const properties = snapshotKanbanDataProperties(value, QUICK_FILTER_KEYS.size);
    if (Object.keys(properties).some((key) => !QUICK_FILTER_KEYS.has(key))) return invalidRegistry();
    if (
      typeof properties.id !== 'string' ||
      typeof properties.labelId !== 'string' ||
      !MESSAGE_ID.test(properties.labelId) ||
      new TextEncoder().encode(properties.labelId).byteLength > KANBAN_LIMITS.idBytes.safe ||
      typeof properties.predicate !== 'function' ||
      (properties.sensitive !== undefined && typeof properties.sensitive !== 'boolean') ||
      (properties.applicable !== undefined && typeof properties.applicable !== 'function')
    ) {
      return invalidRegistry();
    }
    const codec = properties.parameterCodec;
    let parameterCodec: KanbanQuickFilterParameterCodec | undefined;
    if (codec !== undefined) {
      const codecProperties = snapshotKanbanDataProperties(codec, 1);
      if (Object.keys(codecProperties).length !== 1 || typeof codecProperties.snapshot !== 'function') {
        return invalidRegistry();
      }
      parameterCodec = Object.freeze({
        snapshot: codecProperties.snapshot as KanbanQuickFilterParameterCodec['snapshot'],
      });
    }
    return Object.freeze({
      id: createKanbanExtensionId(properties.id),
      labelId: properties.labelId,
      predicate: properties.predicate as KanbanQuickFilterRegistration<TCard>['predicate'],
      ...(parameterCodec === undefined ? {} : { parameterCodec }),
      ...(properties.sensitive === undefined ? {} : { sensitive: properties.sensitive }),
      ...(properties.applicable === undefined
        ? {}
        : { applicable: properties.applicable as KanbanQuickFilterRegistration<TCard>['applicable'] }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidViewRegistryError) throw error;
    return invalidRegistry();
  }
}

/**
 * Validates and detaches a finite application view registry without invoking registered behavior.
 *
 * @example
 * ```ts
 * const registry = createKanbanViewRegistry({
 *   quickFilters: [{
 *     id: 'example.mine',
 *     labelId: 'example.filters.mine',
 *     predicate: (card: { owner: string }) => card.owner === 'me',
 *   }],
 * });
 * ```
 */
export function createKanbanViewRegistry<TCard = unknown>(
  options: KanbanViewRegistryOptions<TCard> = {},
): KanbanViewRegistry<TCard> {
  try {
    const optionProperties = snapshotKanbanDataProperties(options, 1);
    if (Object.keys(optionProperties).some((key) => key !== 'quickFilters')) return invalidRegistry();
    const quickFilters = Object.freeze(
      snapshotKanbanDataArray(optionProperties.quickFilters ?? [], KANBAN_LIMITS.cardFields.safe).map((entry) =>
        snapshotQuickFilter<TCard>(entry),
      ),
    );
    const byId = new Map<KanbanExtensionId, KanbanQuickFilterRegistration<TCard>>();
    for (const quickFilter of quickFilters) {
      if (byId.has(quickFilter.id)) return invalidRegistry();
      byId.set(quickFilter.id, quickFilter);
    }
    return Object.freeze({
      quickFilters,
      quickFilter: (id: KanbanExtensionId) => byId.get(id),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidViewRegistryError) throw error;
    return invalidRegistry();
  }
}
