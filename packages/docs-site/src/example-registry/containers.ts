import type { ExampleEntry } from './types.js';

/** Container and navigation laboratories, loaded only when opened. */
export const CONTAINER_EXAMPLES = [
  {
    id: 'containers/dialog',
    category: 'containers',
    kind: 'app',
    sourcePath: 'examples/containers/dialog.ts',
    load: () => import('../../examples/containers/dialog.js'),
  },
  {
    id: 'containers/group-box',
    category: 'containers',
    kind: 'app',
    sourcePath: 'examples/containers/group-box.ts',
    load: () => import('../../examples/containers/group-box.js'),
  },
  {
    id: 'containers/list-view',
    category: 'containers',
    kind: 'app',
    sourcePath: 'examples/containers/list-view.ts',
    load: () => import('../../examples/containers/list-view.js'),
  },
  {
    id: 'containers/list-box',
    category: 'containers',
    kind: 'app',
    sourcePath: 'examples/containers/list-box.ts',
    load: () => import('../../examples/containers/list-box.js'),
  },
  {
    id: 'containers/scroller',
    category: 'containers',
    kind: 'app',
    sourcePath: 'examples/containers/scroller.ts',
    load: () => import('../../examples/containers/scroller.js'),
  },
  {
    id: 'containers/scroll-bar',
    category: 'containers',
    kind: 'app',
    sourcePath: 'examples/containers/scroll-bar.ts',
    load: () => import('../../examples/containers/scroll-bar.js'),
  },
  {
    id: 'containers/tree',
    category: 'containers',
    kind: 'app',
    sourcePath: 'examples/containers/tree.ts',
    load: () => import('../../examples/containers/tree.js'),
  },
  {
    id: 'containers/tabs',
    category: 'containers',
    kind: 'app',
    sourcePath: 'examples/containers/tabs.ts',
    load: () => import('../../examples/containers/tabs.js'),
  },
  {
    id: 'containers/split-view',
    category: 'containers',
    kind: 'app',
    sourcePath: 'examples/containers/split-view.ts',
    load: () => import('../../examples/containers/split-view.js'),
  },
] as const satisfies readonly ExampleEntry[];
