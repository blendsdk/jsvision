import { I18nError } from './errors.js';
import { isObjectLike } from './input.js';

const MAX_LOAD_DIRECTORY_ENTRIES = 100_000;
const MAX_LOAD_FILES = 10_000;
const MAX_LOAD_FILE_BYTES = 16 * 1024 * 1024;
const LOAD_BUDGETS = new WeakMap<object, LoadResourceBudget>();

/** Shared monotonic work budget for built-in sources participating in one atomic load. */
export interface LoadResourceBudget {
  /** Consume one directory entry inspected by a glob expansion. */
  consumeDirectoryEntry(): void;
  /** Consume one selected catalog file. */
  consumeFile(): void;
  /**
   * Consume checked file bytes before allocation, reading, or parsing.
   *
   * @param bytes Checked regular-file size.
   */
  consumeFileBytes(bytes: number): void;
}

/** Create a typed aggregate-limit failure without exposing filesystem or catalog values. */
function limitExceeded(message: string): I18nError {
  return new I18nError('CATALOG_LIMIT_EXCEEDED', message);
}

/** Create one independent aggregate budget. */
export function createLoadResourceBudget(): LoadResourceBudget {
  let directoryEntries = 0;
  let files = 0;
  let fileBytes = 0;
  return Object.freeze({
    consumeDirectoryEntry() {
      directoryEntries += 1;
      if (directoryEntries > MAX_LOAD_DIRECTORY_ENTRIES) {
        throw limitExceeded('Catalog loading exceeds its aggregate directory-entry limit.');
      }
    },
    consumeFile() {
      files += 1;
      if (files > MAX_LOAD_FILES) {
        throw limitExceeded('Catalog loading exceeds its aggregate file limit.');
      }
    },
    consumeFileBytes(bytes: number) {
      if (!Number.isSafeInteger(bytes) || bytes < 0) {
        throw limitExceeded('Catalog loading encountered an invalid file size.');
      }
      fileBytes += bytes;
      if (fileBytes > MAX_LOAD_FILE_BYTES) {
        throw limitExceeded('Catalog loading exceeds its aggregate file-byte limit.');
      }
    },
  });
}

/**
 * Associate an atomic source context with one aggregate built-in-source budget.
 *
 * @param context Frozen context shared with every source in the load.
 * @param budget Budget to retain until every initiated source settles or cancellation wins.
 */
export function registerLoadResourceBudget(context: object, budget: LoadResourceBudget): void {
  LOAD_BUDGETS.set(context, budget);
}

/**
 * Resolve the aggregate budget for a source context.
 *
 * Direct `CatalogSource.load` calls are not registered by orchestration, so they receive an
 * independent budget with the same hard ceilings.
 *
 * @param context Source context identity.
 * @returns Shared load budget or a fresh direct-call budget.
 */
export function resourceBudgetFor(context: unknown): LoadResourceBudget {
  if (!isObjectLike(context)) return createLoadResourceBudget();
  return LOAD_BUDGETS.get(context) ?? createLoadResourceBudget();
}

/**
 * Release the weak association after orchestration no longer needs the context.
 *
 * Sources that continue briefly after cancellation already retain the budget object they resolved,
 * so cleanup does not reset their work counters.
 *
 * @param context Completed load context.
 */
export function unregisterLoadResourceBudget(context: object): void {
  LOAD_BUDGETS.delete(context);
}
