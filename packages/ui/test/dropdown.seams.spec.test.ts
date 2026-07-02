/**
 * Specification tests (immutable oracles) — RD-14 Phase-0 additive seams.
 *
 * Source: jsvision-ui RD-14 (input-dropdowns/03-04-seams-and-theme.md §1/§2 + 03-02-anchored-popup.md
 * "Host acquisition"), tasks 0.1.2. Three additive, non-breaking seams the dropdown controls build
 * on, asserted BEFORE implementation (spec-first, RED):
 *   1. Public `Input` linkage seam (PA-8) — `getValueSignal()` / `getMaxLength()` / public `selectAll()`.
 *   2. Derived overlay-visibility seam (PA-5/PF-001) — an imperative `syncOverlayVisible(overlay)`
 *      helper: `state.visible === (children.length > 0)`, so a menu + a popup coexist without stomping.
 *   3. Popup-host `DispatchEvent` envelope seam (PF-002) — `ev.getFocused()` + an overlay-host
 *      accessor present on the envelope during real dispatch.
 *
 * Expectations derive from the plan/AC, never from the implementation. Real objects + a real loop
 * (no mocks), synthetic dispatch, headless.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';
import { createEventLoop } from '../src/event/index.js';
import { syncOverlayVisible } from '../src/app/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false };
}

/** A focusable leaf that records every dispatch envelope it receives (for the seam assertions). */
class RecordingLeaf extends View {
  override focusable = true;
  readonly events: DispatchEvent[] = [];
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    this.events.push(ev);
  }
}

// ── 1. Public Input linkage seam (PA-8) ──────────────────────────────────────────────────────────

test('Input exposes a public linkage seam: getValueSignal / getMaxLength / selectAll', () => {
  const value = signal('hello');
  const input = new Input({ value, maxLength: 5 });

  expect(typeof input.getValueSignal).toBe('function');
  expect(input.getValueSignal()).toBe(value); // the SAME two-way signal History writes through
  expect(input.getMaxLength()).toBe(5);

  // `selectAll` is public and callable (no throw) — History calls it after a pick.
  expect(() => input.selectAll(true)).not.toThrow();
});

test('Input.getMaxLength reports Infinity when unbounded (no maxLength option)', () => {
  const input = new Input({ value: signal('') });
  expect(input.getMaxLength()).toBe(Infinity);
});

// ── 2. Derived overlay-visibility seam (PA-5 / PF-001) ───────────────────────────────────────────

test('syncOverlayVisible derives visibility from the live child count (empty ⇒ hidden)', () => {
  const overlay = new Group();
  overlay.state.visible = true; // start dirty to prove the helper re-derives
  syncOverlayVisible(overlay);
  expect(overlay.state.visible).toBe(false);
});

test('syncOverlayVisible: menu + a mounted popup child both visible, hides only on the last unmount', () => {
  const overlay = new Group();
  const menuCatcher = new RecordingLeaf(); // stands in for the menu's mounted child
  const popupChild = new RecordingLeaf(); // stands in for a dropdown popup's mounted child

  overlay.add(menuCatcher);
  syncOverlayVisible(overlay);
  expect(overlay.state.visible).toBe(true);

  // A second client mounts (F10 menu open while a combo popup is open) — still visible, no stomp.
  overlay.add(popupChild);
  syncOverlayVisible(overlay);
  expect(overlay.state.visible).toBe(true);

  // One client unmounts — the other keeps the overlay visible (coexistence rule).
  overlay.remove(popupChild);
  syncOverlayVisible(overlay);
  expect(overlay.state.visible).toBe(true);

  // The last child unmounts — now the overlay hides.
  overlay.remove(menuCatcher);
  syncOverlayVisible(overlay);
  expect(overlay.state.visible).toBe(false);
});

// ── 3. Popup-host DispatchEvent envelope seam (PF-002) ───────────────────────────────────────────

test('DispatchEvent carries getFocused() + the overlay-host accessor during real dispatch', () => {
  const loop = createEventLoop({ width: 80, height: 24 }, { caps });
  const root = new Group();
  const leaf = new RecordingLeaf();
  root.add(leaf);
  loop.mount(root);

  // The app shell wires the popup host onto the loop (as run()/application.ts do for onFrame etc.).
  const overlay = new Group();
  loop.popupHost = {
    overlay,
    focusView: (v) => loop.focusView(v),
    getFocused: () => loop.getFocused(),
  };

  loop.focusView(leaf);
  loop.dispatch(keyEvent('a'));

  const ev = leaf.events.at(-1);
  expect(ev).toBeDefined();
  expect(typeof ev?.getFocused).toBe('function');
  expect(ev?.getFocused?.()).toBe(leaf);
  expect(ev?.popupHost).toBe(loop.popupHost);
  expect(ev?.popupHost?.overlay).toBe(overlay);
});
