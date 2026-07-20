/**
 * Specification tests (immutable oracles) — the `at()` placement helper as exported from the two
 * showcase story surfaces (`kitchen-sink/story.ts` and `datagrid-showcase/story.ts`).
 *
 * Both story modules are contracted to expose the blessed `@jsvision/ui` absolute-placement
 * builder, whose write path MERGES into the view's existing layout props (preserving everything the
 * call does not name) and requests a reflow when the view is mounted. Expectations here derive from
 * that contract, not from the modules' current source: a hand-rolled shadow helper that REPLACES
 * the whole layout object, or that never asks the host to relayout, must fail these tests.
 *
 * The mounted-view case counts `markRelayout` on an inline `ViewHost` double assigned to the public
 * `view.host` field — deliberately not a scheduler-frame counter, because a frame counter cannot
 * tell a reflow from a mere repaint, and that distinction is the whole point of the case.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { Group } from '@jsvision/ui';
import { at } from '../kitchen-sink/story.js';
import { at as atGrid } from '../datagrid-showcase/story.js';

// A fresh bare Group starts with an empty layout, so the deep-equality below is exact: nothing but
// the absolute placement may be present afterwards, and the helper hands the same view back for
// chaining.
test('kitchen-sink at() writes an absolute rect on a bare view and returns the same view', () => {
  const v = new Group();
  const returned = at(v, 1, 2, 3, 4);
  expect(v.layout).toEqual({ position: 'absolute', rect: { x: 1, y: 2, width: 3, height: 4 } });
  expect(returned).toBe(v);
});

// The merge contract: layout props the call does not name survive the write. A replace-style
// helper wipes `direction` and `padding` here and must fail.
test('kitchen-sink at() preserves layout props it does not name', () => {
  const v = new Group();
  v.setLayout({ direction: 'col', padding: 1 });
  at(v, 0, 0, 10, 5);
  expect(v.layout).toEqual({
    direction: 'col',
    padding: 1,
    position: 'absolute',
    rect: { x: 0, y: 0, width: 10, height: 5 },
  });
});

// Same bare-view contract, seen through the datagrid showcase's export.
test('datagrid-showcase at() writes an absolute rect on a bare view and returns the same view', () => {
  const v = new Group();
  const returned = atGrid(v, 1, 2, 3, 4);
  expect(v.layout).toEqual({ position: 'absolute', rect: { x: 1, y: 2, width: 3, height: 4 } });
  expect(returned).toBe(v);
});

// Same merge contract, seen through the datagrid showcase's export.
test('datagrid-showcase at() preserves layout props it does not name', () => {
  const v = new Group();
  v.setLayout({ direction: 'col', padding: 1 });
  atGrid(v, 0, 0, 10, 5);
  expect(v.layout).toEqual({
    direction: 'col',
    padding: 1,
    position: 'absolute',
    rect: { x: 0, y: 0, width: 10, height: 5 },
  });
});

// On a mounted view the write must request a reflow — exactly one markRelayout call, counted on an
// inline host double (never a scheduler-frame counter, which conflates reflow with repaint).
test('at() on a mounted view requests exactly one relayout from its host', () => {
  const v = new Group();
  let relayouts = 0;
  v.host = {
    markRepaint() {
      // repaints are irrelevant here — only reflow requests are counted
    },
    markRelayout() {
      relayouts += 1;
    },
  };
  at(v, 0, 0, 4, 1);
  expect(relayouts).toBe(1);
});
