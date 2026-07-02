/**
 * Specification tests (immutable oracles) — event-loop hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-02 + AC-1, plan docs 03-06-event-loop-focus.md and
 * 07-testing-strategy.md (ST-1.y, ST-1.y-prop). A modal hit-test must translate the pointer
 * through the modal's **absolute** origin, so a click's delivered `ev.local` is identical for the
 * same dialog-relative point regardless of where the modal (its ancestors) sits on screen. Real
 * `View`/`Group` subclasses + a real loop; expectations derive from the AC, never the code.
 *
 * Later hardening phases append their event/focus oracles (ST-3.a–b, ST-7.d–e,h) to this file.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { For, signal } from '../src/reactive/index.js';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent, Point } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false };
}

/** A focusable leaf that counts the events it receives. */
class FocusLeaf extends View {
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

/** A 1-based SGR mouse-down at (x, y). */
function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

/** A leaf that records the view-local coords of every envelope it receives. */
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

/** A group that records the view-local coords of every envelope it receives (bubbled hits). */
class HitGroup extends Group {
  readonly locals: Point[] = [];
  override onEvent(ev: DispatchEvent): void {
    this.locals.push(ev.local);
    ev.handled = true;
  }
}

/**
 * Build `root > desktop > dialog > child`, where `desktop` carries an ancestor `offset` (mirroring a
 * MenuBar pushing the desktop to y≥1). The dialog is `execView`-modal. All bounds are parent-relative
 * (RD-03 contract). Child spans a known absolute cell so its view-local coordinate is deterministic.
 */
function modalOffsetScene(offset: Point): {
  loop: ReturnType<typeof createEventLoop>;
  dialog: HitGroup;
  child: HitLeaf;
  /** The child's absolute (0-based) top-left origin. */
  childOrigin: Point;
  /** The dialog's absolute (0-based) top-left origin. */
  dialogOrigin: Point;
} {
  const child = new HitLeaf();
  const dialog = new HitGroup();
  dialog.add(child);
  const desktop = new Group();
  desktop.add(dialog);
  const root = new Group();
  root.add(desktop);

  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  loop.mount(root);

  root.bounds = { x: 0, y: 0, width: 40, height: 20 };
  desktop.bounds = { x: offset.x, y: offset.y, width: 40 - offset.x, height: 20 - offset.y };
  dialog.bounds = { x: 5, y: 3, width: 12, height: 6 }; // parent-relative to desktop
  child.bounds = { x: 2, y: 1, width: 4, height: 3 }; // parent-relative to dialog

  const dialogOrigin: Point = { x: offset.x + 5, y: offset.y + 3 };
  const childOrigin: Point = { x: dialogOrigin.x + 2, y: dialogOrigin.y + 1 };
  return { loop, dialog, child, childOrigin, dialogOrigin };
}

// ST-1.y — a modal click delivers the correct child-local coordinate (no ancestor shift), and a
// click on the modal's real last row hits the modal.
test('ST-1.y: a modal click delivers child-local coords through the absolute origin', () => {
  const { loop, dialog, child, childOrigin, dialogOrigin } = modalOffsetScene({ x: 0, y: 1 });
  void loop.execView(dialog);

  // Absolute 0-based point (childOrigin + (1,1)) → 1-based mouse event.
  const localWanted: Point = { x: 1, y: 1 };
  const absX = childOrigin.x + localWanted.x;
  const absY = childOrigin.y + localWanted.y;
  loop.dispatch(mouseDown(absX + 1, absY + 1));

  expect(child.locals.length).toBe(1);
  expect(child.locals[0]).toEqual(localWanted); // no ancestor shift — exact child-local coord

  // A click on the modal's real bottom row (dialog height 6 ⇒ last row = origin.y + 5) hits the modal.
  const lastRowAbsY = dialogOrigin.y + 5;
  const lastRowAbsX = dialogOrigin.x + 1; // over the dialog frame, not the child
  loop.dispatch(mouseDown(lastRowAbsX + 1, lastRowAbsY + 1));
  expect(dialog.locals.length).toBeGreaterThanOrEqual(1); // last-row click reached the modal
});

// ST-1.y-prop — offset invariance: the SAME dialog-relative click yields the SAME ev.local at every
// ancestor offset (AC-1 property).
test('ST-1.y-prop: modal ev.local is offset-invariant across ancestor offsets', () => {
  const offsets: Point[] = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 3, y: 2 },
    { x: 10, y: 5 },
  ];
  const localWanted: Point = { x: 2, y: 1 };

  for (const offset of offsets) {
    const { loop, dialog, child, childOrigin } = modalOffsetScene(offset);
    void loop.execView(dialog);

    const absX = childOrigin.x + localWanted.x;
    const absY = childOrigin.y + localWanted.y;
    loop.dispatch(mouseDown(absX + 1, absY + 1));

    expect(child.locals.length, `offset ${offset.x},${offset.y}`).toBe(1);
    expect(child.locals[0], `offset ${offset.x},${offset.y}`).toEqual(localWanted);
  }
});

// ST-3.a — removing the focused child re-homes focus to the next focusable sibling (else null); a
// dispatched key never reaches the removed view (HR-10/PA-10).
test('ST-3.a: removing the focused child re-homes focus to a sibling, then to null', () => {
  const a = new FocusLeaf();
  const b = new FocusLeaf();
  const root = new Group();
  root.add(a);
  root.add(b);
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 20, height: 5 };
  a.bounds = { x: 0, y: 0, width: 5, height: 1 };
  b.bounds = { x: 5, y: 0, width: 5, height: 1 };

  loop.focusView(a);
  expect(loop.getFocused()).toBe(a);

  root.remove(a); // remove the focused child
  expect(loop.getFocused()).toBe(b); // re-homed to the sibling

  const aBefore = a.events;
  loop.dispatch(keyEvent('x'));
  expect(a.events).toBe(aBefore); // no key reached the removed view
  expect(b.events).toBeGreaterThan(0); // delivered to the re-homed focus

  root.remove(b); // remove the last focusable child
  expect(loop.getFocused()).toBeNull(); // nothing left → null
});

// ST-3.a — the same re-home holds for the dynamic-child (For) removal path (unmountDynamicChild).
test('ST-3.a: removing the focused dynamic child re-homes focus (unmountDynamicChild)', () => {
  const items = signal<number[]>([1, 2]);
  const leaves = new Map<number, FocusLeaf>();
  const root = new Group();
  root.layout = { direction: 'col' };
  root.addDynamic(() =>
    For(
      () => items(),
      (n) => n,
      (n) => {
        const leaf = new FocusLeaf();
        leaves.set(n, leaf);
        return leaf;
      },
    ),
  );
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 20, height: 5 };

  const one = leaves.get(1);
  const two = leaves.get(2);
  if (one === undefined || two === undefined) throw new Error('leaves not produced');
  one.bounds = { x: 0, y: 0, width: 5, height: 1 };
  two.bounds = { x: 0, y: 1, width: 5, height: 1 };

  loop.focusView(one);
  expect(loop.getFocused()).toBe(one);

  items.set([2]); // drops item 1 → unmountDynamicChild(one)
  expect(loop.getFocused()).toBe(two); // re-homed to the surviving dynamic child
});

// ST-3.b — a detached view is not focusable; focusView on it is a genuine no-op (HR-11).
test('ST-3.b: focusView on a detached view is a no-op; the real focus is untouched', () => {
  const a = new FocusLeaf();
  const b = new FocusLeaf();
  const root = new Group();
  root.add(a);
  root.add(b);
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  loop.mount(root);
  root.bounds = { x: 0, y: 0, width: 20, height: 5 };
  a.bounds = { x: 0, y: 0, width: 5, height: 1 };
  b.bounds = { x: 5, y: 0, width: 5, height: 1 };

  loop.focusView(a);
  expect(loop.getFocused()).toBe(a);

  // A never-mounted leaf: focusView is a genuine no-op.
  const detached = new FocusLeaf();
  loop.focusView(detached);
  expect(loop.getFocused()).toBe(a); // real focus unchanged
  expect(a.state.focused).toBe(true); // not blurred
  expect(detached.state.focused).toBe(false);

  // A mounted-then-removed leaf: also a no-op (isFocusable requires mounted).
  root.remove(b);
  loop.focusView(b);
  expect(loop.getFocused()).toBe(a);
  expect(a.state.focused).toBe(true);
});
