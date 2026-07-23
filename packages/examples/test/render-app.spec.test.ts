// Specification oracle for render-app (the headless ASCII "screenshot" tool).
//
// Pins the pure helpers (key parsing, frame rendering) and one end-to-end render: mounting a real
// recipe view headlessly must produce a framed screen showing its actual content. Immutable oracle:
// if the tool disagrees, the tool is wrong — never this test.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import {
  bufferToText,
  parseKeys,
  renderModule,
} from '../../../plugins/jsvision-plugin/skills/jsvision-render/render-app.mjs';

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
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
  const directory = mkdtempSync(join(repoRoot, '.jsvision-render-'));
  try {
    const module = join(directory, 'app.mjs');
    writeFileSync(
      module,
      [
        "import { createApplication, Text, Window } from '@jsvision/ui';",
        'export function buildApp() {',
        '  const app = createApplication({});',
        "  const win = new Window('Consumer app');",
        '  win.setLayout({ rect: { x: 1, y: 1, width: 24, height: 6 } });',
        "  win.add(new Text('Rendered consumer'));",
        '  app.desktop.addWindow(win);',
        '  return app;',
        '}',
      ].join('\n'),
    );
    const screen = await renderModule({
      module,
      width: 40,
      height: 12,
      cwd: repoRoot,
    });
    expect(screen).toContain('Consumer');
    expect(screen).toContain('Rendered consumer');
    expect(screen).toContain('app 40×12');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
