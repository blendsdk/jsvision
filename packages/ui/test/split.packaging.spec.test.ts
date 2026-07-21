/**
 * Specification test (immutable oracle) — split-panes packaging.
 *
 * The `split/` subsystem lives under `src/` with explicit named re-exports from `src/index.ts`
 * (imported here BY NAME from `@jsvision/ui`, the published surface). The pure resize helper
 * `applySplitResize` stays module-private — it is the layout/pack-row precedent, reachable only by
 * a relative import from a test, never from the barrel. Every `split/` source file is ≤ 500 lines,
 * and the package declares zero native runtime dependencies. Mirrors `tabs.packaging.spec`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ui from '@jsvision/ui';
import { signal, Group, SplitView } from '@jsvision/ui';
import type { SplitViewOptions } from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// SplitView is an importable, constructable class from the published surface, and SplitViewOptions
// resolves (the type-only import below compiles ⇒ it is re-exported).
test('SplitView (+ SplitViewOptions) is re-exported from @jsvision/ui', () => {
  expect(typeof SplitView).toBe('function');
  const opts: SplitViewOptions = { direction: 'row', children: [new Group(), new Group()], sizes: signal([1, 1]) };
  const view = new SplitView(opts);
  expect(view).toBeTruthy();
});

// The pure resize helper is NOT part of the public surface (the layout/pack-row precedent).
test('applySplitResize is module-private — not re-exported from @jsvision/ui', () => {
  expect('applySplitResize' in ui, 'applySplitResize must stay internal').toBe(false);
});

// Every file in src/split/ is ≤ 500 lines (the architecture boundary).
test('each src/split/ source file is ≤ 500 lines', () => {
  const dir = join(here, '..', 'src', 'split');
  for (const file of tsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});
