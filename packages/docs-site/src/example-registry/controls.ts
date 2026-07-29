import type { ExampleEntry } from './types.js';

/** Existing control and form examples, loaded only when opened. */
export const CONTROL_EXAMPLES = [
  {
    id: 'controls/button',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/button.ts',
    load: () => import('../../examples/controls/button.js'),
  },
  {
    id: 'controls/input',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/input.ts',
    load: () => import('../../examples/controls/input.js'),
  },
  {
    id: 'controls/text',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/text.ts',
    load: () => import('../../examples/controls/text.js'),
  },
  {
    id: 'controls/form-dialog',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/form-dialog.ts',
    load: () => import('../../examples/controls/form-dialog.js'),
  },
] as const satisfies readonly ExampleEntry[];
