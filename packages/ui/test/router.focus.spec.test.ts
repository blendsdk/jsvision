/**
 * Specification tests (immutable oracles) — Navigation router · Phase 0 focus restore (ST-6a, ST-6b).
 *
 * Source: 07-testing-strategy.md ST-6a/ST-6b (R-6 / AR-19). The focus-restore contract is tiered:
 * exact (the saved View ref) for a warm frame, an index-path resolve for a disposed+rebuilt frame,
 * and a first-focusable floor. ST-6a is a fixed up-front oracle (warm/exact); ST-6b is the Phase 0
 * spike oracle that the index-path middle tier restores the same-position leaf across a rebuild, with
 * the first-focusable floor as the minimum guarantee. Expectations derive from the spec, never the impl.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { focusPath, viewAtPath, firstFocusableLeaf } from '../src/router/focus.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A minimal focusable leaf. */
class Field extends View {
  override focusable = true;
  constructor(readonly name: string) {
    super();
  }
  draw(): void {}
}

/** Build one screen: root → [ panel → [a, b], c ]. `b` sits at path [0, 1]. */
function buildScreen(): { root: Group; fields: Field[] } {
  const root = new Group();
  const panel = new Group();
  const a = new Field('a');
  const b = new Field('b');
  const c = new Field('c');
  panel.add(a);
  panel.add(b);
  root.add(panel);
  root.add(c);
  return { root, fields: [a, b, c] };
}

// ST-6a — warm frame: the exact previously-focused view is restored (via the saved View ref).
test('ST-6a: a warm frame restores the exact focused view', () => {
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  const { root, fields } = buildScreen();
  loop.mount(root);

  loop.focusView(fields[1]); // focus b
  const saved = loop.getFocused();
  expect(saved).toBe(fields[1]);

  // On the same (warm) tree the captured path also resolves to the exact same view.
  const path = focusPath(root, saved!);
  expect(path).toEqual([0, 1]);
  expect(viewAtPath(root, path!)).toBe(fields[1]);

  // Move focus away, then restore the exact saved ref — b is focused again.
  loop.focusView(fields[0]);
  loop.focusView(saved!);
  expect(loop.getFocused()).toBe(fields[1]);
});

// ST-6b — disposed+rebuilt frame: the index-path resolves the same-position leaf; first-focusable floor.
test('ST-6b: a rebuilt frame restores focus by index-path; first-focusable is the floor', () => {
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  const s1 = buildScreen();
  loop.mount(s1.root);
  loop.focusView(s1.fields[1]); // focus b
  const path = focusPath(s1.root, loop.getFocused()!);
  expect(path).toEqual([0, 1]);

  // Dispose the screen and rebuild an identical one (a keepAlive:false round-trip).
  const s2 = buildScreen();
  loop.mount(s2.root);

  // The saved path resolves to the SAME-POSITION leaf in the rebuilt tree, and focuses it.
  const resolved = viewAtPath(s2.root, path!);
  expect(resolved).toBe(s2.fields[1]);
  loop.focusView(resolved!);
  expect(loop.getFocused()).toBe(s2.fields[1]);

  // The guaranteed floor: the first focusable leaf of the rebuilt screen.
  expect(firstFocusableLeaf(s2.root)).toBe(s2.fields[0]);
});
