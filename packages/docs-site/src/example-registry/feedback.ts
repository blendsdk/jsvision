import type { ExampleEntry } from './types.js';

/** Determinate and indeterminate feedback laboratories, loaded only when opened. */
export const FEEDBACK_EXAMPLES = [
  {
    id: 'feedback/progress-bar',
    category: 'feedback',
    kind: 'app',
    sourcePath: 'examples/feedback/progress-bar.ts',
    load: () => import('../../examples/feedback/progress-bar.js'),
  },
  {
    id: 'feedback/spinner',
    category: 'feedback',
    kind: 'app',
    sourcePath: 'examples/feedback/spinner.ts',
    load: () => import('../../examples/feedback/spinner.js'),
  },
] as const satisfies readonly ExampleEntry[];
