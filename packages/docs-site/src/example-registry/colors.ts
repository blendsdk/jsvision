import type { ExampleEntry } from './types.js';

/** Palette and truecolor selection laboratories, loaded only when opened. */
export const COLOR_EXAMPLES = [
  {
    id: 'color/color-swatch',
    category: 'color',
    kind: 'app',
    sourcePath: 'examples/color/color-swatch.ts',
    load: () => import('../../examples/color/color-swatch.js'),
  },
  {
    id: 'color/color-picker',
    category: 'color',
    kind: 'app',
    sourcePath: 'examples/color/color-picker.ts',
    load: () => import('../../examples/color/color-picker.js'),
  },
] as const satisfies readonly ExampleEntry[];
