/**
 * Specification test (immutable oracle) — jsvision-ui RD-20 anchored-popup generalization (ST-13).
 *
 * Source: RD-20 AC-13 → ST-13 (plans/date-family/03-03-date-picker.md Part A, PA-5 / AR-204). RD-14's
 * internal `openAnchoredPopup` is generalized from list-only to host **any fixed-size `View`** via
 * `buildContent(commit)` + `contentSize` + `focusTarget`. This oracle drives it with a **non-list**
 * probe view (standing in for the 20×8 `Calendar`): the popup must host + focus the content, close when
 * the content invokes the injected `commit()`, and dismiss on Esc / outside-down **without** committing.
 * The History/ComboBox suites (public API, unchanged) are the separate byte-identical guard (AC-13).
 *
 * Expectations derive from the plan/AC (03-03 Part A) — never the implementation. Real objects: a real
 * `EventLoop` supplies the `PopupHost`; a real focusable content view; synthetic dispatch; headless.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent, PopupHost } from '../src/view/index.js';
import type { Rect } from '../src/layout/index.js';
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

/**
 * A fixed-size, non-list content view (a `Calendar` stand-in): focusable, wires its own activation
 * (Enter) to a value-side effect **then** the popup-injected `commit()` — the ONLY content→dismiss
 * channel under the generalization (no `list.selected()` watch).
 */
class ProbeContent extends View {
  override focusable = true;
  /** How many times the content ran its value-side effect (proof pick-then-close ordering holds). */
  committedValues = 0;
  constructor(private readonly commit: () => void) {
    super();
  }
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key' && inner.key === 'enter') {
      this.committedValues += 1; // value-side effect FIRST (mirrors Calendar writing `value`)
      this.commit(); // …then close via the injected trigger
      ev.handled = true;
    }
  }
}

/** A background focusable establishing the prior focus the popup saves + restores. */
class BackgroundLeaf extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
  override onEvent(_ev: DispatchEvent): void {}
}

interface Harness {
  loop: ReturnType<typeof createEventLoop>;
  overlay: Group;
  host: PopupHost;
  bg: BackgroundLeaf;
}

function makeHarness(viewport = { width: 40, height: 20 }): Harness {
  const loop = createEventLoop(viewport, { caps });
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height } };
  overlay.state.visible = false;
  const bg = new BackgroundLeaf();
  const root = new Group();
  root.add(bg);
  root.add(overlay);
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  loop.focusView(bg);
  return { loop, overlay, host, bg };
}

/** The mounted popup frame = the only `Group` child of the overlay (the catcher is a bare `View`). */
function popupFrame(overlay: Group): Group | undefined {
  return overlay.children.find((c): c is Group => c instanceof Group);
}

/**
 * Open a popup hosting a fresh `ProbeContent`; returns the content ref (captured from inside the
 * popup's reactive owner, as a real caller's `buildContent` would wire it) + a dismiss counter.
 */
function openProbe(h: Harness, opts: { contentSize?: { width?: number; height: number }; anchor?: Rect } = {}) {
  let content: ProbeContent | undefined;
  let dismissed = 0;
  openAnchoredPopup({
    host: h.host,
    anchor: opts.anchor ?? { x: 5, y: 3, width: 10, height: 1 },
    buildContent: (commit) => {
      content = new ProbeContent(commit);
      return content;
    },
    contentSize: opts.contentSize ?? { width: 20, height: 9 }, // Calendar: 20 cols × (8 rows + 1) = 9
    focusTarget: (c) => c, // the content itself is the focus target (not a nested list)
    onDismiss: () => {
      dismissed += 1;
    },
  });
  return {
    get content() {
      return content!;
    },
    get dismissed() {
      return dismissed;
    },
  };
}

// ── ST-13a: open hosts + focuses a non-list content view; overlay shown ─────────────────────────

test('ST-13: opening hosts a non-list View, focuses the focusTarget, and shows the overlay', () => {
  const h = makeHarness();
  const p = openProbe(h);
  expect(h.loop.getFocused()).toBe(p.content); // focusTarget(content) receives focus (not list.rows)
  expect(h.overlay.state.visible).toBe(true);
  expect(popupFrame(h.overlay)).toBeDefined();
});

// ── ST-13b: contentSize drives placement for a wide, tall non-list view ──────────────────────────

test('ST-13: contentSize sizes the popup interior (20×8 for a Calendar-shaped content)', () => {
  const h = makeHarness();
  const p = openProbe(h, { contentSize: { width: 20, height: 9 }, anchor: { x: 2, y: 2, width: 8, height: 1 } });
  h.loop.renderRoot.flush();
  // width: contentSize.width (20) grown ±1 → frame 22, padding-1 interior → 20.
  // height: intermediate contentSize.height+2 = 11, unclamped −1 → 10, padding-1 interior → 8.
  expect(p.content.bounds.width).toBe(20);
  expect(p.content.bounds.height).toBe(8);
});

// ── ST-13c: content activation → injected commit() closes the popup (pick-then-close) ────────────

test('ST-13: the content invoking the injected commit() dismisses the popup (value-effect ran first)', () => {
  const h = makeHarness();
  const p = openProbe(h);
  expect(h.overlay.state.visible).toBe(true);

  h.loop.dispatch(keyEvent('enter')); // the focused content runs its value effect then calls commit()

  expect(p.content.committedValues).toBe(1); // the content's value-side effect ran before closing
  expect(p.dismissed).toBe(1);
  expect(h.overlay.state.visible).toBe(false);
  expect(popupFrame(h.overlay)).toBeUndefined();
});

// ── ST-13d: Esc dismisses WITHOUT committing ─────────────────────────────────────────────────────

test('ST-13: Esc dismisses the popup without running the content commit', () => {
  const h = makeHarness();
  const p = openProbe(h);

  h.loop.dispatch(keyEvent('escape'));

  expect(p.content.committedValues).toBe(0); // Esc is a cancel — no value-side effect
  expect(p.dismissed).toBe(1);
  expect(h.overlay.state.visible).toBe(false);
});

// ── ST-13e: outside mouse-down dismisses WITHOUT committing ──────────────────────────────────────

test('ST-13: an outside mouse-down dismisses the popup without committing', () => {
  const h = makeHarness();
  const p = openProbe(h, { anchor: { x: 20, y: 10, width: 8, height: 1 } });

  h.loop.dispatch(mouseDown(1, 1)); // far from the popup → caught + consumed → dismiss

  expect(p.content.committedValues).toBe(0);
  expect(p.dismissed).toBe(1);
  expect(h.overlay.state.visible).toBe(false);
});

// ── ST-13f: focus-loss dismisses (focusTarget focusSignal path, non-list target) ────────────────

test('ST-13: the content losing focus dismisses the popup (focusTarget focus-loss path)', () => {
  const h = makeHarness();
  const p = openProbe(h);
  expect(h.overlay.state.visible).toBe(true);

  h.loop.focusView(h.bg); // focus leaves the content → focusSignal fires with focused=false

  expect(p.dismissed).toBe(1);
  expect(h.overlay.state.visible).toBe(false);
});
