import type { ExampleEntry } from './types.js';

/** Complete application showcases, preserved as lazy registry entries. */
export const APPLICATION_EXAMPLES = [
  {
    id: 'apps/hello',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/hello.ts',
    load: () => import('../../examples/apps/hello.js'),
  },
  {
    id: 'apps/editor',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/editor.ts',
    load: () => import('../../examples/apps/editor.js'),
  },
  {
    id: 'apps/amiga-clock',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/amiga-clock.ts',
    load: () => import('../../examples/apps/amiga-clock.js'),
  },
  {
    id: 'apps/matrix',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/matrix.ts',
    load: () => import('../../examples/apps/matrix.js'),
  },
  {
    id: 'apps/effects',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/effects.ts',
    load: () => import('../../examples/apps/effects.js'),
  },
  {
    id: 'apps/calculator',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/calculator.ts',
    load: () => import('../../examples/apps/calculator.js'),
  },
  {
    id: 'apps/life',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/life.ts',
    load: () => import('../../examples/apps/life.js'),
  },
  {
    id: 'apps/desktop',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/desktop.ts',
    load: () => import('../../examples/apps/desktop.js'),
  },
] as const satisfies readonly ExampleEntry[];
