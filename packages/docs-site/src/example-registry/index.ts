import { APPLICATION_EXAMPLES } from './applications.js';
import { CONTAINER_FILE_TABLE_EXAMPLES } from './containers-files-table.js';
import { CONTROL_EXAMPLES } from './controls.js';
import { FOUNDATION_EXAMPLES } from './foundations.js';
import { THEMING_EXAMPLES } from './theming.js';
import type { ExampleEntry } from './types.js';

/**
 * Compose immutable family arrays while rejecting duplicate IDs and runnable sources.
 *
 * @param families Family-owned descriptor arrays in stable display order.
 * @returns One frozen aggregate registry.
 * @throws Error when two descriptors claim the same ID or source module.
 */
export function composeExampleRegistry(...families: readonly (readonly ExampleEntry[])[]): readonly ExampleEntry[] {
  const entries = families.flat();
  const ids = entries.map((entry) => entry.id);
  const sources = entries.map((entry) => entry.sourcePath);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate example registry id');
  if (new Set(sources).size !== sources.length) throw new Error('duplicate example registry sourcePath');
  return Object.freeze(entries);
}

/** Complete lazy example registry assembled from bounded family modules. */
export const EXAMPLES = composeExampleRegistry(
  CONTROL_EXAMPLES,
  FOUNDATION_EXAMPLES,
  CONTAINER_FILE_TABLE_EXAMPLES,
  APPLICATION_EXAMPLES,
  THEMING_EXAMPLES,
);

export type { ExampleEntry } from './types.js';
