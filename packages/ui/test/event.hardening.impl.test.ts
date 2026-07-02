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

// HR-10 — removing a focused CONTAINER (scope-root subtree) re-homes focus to a sibling, else null.
test('removing a focused container subtree re-homes focus to a sibling', () => {
  class FocusLeaf extends View {
    draw(_ctx: DrawContext): void {}
  }
  const inner = new FocusLeaf();
  inner.focusable = true;
  const panel = new Group(); // a container holding the focused leaf
  panel.add(inner);
  const sibling = new FocusLeaf();
  sibling.focusable = true;
  const root = new Group();
  root.add(panel);
  root.add(sibling);

  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 20, height: 5 };
  panel.bounds = { x: 0, y: 0, width: 5, height: 2 };
  inner.bounds = { x: 0, y: 0, width: 5, height: 1 };
  sibling.bounds = { x: 6, y: 0, width: 5, height: 1 };

  loop.focusView(inner);
  expect(loop.getFocused()).toBe(inner);

  root.remove(panel); // remove the whole focused subtree
  expect(loop.getFocused()).toBe(sibling); // re-homed out of the removed subtree
});

// ---------------------------------------------------------------------------
// Phase-7 impl — quit cascade / focus recovery / mid-sweep edges
// ---------------------------------------------------------------------------

function keyEvt(key: string): { type: 'key'; key: string; ctrl: boolean; alt: boolean; shift: boolean } {
  return { type: 'key', key, ctrl: false, alt: false, shift: false };
}

/** A focusable leaf that counts events. */
class CountLeaf extends View {
  events = 0;
  constructor() {
    super();
    this.focusable = true;
  }
  draw(_ctx: DrawContext): void {}
  override onEvent(_ev: DispatchEvent): void {
    this.events += 1;
  }
}

// HR-38 — a veto in the MIDDLE of a 3-deep stack stops the cascade there: the un-vetoed top resolves,
// the vetoing modal and everything beneath it stay open.
test('HR-38 impl: a mid-stack valid() veto halts the cascade, keeping it + the base modal open', async () => {
  class VetoModal extends Group {
    valid(_command: string): boolean {
      return false;
    }
  }
  const root = new Group();
  const loop = createEventLoop({ width: 20, height: 10 }, { caps, quitCommand: 'quit' });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 20, height: 10 };

  const base = new Group();
  root.add(base);
  let baseResolved = false;
  loop.execView<string>(base).then(() => (baseResolved = true));
  const mid = new VetoModal();
  root.add(mid);
  let midResolved = false;
  loop.execView<string>(mid).then(() => (midResolved = true));
  const top = new Group();
  root.add(top);
  const topPromise = loop.execView<string>(top);

  loop.emitCommand('quit'); // top ends, mid vetoes → stop
  expect(await topPromise).toBe('quit'); // the top (un-vetoed) modal resolved
  await Promise.resolve();
  expect(midResolved).toBe(false); // the vetoing modal stays
  expect(baseResolved).toBe(false); // and so does the base beneath it
});

// HR-39 — focusPrev also recovers from a disabled anchor (mirror of the focusNext spec case).
test('HR-39 impl: focusPrev recovers to the previous candidate when the anchor is disabled', () => {
  const a = new CountLeaf();
  const b = new CountLeaf();
  const c = new CountLeaf();
  const root = new Group();
  root.add(a);
  root.add(b);
  root.add(c);
  const loop = createEventLoop({ width: 30, height: 5 }, { caps });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 30, height: 5 };
  a.bounds = { x: 0, y: 0, width: 8, height: 1 };
  b.bounds = { x: 10, y: 0, width: 8, height: 1 };
  c.bounds = { x: 20, y: 0, width: 8, height: 1 };

  loop.focusView(b);
  b.state.disabled = true; // disable the anchor
  loop.focusPrev(); // must resume from the nearest earlier candidate, not snap wrong
  expect(loop.getFocused()).toBe(a);
});

// HR-42 — mid-sweep removal in the POST-process sweep also skips the removed view.
test('HR-42 impl: a post-process view removed mid-sweep is not delivered to', () => {
  const root = new Group();
  let removeB = false;
  class Remover extends View {
    override postProcess = true;
    draw(_ctx: DrawContext): void {}
    override onEvent(_ev: DispatchEvent): void {
      if (removeB) root.remove(b);
    }
  }
  class Counter extends View {
    override postProcess = true;
    events = 0;
    draw(_ctx: DrawContext): void {}
    override onEvent(_ev: DispatchEvent): void {
      this.events += 1;
    }
  }
  const a = new Remover();
  const b = new Counter();
  root.add(a);
  root.add(b);
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 20, height: 5 };

  removeB = true;
  loop.dispatch(keyEvt('x'));
  expect(b.events).toBe(0);
});
