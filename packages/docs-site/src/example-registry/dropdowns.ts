import type { ExampleEntry } from './types.js';

/** Dropdown and recall laboratories, loaded only when opened. */
export const DROPDOWN_EXAMPLES = [
  {
    id: 'dropdown/combo-box',
    category: 'dropdown',
    kind: 'app',
    sourcePath: 'examples/dropdown/combo-box.ts',
    load: () => import('../../examples/dropdown/combo-box.js'),
  },
  {
    id: 'dropdown/history',
    category: 'dropdown',
    kind: 'app',
    sourcePath: 'examples/dropdown/history.ts',
    load: () => import('../../examples/dropdown/history.js'),
  },
] as const satisfies readonly ExampleEntry[];
