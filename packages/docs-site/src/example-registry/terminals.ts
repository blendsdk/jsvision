import type { ExampleEntry } from './types.js';

/** Passive terminal-output laboratories, loaded only when opened. */
export const TERMINAL_EXAMPLES = [
  {
    id: 'terminal/terminal',
    category: 'terminal',
    kind: 'app',
    sourcePath: 'examples/terminal/terminal.ts',
    load: () => import('../../examples/terminal/terminal.js'),
  },
] as const satisfies readonly ExampleEntry[];
