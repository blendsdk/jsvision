import { snapshotKanbanDataArray, snapshotKanbanDataProperties } from '../contract/data-snapshot.js';
import { KanbanInvalidSavedViewError } from '../contract/error.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { parseKanbanSavedView } from './saved-view-codec.js';
import { KANBAN_SAVED_VIEW_LIMITS } from './saved-view-limits.js';
import { KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS } from './saved-view-types.js';
import type {
  KanbanSavedViewMigration,
  KanbanSavedViewMigrationOptions,
  KanbanSavedViewMigrationRegistry,
  KanbanSavedViewMigrationRegistryOptions,
  KanbanSavedViewMigrationResult,
} from './saved-view-types.js';

/** Exact members accepted for one migration adapter. */
const MIGRATION_KEYS = new Set(['fromVersion', 'toVersion', 'migrate']);
/** Exact members accepted for migration-registry options. */
const REGISTRY_KEYS = new Set(['migrations']);
/** Exact members read from an older envelope before application code runs. */
const VERSION_KEYS = new Set(['kind', 'version', 'name', 'view', 'extensions']);

/** Rejects invalid registry configuration without retaining callback or envelope data. */
function invalidMigration(): never {
  throw new KanbanInvalidSavedViewError();
}

/** Reads an exact plain data object without invoking accessors. */
function exactProperties(value: unknown, keys: ReadonlySet<string>): Readonly<Record<string, unknown>> {
  try {
    const properties = snapshotKanbanDataProperties(value, keys.size);
    if (Object.keys(properties).some((key) => !keys.has(key))) return invalidMigration();
    return properties;
  } catch {
    return invalidMigration();
  }
}

/** Validates one non-negative safe schema version. */
function schemaVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalidMigration();
  return value;
}

/** Snapshots one one-version migration adapter without invoking it. */
function snapshotMigration(value: unknown): KanbanSavedViewMigration {
  const properties = exactProperties(value, MIGRATION_KEYS);
  const fromVersion = schemaVersion(properties.fromVersion);
  const toVersion = schemaVersion(properties.toVersion);
  if (toVersion !== fromVersion + 1 || typeof properties.migrate !== 'function') return invalidMigration();
  return Object.freeze({
    fromVersion,
    toVersion,
    migrate: properties.migrate as KanbanSavedViewMigration['migrate'],
  });
}

/**
 * Creates an immutable bounded registry of sequential application migration adapters.
 *
 * Duplicate source versions and adapters that skip versions are rejected before any callback runs.
 */
export function createKanbanSavedViewMigrationRegistry(
  options: KanbanSavedViewMigrationRegistryOptions = {},
): KanbanSavedViewMigrationRegistry {
  const properties = exactProperties(options, REGISTRY_KEYS);
  let migrations: readonly unknown[];
  try {
    migrations = snapshotKanbanDataArray(properties.migrations ?? [], KANBAN_SAVED_VIEW_LIMITS.migrations);
  } catch {
    return invalidMigration();
  }
  const snapshot = Object.freeze(
    migrations.map(snapshotMigration).sort((left, right) => left.fromVersion - right.fromVersion),
  );
  const byVersion = new Map<number, KanbanSavedViewMigration>();
  for (const migration of snapshot) {
    if (byVersion.has(migration.fromVersion)) return invalidMigration();
    byVersion.set(migration.fromVersion, migration);
  }
  return Object.freeze({
    migrations: snapshot,
    migrationFrom: (version: number) => byVersion.get(version),
  });
}

/** Returns a sanitized failure shared by every adapter or post-adapter validation error. */
function migrationFailed(): KanbanSavedViewMigrationResult {
  return Object.freeze({ kind: 'rejected', diagnostic: Object.freeze({ code: 'migration-failed' }) });
}

/** Reads the detached envelope version without requiring the current exact schema. */
function envelopeVersion(value: KanbanSemanticValue): number {
  const properties = exactProperties(value, VERSION_KEYS);
  if (properties.kind !== 'jsvision-kanban-view') return invalidMigration();
  return schemaVersion(properties.version);
}

/**
 * Advances an older detached saved-view envelope through each registered version exactly once.
 *
 * Adapter exceptions and invalid adapter output are converted to a payload-free diagnostic. The caller's
 * input and every intermediate generation remain detached from application-owned containers.
 */
export function migrateKanbanSavedView(
  input: unknown,
  options: KanbanSavedViewMigrationOptions = {},
): KanbanSavedViewMigrationResult {
  try {
    let current = snapshotKanbanSemanticValue(input);
    const fromVersion = envelopeVersion(current);
    if (fromVersion > KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS.maximum) {
      return Object.freeze({
        kind: 'unsupported-version',
        version: fromVersion,
        supported: KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS,
      });
    }
    const registry = options.registry ?? createKanbanSavedViewMigrationRegistry();
    let version = fromVersion;
    let steps = 0;
    while (version < KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS.maximum) {
      if (steps >= KANBAN_SAVED_VIEW_LIMITS.migrations) return migrationFailed();
      const migration = registry.migrationFrom(version);
      if (migration === undefined || migration.toVersion !== version + 1) return migrationFailed();
      current = snapshotKanbanSemanticValue(migration.migrate(current));
      const producedVersion = envelopeVersion(current);
      if (producedVersion !== migration.toVersion) return migrationFailed();
      version = producedVersion;
      steps += 1;
    }
    const parsed = parseKanbanSavedView(current);
    if (parsed.kind !== 'parsed') return migrationFailed();
    return Object.freeze({
      kind: 'migrated',
      fromVersion,
      toVersion: 1,
      value: parsed.value,
    });
  } catch {
    return migrationFailed();
  }
}
