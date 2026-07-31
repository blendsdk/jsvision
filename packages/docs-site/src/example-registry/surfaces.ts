import type { ExampleEntry } from './types.js';

/** Offscreen surface and viewport laboratories, loaded only when opened. */
export const SURFACE_EXAMPLES = [
  {
    id: 'surface/surface',
    category: 'surface',
    kind: 'app',
    sourcePath: 'examples/surface/surface.ts',
    load: () => import('../../examples/surface/surface.js'),
  },
  {
    id: 'surface/surface-view',
    category: 'surface',
    kind: 'app',
    sourcePath: 'examples/surface/surface-view.ts',
    load: () => import('../../examples/surface/surface-view.js'),
  },
] as const satisfies readonly ExampleEntry[];
