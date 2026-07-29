import type { ExampleEntry } from './types.js';

/** Theme teaching tools, isolated from component-family descriptors. */
export const THEMING_EXAMPLES = [
  {
    id: 'theming/preset-gallery',
    category: 'theming',
    kind: 'component',
    themeMenu: true,
    sourcePath: 'examples/theming/preset-gallery.ts',
    load: () => import('../../examples/theming/preset-gallery.js'),
  },
  {
    id: 'theming/i18n-theme-designer',
    category: 'theming',
    kind: 'app',
    sourcePath: 'examples/i18n-theme-designer.ts',
    load: () => import('../../examples/i18n-theme-designer.js'),
  },
] as const satisfies readonly ExampleEntry[];
