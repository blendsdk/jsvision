import type { ExampleEntry } from './types.js';

/** Template1 examples for the complete composable file family. */
export const FILE_EXAMPLES = [
  {
    id: 'files/file-dialog',
    category: 'files',
    kind: 'app',
    sourcePath: 'examples/files/file-dialog.ts',
    load: () => import('../../examples/files/file-dialog.js'),
  },
  {
    id: 'files/chdir-dialog',
    category: 'files',
    kind: 'app',
    sourcePath: 'examples/files/chdir-dialog.ts',
    load: () => import('../../examples/files/chdir-dialog.js'),
  },
  {
    id: 'files/file-list',
    category: 'files',
    kind: 'app',
    sourcePath: 'examples/files/file-list.ts',
    load: () => import('../../examples/files/file-list.js'),
  },
  {
    id: 'files/dir-list',
    category: 'files',
    kind: 'app',
    sourcePath: 'examples/files/dir-list.ts',
    load: () => import('../../examples/files/dir-list.js'),
  },
  {
    id: 'files/file-input',
    category: 'files',
    kind: 'app',
    sourcePath: 'examples/files/file-input.ts',
    load: () => import('../../examples/files/file-input.js'),
  },
  {
    id: 'files/file-info-pane',
    category: 'files',
    kind: 'app',
    sourcePath: 'examples/files/file-info-pane.ts',
    load: () => import('../../examples/files/file-info-pane.js'),
  },
  {
    id: 'files/file-editor',
    category: 'files',
    kind: 'app',
    sourcePath: 'examples/files/file-editor.ts',
    load: () => import('../../examples/files/file-editor.js'),
  },
] as const satisfies readonly ExampleEntry[];
