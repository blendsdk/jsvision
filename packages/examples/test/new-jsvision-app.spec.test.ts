// Specification oracle for the `jsvision-new-app` scaffolder generator.
//
// Derived from the plan's ST-1…ST-6 (deterministic name handling, the emitted file set, the
// publish-agnostic dependency seam, the runnable starter, path-safety, and an in-process paint of
// the generated app). Immutable: if the generator disagrees with an assertion here, the generator
// is wrong — never the test.
//
// The generator is a zero-dependency Node ESM script living with the plugin; it is imported by a
// cross-root relative path, mirroring the existing `core/test/gate.spec.test.ts` → root
// `scripts/gate.mjs` precedent.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';

import {
  buildAppFiles,
  slugify,
  uiDependency,
} from '../../../tools/claude-plugin/skills/jsvision-new-app/scripts/new-jsvision-app.mjs';

/** Count cells that were actually painted (an empty view leaves only spaces). */
function paintedCells(rows: readonly { char: string }[][]): number {
  let n = 0;
  for (const row of rows) for (const cell of row) if (cell.char !== ' ') n += 1;
  return n;
}

// ST-1 — slugify normalizes a human name to a package-safe slug.
test('ST-1: slugify lowercases and turns spaces into dashes', () => {
  expect(slugify('My App')).toBe('my-app');
});

// ST-2 — the emitted file set is exactly the runnable-app skeleton.
test('ST-2: buildAppFiles emits the full app skeleton key set', () => {
  const files = buildAppFiles('todo');
  const keys = new Set(files.keys());
  for (const rel of [
    'packages/todo/package.json',
    'packages/todo/tsconfig.json',
    'packages/todo/vitest.config.ts',
    'packages/todo/src/main.ts',
    'packages/todo/test/todo.smoke.test.ts',
  ]) {
    expect(keys.has(rel)).toBe(true);
  }
});

// ST-3 — the generated package.json is a private ESM workspace package whose @jsvision/ui
// dependency comes from the single publish-agnostic seam.
test('ST-3: generated package.json is private, ESM, and uses uiDependency() for @jsvision/ui', () => {
  const files = buildAppFiles('todo');
  const pkg = JSON.parse(files.get('packages/todo/package.json') as string);
  expect(pkg.name).toBe('@jsvision/todo');
  expect(pkg.private).toBe(true);
  expect(pkg.type).toBe('module');
  expect(pkg.dependencies['@jsvision/ui']).toBe(uiDependency());
});

// ST-4 — the emitted main.ts is a real, runnable starter: it guards on a TTY, builds an
// application, adds a window, and can run.
test('ST-4: generated src/main.ts contains the TTY guard, app creation, a window, and run()', () => {
  const main = buildAppFiles('todo').get('packages/todo/src/main.ts') as string;
  expect(main).toContain('isTTY');
  expect(main).toContain('createApplication(');
  expect(main).toContain('desktop.addWindow(');
  expect(main).toContain('run()');
});

// ST-5 — unsafe names are rejected before anything is produced (path traversal / separators /
// absolute paths / empty).
test('ST-5: buildAppFiles throws on unsafe names and produces nothing', () => {
  for (const evil of ['../evil', 'a/b', '/abs', '']) {
    expect(() => buildAppFiles(evil)).toThrow();
  }
});

// ST-6 — a generated app actually runs: written to disk, its buildApp() paints a non-empty frame
// headlessly, and every emitted config parses. (The full generate → install → `yarn verify` path
// is proven end-to-end by the acceptance flow.)
test('ST-6: a generated app is structurally valid and paints headlessly', async () => {
  const examplesRoot = fileURLToPath(new URL('..', import.meta.url));
  const tmpRoot = join(examplesRoot, '.scaffold-tmp');
  rmSync(tmpRoot, { recursive: true, force: true });
  try {
    const files = buildAppFiles('todo');

    // The full skeleton is present and every emitted config parses as JSON where it should.
    expect(files.size).toBe(5);
    expect(() => JSON.parse(files.get('packages/todo/package.json') as string)).not.toThrow();
    expect(() => JSON.parse(files.get('packages/todo/tsconfig.json') as string)).not.toThrow();

    // Materialize the app source under the examples package (inside the vite fs root) and paint it.
    // Only main.ts needs to be on disk for the in-process mount; the rest is validated from the map.
    // (The emitted tsconfig's relative `extends` only resolves at real package depth, so it is not
    // written here — the in-process import needs only the source.)
    const mainRel = 'packages/todo/src/main.ts';
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
    expect(paintedCells(app.loop.renderRoot.buffer().rows())).toBeGreaterThan(0);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
    expect(existsSync(tmpRoot)).toBe(false);
  }
});
