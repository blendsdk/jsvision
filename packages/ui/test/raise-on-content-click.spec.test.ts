/**
 * Specification oracle — raise a background window on a **content** click (fix #38, T-02).
 *
 * Turbo Vision selects + raises a window at the TOP of its `handleEvent`, before the positional
 * event descends into the interior (`tgroup.cpp:377-380` → `tview.cpp:553-557` `focus()` →
 * `tview.cpp:452-466` `select()` → `tview.cpp:728-733` `makeFirst()` for an `ofTopSelect` window).
 * So the raise is independent of whether the interior consumes the click. Our port inverted that
 * (raise via an up-bubble to `Window.onEvent`), so an interior view that consumes the mouse-down —
 * the `Editor` captures the pointer + sets `ev.handled` (`editor-mouse.ts:60-63`), likewise
 * `Input`/`ListRows`/`Scroller`/`GridRows` — stopped the bubble and the window never raised while
 * focus had already moved in. This oracle pins the TV behavior: an interior-consumed click on a
 * background window **raises** it AND focuses the clicked leaf.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DispatchEvent } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function shellApp(width: number, height: number) {
  return createApplication({ caps, viewport: { width, height } });
}
/** A 1-based mouse event from 0-based cell coords (the loop normalizes 1-based→0-based). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/**
 * A focusable content leaf that **consumes** a mouse-down and captures the pointer — the `Editor`
 * shape (`editor-mouse.ts:48-64`). This is the exact interior behavior that used to stop the raise.
 */
class ConsumingLeaf extends View {
  override focusable = true;
  /** Fill the window interior (content-box-relative; `padding:1` offsets it to window-local (1,1)). */
  override layout = { position: 'absolute' as const, rect: { x: 0, y: 0, width: 38, height: 12 } };
  draw(): void {
    /* no-op — presence + hit-target is all the test needs */
  }
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'mouse' && ev.event.kind === 'down') {
      ev.setCapture?.(this); // the editor captures the pointer on down…
      ev.handled = true; // …and consumes the event, stopping the ancestor bubble
    }
  }
}

/** Add a `Window` at `rect` hosting a single interior-consuming leaf; return both. */
function windowWithLeaf(
  app: ReturnType<typeof shellApp>,
  title: string,
  rect: { x: number; y: number; width: number; height: number },
): { win: Window; leaf: ConsumingLeaf } {
  const win = new Window(title);
  win.setLayout({ rect: rect });
  const leaf = new ConsumingLeaf();
  win.add(leaf);
  app.desktop.addWindow(win);
  return { win, leaf };
}

// ST-1 — a mouse-down on the INTERIOR of a non-active window whose content leaf consumes the down
// raises that window to active AND focuses its inner leaf (the caret target). This is #38.
test('ST-1: clicking a background window’s consuming content raises it and focuses the leaf', () => {
  const app = shellApp(80, 24);
  // B (back) then A (front, active). B is only partly covered by A, leaving a clickable region.
  const { win: b, leaf: leafB } = windowWithLeaf(app, 'Clipboard', { x: 30, y: 8, width: 40, height: 14 });
  const { win: a } = windowWithLeaf(app, 'Untitled', { x: 0, y: 0, width: 40, height: 14 });
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()).toBe(a); // added last ⇒ front + active

  // Click B's interior at 0-based (50,15): inside B (x 30..69, y 8..21), outside A (x 0..39).
  // B's leaf covers abs (31..68, 9..20), so the click lands on the consuming leaf.
  app.loop.dispatch(mouse('down', 50, 15));

  // TV-correct: B raised to active AND its inner leaf focused — not the old split (leaf focused,
  // window still buried behind A).
  expect(app.desktop.activeWindow()).toBe(b);
  expect(leafB.state.focused).toBe(true);
});

// ST-2 (HR-09 guard) — the raise must NOT regress the inactive-window first-click-inert affordance:
// the first click on an inactive window's close column only raises+activates it; the second (now
// active) click closes it (tframe.cpp:150-193). Co-located guard mirroring the app-shell.hardening
// oracle, asserted against this task's dispatch path.
test('ST-2: an inactive window’s close box stays inert on the first click, closes on the second', () => {
  const app = shellApp(40, 12);
  const a = new Window('A');
  a.setLayout({ rect: { x: 0, y: 0, width: 14, height: 6 } });
  app.desktop.addWindow(a);
  const b = new Window('B');
  b.setLayout({ rect: { x: 16, y: 0, width: 14, height: 6 } });
  app.desktop.addWindow(b);
  app.desktop.raise(a); // A active, B inactive
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()).toBe(a);

  // B's close box: window-local (2,0) → abs (18,0) → the frame (no interior child there).
  app.loop.dispatch(mouse('down', 18, 0));
  expect(app.desktop.children.includes(b)).toBe(true); // first click did NOT close
  expect(app.desktop.activeWindow()).toBe(b); // it raised + activated B

  app.loop.dispatch(mouse('down', 18, 0));
  expect(app.desktop.children.includes(b)).toBe(false); // second click (now active) closes
});
