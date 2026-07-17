/**
 * Remap a chord — the grid's `keymap` option layers over the default table. Here `Ctrl+E` also begins
 * editing (the default `F2` still works); an unknown chord or action would simply be ignored. The caller
 * wins on a chord conflict; every untouched default binding still fires.
 */
import { column } from '@jsvision/datagrid';
import { buildNavStory } from './nav-demo.js';

interface Person {
  id: number;
  name: string;
  city: string;
}
const ROWS: Person[] = [
  { id: 1, name: 'Ada', city: 'NYC' },
  { id: 2, name: 'Bo', city: 'LA' },
  { id: 3, name: 'Cy', city: 'SF' },
];
const editable = (id: 'name' | 'city', title: string, width: number) =>
  column<Person, string>({
    id,
    title,
    value: (r) => r[id],
    parse: (t) => t,
    set: (r, v) => {
      r[id] = v;
    },
    width,
  });

export const navRemapChordStory = buildNavStory<Person>({
  slug: 'remap-chord',
  title: 'Remap a chord',
  blurb: 'A `keymap: { "ctrl+e": "beginEdit" }` option makes Ctrl+E edit too — F2 still works, unknowns ignored.',
  hint: 'Ctrl+E begins editing the focused cell (so does F2). The caller wins on a conflict; defaults still fire.',
  rows: ROWS,
  columns: [editable('name', 'Name', 12), editable('city', 'City', 10)],
  keymap: { 'ctrl+e': 'beginEdit' },
});
