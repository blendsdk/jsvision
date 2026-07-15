/**
 * The datagrid-showcase **story registry** — the aggregated list the shell + smoke test read.
 *
 * Explicit aggregation (no import-side-effects): adding a demo to the showcase = write its `*.story.ts`
 * under `stories/<cluster>/` and add it to this array. Entries are grouped by category and ordered as
 * they should appear in the navigator; the category order is first-seen here.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Story } from '../story.js';
import { sizingStory } from './foundation/sizing.story.js';
import { placeholders } from './placeholders.js';

/**
 * Every registered demo, in navigator order. Phase 1 registers the Foundation seed demo and the eight
 * roadmap placeholders; the remaining clusters are appended before the `Roadmap` band as they land.
 */
export const STORIES: readonly Story[] = [
  // Foundation (RD-01)
  sizingStory,

  // Roadmap — the "coming soon" panels (RD-07…RD-14)
  ...placeholders,
];
