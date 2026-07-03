/**
 * Specification test (immutable oracle) — jsvision-ui RD-17 tabs packaging (ST-31, ST-32).
 *
 * Source: RD-17 AC-12 → ST-31/ST-32 (plans/tabs/03-03-theme-packaging.md §Packaging, AR-181). The
 * `tabs/` subsystem lives under `src/` with explicit named re-exports from `src/index.ts` (imported
 * here BY NAME from `@jsvision/ui`, the published surface), every `tabs/` source file is ≤ 500 lines,
 * and the package declares zero native runtime dependencies (mirrors `table.packaging.spec`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { signal, Group } from '@jsvision/ui';
import { TabView } from '@jsvision/ui';
import type { Tab, TabViewOptions } from '@jsvision/ui';

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

// ST-31 / AC-12 — TabView is an importable, constructable class from the published surface, and the
// Tab / TabViewOptions types resolve (the type-only imports below compile ⇒ they are re-exported).
test('ST-31: TabView (+ Tab, TabViewOptions) is re-exported from @jsvision/ui', () => {
  expect(typeof TabView).toBe('function');
  const tabs = signal<Tab[]>([{ title: '~G~eneral', content: new Group() }]);
  const active = signal(0);
  const opts: TabViewOptions = { tabs, active };
  const view = new TabView(opts);
  expect(view).toBeTruthy();
  expect(view.strip.focusable, 'the exposed strip is the focus target').toBe(true);
  // The public methods exist (the Should-Have surface, PA-1).
  expect(typeof view.select).toBe('function');
  expect(typeof view.next).toBe('function');
  expect(typeof view.prev).toBe('function');
});

// ST-32 / AR-181 — every file in src/tabs/ is ≤ 500 lines (architecture boundary).
test('ST-32: each src/tabs/ source file is ≤ 500 lines', () => {
  const dir = join(here, '..', 'src', 'tabs');
  for (const file of tsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});

// ST-32 / AC-12 — the package declares no third-party/native runtime dependency (check:deps clean).
test('ST-32: @jsvision/ui declares only the workspace @jsvision/core runtime dependency', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@jsvision/core']);
});
