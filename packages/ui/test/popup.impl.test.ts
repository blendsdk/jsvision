/**
 * Implementation tests (edge cases / internals) — RD-14 anchored-popup primitive.
 *
 * Companion to `popup.spec.test.ts`: the double-dismiss race, focus save/restore, the overlay
 * mount/unmount derive + menu coexistence (PA-5 — a popup dismiss must NOT hide the overlay while a
 * menu child remains), and the owned-ScrollBar scroll wiring.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, PopupHost } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { ListView } from '../src/list/index.js';
import { createEventLoop } from '../src/event/index.js';
import { openAnchoredPopup } from '../src/dropdown/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false };
}

class Leaf extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}

interface Harness {
  loop: ReturnType<typeof createEventLoop>;
  overlay: Group;
  host: PopupHost;
  bg: Leaf;
  list: ListView<string>;
}

function makeHarness(items: string[], viewport = { width: 40, height: 20 }): Harness {
  const loop = createEventLoop(viewport, { caps });
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height } };
  overlay.state.visible = false;
  const bg = new Leaf();
  const root = new Group();
  root.add(bg);
  root.add(overlay);
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  loop.focusView(bg);
  const list = new ListView<string>({ items: signal(items), getText: (s) => s });
  return { loop, overlay, host, bg, list };
}

// ── Focus save / restore ─────────────────────────────────────────────────────────────────────────

test('the popup saves the prior focus on open and restores it on dismiss', () => {
  const h = makeHarness(['a', 'b', 'c']);
  expect(h.loop.getFocused()).toBe(h.bg);

  const p = openAnchoredPopup({ host: h.host, anchor: { x: 5, y: 3, width: 10, height: 1 }, buildList: () => h.list, onPick: () => {} });
  expect(h.loop.getFocused()).toBe(h.list.rows); // list focused during the popup

  p.dismiss();
  expect(h.loop.getFocused()).toBe(h.bg); // prior focus restored
});

// ── Double-dismiss race (idempotence under two triggers) ────────────────────────────────────────

test('Esc then focus-change does not double-dismiss (the focus watch is disposed on the first dismiss)', () => {
  const h = makeHarness(['a', 'b', 'c']);
  let dismissed = 0;
  openAnchoredPopup({
    host: h.host,
    anchor: { x: 5, y: 3, width: 10, height: 1 },
    buildList: () => h.list,
    onPick: () => {},
    onDismiss: () => {
      dismissed += 1;
    },
  });

  h.loop.dispatch(keyEvent('escape')); // dismiss #1 (also restores focus → would re-tick the watch)
  h.loop.focusView(h.bg); // a further focus change must NOT re-dismiss

  expect(dismissed).toBe(1);
});

// ── Overlay derive + menu coexistence (PA-5) ────────────────────────────────────────────────────

test('dismissing the popup keeps the overlay visible while another client (a menu child) remains', () => {
  const h = makeHarness(['a', 'b', 'c']);
  // Simulate an already-open menu: a mounted child in the shared overlay.
  const menuChild = new Leaf();
  h.overlay.add(menuChild);
  h.overlay.state.visible = true;

  const p = openAnchoredPopup({ host: h.host, anchor: { x: 5, y: 3, width: 10, height: 1 }, buildList: () => h.list, onPick: () => {} });
  expect(h.overlay.state.visible).toBe(true);

  p.dismiss(); // the popup's own children unmount, but the menu child remains
  expect(h.overlay.state.visible).toBe(true); // NOT stomped — coexistence rule (children.length > 0)
  expect(h.overlay.children).toContain(menuChild);

  h.overlay.remove(menuChild); // now the last client leaves
  // re-derive as the menu controller would on close:
  h.overlay.state.visible = h.overlay.children.length > 0;
  expect(h.overlay.state.visible).toBe(false);
});

// ── Owned ScrollBar / scroll wiring ─────────────────────────────────────────────────────────────

test('navigating past maxRows scrolls the list (focused advances, visible window stays ≤ maxRows)', () => {
  const many = Array.from({ length: 20 }, (_, i) => `item-${i}`);
  const h = makeHarness(many);
  openAnchoredPopup({ host: h.host, anchor: { x: 2, y: 2, width: 12, height: 1 }, buildList: () => h.list, maxRows: 6, onPick: () => {} });
  h.loop.renderRoot.flush();

  expect(h.list.rows.bounds.height).toBe(6); // ≤ maxRows visible
  expect(h.list.focused()).toBe(0);

  for (let i = 0; i < 10; i += 1) h.loop.dispatch(keyEvent('down'));
  expect(h.list.focused()).toBe(10); // the shared focused signal (= the bar's value) advanced
  expect(h.list.rows.bounds.height).toBe(6); // still ≤ maxRows visible (virtual scroll)
});

test('Enter on a focused row fires onPick with the selected index and dismisses', () => {
  const h = makeHarness(['a', 'b', 'c']);
  let picked = -1;
  let dismissed = 0;
  openAnchoredPopup({
    host: h.host,
    anchor: { x: 5, y: 3, width: 10, height: 1 },
    buildList: () => h.list,
    onPick: (i) => {
      picked = i;
    },
    onDismiss: () => {
      dismissed += 1;
    },
  });

  h.loop.dispatch(keyEvent('down')); // focused 0 → 1
  h.loop.dispatch(keyEvent('enter')); // activate → selected = 1 → onPick(1) + dismiss

  expect(picked).toBe(1);
  expect(dismissed).toBe(1);
  expect(h.overlay.state.visible).toBe(false);
});

test('a pre-existing selection on the hosted list does not auto-pick on open (first-selection skip)', () => {
  const h = makeHarness(['a', 'b', 'c']);
  h.list.selected.set(2); // stale selection before the popup opens
  let picked = -1;
  openAnchoredPopup({
    host: h.host,
    anchor: { x: 5, y: 3, width: 10, height: 1 },
    buildList: () => h.list,
    onPick: (i) => {
      picked = i;
    },
  });

  expect(picked).toBe(-1); // the initial selection value is skipped — no spurious pick
  expect(h.overlay.state.visible).toBe(true);
});

// ── Drop shadow (TV fidelity: THistoryWindow is a TWindow, shadowSize {2,1}) ─────────────────────

test('the popup frame casts a TV drop shadow', () => {
  const h = makeHarness(['a', 'b', 'c']);
  openAnchoredPopup({ host: h.host, anchor: { x: 5, y: 3, width: 10, height: 1 }, buildList: () => h.list, onPick: () => {} });

  const frame = h.overlay.children.find((c): c is Group => c instanceof Group);
  expect(frame?.castsShadow).toBe(true); // the compose walker paints the shadowSize {2,1} L-shadow
});

// ── No reactive-owner leak (the list's computeds are built inside the popup's createRoot) ─────────

test('building the hosted list inside the popup owner emits no no-owner warning', () => {
  const h = makeHarness(['a', 'b', 'c']);
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (msg?: unknown) => {
    warnings.push(String(msg));
  };
  try {
    // A FRESH ListView built by the factory — its constructor `computed` must be owned by the popup's
    // `createRoot`, not leaked (the regression: it was previously built in the caller's click handler).
    const p = openAnchoredPopup({
      host: h.host,
      anchor: { x: 5, y: 3, width: 10, height: 1 },
      buildList: () => new ListView<string>({ items: signal(['x', 'y']), getText: (s) => s }),
      onPick: () => {},
    });
    p.dismiss();
  } finally {
    console.warn = original;
  }
  expect(warnings.some((w) => w.includes('createRoot'))).toBe(false);
});
