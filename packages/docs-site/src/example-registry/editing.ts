import type { ExampleEntry } from './types.js';

/** General text-editor and editor-gadget laboratories, loaded only when opened. */
export const EDITING_EXAMPLES = [
  {
    id: 'editor/editor',
    category: 'editor',
    kind: 'app',
    sourcePath: 'examples/editor/editor.ts',
    load: () => import('../../examples/editor/editor.js'),
  },
  {
    id: 'editor/memo',
    category: 'editor',
    kind: 'app',
    sourcePath: 'examples/editor/memo.ts',
    load: () => import('../../examples/editor/memo.js'),
  },
  {
    id: 'editor/edit-window',
    category: 'editor',
    kind: 'app',
    sourcePath: 'examples/editor/edit-window.ts',
    load: () => import('../../examples/editor/edit-window.js'),
  },
  {
    id: 'editor/indicator',
    category: 'editor',
    kind: 'app',
    sourcePath: 'examples/editor/indicator.ts',
    load: () => import('../../examples/editor/indicator.js'),
  },
] as const satisfies readonly ExampleEntry[];
