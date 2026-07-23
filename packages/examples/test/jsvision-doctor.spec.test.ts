// Specification oracle for jsvision-doctor (the static footgun linter).
//
// Each case pins one rule: doctor must catch the documented footgun on broken code and stay silent
// on the correct pattern — and it must not flag a window/dialog's own placement rect or a bind that
// already lives in onMount. A dogfood check asserts the curated recipe modules are footgun-free.
// Immutable oracle: if doctor disagrees, the linter is wrong — never this test.

import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import { lintText, lintPaths } from '../../../plugins/jsvision-plugin/skills/jsvision-doctor/jsvision-doctor.mjs';

const rules = (src: string): string[] => lintText(src).map((f) => f.rule);

// gotcha 11 — relative imports need the NodeNext `.js` extension.
test('detects a relative import missing its .js extension, allows one that has it', () => {
  expect(rules("import { View } from './view';")).toContain('missing-js-extension');
  expect(rules("import { View } from './view.js';")).not.toContain('missing-js-extension');
  expect(rules("import { View } from '@jsvision/ui';")).not.toContain('missing-js-extension'); // package import
});

// gotcha 2 — bind() belongs in onMount, never directly in the constructor.
test('flags bind() directly in a constructor, allows bind() inside onMount', () => {
  const bad =
    'class A extends View { constructor() { super(); this.bind(() => 1); } measure() { return { width: 1, height: 1 }; } }';
  expect(rules(bad)).toContain('bind-in-constructor');
  const good =
    'class A extends View { constructor() { super(); this.onMount(() => this.bind(() => 1)); } measure() { return { width: 1, height: 1 }; } }';
  expect(rules(good)).not.toContain('bind-in-constructor');
});

// gotcha 1 — a custom View with no measure() collapses to {0,0} in an auto slot.
test('flags a View subclass without measure(); allows one with measure() and any Group subclass', () => {
  expect(rules('class B extends View {}')).toContain('view-without-measure');
  expect(rules('class C extends View { measure() { return { width: 1, height: 1 }; } }')).not.toContain(
    'view-without-measure',
  );
  expect(rules('class D extends Group {}')).not.toContain('view-without-measure');
});

// gotcha 3 — content should use the DSL; only a window/dialog's own rect is a sanctioned exception.
test('flags an absolute content rect, allows a window/dialog placement rect', () => {
  expect(rules("label.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 4, height: 1 } };")).toContain(
    'content-absolute-rect',
  );
  const win = "const win = new Window('t'); win.layout.rect = { x: 1, y: 1, width: 20, height: 5 };";
  expect(rules(win)).not.toContain('content-absolute-rect');
});

// The same rule, written the way the framework now requires. `setLayout` is the only way to write
// layout, so a checker that only understood the assignment form would flag a window placing itself —
// the one thing gotcha 3 explicitly sanctions — while staying quiet about the identical old spelling.
test('the window exception survives the setLayout spelling; content is still flagged', () => {
  const win =
    "const win = new Window('t'); win.setLayout({ position: 'absolute', rect: { x: 1, y: 1, width: 20, height: 5 } });";
  expect(rules(win)).not.toContain('content-absolute-rect');

  const content = "label.setLayout({ position: 'absolute', rect: { x: 1, y: 1, width: 4, height: 1 } });";
  expect(rules(content)).toContain('content-absolute-rect');
});

// gotcha 10 — focus the inner .rows renderer of a list/grid, not the container.
test('flags focusing a DataGrid container, allows focusing its .rows', () => {
  expect(rules('const grid = new DataGrid({}); loop.focusView(grid);')).toContain('focus-container-not-rows');
  expect(rules('const grid = new DataGrid({}); loop.focusView(grid.rows);')).not.toContain('focus-container-not-rows');
});

// gotcha 8 — a modal must be resolved, not closed with .close().
test('notes .close() only when execView is in play', () => {
  expect(rules('loop.execView(d); d.close();')).toContain('modal-close');
  expect(rules('d.close();')).not.toContain('modal-close');
});

// gotcha 6 — a signal write in a timer needs a flush / no-op command to repaint.
test('notes a timer signal write without a flush, allows one with a flush', () => {
  expect(rules('setInterval(() => { s.set(s() + 1); }, 100);')).toContain('signal-set-without-flush');
  expect(rules('setInterval(() => { s.set(s() + 1); loop.renderRoot.flush(); }, 100);')).not.toContain(
    'signal-set-without-flush',
  );
});

// Dogfood — the curated recipe modules (the canonical teaching examples) must be footgun-free.
test('the recipe modules are clean', () => {
  const recipes = fileURLToPath(new URL('../recipes', import.meta.url));
  expect(lintPaths([recipes])).toEqual([]);
});
