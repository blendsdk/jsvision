/**
 * Specification tests (immutable oracles) — RD-17 `TabView` container (03-01, 07 ST-1…17/33/34/37/38).
 *
 * RD-17 has NO Turbo Vision counterpart (GATE-1, AR-172) — it is a documented new component. These
 * oracles derive from RD-17 AC-1…AC-15 + the 03-01 spec + the AR/PA rows, NEVER from the
 * implementation: one page visible via a visibility FLIP (no mount/dispose — ST-2), read/render-time
 * clamp (ST-11/12/34), disabled skipped (ST-5/7/9), the global chord fed as REAL decoder bytes
 * (`CSI 6;5~`/`CSI 5;5~`, ST-4/37), Ctrl+Tab inert (ST-6), and the two-`TabView` focus scoping of the
 * chord + Alt-hotkey (ST-37/38, PF-002). `.js` per NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme, decode, createDecoderState } from '@jsvision/core';
import type { KeyEvent, InputEvent } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { TabView } from '../src/tabs/index.js';
import type { Tab } from '../src/tabs/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A synthetic decoded key (no terminal). */
function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** Decode a raw byte sequence through the REAL core decoder, returning its key events (ST-4/37). */
function decodeKeys(bytes: number[]): KeyEvent[] {
  const r = decode(new Uint8Array(bytes), createDecoderState());
  return r.events.filter((e: InputEvent): e is KeyEvent => e.type === 'key');
}
const CSI_CTRL_PGDN = [0x1b, 0x5b, 0x36, 0x3b, 0x35, 0x7e]; // CSI 6;5~  → { pagedown, ctrl }
const CSI_CTRL_PGUP = [0x1b, 0x5b, 0x35, 0x3b, 0x35, 0x7e]; // CSI 5;5~  → { pageup, ctrl }

/** A focusable content leaf that paints `marker` and counts its own disposals (mount/dispose oracle). */
class Leaf extends View {
  override focusable = true;
  override layout = { size: { kind: 'fr' as const, weight: 1 } };
  disposeCount = 0;
  constructor(readonly marker: string) {
    super();
    this.onMount(() => this.onCleanup(() => (this.disposeCount += 1)));
  }
  draw(ctx: DrawContext): void {
    ctx.text(0, 0, this.marker);
  }
}

/** Build a page `Group` wrapping one {@link Leaf} that paints `marker`. */
function page(marker: string): { group: Group; leaf: Leaf } {
  const group = new Group();
  group.layout = { direction: 'col' };
  const leaf = new Leaf(marker);
  group.add(leaf);
  return { group, leaf };
}

interface Hosted {
  loop: ReturnType<typeof createEventLoop>;
  view: TabView;
  buffer(): ReturnType<ReturnType<typeof createEventLoop>['renderRoot']['buffer']>;
  rowText(y: number): string;
  has(ch: string): boolean;
}

/** Mount a `TabView` filling `w×h` under a root Group; returns the loop + buffer helpers. */
function host(view: TabView, w: number, h: number): Hosted {
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const buffer = () => loop.renderRoot.buffer();
  const rowText = (y: number): string =>
    buffer()
      .rows()
      [y].map((c) => c.char)
      .join('');
  const has = (ch: string): boolean =>
    buffer()
      .rows()
      .some((row) => row.some((c) => c.char === ch));
  return { loop, view, buffer, rowText, has };
}

// ---------------------------------------------------------------------------------------------------
// ST-1 / ST-2 — one page visible; switching swaps the page via a FLIP (no mount/dispose).
// ---------------------------------------------------------------------------------------------------

test('ST-1: only the active page is visible; others are omitted from layout', () => {
  const a = page('@');
  const b = page('#');
  const c = page('%');
  const tabs = signal<Tab[]>([
    { title: '~G~eneral', content: a.group },
    { title: '~D~isplay', content: b.group },
    { title: '~A~dvanced', content: c.group },
  ]);
  const active = signal(0);
  const h = host(new TabView({ tabs, active }), 40, 6);
  expect(h.has('@'), 'page A visible').toBe(true);
  expect(h.has('#'), 'page B hidden').toBe(false);
  expect(h.has('%'), 'page C hidden').toBe(false);
});

test('ST-2: setting active swaps the visible page with NO mount/dispose (page state survives)', () => {
  const a = page('@');
  const b = page('#');
  const c = page('%');
  const tabs = signal<Tab[]>([
    { title: 'A', content: a.group },
    { title: 'B', content: b.group },
    { title: 'C', content: c.group },
  ]);
  const active = signal(0);
  const h = host(new TabView({ tabs, active }), 40, 6);

  active.set(2);
  h.loop.renderRoot.flush();
  expect(h.has('%'), 'page C now visible').toBe(true);
  expect(h.has('@'), 'page A now hidden').toBe(false);

  active.set(0);
  h.loop.renderRoot.flush();
  expect(h.has('@'), 'page A visible again').toBe(true);
  // The strong oracle: no page was ever disposed across the round-trip (a visibility flip, not Show).
  expect(a.leaf.disposeCount, 'A never disposed').toBe(0);
  expect(b.leaf.disposeCount, 'B never disposed').toBe(0);
  expect(c.leaf.disposeCount, 'C never disposed').toBe(0);
});

// ---------------------------------------------------------------------------------------------------
// ST-3 — active vs inactive tab role (re-themes on active change, no teardown).
// ---------------------------------------------------------------------------------------------------

test('ST-3: the active tab draws in tabActive, the others in tabInactive; re-themes on change', () => {
  const tabs = signal<Tab[]>([
    { title: '~G~eneral', content: page('@').group },
    { title: '~D~isplay', content: page('#').group },
    { title: '~A~dvanced', content: page('%').group },
  ]);
  const active = signal(1);
  const h = host(new TabView({ tabs, active }), 40, 6);
  const row0 = h.buffer().rows()[0];
  // A non-hotkey cell of each label (avoids the hotkey-accent cell). 'General'@col2 hot(G), 'e'@col3;
  // 'Display'@col12 hot(D), 'i'@col13; 'Advanced'@col≈23 hot(A), 'd'@col24. Locate by char to stay robust.
  const cellOf = (label: string, offset: number) => {
    const txt = row0.map((c) => c.char).join('');
    const at = txt.indexOf(label);
    return row0[at + offset];
  };
  expect(cellOf('eneral', 0).fg, 'inactive tab 0 fg').toBe(defaultTheme.tabInactive.fg);
  expect(cellOf('isplay', 0).fg, 'active tab 1 fg').toBe(defaultTheme.tabActive.fg);

  active.set(0);
  h.loop.renderRoot.flush();
  const row0b = h.buffer().rows()[0];
  const txt = row0b.map((c) => c.char).join('');
  expect(row0b[txt.indexOf('eneral')].fg, 'tab 0 now active').toBe(defaultTheme.tabActive.fg);
});

// ---------------------------------------------------------------------------------------------------
// ST-4 / ST-5 / ST-6 — global cycle from REAL decoder bytes; disabled skipped; Ctrl+Tab inert.
// ---------------------------------------------------------------------------------------------------

test('ST-4: Ctrl+PageDown/Up (real decoder bytes) cycle the active tab from inside the view', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group },
    { title: 'C', content: page('%').group },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const h = host(view, 40, 6);
  h.loop.focusView(view.strip); // focus is inside the view

  const [pgdn] = decodeKeys(CSI_CTRL_PGDN);
  expect(pgdn, 'CSI 6;5~ decodes to a key').toBeTruthy();
  expect(pgdn.key).toBe('pagedown');
  expect(pgdn.ctrl).toBe(true);

  h.loop.dispatch(pgdn);
  expect(active(), 'advanced to tab 1').toBe(1);
  h.loop.dispatch(pgdn);
  expect(active(), 'advanced to tab 2').toBe(2);
  h.loop.dispatch(pgdn);
  expect(active(), 'wraps to tab 0').toBe(0);

  const [pgup] = decodeKeys(CSI_CTRL_PGUP);
  h.loop.dispatch(pgup);
  expect(active(), 'Ctrl+PageUp retreats (wraps back to 2)').toBe(2);
});

test('ST-5: Ctrl+PageDown skips a disabled tab', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group, disabled: true },
    { title: 'C', content: page('%').group },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const h = host(view, 40, 6);
  h.loop.focusView(view.strip);
  const [pgdn] = decodeKeys(CSI_CTRL_PGDN);
  h.loop.dispatch(pgdn);
  expect(active(), 'skips disabled tab 1 → lands on 2').toBe(2);
});

test('ST-6: Ctrl+Tab does NOT switch tabs (byte-identical to plain Tab on the default terminal)', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const h = host(view, 40, 6);
  h.loop.focusView(view.strip);
  h.loop.dispatch(key('tab', { ctrl: true }));
  expect(active(), 'Ctrl+Tab did not change the active tab').toBe(0);
});

// ---------------------------------------------------------------------------------------------------
// ST-7 / ST-8 — strip ←→ cycles; content-focused Tab traverses the page, not the tabs.
// ---------------------------------------------------------------------------------------------------

test('ST-7: with the strip focused, → then ← cycle next-enabled then prev-enabled', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group },
    { title: 'C', content: page('%').group },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const h = host(view, 40, 6);
  h.loop.focusView(view.strip);
  h.loop.dispatch(key('right'));
  expect(active(), '→ next').toBe(1);
  h.loop.dispatch(key('left'));
  expect(active(), '← prev').toBe(0);
});

test('ST-8: a content-focused Tab traverses the page content; the active tab is unchanged', () => {
  const a = page('@');
  const tabs = signal<Tab[]>([
    { title: 'A', content: a.group },
    { title: 'B', content: page('#').group },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const h = host(view, 40, 6);
  h.loop.focusView(a.leaf); // focus a content widget, not the strip
  h.loop.dispatch(key('tab'));
  expect(active(), 'plain Tab never switches tabs').toBe(0);
});

// ---------------------------------------------------------------------------------------------------
// ST-9 — Alt-hotkey jump (skips disabled).
// ---------------------------------------------------------------------------------------------------

test('ST-9: Alt+letter jumps to the matching enabled tab; a disabled match does not jump', () => {
  const tabs = signal<Tab[]>([
    { title: '~G~eneral', content: page('@').group },
    { title: '~D~isplay', content: page('#').group },
    { title: '~A~dvanced', content: page('%').group, disabled: true },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const h = host(view, 40, 6);
  h.loop.focusView(view.strip);
  h.loop.dispatch(key('d', { alt: true }));
  expect(active(), 'Alt+D → Display (tab 1)').toBe(1);
  h.loop.dispatch(key('a', { alt: true }));
  expect(active(), 'Alt+A → Advanced is disabled → no jump').toBe(1);
});

// ---------------------------------------------------------------------------------------------------
// ST-10/11/12 — close + dynamic remove; active clamps to the neighbour.
// ---------------------------------------------------------------------------------------------------

test('ST-10: closing a closeable tab removes it, fires onClose, and re-renders', () => {
  const closed: Array<[string, number]> = [];
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group, closeable: true },
    { title: 'C', content: page('%').group },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active, onClose: (t, i) => closed.push([t.title, i]) });
  host(view, 40, 6);
  view.closeTab(1);
  expect(tabs().map((t) => t.title), 'B removed').toEqual(['A', 'C']);
  expect(closed, 'onClose fired with (tab, index)').toEqual([['B', 1]]);
});

test('ST-11: removing the LAST tab while active clamps active to the new last', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group },
    { title: 'C', content: page('%').group, closeable: true },
  ]);
  const active = signal(2);
  const view = new TabView({ tabs, active });
  host(view, 40, 6);
  view.closeTab(2);
  expect(active(), 'active clamps to the new last (1)').toBe(1);
  expect(active()).toBeLessThan(tabs().length);
});

test('ST-12: removing a MIDDLE tab while active keeps active at the same position (the next tab)', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group, closeable: true },
    { title: 'C', content: page('%').group },
  ]);
  const active = signal(1);
  const view = new TabView({ tabs, active });
  host(view, 40, 6);
  view.closeTab(1);
  expect(active(), 'active stays at position 1 (was C, now index 1)').toBe(1);
  expect(tabs()[active()].title).toBe('C');
});

// ---------------------------------------------------------------------------------------------------
// ST-13/14/17 — snap-to-first-enabled; onChange; select() clamp.
// ---------------------------------------------------------------------------------------------------

test('ST-13: constructing with active on a disabled tab snaps to the first enabled tab', () => {
  const a = page('@');
  const b = page('#');
  const tabs = signal<Tab[]>([
    { title: 'A', content: a.group, disabled: true },
    { title: 'B', content: b.group },
    { title: 'C', content: page('%').group },
  ]);
  const active = signal(0); // points at the disabled tab 0
  const h = host(new TabView({ tabs, active }), 40, 6);
  expect(active(), 'snapped to first enabled (1)').toBe(1);
  expect(h.has('#'), 'page B is the visible page').toBe(true);
  expect(h.has('@'), 'disabled page A is not shown').toBe(false);
});

test('ST-14: onChange fires once with the new index whenever active changes', () => {
  const changes: number[] = [];
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group },
    { title: 'C', content: page('%').group },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active, onChange: (i) => changes.push(i) });
  const h = host(view, 40, 6);
  expect(changes, 'no spurious onChange on the initial render').toEqual([]);
  view.select(2);
  h.loop.renderRoot.flush();
  view.select(1);
  h.loop.renderRoot.flush();
  expect(changes, 'one onChange per real change, with the new index').toEqual([2, 1]);
});

test('ST-17: select() beyond the range clamps into range (no throw)', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group },
    { title: 'C', content: page('%').group },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  host(view, 40, 6);
  expect(() => view.select(5)).not.toThrow();
  expect(active(), 'clamped to the last index (2)').toBe(2);
});

// ---------------------------------------------------------------------------------------------------
// ST-15/16 — empty + all-disabled safety (no crash, no infinite loop).
// ---------------------------------------------------------------------------------------------------

test('ST-15: an empty tabs signal renders a framed empty region with no crash', () => {
  const tabs = signal<Tab[]>([]);
  const active = signal(0);
  const h = host(new TabView({ tabs, active }), 20, 5);
  // Frame still drawn (top-left corner), no label glyphs, no out-of-range access.
  expect(h.buffer().get(0, 0)?.char, 'top-left corner still drawn').toBe('┌');
  expect(h.buffer().get(0, 4)?.char, 'bottom-left corner still drawn').toBe('└');
});

test('ST-16: with ALL tabs disabled, Ctrl+PageDown is a no-op (returns -1, no infinite loop)', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group, disabled: true },
    { title: 'B', content: page('#').group, disabled: true },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const h = host(view, 30, 5);
  h.loop.focusView(view.strip);
  const [pgdn] = decodeKeys(CSI_CTRL_PGDN);
  expect(() => h.loop.dispatch(pgdn)).not.toThrow();
  // No enabled tab ⇒ no page shown; neither page painted its marker.
  expect(h.has('@') || h.has('#'), 'no page is shown when all tabs are disabled').toBe(false);
});

// ---------------------------------------------------------------------------------------------------
// ST-34 — read-time clamp on a raw caller active.set that bypasses select().
// ---------------------------------------------------------------------------------------------------

test('ST-34: a raw out-of-range active.set is re-clamped at render-time (bounds-checked)', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page('@').group },
    { title: 'B', content: page('#').group },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const h = host(view, 30, 5);
  active.set(99); // bypasses select()
  h.loop.renderRoot.flush();
  expect(active(), 'clamped into range').toBeLessThan(tabs().length);
  expect(active()).toBe(1);
  active.set(-5);
  h.loop.renderRoot.flush();
  expect(active(), 'clamped up to 0').toBe(0);
});

// ---------------------------------------------------------------------------------------------------
// ST-33 — a title with a raw escape sequence is sanitized (no raw ESC reaches the buffer).
// ---------------------------------------------------------------------------------------------------

test('ST-33: a tab title containing a raw ESC is sanitized — no ESC byte reaches the buffer', () => {
  const tabs = signal<Tab[]>([{ title: '\x1b[31mX', content: page('@').group }]);
  const active = signal(0);
  const h = host(new TabView({ tabs, active }), 30, 5);
  const anyEsc = h
    .buffer()
    .rows()
    .some((row) => row.some((c) => c.char.includes('\x1b')));
  expect(anyEsc, 'no raw ESC in any rendered cell').toBe(false);
});

// ---------------------------------------------------------------------------------------------------
// ST-37 / ST-38 — two-TabView focus scoping (PF-002): the chord + Alt-hotkey act only on the
// focus-owning view.
// ---------------------------------------------------------------------------------------------------

/** Build two sibling TabViews A,B under one root; focus a content leaf in B. */
function twoTabViews(sharedHotkey: boolean) {
  const aTabs = signal<Tab[]>([
    { title: sharedHotkey ? '~G~en' : 'A0', content: page('@').group },
    { title: sharedHotkey ? '~D~isp' : 'A1', content: page('#').group },
  ]);
  const bLeaf = page('$');
  const bTabs = signal<Tab[]>([
    { title: sharedHotkey ? '~F~oo' : 'B0', content: bLeaf.group },
    { title: sharedHotkey ? '~D~isp' : 'B1', content: page('&').group },
  ]);
  const aActive = signal(0);
  const bActive = signal(0);
  const viewA = new TabView({ tabs: aTabs, active: aActive });
  const viewB = new TabView({ tabs: bTabs, active: bActive });
  viewA.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 6 } };
  viewB.layout = { position: 'absolute', rect: { x: 0, y: 6, width: 20, height: 6 } };
  const root = new Group();
  root.add(viewA);
  root.add(viewB);
  const loop = createEventLoop({ width: 20, height: 12 }, { caps });
  loop.mount(root);
  loop.focusView(bLeaf.leaf); // focus is inside B
  return { loop, aActive, bActive };
}

test('ST-37: Ctrl+PageDown (real bytes) with focus in B advances ONLY B; A is unchanged', () => {
  const { loop, aActive, bActive } = twoTabViews(false);
  const [pgdn] = decodeKeys(CSI_CTRL_PGDN);
  loop.dispatch(pgdn);
  expect(bActive(), 'B (focus owner) advanced').toBe(1);
  expect(aActive(), 'A (not focused) unchanged').toBe(0);
});

test('ST-38: an Alt-hotkey shared by A and B activates ONLY B (the focus owner)', () => {
  const { loop, aActive, bActive } = twoTabViews(true);
  loop.dispatch(key('d', { alt: true })); // both A and B have a ~D~ tab
  expect(bActive(), 'B (focus owner) jumped to its ~D~ tab').toBe(1);
  expect(aActive(), 'A (not focused) unchanged').toBe(0);
});
