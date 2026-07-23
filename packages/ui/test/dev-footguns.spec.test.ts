/**
 * Specification tests (immutable oracles) — the six silent layout/focus/command footguns.
 *
 * Derived from the requirement that each of these conditions, which today fails silently (a blank
 * screen, an invisible view, a dead keystroke), instead names the offending view **and the fix**.
 *
 * The oracles assert behaviour, not phrasing: a warning must fire, must be tagged with the right
 * subsystem scope, must identify the view by its class name, and must contain the token a developer
 * would act on (`measure`, `position`, `rect`, the focusable child's name, the command name,
 * `invalidate`). Exact wording is free to improve.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group, reflow, at } from '../src/view/index.js';
import { Scroller } from '../src/scroll/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { resetDevWarnings } from '../src/shared/warnings.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A leaf with no `measure()` — the shape a newcomer writes for a custom widget. */
class Unmeasured extends View {
  draw(_ctx: DrawContext): void {}
}

/** A leaf that reports a real natural size, so it never trips the `measure` footgun. */
class Sized extends View {
  draw(_ctx: DrawContext): void {}
  override measure(): { width: number; height: number } {
    return { width: 4, height: 1 };
  }
}

/**
 * Capture every developer warning raised by `body`, including the ones whose verdict is deferred so
 * that a container which places its children while painting is never falsely accused.
 */
async function captureWarnings(body: () => void): Promise<string[]> {
  const lines: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  try {
    body();
    await Promise.resolve(); // let the deferred re-test run
  } finally {
    warn.mockRestore();
  }
  return lines;
}

afterEach(() => {
  resetDevWarnings();
  vi.restoreAllMocks();
});

// --- Footgun 1: an `auto` leaf with no measure() collapses to {0,0} ------------------------------

test('a custom View with no measure() and auto sizing warns that it laid out to nothing', async () => {
  const root = new Group();
  root.setLayout({ direction: 'col' });
  const widget = new Unmeasured();
  root.add(widget);

  const lines = await captureWarnings(() => reflow(root, { width: 40, height: 10 }));

  const warning = lines.find((line) => line.includes('Unmeasured'));
  expect(warning).toBeDefined();
  expect(warning).toContain('[jsvision/ui layout]');
  expect(warning).toContain('measure'); // names the fix, not just the symptom
});

test('a leaf that supplies measure() does not warn', async () => {
  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.add(new Sized());

  const lines = await captureWarnings(() => reflow(root, { width: 40, height: 10 }));

  expect(lines.filter((line) => line.includes('Sized'))).toEqual([]);
});

test('an empty auto Group does not warn — it has no children to have collapsed', async () => {
  const root = new Group();
  root.setLayout({ direction: 'col' });
  const empty = new Group();
  root.add(empty);

  const lines = await captureWarnings(() => reflow(root, { width: 40, height: 10 }));

  expect(lines).toEqual([]);
});

// --- Footgun 2: an `auto` Group whose children are all out-of-flow collapses -----------------------

test('an auto Group whose children are all absolute warns that its children are clipped away', async () => {
  const child = new Sized();
  child.setLayout({ position: 'absolute', rect: { x: 1, y: 1, width: 10, height: 1 } });
  const panel = new Group();
  panel.add(child);
  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.add(panel);

  const lines = await captureWarnings(() => reflow(root, { width: 40, height: 10 }));

  const warning = lines.find((line) => line.includes('Group') && line.includes('absolute'));
  expect(warning).toBeDefined();
  expect(warning).toContain('[jsvision/ui layout]');
  expect(warning).toContain("position: 'fill'"); // the documented remedy
});

test('an auto Group with at least one flow child does not warn', async () => {
  const flowing = new Sized();
  const overlay = new Sized();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 5, height: 1 } });
  const panel = new Group();
  panel.add(flowing);
  panel.add(overlay);
  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.add(panel);

  const lines = await captureWarnings(() => reflow(root, { width: 40, height: 10 }));

  expect(lines).toEqual([]);
});

// --- Footgun 3: rect without absolute, absolute without rect --------------------------------------

test('a rect set without position:absolute warns that the rect is ignored', async () => {
  const widget = new Sized();
  widget.setLayout({ rect: { x: 5, y: 2, width: 10, height: 3 } });
  const root = new Group();
  root.add(widget);

  const lines = await captureWarnings(() => reflow(root, { width: 40, height: 10 }));

  const warning = lines.find((line) => line.includes('Sized'));
  expect(warning).toBeDefined();
  expect(warning).toContain('[jsvision/ui layout]');
  expect(warning).toContain("position: 'absolute'");
});

test('position:absolute with no rect warns that the view resolves to a zero rect', async () => {
  const widget = new Sized();
  widget.setLayout({ position: 'absolute' });
  const root = new Group();
  root.add(widget);

  const lines = await captureWarnings(() => reflow(root, { width: 40, height: 10 }));

  const warning = lines.find((line) => line.includes('Sized'));
  expect(warning).toBeDefined();
  expect(warning).toContain('rect');
});

test('position:absolute with a rect does not warn', async () => {
  const widget = new Sized();
  widget.setLayout({ position: 'absolute', rect: { x: 1, y: 1, width: 4, height: 1 } });
  const root = new Group();
  root.add(widget);

  const lines = await captureWarnings(() => reflow(root, { width: 40, height: 10 }));

  expect(lines).toEqual([]);
});

// --- Footgun 4: focusView() on a non-focusable container ------------------------------------------

test('focusView on a non-focusable container names the focusable child to target instead', async () => {
  const button = new Sized();
  button.focusable = true;
  const panel = new Group();
  panel.add(button);
  const root = new Group();
  root.add(panel);

  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const lines = await captureWarnings(() => loop.focusView(panel));

  expect(loop.getFocused()).toBeNull(); // still a no-op — the diagnostic does not change behaviour
  const warning = lines.find((line) => line.includes('focusView'));
  expect(warning).toBeDefined();
  expect(warning).toContain('[jsvision/ui focus]');
  expect(warning).toContain('Sized'); // names the focusable descendant, not just "not focusable"
});

test('focusView on a container with nothing focusable says so', async () => {
  const panel = new Group();
  panel.add(new Sized());
  const root = new Group();
  root.add(panel);

  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const lines = await captureWarnings(() => loop.focusView(panel));

  expect(lines.some((line) => line.includes('[jsvision/ui focus]'))).toBe(true);
});

test('focusView on a focusable leaf focuses it and warns about nothing', async () => {
  const button = new Sized();
  button.focusable = true;
  const root = new Group();
  root.add(button);

  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const lines = await captureWarnings(() => loop.focusView(button));

  expect(loop.getFocused()).toBe(button);
  expect(lines).toEqual([]);
});

// --- Footgun 5: a command no view handles ---------------------------------------------------------

test('a command that no view handles warns, naming the command', async () => {
  const root = new Group();
  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const lines = await captureWarnings(() => loop.emitCommand('sve'));

  const warning = lines.find((line) => line.includes('sve'));
  expect(warning).toBeDefined();
  expect(warning).toContain('[jsvision/ui command]');
});

test('a command with a registered onCommand handler does not warn', async () => {
  const root = new Group();
  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);
  loop.onCommand('save', () => undefined);

  const lines = await captureWarnings(() => loop.emitCommand('save'));

  expect(lines).toEqual([]);
});

// --- Footgun 6: mutating state.visible / state.disabled without invalidating -----------------------

test('mutating state.visible on a mounted view without invalidating warns', async () => {
  const widget = new Sized();
  const root = new Group();
  root.add(widget);

  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const lines: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  widget.state.visible = false;
  await Promise.resolve(); // the check is deferred, so a synchronous invalidate() still counts
  warn.mockRestore();

  const warning = lines.find((line) => line.includes('Sized'));
  expect(warning).toBeDefined();
  expect(warning).toContain('[jsvision/ui view]');
  expect(warning).toContain('visible');
  expect(warning).toContain('invalidate');
});

test('mutating state.visible followed by invalidate() does not warn', async () => {
  const widget = new Sized();
  const root = new Group();
  root.add(widget);

  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const lines: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  widget.state.visible = false;
  widget.invalidate();
  await Promise.resolve();
  warn.mockRestore();

  expect(lines).toEqual([]);
});

test('mutating state.disabled without invalidating warns', async () => {
  const widget = new Sized();
  const root = new Group();
  root.add(widget);

  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const lines: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  widget.state.disabled = true;
  await Promise.resolve();
  warn.mockRestore();

  expect(lines.some((line) => line.includes('disabled'))).toBe(true);
});

test('an unmounted view never warns about its state — nothing is painting it yet', async () => {
  const widget = new Sized();

  const lines: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  widget.state.visible = false;
  await Promise.resolve();
  warn.mockRestore();

  expect(lines).toEqual([]);
});

test('state.visible keeps its value through the accessor', () => {
  const widget = new Sized();

  expect(widget.state.visible).toBe(true);
  widget.state.visible = false;
  expect(widget.state.visible).toBe(false);
  widget.state.disabled = true;
  expect(widget.state.disabled).toBe(true);
});

// --- No false accusations: the verdict waits for the frame to settle -------------------------------

test('a container that assigns its children bounds while painting is never accused', async () => {
  // A `Scroller` gives its content and owned bars their bounds in draw(), so at reflow time those
  // children still hold the degenerate rects the flex pass produced. Judging then would report every
  // scroll bar in every app as invisible.
  const content = new Group();
  content.add(at(new Sized(), 0, 0, 30, 20));
  const scroller = new Scroller({ content, extent: { width: 30, height: 20 }, scrollbars: 'both' });
  const root = new Group();
  root.add(at(scroller, 0, 0, 24, 8));

  const loop = createEventLoop({ width: 24, height: 8 }, { caps });

  const lines: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  loop.mount(root);
  loop.renderRoot.flush(); // the frame in which the Scroller places its children
  await Promise.resolve();
  warn.mockRestore();

  expect(lines).toEqual([]);
});

test('a repeating condition warns once even as the message changes with each new size', async () => {
  const widget = new Unmeasured();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.add(widget);

  const lines: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  // The same broken view laid out at three terminal sizes: one condition, three different rects.
  for (const height of [10, 20, 30]) {
    reflow(root, { width: 40, height });
    await Promise.resolve();
  }
  warn.mockRestore();

  expect(lines.length).toBe(1);
});
