import type { ExampleEntry } from './types.js';

/** Existing table example pending its specialist-hub replacement. */
export const CONTAINER_FILE_TABLE_EXAMPLES = [
  {
    id: 'table/data-grid',
    category: 'table',
    kind: 'component',
    sourcePath: 'examples/table/data-grid.ts',
    load: () => import('../../examples/table/data-grid.js'),
  },
] as const satisfies readonly ExampleEntry[];
