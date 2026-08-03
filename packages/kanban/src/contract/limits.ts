import { KanbanError } from './error.js';

/** One package resource limit across safe, standard, and absolute classes. */
export interface KanbanLimitRow {
  /** Conservative default and maximum accepted by the safe class. */
  readonly safe: number;
  /** Larger default and maximum accepted by the standard class. */
  readonly standard: number;
  /** Hard package ceiling, used as the advanced-class maximum. */
  readonly absolute: number;
}

/** Complete durable resource-limit surface shared by all Kanban phases. */
export interface KanbanLimitManifest {
  readonly idBytes: KanbanLimitRow;
  readonly tokenBytes: KanbanLimitRow;
  readonly semanticEncodedBytes: KanbanLimitRow;
  readonly semanticDepth: KanbanLimitRow;
  readonly semanticArrayEntries: KanbanLimitRow;
  readonly semanticObjectKeys: KanbanLimitRow;
  readonly semanticStringBytes: KanbanLimitRow;
  readonly columns: KanbanLimitRow;
  readonly swimlanes: KanbanLimitRow;
  readonly retainedCursors: KanbanLimitRow;
  readonly ensureRangeCards: KanbanLimitRow;
  readonly cardFields: KanbanLimitRow;
  readonly summarySections: KanbanLimitRow;
  readonly checklistGroups: KanbanLimitRow;
  readonly checklistItemsPerGroup: KanbanLimitRow;
  readonly cardRowsCompact: KanbanLimitRow;
  readonly cardRowsComfortable: KanbanLimitRow;
  readonly cardRowsSpacious: KanbanLimitRow;
  readonly descriptorRows: KanbanLimitRow;
  readonly selectedKeys: KanbanLimitRow;
  readonly concurrentCellLoads: KanbanLimitRow;
  readonly concurrentValidators: KanbanLimitRow;
  readonly pendingOperations: KanbanLimitRow;
  readonly retainedOperationIds: KanbanLimitRow;
  readonly retainedObservations: KanbanLimitRow;
  readonly verticalOverscan: KanbanLimitRow;
  readonly horizontalOverscan: KanbanLimitRow;
}

/** Resource class selected by a component instance. */
export type KanbanLimitClass = 'safe' | 'standard' | 'advanced';

/** Every validated concrete limit keyed by the public manifest. */
export type KanbanResolvedLimits = Readonly<Record<keyof KanbanLimitManifest, number>>;

/** Caller-selected class and optional values that may lower, but never exceed, its ceiling. */
export interface KanbanLimitOptions {
  readonly class?: KanbanLimitClass;
  readonly values?: Partial<KanbanResolvedLimits>;
}

/** A safe typed error raised before invalid resource limits can be used. */
export class KanbanInvalidLimitError extends KanbanError {
  /** Stable machine-readable failure code. */
  readonly code = 'invalid-limit' as const;

  /** Creates a bounded error that does not retain the rejected value. */
  constructor() {
    super('Invalid Kanban resource limit selection.');
    this.name = 'KanbanInvalidLimitError';
  }
}

/** Freezes one manifest row before it becomes publicly reachable. */
function limit(safe: number, standard: number, absolute: number): KanbanLimitRow {
  return Object.freeze({ safe, standard, absolute });
}

/** Complete deeply immutable Kanban resource-limit manifest. */
export const KANBAN_LIMITS: KanbanLimitManifest = Object.freeze({
  idBytes: limit(256, 256, 256),
  tokenBytes: limit(2_048, 2_048, 2_048),
  semanticEncodedBytes: limit(262_144, 1_048_576, 4_194_304),
  semanticDepth: limit(16, 32, 64),
  semanticArrayEntries: limit(4_096, 16_384, 65_536),
  semanticObjectKeys: limit(256, 1_024, 4_096),
  semanticStringBytes: limit(16_384, 65_536, 262_144),
  columns: limit(64, 256, 1_024),
  swimlanes: limit(128, 512, 2_048),
  retainedCursors: limit(64, 256, 1_024),
  ensureRangeCards: limit(256, 2_048, 8_192),
  cardFields: limit(64, 128, 256),
  summarySections: limit(16, 32, 64),
  checklistGroups: limit(32, 64, 128),
  checklistItemsPerGroup: limit(1_024, 4_096, 16_384),
  cardRowsCompact: limit(6, 6, 6),
  cardRowsComfortable: limit(12, 12, 12),
  cardRowsSpacious: limit(18, 18, 18),
  descriptorRows: limit(32, 32, 32),
  selectedKeys: limit(10_000, 50_000, 100_000),
  concurrentCellLoads: limit(8, 16, 64),
  concurrentValidators: limit(4, 16, 32),
  pendingOperations: limit(32, 128, 512),
  retainedOperationIds: limit(1_024, 8_192, 32_768),
  retainedObservations: limit(256, 2_048, 8_192),
  verticalOverscan: limit(1, 4, 8),
  horizontalOverscan: limit(1, 4, 8),
});

/** Manifest keys captured once from the immutable package-owned object. */
const LIMIT_KEYS = Object.freeze(Object.keys(KANBAN_LIMITS) as (keyof KanbanLimitManifest)[]);

/** Returns true only for plain data objects with no accessor properties. */
function isDataObject(value: unknown): value is Readonly<Record<string, unknown>> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (descriptor) => descriptor.get === undefined && descriptor.set === undefined,
    );
  } catch {
    return false;
  }
}

/**
 * Resolves and freezes a class-bounded limit selection before any caller allocation occurs.
 *
 * Omitted values use the selected class defaults. Advanced mode keeps safe defaults and permits
 * explicitly supplied values up to each absolute ceiling.
 */
export function validateKanbanLimitOptions(options: KanbanLimitOptions = {}): KanbanResolvedLimits {
  if (!isDataObject(options)) throw new KanbanInvalidLimitError();
  if (Object.keys(options).some((key) => key !== 'class' && key !== 'values')) {
    throw new KanbanInvalidLimitError();
  }
  const selectedClass = options.class ?? 'safe';
  if (selectedClass !== 'safe' && selectedClass !== 'standard' && selectedClass !== 'advanced') {
    throw new KanbanInvalidLimitError();
  }

  const values = options.values ?? {};
  if (!isDataObject(values)) throw new KanbanInvalidLimitError();
  const knownKeys = new Set<string>(LIMIT_KEYS);
  if (Object.keys(values).some((key) => !knownKeys.has(key))) throw new KanbanInvalidLimitError();

  const resolved = {} as Record<keyof KanbanLimitManifest, number>;
  for (const key of LIMIT_KEYS) {
    const row = KANBAN_LIMITS[key];
    const maximum = selectedClass === 'advanced' ? row.absolute : row[selectedClass];
    const defaultValue = selectedClass === 'advanced' ? row.safe : row[selectedClass];
    const candidate = values[key] ?? defaultValue;
    if (
      typeof candidate !== 'number' ||
      !Number.isSafeInteger(candidate) ||
      candidate < 0 ||
      candidate > maximum ||
      candidate > row.absolute
    ) {
      throw new KanbanInvalidLimitError();
    }
    resolved[key] = candidate;
  }
  return Object.freeze(resolved);
}
