// Specification oracle for render-app (the headless ASCII "screenshot" tool).
//
// Pins the pure helpers (key parsing, frame rendering) and one end-to-end render: mounting a real
// recipe view headlessly must produce a framed screen showing its actual content. Immutable oracle:
// if the tool disagrees, the tool is wrong — never this test.

import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import { bufferToText, parseKeys, renderModule } from '../../../scripts/render-app.mjs';

test('parseKeys turns a chord spec into dispatchable key events', () => {
  expect(parseKeys('')).toEqual([]);
  expect(parseKeys('tab enter')).toEqual([
    { type: 'key', key: 'tab', ctrl: false, alt: false, shift: false },
    { type: 'key', key: 'enter', ctrl: false, alt: false, shift: false },
  ]);
  expect(parseKeys('ctrl+s shift+tab alt+x')).toEqual([
    { type: 'key', key: 's', ctrl: true, alt: false, shift: false },
    { type: 'key', key: 'tab', ctrl: false, alt: false, shift: true },
    { type: 'key', key: 'x', ctrl: false, alt: true, shift: false },
  ]);
});

test('bufferToText frames a cell grid with a titled border showing the dimensions', () => {
  const rows = [
    [{ char: 'h' }, { char: 'i' }, { char: ' ' }, { char: ' ' }],
    [{ char: ' ' }, { char: ' ' }, { char: ' ' }, { char: ' ' }],
  ];
  const framed = bufferToText(rows, 4, 'view 4×2');
  expect(framed).toContain('view 4×2'); // the dimension title is in the top border
  expect(framed.split('\n')[1]).toBe('│hi  │'); // row content, padded to width, bordered
  expect(framed).toMatch(/^┌/); // top border
  expect(framed).toMatch(/┘$/); // bottom border
});

test('renderModule mounts a real recipe view headlessly and shows its content', async () => {
  const module = fileURLToPath(new URL('../recipes/data-grid.ts', import.meta.url));
  const screen = await renderModule({ module, exportName: 'buildPeopleGrid', pick: 'root', width: 40, height: 12 });
  expect(screen).toContain('Name'); // the grid header painted
  expect(screen).toContain('Oslo'); // a data cell painted
  expect(screen).toContain('age 24'); // the master-detail line painted
  expect(screen).toContain('root 40×12'); // the frame reports the size
});
