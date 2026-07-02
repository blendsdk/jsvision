/**
 * Implementation tests — event-loop hardening (RD-13, HR-02).
 *
 * Edge coverage beyond the ST oracles: nested (modal-in-modal) offsets deliver correct child-local
 * coords, and a click inside the OUTER modal but outside the inner (top) modal is inert. Covers the
 * 03-06 "Testing Requirements → Impl tests" bullet (modal-in-modal offsets).
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent, Point } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

class HitLeaf extends View {
  readonly locals: Point[] = [];
  draw(ctx: DrawContext): void {
    ctx.fill('x');
  }
  override onEvent(ev: DispatchEvent): void {
    this.locals.push(ev.local);
    ev.handled = true;
  }
}

test('a nested modal delivers correct child-local coords through the absolute origin', () => {
  const child = new HitLeaf();
  const d2 = new Group();
  d2.add(child);
  const d1 = new Group();
  d1.add(d2);
  const desktop = new Group();
  desktop.add(d1);
  const root = new Group();
  root.add(desktop);

  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 40, height: 20 };
  desktop.bounds = { x: 2, y: 1, width: 38, height: 19 };
  d1.bounds = { x: 3, y: 2, width: 30, height: 15 }; // abs origin (5,3)
  d2.bounds = { x: 4, y: 3, width: 20, height: 10 }; // abs origin (9,6)
  child.bounds = { x: 2, y: 1, width: 5, height: 3 }; // abs origin (11,7)

  void loop.execView(d1);
  void loop.execView(d2); // d2 is now the top modal scope

  // Click at child abs origin (11,7) + (1,1) = 0-based (12,8) → 1-based (13,9).
  loop.dispatch(mouseDown(13, 9));
  expect(child.locals.length).toBe(1);
  expect(child.locals[0]).toEqual({ x: 1, y: 1 });
});

test('a click inside the outer modal but outside the inner (top) modal is inert', () => {
  const inner = new HitLeaf();
  const outer = new HitLeaf();
  const d2 = new Group();
  d2.add(inner);
  const d1 = new Group();
  d1.add(outer);
  d1.add(d2);
  const root = new Group();
  root.add(d1);

  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 40, height: 20 };
  d1.bounds = { x: 0, y: 0, width: 40, height: 20 };
  outer.bounds = { x: 1, y: 1, width: 4, height: 3 }; // abs (1,1), part of the outer modal
  d2.bounds = { x: 20, y: 5, width: 10, height: 6 }; // inner modal, far from `outer`
  inner.bounds = { x: 0, y: 0, width: 10, height: 6 };

  void loop.execView(d1);
  void loop.execView(d2); // inner modal captures

  // Click over `outer` (abs 0-based (2,2)) — inside d1 but outside the top modal d2.
  loop.dispatch(mouseDown(3, 3));
  expect(outer.locals.length).toBe(0); // inert: the top modal scope excludes it
  expect(inner.locals.length).toBe(0);
});
