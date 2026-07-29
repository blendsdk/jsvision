import { FOUNDATION_DATA_GRID_CONTRACTS } from './foundation.js';
import { INTERACTION_DATA_GRID_CONTRACTS } from './interaction.js';
import { TRUST_DATA_GRID_CONTRACTS } from './trust.js';

/** Exact Data Grid hub example population in its teaching order. */
export const DATA_GRID_EXAMPLE_IDS = [
  'data-grid/quick-start',
  'data-grid/data-sources',
  'data-grid/typed-columns',
  'data-grid/layout-freezing',
  'data-grid/rendering',
  'data-grid/sorting',
  'data-grid/quick-filter',
  'data-grid/advanced-filter',
  'data-grid/selection-navigation',
  'data-grid/row-mutations',
  'data-grid/editing-lifecycle',
  'data-grid/editor-types',
  'data-grid/custom-editor',
  'data-grid/dirty-commit',
  'data-grid/validation',
  'data-grid/lifecycle-states',
  'data-grid/aggregates',
  'data-grid/master-detail',
  'data-grid/windowed',
  'data-grid/large-memory',
  'data-grid/export',
  'data-grid/variants-personalization',
  'data-grid/theming-accessibility',
  'data-grid/performance-boundaries',
] as const;

/** Complete typed behavior-contract population in the same teaching order. */
export const DATA_GRID_CONTRACTS = [
  ...FOUNDATION_DATA_GRID_CONTRACTS,
  ...INTERACTION_DATA_GRID_CONTRACTS,
  ...TRUST_DATA_GRID_CONTRACTS,
] as const;

export type { DataGridExpectation, DataGridProbe } from './_shared.js';
