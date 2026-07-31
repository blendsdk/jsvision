import type { ExampleEntry } from './types.js';

/** Civil-date selection laboratories, loaded only when opened. */
export const DATE_EXAMPLES = [
  {
    id: 'date/calendar',
    category: 'date',
    kind: 'app',
    sourcePath: 'examples/date/calendar.ts',
    load: () => import('../../examples/date/calendar.js'),
  },
  {
    id: 'date/date-picker',
    category: 'date',
    kind: 'app',
    sourcePath: 'examples/date/date-picker.ts',
    load: () => import('../../examples/date/date-picker.js'),
  },
] as const satisfies readonly ExampleEntry[];
