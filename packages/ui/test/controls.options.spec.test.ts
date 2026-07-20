/**
 * Specification tests (immutable oracles) — DX consistency: options-object constructors for
 * `RadioGroup`/`CheckGroup`, their exported option types, and the retired `onCommit` symbol
 * (ST-1, ST-2, ST-3, ST-6).
 *
 * Source: DX-ASSESSMENT.md Proposal 6 → FR-1…FR-3, FR-5. `RadioGroup`/`CheckGroup` are the two
 * outlier controls that shipped a positional `(labels, value)` constructor and no option type;
 * they are normalized to the framework's dominant options-object form (`new RadioGroup({ labels,
 * value })`), matching the sibling `MultiCheckGroup`, and both option types are re-exported from the
 * package barrel. The color-callback rename (FR-4/FR-5) retires the `onCommit` identifier across
 * `packages/ui/src`. Real `View`/`EventLoop` over fixed caps; buffers read pre-serialize. `.js`
 * import specifiers are required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { CheckGroup, RadioGroup } from '../src/controls/index.js';
import type { RadioGroupOptions, CheckGroupOptions } from '../src/index.js';
import type { Cluster } from '../src/controls/cluster.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** Mount a cluster as a child of a Group root (focus routing needs a Group-rooted current chain). */
function mountCluster(cluster: Cluster, width: number, rows: number): ReturnType<typeof createEventLoop> {
  const root = new Group();
  root.setLayout({ direction: 'col' });
  cluster.setLayout({ size: { kind: 'fixed', cells: rows } });
  root.add(cluster);
  const loop = createEventLoop({ width, height: rows }, { caps });
  loop.mount(root);
  loop.focusView(cluster);
  return loop;
}

// ── Source-text helpers for the packaging/grep oracle (ST-6) ────────────────────────────────────────
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, '../src');

/** All `.ts` source files under `packages/ui/src` (recursive). */
function srcFiles(dir: string = SRC_DIR): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...srcFiles(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ── ST-1: RadioGroup options-object constructor + intact two-way bind ───────────────────────────────

test('ST-1: new RadioGroup({ labels, value }) constructs; moving the selection updates value()', () => {
  const value = signal(0);
  const rg = new RadioGroup({ labels: ['~L~', '~C~', '~R~'], value });
  const loop = mountCluster(rg, 12, 3);
  expect(rg).toBeInstanceOf(RadioGroup);
  // ↓ moves the exclusive selection to item 1 (radio: moving selects) — the bind is intact.
  loop.dispatch(key('down'));
  expect(value(), 'selection moved to index 1').toBe(1);
});

// ── ST-2: CheckGroup options-object constructor + intact two-way bind ───────────────────────────────

test('ST-2: new CheckGroup({ labels, value }) constructs; toggling item 0 flips value()[0]', () => {
  const value = signal([false, false]);
  const cg = new CheckGroup({ labels: ['~A~', '~B~'], value });
  const loop = mountCluster(cg, 12, 2);
  expect(cg).toBeInstanceOf(CheckGroup);
  // Space toggles the focused item 0 — the bind is intact.
  loop.dispatch(key('space'));
  expect(value(), 'item 0 toggled true').toEqual([true, false]);
});

// ── ST-3: the option types are importable and usable to construct the controls ──────────────────────

test('ST-3: RadioGroupOptions / CheckGroupOptions type the constructor arguments', () => {
  const ropts: RadioGroupOptions = { labels: ['~L~eft', '~R~ight'], value: signal(0) };
  const copts: CheckGroupOptions = { labels: ['~B~old'], value: signal([false]) };
  expect(new RadioGroup(ropts), 'RadioGroupOptions constructs a RadioGroup').toBeInstanceOf(RadioGroup);
  expect(new CheckGroup(copts), 'CheckGroupOptions constructs a CheckGroup').toBeInstanceOf(CheckGroup);
});

// ── ST-6: no `onCommit` symbol remains in src; the barrel re-exports both new option types ───────────

test('ST-6: no `onCommit` identifier exists anywhere in packages/ui/src', () => {
  const offenders = srcFiles().filter((f) => /\bonCommit\b/.test(readFileSync(f, 'utf8')));
  expect(offenders, `onCommit found in: ${offenders.map((f) => f.replace(SRC_DIR, 'src')).join(', ')}`).toEqual([]);
});

test('ST-6: the package barrel re-exports RadioGroupOptions and CheckGroupOptions', () => {
  const barrel = readFileSync(resolve(SRC_DIR, 'index.ts'), 'utf8');
  expect(barrel, 'barrel re-exports RadioGroupOptions').toMatch(/\bRadioGroupOptions\b/);
  expect(barrel, 'barrel re-exports CheckGroupOptions').toMatch(/\bCheckGroupOptions\b/);
  const controlsBarrel = readFileSync(resolve(SRC_DIR, 'controls/index.ts'), 'utf8');
  expect(controlsBarrel, 'controls barrel exports RadioGroupOptions').toMatch(/\bRadioGroupOptions\b/);
  expect(controlsBarrel, 'controls barrel exports CheckGroupOptions').toMatch(/\bCheckGroupOptions\b/);
});
