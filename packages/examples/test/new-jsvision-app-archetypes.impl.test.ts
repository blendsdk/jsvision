// Implementation tests for the `jsvision-new-app` scaffolder's archetype system.
//
// The scaffolder auto-discovers archetypes from `templates/archetypes/*` and overlays each one's
// starter source on the shared base skeleton. These tests dogfood that path: every shipped archetype
// must yield the full skeleton, carry its own recognisable UI, stay backward-compatible with the
// plain `basic` starter, and — the real proof — its generated `buildApp()` must paint a non-empty
// frame headlessly, exactly as the base ST-6 oracle demands of the default.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';

import {
  buildAppFiles,
  DEFAULT_ARCHETYPE,
  listArchetypes,
  writeApp,
} from '../../../tools/claude-plugin/skills/jsvision-new-app/scripts/new-jsvision-app.mjs';

/** Count cells that were actually painted (an empty view leaves only spaces). */
function paintedCells(rows: readonly { char: string }[][]): number {
  let n = 0;
  for (const row of rows) for (const cell of row) if (cell.char !== ' ') n += 1;
  return n;
}

/** The archetypes every shipped release provides, and a marker unique to each one's starter source. */
const SHIPPED = [
  { name: 'form', marker: 'new Input(' },
  { name: 'grid', marker: 'new DataGrid<' },
  { name: 'dashboard', marker: 'new ProgressBar(' },
];

test('listArchetypes lists basic first, then every discovered archetype with a description', () => {
  const listed = listArchetypes();
  expect(listed[0].name).toBe(DEFAULT_ARCHETYPE);
  const names = listed.map((a) => a.name);
  for (const { name } of SHIPPED) expect(names).toContain(name);
  for (const a of listed) expect(a.description.length).toBeGreaterThan(0);
});

test('the default archetype is byte-identical to explicit basic (backward compatible)', () => {
  const def = buildAppFiles('todo');
  const basic = buildAppFiles('todo', 'basic');
  expect([...def]).toEqual([...basic]);
});

test('every archetype yields the full 5-file skeleton with its own starter source', () => {
  for (const { name, marker } of SHIPPED) {
    const files = buildAppFiles('demo', name);
    // Overlaying an archetype swaps starter files in place — the file *set* never changes.
    expect(files.size).toBe(5);
    for (const rel of [
      'packages/demo/package.json',
      'packages/demo/tsconfig.json',
      'packages/demo/vitest.config.ts',
      'packages/demo/src/main.ts',
      'packages/demo/test/demo.smoke.test.ts',
    ]) {
      expect(files.has(rel)).toBe(true);
    }
    const main = files.get('packages/demo/src/main.ts') as string;
    expect(main).toContain(marker); // the archetype's distinctive widget
    expect(main).toContain('export function buildApp('); // the smoke-test contract
    expect(main).not.toContain('__SLUG__'); // tokens fully substituted
  }
});

test('an unknown archetype is rejected before anything is produced', () => {
  expect(() => buildAppFiles('demo', 'no-such-archetype')).toThrow(/unknown archetype/);
});

test('every archetype generates an app that paints a non-empty frame headlessly', async () => {
  const examplesRoot = fileURLToPath(new URL('..', import.meta.url));
  const tmpRoot = join(examplesRoot, '.scaffold-archetypes-tmp');
  rmSync(tmpRoot, { recursive: true, force: true });
  try {
    for (const { name } of SHIPPED) {
      const files = buildAppFiles(name, name); // e.g. app "grid" from the grid archetype
      const mainRel = `packages/${name}/src/main.ts`;
      // Each archetype's source lands on its own path so ESM's URL-keyed module cache keeps them distinct.
      const mainAbs = join(tmpRoot, mainRel);
      mkdirSync(dirname(mainAbs), { recursive: true });
      writeFileSync(mainAbs, files.get(mainRel) as string);

      const mod = (await import(pathToFileURL(mainAbs).href)) as {
        buildApp: () => {
          loop: {
            resize: (s: { width: number; height: number }) => void;
            renderRoot: { buffer: () => { rows: () => readonly { char: string }[][] } };
          };
        };
      };

      const app = mod.buildApp();
      app.loop.resize({ width: 80, height: 24 }); // reflow the late-added window, then flush
      expect(paintedCells(app.loop.renderRoot.buffer().rows()), `${name} painted nothing`).toBeGreaterThan(0);
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('writeApp threads the archetype through to disk', () => {
  const examplesRoot = fileURLToPath(new URL('..', import.meta.url));
  const tmpRoot = join(examplesRoot, '.scaffold-writeapp-tmp');
  rmSync(tmpRoot, { recursive: true, force: true });
  try {
    const { dir } = writeApp('stock', { root: tmpRoot, archetype: 'grid' });
    const main = join(tmpRoot, dir, 'src', 'main.ts');
    // The grid archetype's distinctive widget must be on disk — proof the override reached writeApp.
    expect(readFileSync(main, 'utf8')).toContain('new DataGrid<');
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
