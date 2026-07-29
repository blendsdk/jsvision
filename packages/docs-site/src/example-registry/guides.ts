import type { ExampleEntry } from './types.js';

/** Concept-guide laboratories in course order, each owning the complete template1 application shell. */
export const GUIDE_EXAMPLES = [
  {
    id: 'guides/introduction-runtime',
    category: 'guides',
    kind: 'app',
    sourcePath: 'examples/guides/introduction-runtime.ts',
    load: () => import('../../examples/guides/introduction-runtime.js'),
  },
  {
    id: 'guides/layout-flow',
    category: 'guides',
    kind: 'app',
    sourcePath: 'examples/guides/layout-flow.ts',
    load: () => import('../../examples/guides/layout-flow.js'),
  },
  {
    id: 'guides/layout-overlays',
    category: 'guides',
    kind: 'app',
    sourcePath: 'examples/guides/layout-overlays.ts',
    load: () => import('../../examples/guides/layout-overlays.js'),
  },
  {
    id: 'guides/reactive-graph',
    category: 'guides',
    kind: 'app',
    sourcePath: 'examples/guides/reactive-graph.ts',
    load: () => import('../../examples/guides/reactive-graph.js'),
  },
  {
    id: 'guides/reactive-lifetimes',
    category: 'guides',
    kind: 'app',
    sourcePath: 'examples/guides/reactive-lifetimes.ts',
    load: () => import('../../examples/guides/reactive-lifetimes.js'),
  },
  {
    id: 'guides/views-focus-traversal',
    category: 'guides',
    kind: 'app',
    sourcePath: 'examples/guides/views-focus-traversal.ts',
    load: () => import('../../examples/guides/views-focus-traversal.js'),
  },
  {
    id: 'guides/views-focus-modality',
    category: 'guides',
    kind: 'app',
    sourcePath: 'examples/guides/views-focus-modality.ts',
    load: () => import('../../examples/guides/views-focus-modality.js'),
  },
  {
    id: 'guides/event-routing',
    category: 'guides',
    kind: 'app',
    sourcePath: 'examples/guides/event-routing.ts',
    load: () => import('../../examples/guides/event-routing.js'),
  },
  {
    id: 'guides/command-precedence',
    category: 'guides',
    kind: 'app',
    sourcePath: 'examples/guides/command-precedence.ts',
    load: () => import('../../examples/guides/command-precedence.js'),
  },
] as const satisfies readonly ExampleEntry[];
