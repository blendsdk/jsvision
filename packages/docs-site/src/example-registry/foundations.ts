import type { ExampleEntry } from './types.js';

/** Foundation examples that teach custom views and retained composition. */
export const FOUNDATION_EXAMPLES = [
  {
    id: 'foundations/view',
    category: 'foundations',
    kind: 'app',
    sourcePath: 'examples/foundations/view.ts',
    load: () => import('../../examples/foundations/view.js'),
  },
  {
    id: 'foundations/group',
    category: 'foundations',
    kind: 'app',
    sourcePath: 'examples/foundations/group.ts',
    load: () => import('../../examples/foundations/group.js'),
  },
] as const satisfies readonly ExampleEntry[];
