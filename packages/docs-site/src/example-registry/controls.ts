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
    id: 'controls/label',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/label.ts',
    load: () => import('../../examples/controls/label.js'),
  },
  {
    id: 'controls/check-group',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/check-group.ts',
    load: () => import('../../examples/controls/check-group.js'),
  },
  {
    id: 'controls/radio-group',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/radio-group.ts',
    load: () => import('../../examples/controls/radio-group.js'),
  },
  {
    id: 'controls/multi-check-group',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/multi-check-group.ts',
    load: () => import('../../examples/controls/multi-check-group.js'),
  },
  {
    id: 'controls/slider',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/slider.ts',
    load: () => import('../../examples/controls/slider.js'),
  },
  {
    id: 'controls/switch',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/switch.ts',
    load: () => import('../../examples/controls/switch.js'),
  },
  {
    id: 'controls/form-dialog',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/form-dialog.ts',
    load: () => import('../../examples/controls/form-dialog.js'),
  },
] as const satisfies readonly ExampleEntry[];
