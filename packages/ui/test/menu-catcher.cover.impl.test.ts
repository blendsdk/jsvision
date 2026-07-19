/**
 * Implementation test — the menu outside-click catcher keeps covering the viewport after a resize.
 *
 * The catcher is a full-viewport overlay, so an outside click dismisses the open menu even after the
 * terminal is resized — the coverage re-solves to the new geometry on the reflow, with no manual
 * per-resize re-anchoring. This pins the dismissal-after-resize behavior so a change to how the
 * catcher is placed can't silently regress it (no other menu test resizes then dismisses). Real
 * MenuBar/app overlay; keys + clicks drive the loop. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { MenuPopup, menuBar, subMenu, item } from '../src/menu/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(name: string): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false };
}
function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x: x + 1, y: y + 1 };
}

/** A composed app with a File/Edit menu bar; returns the app and its full-viewport overlay. */
function menuApp(width: number, height: number) {
  const bar = menuBar([subMenu('~F~ile', [item('~O~k', 'ok')]), subMenu('~E~dit', [item('~C~opy', 'copy')])]);
  const app = createApplication({ caps, menuBar: bar, viewport: { width, height } });
  app.loop.renderRoot.flush();
  const root = app.desktop!.parent as Group;
  const overlay = root.children.find((c) => c.layout.position === 'absolute') as Group;
  return { app, overlay };
}

function popupCount(overlay: Group): number {
  return overlay.children.filter((c) => c instanceof MenuPopup).length;
}

test('an outside click dismisses the menu after the viewport is resized larger', () => {
  const { app, overlay } = menuApp(40, 12);

  app.loop.dispatch(key('f10')); // open File
  expect(overlay.state.visible).toBe(true);
  expect(popupCount(overlay)).toBe(1);

  // Grow the viewport; the catcher must re-solve to the new geometry so the whole screen still
  // dismisses (the loop reflows, updates the overlay rect, then re-anchors the open menu).
  app.loop.resize({ width: 60, height: 20 });
  expect(overlay.layout.rect).toEqual({ x: 0, y: 0, width: 60, height: 20 });

  // A click in the newly-added bottom-right area — outside every popup, not on a bar title (row 0) —
  // must still hit the catcher and close the menu.
  app.loop.dispatch(mouseDown(55, 18));
  expect(overlay.state.visible).toBe(false);
  expect(popupCount(overlay)).toBe(0);
});

test('an outside click dismisses the menu after the viewport is resized smaller', () => {
  const { app, overlay } = menuApp(60, 20);

  app.loop.dispatch(key('f10'));
  expect(popupCount(overlay)).toBe(1);

  app.loop.resize({ width: 40, height: 12 });
  expect(overlay.layout.rect).toEqual({ x: 0, y: 0, width: 40, height: 12 });

  app.loop.dispatch(mouseDown(35, 10)); // inside the shrunk viewport, outside the popup
  expect(overlay.state.visible).toBe(false);
  expect(popupCount(overlay)).toBe(0);
});
