/**
 * Specification tests (immutable oracles) — RD-14 shared anchored-popup primitive.
 *
 * Source: jsvision-ui RD-14 (input-dropdowns/03-02-anchored-popup.md, 07-testing-strategy.md ST-18…
 * ST-23 ↔ AC-8/AC-9, PA-4/PA-5/PA-15). One non-modal popup drives both History + ComboBox: it anchors
 * a `ListView` below a field, computes the TV-faithful clamped placement (grow ±1, fixed height
 * `maxRows+2`, `intersect`-clamp the only row reducer, never flip up), gives the list focus, and
 * routes dismissal (Esc / outside-down consumed / list-focus-loss).
 *
 * Expectations derive from the plan/AC + the GATE-1 decode (03-01 §3), never the implementation. Real
 * objects: a real `EventLoop` supplies the `PopupHost` (overlay + focus save/restore); a real
 * `ListView`; synthetic dispatch; headless.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent, PopupHost } from '../src/view/index.js';
import type { Rect } from '../src/layout/index.js';
import { signal } from '../src/reactive/index.js';
import { ListView } from '../src/list/index.js';
import { createEventLoop } from '../src/event/index.js';
import { openAnchoredPopup } from '../src/dropdown/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false };
}
/** A left mouse-down at 1-based terminal coords (dispatch normalizes 1-based → 0-based, AR-63). */
function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

/** A background pre-process leaf recording events (the non-modal / interactable-after checks). */
class BackgroundLeaf extends View {
  override focusable = true;
  override preProcess = true;
  readonly seen: DispatchEvent[] = [];
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    this.seen.push(ev);
  }
}

interface Harness {
  loop: ReturnType<typeof createEventLoop>;
  overlay: Group;
  host: PopupHost;
  bg: BackgroundLeaf;
  list: ListView<string>;
}

/** Build a mounted loop + overlay + a background focusable, with the popup host wired (like the shell). */
function makeHarness(items: string[], viewport = { width: 40, height: 20 }): Harness {
  const loop = createEventLoop(viewport, { caps });
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height } };
  overlay.state.visible = false;
  const bg = new BackgroundLeaf();
  const root = new Group();
  root.add(bg);
  root.add(overlay);
  loop.mount(root);
  const host: PopupHost = {
    overlay,
    focusView: (v) => loop.focusView(v),
    getFocused: () => loop.getFocused(),
  };
  loop.popupHost = host;
  loop.focusView(bg); // establish the prior focus the popup saves + restores
  const list = new ListView<string>({ items: signal(items), getText: (s) => s });
  return { loop, overlay, host, bg, list };
}

/** The mounted popup frame = the only `Group` child of the overlay (the catcher is a bare `View`). */
function popupFrame(overlay: Group): Group | undefined {
  return overlay.children.find((c): c is Group => c instanceof Group);
}

// ── ST-18: focus on open + derived overlay visibility ───────────────────────────────────────────

test('ST-18: opening a popup focuses the hosted list and shows the overlay (derived)', () => {
  const h = makeHarness(['a', 'b', 'c']);
  openAnchoredPopup({ host: h.host, anchor: { x: 5, y: 3, width: 10, height: 1 }, list: h.list, onPick: () => {} });

  expect(h.loop.getFocused()).toBe(h.list.rows); // the list receives focus on open (PA-15)
  expect(h.overlay.state.visible).toBe(true); // derived visibility (PA-5)
});

// ── ST-19: bottom-edge clamp — fewer rows, never flips up ───────────────────────────────────────

test('ST-19: an anchor near the bottom edge intersect-clamps the popup (fewer rows, no upward flip)', () => {
  const h = makeHarness(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']); // 8 items
  // Anchor 1 row above the bottom of a 20-tall viewport. Unclamped rect = {x:4,y:16,w:12,h:8} (a.y=15?)
  // grow: a.x=4, width=12, a.y = 17-1 = 16, height = maxRows+2 = 8 → bottom 24 > 20 → clamp height to 4.
  openAnchoredPopup({ host: h.host, anchor: { x: 5, y: 17, width: 10, height: 1 }, list: h.list, onPick: () => {} });

  const frame = popupFrame(h.overlay);
  const rect = frame?.layout.rect as Rect;
  expect(rect.y).toBe(16); // top stays 1 row above the anchor — NOT flipped upward (PA-15)
  expect(rect.height).toBe(4); // intersect truncated to the space below (8 → 4)
  expect(rect.height).toBeLessThan(8); // fewer visible rows than the fixed maxRows+2
});

// ── ST-20: entries exceed maxRows → ≤ maxRows visible + a ScrollBar ──────────────────────────────

test('ST-20: with more entries than maxRows, at most maxRows rows are visible (list scrolls)', () => {
  const many = Array.from({ length: 20 }, (_, i) => `item-${i}`);
  const h = makeHarness(many);
  openAnchoredPopup({ host: h.host, anchor: { x: 2, y: 2, width: 12, height: 1 }, list: h.list, maxRows: 6, onPick: () => {} });
  h.loop.renderRoot.flush();

  // Window height = maxRows + 2 = 8; interior (padding 1) = 6 = the list's visible rows.
  expect(h.list.rows.bounds.height).toBe(6);
  expect(h.list.rows.bounds.height).toBeLessThanOrEqual(6); // ≤ maxRows visible with 20 items
});

// ── ST-21: list loses focus (Tab-away) → dismissed via the focusSignal path ──────────────────────

test('ST-21: when the list loses focus the popup dismisses (focus-loss path, PF-004 guard)', () => {
  const h = makeHarness(['a', 'b', 'c']);
  let dismissed = 0;
  openAnchoredPopup({
    host: h.host,
    anchor: { x: 5, y: 3, width: 10, height: 1 },
    list: h.list,
    onPick: () => {},
    onDismiss: () => {
      dismissed += 1;
    },
  });
  expect(h.overlay.state.visible).toBe(true);

  h.loop.focusView(h.bg); // Tab-away: focus leaves the list → focusSignal fires with focused=false

  expect(dismissed).toBe(1);
  expect(h.overlay.state.visible).toBe(false);
  expect(popupFrame(h.overlay)).toBeUndefined(); // list + catcher unmounted
});

// ── ST-22: Esc + outside-down race → dismiss runs once (idempotent) ─────────────────────────────

test('ST-22: dismiss() is idempotent — a double dismissal fires onDismiss exactly once', () => {
  const h = makeHarness(['a', 'b', 'c']);
  let dismissed = 0;
  const popup = openAnchoredPopup({
    host: h.host,
    anchor: { x: 5, y: 3, width: 10, height: 1 },
    list: h.list,
    onPick: () => {},
    onDismiss: () => {
      dismissed += 1;
    },
  });

  popup.dismiss();
  popup.dismiss(); // the double-fire of outside-down + focus-loss must not re-run

  expect(dismissed).toBe(1);
  expect(h.overlay.state.visible).toBe(false);
});

test('ST-22b: Esc dismisses the popup (routed from the popup key handling)', () => {
  const h = makeHarness(['a', 'b', 'c']);
  let dismissed = 0;
  openAnchoredPopup({
    host: h.host,
    anchor: { x: 5, y: 3, width: 10, height: 1 },
    list: h.list,
    onPick: () => {},
    onDismiss: () => {
      dismissed += 1;
    },
  });

  h.loop.dispatch(keyEvent('escape'));

  expect(dismissed).toBe(1);
  expect(h.overlay.state.visible).toBe(false);
});

// ── ST-23: non-modal — background still processes events + interactable after dismiss ────────────

test('ST-23: the popup is non-modal — a background pre-process view still receives events while open', () => {
  const h = makeHarness(['a', 'b', 'c']);
  openAnchoredPopup({ host: h.host, anchor: { x: 5, y: 3, width: 10, height: 1 }, list: h.list, onPick: () => {} });
  h.bg.seen.length = 0;

  h.loop.dispatch(keyEvent('x')); // a non-Esc key: a modal would confine the sweep to the popup subtree

  expect(h.bg.seen.length).toBeGreaterThan(0); // background pre-process still swept → non-modal (AR-132)
});

test('ST-23b: after an outside-click dismissal the UI is interactable (the click is consumed)', () => {
  const h = makeHarness(['a', 'b', 'c']);
  openAnchoredPopup({ host: h.host, anchor: { x: 5, y: 3, width: 10, height: 1 }, list: h.list, onPick: () => {} });

  // An outside mouse-down (top-left, far from the popup at {x:4,y:2}) is caught + consumed → dismiss.
  h.loop.dispatch(mouseDown(1, 1));
  expect(h.overlay.state.visible).toBe(false);

  // The next event reaches the background — the UI is live again.
  h.bg.seen.length = 0;
  h.loop.dispatch(keyEvent('y'));
  expect(h.bg.seen.length).toBeGreaterThan(0);
});
