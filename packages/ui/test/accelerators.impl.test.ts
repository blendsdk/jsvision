/**
 * Implementation tests (edges/internals, after the accelerators spec is green) for the
 * duplicate-accelerator check: validator ordering/multi-group behaviour, the `View.accelerators()`
 * overrides (a disabled cluster item still contributes), and the Dialog scope walk's isolation at a
 * nested `Dialog`/`TabView` boundary. `.js` per NodeNext.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { findDuplicateAccelerators } from '../src/menu/accelerators.js';
import { Dialog } from '../src/dialog/index.js';
import { Button, Label, CheckGroup } from '../src/controls/index.js';
import { TabView } from '../src/tabs/index.js';
import type { Tab } from '../src/tabs/index.js';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

afterEach(() => vi.restoreAllMocks());

function warnSpy() {
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined);
}
function mount(view: Group): void {
  createEventLoop({ width: 44, height: 14 }, { caps }).mount(view);
}
function dialogWarns(spy: ReturnType<typeof warnSpy>): string[] {
  return spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('[jsvision/ui dialog]'));
}

// --- validator internals -----------------------------------------------------------------------

test('two distinct collisions produce two groups, in first-appearance order', () => {
  expect(findDuplicateAccelerators(['a', 'b', 'a', 'b', 'c'])).toEqual([
    { char: 'a', indices: [0, 2] },
    { char: 'b', indices: [1, 3] },
  ]);
});

test('mixed case across three claimants collapses to one lowercase group', () => {
  expect(findDuplicateAccelerators(['S', 's', 'S'])).toEqual([{ char: 's', indices: [0, 1, 2] }]);
});

test('a single claim is never a group even amid ignored blanks', () => {
  expect(findDuplicateAccelerators(['', 'q', '', ''])).toEqual([]);
});

// --- View.accelerators() overrides -------------------------------------------------------------

test('Button/Label report their ~X~ hotkey; an unmarked control reports none', () => {
  expect(new Button('~O~K', { command: 'ok' }).accelerators()).toEqual(['o']);
  expect(new Button('Plain', { command: 'p' }).accelerators()).toEqual([]);
  expect(new Label('~N~ame', new Button('X', { command: 'x' })).accelerators()).toEqual(['n']);
});

test('a CheckGroup reports every item hotkey — a DISABLED item still contributes', () => {
  const group = new CheckGroup({ labels: ['~A~lpha', '~B~eta', 'Plain'], value: signal([false, false, false]) });
  group.setItemEnabled(1, false); // disabling Beta must NOT drop its 'b' — it still shadows at runtime
  expect(group.accelerators()).toEqual(['a', 'b']);
});

// --- Dialog scope walk isolation ---------------------------------------------------------------

test('the Dialog walk stops at a nested Dialog boundary (child scope not merged into the parent)', () => {
  const spy = warnSpy();
  const outer = new Dialog({ title: ' Outer ', width: 40, height: 12 });
  outer.add(new Button('~O~K', { command: 'ok' })); // outer scope: one 'o'
  const inner = new Dialog({ title: ' Inner ', rect: { x: 2, y: 2, width: 20, height: 6 } });
  inner.add(new Button('~O~ops', { command: 'oops' })); // inner scope: its own 'o' — NOT counted against outer
  outer.add(inner);
  mount(outer);
  // Outer sees only its own single 'o' ⇒ no collision; inner sees only its own single 'o' ⇒ none.
  expect(dialogWarns(spy)).toHaveLength(0);
});

test('the Dialog walk stops at a nested TabView boundary — a tab char does not collide with a dialog control', () => {
  const spy = warnSpy();
  const dialog = new Dialog({ title: ' D ', width: 40, height: 12 });
  dialog.add(new Button('~A~pply', { command: 'apply' })); // dialog scope: one 'a'
  const tabs = signal<Tab[]>([
    { title: '~A~lpha', content: new Group() }, // tab 'a' — a different scope, must not merge
    { title: '~B~eta', content: new Group() },
  ]);
  const tv = new TabView({ tabs, active: signal(0) });
  tv.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 36, height: 8 } };
  dialog.add(tv);
  mount(dialog);
  expect(dialogWarns(spy)).toHaveLength(0); // dialog 'a' vs tab 'a' are separate scopes
});

test('a real within-dialog collision across a Label + Button still warns once', () => {
  const spy = warnSpy();
  const dialog = new Dialog({ title: ' D ', width: 40, height: 12 });
  const target = new Button('X', { command: 'x' });
  dialog.add(new Label('~S~ave', target)); // 's'
  dialog.add(new Button('~S~top', { command: 'stop' })); // 's' — collides within the same scope
  dialog.add(target);
  mount(dialog);
  const warns = dialogWarns(spy);
  expect(warns).toHaveLength(1);
  expect(warns[0]).toContain("'s'");
});
