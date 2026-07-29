import type { ExampleEntry } from './types.js';

/** Existing container, file, and table examples pending their richer replacements. */
export const CONTAINER_FILE_TABLE_EXAMPLES = [
  {
    id: 'containers/list-box',
    category: 'containers',
    kind: 'component',
    sourcePath: 'examples/containers/list-box.ts',
    load: () => import('../../examples/containers/list-box.js'),
  },
  {
    id: 'files/file-dialog',
    category: 'files',
    kind: 'app',
    sourcePath: 'examples/files/file-dialog.ts',
    load: () => import('../../examples/files/file-dialog.js'),
  },
  {
    id: 'table/data-grid',
    category: 'table',
    kind: 'component',
    sourcePath: 'examples/table/data-grid.ts',
    load: () => import('../../examples/table/data-grid.js'),
  },
] as const satisfies readonly ExampleEntry[];
