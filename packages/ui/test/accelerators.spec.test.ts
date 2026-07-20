/**
 * Specification tests (immutable oracles) — the duplicate-accelerator dev-warning (GH #6),
 * ST-9…ST-18: the pure `findDuplicateAccelerators` validator (ST-9…ST-13) and the per-scope,
 * dev-gated warnings for submenus, the menu bar, a `Dialog` focus scope, and a `TabView` strip
 * (ST-14…ST-18).
 *
 * These oracles are isolated in one new file (rather than folded into the existing menu/dialog/tabs
 * specs) so the fresh ST-9…ST-18 IDs never collide with those suites' own ST numbering.
 *
 * A duplicate is a within-scope collision only, case-insensitive, `''` (separators / no-hotkey) never
 * grouped. Warnings are `NODE_ENV`-gated (silent in production). `.js` per NodeNext.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { findDuplicateAccelerators } from '../src/menu/accelerators.js';
import { subMenu, item, separator, menuBar } from '../src/menu/index.js';
import { Dialog } from '../src/dialog/index.js';
import { Button } from '../src/controls/index.js';
import { TabView } from '../src/tabs/index.js';
import type { Tab } from '../src/tabs/index.js';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

afterEach(() => {
  vi.restoreAllMocks();
});

/** Spy on console.warn, returning the collected message strings. */
function warnSpy() {
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined);
}

/** Mount a view under a fresh loop so its onMount (and any mount-time check) fires. */
function mount(view: Group): void {
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(view);
}

// --- ST-9…ST-13: the pure validator ------------------------------------------------------------

test('ST-9: no duplicates — empty list and an all-distinct list both yield []', () => {
  expect(findDuplicateAccelerators([])).toEqual([]);
  expect(findDuplicateAccelerators(['f', 'e', 'o'])).toEqual([]);
});

test('ST-10: a repeated char is grouped with its in-order indices', () => {
  expect(findDuplicateAccelerators(['x', '', 'x'])).toEqual([{ char: 'x', indices: [0, 2] }]);
});

test('ST-11: matching is case-insensitive and the group char is lowercased', () => {
  expect(findDuplicateAccelerators(['X', 'x'])).toEqual([{ char: 'x', indices: [0, 1] }]);
});

test('ST-12: three claimants collapse into a single group of three indices', () => {
  expect(findDuplicateAccelerators(['x', 'x', 'x'])).toEqual([{ char: 'x', indices: [0, 1, 2] }]);
});

test('ST-13: empty-string entries (separators / no-hotkey) are never grouped', () => {
  expect(findDuplicateAccelerators(['', '', 'a'])).toEqual([]); // only one real 'a'
  expect(findDuplicateAccelerators(['', ''])).toEqual([]);
});

// --- ST-14…ST-16: menu scopes (build-time, plain data) -----------------------------------------

test('ST-14: a submenu with two items sharing a hotkey warns once, naming the char + both labels', () => {
  const spy = warnSpy();
  subMenu('~F~ile', [item('E~x~it', 'quit'), separator(), item('E~x~port', 'export')]);
  const menuWarns = spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('[jsvision/ui menu]'));
  expect(menuWarns).toHaveLength(1);
  expect(menuWarns[0]).toContain("'x'");
  expect(menuWarns[0]).toContain('Exit');
  expect(menuWarns[0]).toContain('Export');
});

test('ST-15: the same collision is silent under NODE_ENV=production', () => {
  const spy = warnSpy();
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    subMenu('~F~ile', [item('E~x~it', 'quit'), item('E~x~port', 'export')]);
  } finally {
    process.env.NODE_ENV = prev;
  }
  expect(spy).not.toHaveBeenCalled();
});

test('ST-16: a char reused across scopes (bar title vs. submenu item) does not warn', () => {
  const spy = warnSpy();
  // `~F~ile` bar title (f) with a `~F~oo` item (f) inside it — different scopes, no collision.
  menuBar([subMenu('~F~ile', [item('~F~oo', 'foo'), item('~B~ar', 'bar')])]);
  const menuWarns = spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('[jsvision/ui menu]'));
  expect(menuWarns).toHaveLength(0);
});

// --- ST-17: Dialog focus scope (mount-time subtree walk) ---------------------------------------

test('ST-17: a Dialog mounting two buttons sharing an Alt-hotkey warns once on mount, naming the char', () => {
  const spy = warnSpy();
  const dialog = new Dialog({ title: ' T ', width: 30, height: 8 });
  dialog.add(new Button('~O~K', { command: 'ok' }));
  dialog.add(new Button('~O~ops', { command: 'oops' }));
  mount(dialog);
  const dialogWarns = spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('[jsvision/ui dialog]'));
  expect(dialogWarns).toHaveLength(1);
  expect(dialogWarns[0]).toContain("'o'");
});

// --- ST-18: TabView strip (mount-time, data-level over tabs()) ---------------------------------

test('ST-18: a TabView with two tabs sharing ~X~ warns once on mount, naming the char (strip only)', () => {
  const spy = warnSpy();
  const page = (): Group => new Group();
  const tabs = signal<Tab[]>([
    { title: '~A~lpha', content: page() },
    { title: '~A~lter', content: page() },
  ]);
  const view = new TabView({ tabs, active: signal(0) });
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 38, height: 8 } };
  const root = new Group();
  root.add(view);
  mount(root);
  const tabWarns = spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('[jsvision/ui tabs]'));
  expect(tabWarns).toHaveLength(1);
  expect(tabWarns[0]).toContain("'a'");
});

test('ST-18b: a page-content accelerator sharing a tab char does NOT warn (strip tabs only)', () => {
  const spy = warnSpy();
  const pageWith = (label: string): Group => {
    const g = new Group();
    g.add(new Button(label, { command: 'cmd' }));
    return g;
  };
  // Tab '~A~lpha' (a) with a page button '~A~ction' (a): different interaction, not a v1 conflict.
  const tabs = signal<Tab[]>([
    { title: '~A~lpha', content: pageWith('~A~ction') },
    { title: '~B~eta', content: new Group() },
  ]);
  const view = new TabView({ tabs, active: signal(0) });
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 38, height: 8 } };
  const root = new Group();
  root.add(view);
  mount(root);
  const tabWarns = spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('[jsvision/ui tabs]'));
  expect(tabWarns).toHaveLength(0);
});
