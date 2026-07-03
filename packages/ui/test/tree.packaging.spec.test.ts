/**
 * Specification tests (immutable oracle) — RD-15 Tree packaging + security (ST-22 / ST-23).
 *
 * Source: jsvision-ui/RD-15 AC-11 (packaging) + AC-13 (security) → tree/07-testing-strategy.md.
 *   • ST-22 — the `tree/` subsystem is importable BY NAME from `@jsvision/ui` (the published surface,
 *     explicit named re-exports), the package declares zero native runtime deps, and every `tree/`
 *     source file is ≤ 500 lines.
 *   • ST-23 — node text reaches the screen ONLY through `DrawContext.text` → `sanitize` (no raw escape
 *     from `getText` survives), flattened-row access is bounds-checked (a wild `focused` clamps, an
 *     empty tree is safe), and `flattenVisible` is depth-guarded (a pathological deep tree can't run away).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { Tree } from '@jsvision/ui';
import type { TreeNode } from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));
const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

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

function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

/** Render a Tree headlessly and return its composed buffer. */
function render(tree: Tree<unknown>, w: number, h: number) {
  tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(tree);
  const rr = createRenderRoot({ width: w, height: h }, { caps });
  rr.mount(root);
  return rr.buffer();
}

/** Flatten the whole composed buffer into one string of glyphs. */
function allChars(buf: ReturnType<typeof render>, w: number, h: number): string {
  let all = '';
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) all += buf.get(x, y)?.char ?? ' ';
  return all;
}

// --- ST-22: packaging ---------------------------------------------------------------------------

test('ST-22: Tree is an exported class importable by name from @jsvision/ui', () => {
  expect(typeof Tree).toBe('function'); // a constructable class
  // Constructing it via the public surface works (TreeNode/TreeOptions are the public option types).
  const roots = signal<TreeNode<string>[]>([node('root', [node('child')])]);
  const tree = new Tree<string>({ roots, getText: (v) => v });
  expect(tree.rows.focusable).toBe(true); // exposes the focusable rows renderer, like ListView
});

test('ST-22: each tree/ source file is ≤ 500 lines (architecture boundary, PA-7)', () => {
  const dir = join(here, '..', 'src', 'tree');
  for (const file of tsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});

test('ST-22: @jsvision/ui declares only the workspace @jsvision/core runtime dependency', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@jsvision/core']);
});

// --- ST-23: security ----------------------------------------------------------------------------

test('ST-23: node text is sanitized to the screen — a raw escape from getText never survives', () => {
  const ESC = String.fromCharCode(27);
  const BEL = String.fromCharCode(7);
  // getText returns text laced with an ESC + a BEL — the injection boundary must neutralize both.
  const roots = signal<TreeNode<string>[]>([node(`${ESC}[31mEVIL${BEL}`)]);
  const tree = new Tree<string>({ roots, getText: (v) => v });
  const all = allChars(render(tree as Tree<unknown>, 20, 4), 20, 4);
  expect(all).not.toContain(ESC); // no raw ESC reaches a cell
  expect(all).not.toContain(BEL); // no raw BEL either
});

test('ST-23: flattened-row access is bounds-checked — a wild focused index clamps, empty tree is safe', () => {
  const focused = signal(9999); // way past the end
  const roots = signal<TreeNode<string>[]>([node('X'), node('Y'), node('Z')]);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused });
  expect(() => render(tree as Tree<unknown>, 20, 5)).not.toThrow();

  const empty = new Tree<string>({ roots: signal<TreeNode<string>[]>([]), getText: (v) => v, focused: signal(5) });
  expect(() => render(empty as Tree<unknown>, 20, 5)).not.toThrow();
});

test('ST-23: flattenVisible is depth-guarded — a pathological deep tree renders without running away', () => {
  let deep = node('leaf');
  for (let i = 0; i < 2000; i += 1) deep = node(`n${i}`, [deep]);
  const tree = new Tree<string>({
    roots: signal<TreeNode<string>[]>([deep]),
    getText: (v) => v,
    expandedByDefault: true,
  });
  expect(() => render(tree as Tree<unknown>, 20, 8)).not.toThrow();
});
