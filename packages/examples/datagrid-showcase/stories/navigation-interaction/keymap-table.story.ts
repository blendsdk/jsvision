/**
 * The default keymap, shown as a grid — the one documented binding table. Every chord in `DEFAULT_KEYMAP`
 * is a row (chord → GridAction), dogfooding the grid to display its own input map. Pass a `keymap` option
 * to the grid to override any of these per-grid.
 */
import { column, DEFAULT_KEYMAP } from '@jsvision/datagrid';
import { buildNavStory } from './nav-demo.js';

interface Binding {
  id: string;
  chord: string;
  action: string;
}
const BINDINGS: Binding[] = Object.entries(DEFAULT_KEYMAP).map(([chord, action]) => ({
  id: chord,
  chord,
  action,
}));

export const navKeymapTableStory = buildNavStory<Binding>({
  slug: 'keymap-table',
  title: 'Default keymap',
  blurb: 'The one documented chord→GridAction table (DEFAULT_KEYMAP), shown as a grid; remap any chord per grid.',
  hint: 'These are the default bindings — pass a `keymap` option to remap any chord (see “Remap a chord”).',
  rows: BINDINGS,
  columns: [
    column({ id: 'chord', title: 'Chord', value: (r: Binding) => r.chord, width: 14 }),
    column({ id: 'action', title: 'GridAction', value: (r: Binding) => r.action, width: 16 }),
  ],
});
