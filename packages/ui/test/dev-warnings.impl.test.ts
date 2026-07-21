/**
 * Implementation tests — internals of the developer-warning sink and the state-write tracker.
 *
 * The spec oracles cover the contract; these cover the mechanics that keep it safe under real
 * conditions: session nesting, the buffer's safety cap, unbalanced calls, and the rule that decides
 * when a state write counts as accounted for.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { devWarn, beginScreenSession, endScreenSession, resetDevWarnings } from '../src/shared/warnings.js';
import { Group, View, reflow } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A leaf that reports a real natural size, so it never trips the layout footguns. */
class Sized extends View {
  draw(_ctx: DrawContext): void {}
  override measure(): { width: number; height: number } {
    return { width: 4, height: 1 };
  }
}

/** A leaf with no `measure()` — it collapses, and so trips the layout diagnostic. */
class Unmeasured extends View {
  draw(_ctx: DrawContext): void {}
}

afterEach(() => {
  resetDevWarnings();
  vi.restoreAllMocks();
});

// --- the sink ------------------------------------------------------------------------------------

test('a nested session does not flush while the outer one still owns the screen', () => {
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  beginScreenSession();
  beginScreenSession();
  devWarn('layout', 'inner');
  endScreenSession(); // inner session ends — the outer one still holds the terminal

  expect(stderr).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();

  endScreenSession(); // outer session ends — now it is safe
  expect(String(stderr.mock.calls[0]?.[0])).toContain('inner');
});

test('endScreenSession with no session open is a harmless no-op', () => {
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  endScreenSession();
  devWarn('layout', 'after an unbalanced end');

  expect(stderr).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledTimes(1); // still treated as "nothing owns the screen"
});

test('the withheld buffer is capped, so a pathological producer cannot grow it without limit', () => {
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  beginScreenSession();
  for (let i = 0; i < 500; i++) devWarn('layout', `distinct message ${i}`);
  endScreenSession();

  const flushed = String(stderr.mock.calls[0]?.[0]).split('\n').filter(Boolean);
  expect(flushed.length).toBe(100);
  expect(flushed[0]).toContain('distinct message 0'); // the earliest are kept — they name the root cause
});

test('resetDevWarnings drops an open session along with the buffer', () => {
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  beginScreenSession();
  devWarn('layout', 'discarded');
  resetDevWarnings();

  devWarn('layout', 'discarded'); // the de-dup memory is gone, and so is the session
  expect(warn).toHaveBeenCalledTimes(1);
  expect(stderr).not.toHaveBeenCalled();
});

// --- state-write tracking ------------------------------------------------------------------------

test('a write that sets the value it already had arms nothing', async () => {
  const widget = new Sized();
  const root = new Group();
  root.add(widget);
  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  widget.state.visible = true; // already true
  widget.state.disabled = false; // already false
  await Promise.resolve();

  expect(warn).not.toHaveBeenCalled();
});

test('one relayout accounts for visibility flips across several sibling views', async () => {
  const a = new Sized();
  const b = new Sized();
  const root = new Group();
  root.add(a);
  root.add(b);
  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  // The framework's own pattern: flip a set of siblings, then relayout once for all of them.
  a.state.visible = false;
  b.state.visible = false;
  root.invalidateLayout();
  await Promise.resolve();

  expect(warn).not.toHaveBeenCalled();
});

test("a repaint of one view does not account for a sibling's write", async () => {
  const a = new Sized();
  const b = new Sized();
  const root = new Group();
  root.add(a);
  root.add(b);
  const loop = createEventLoop({ width: 40, height: 10 }, { caps });
  loop.mount(root);

  const lines: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  a.state.disabled = true;
  b.invalidate(); // repaints b — a's write is still unaccounted for
  await Promise.resolve();
  warn.mockRestore();

  expect(lines.length).toBe(1);
});

test('two flags written before the check are reported together, in one warning', async () => {
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
  widget.state.disabled = true;
  await Promise.resolve();
  warn.mockRestore();

  expect(lines.length).toBe(1);
  expect(lines[0]).toContain('state.visible');
  expect(lines[0]).toContain('state.disabled');
});

// --- layout diagnostics --------------------------------------------------------------------------

test('the root is exempt — it is sized by the viewport, not by its own props', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  // A bare auto Group as the root, laid out into a zero viewport: degenerate, but not the developer's
  // mistake — nothing about the root's own props caused it.
  reflow(new Group(), { width: 0, height: 0 });

  expect(warn).not.toHaveBeenCalled();
});

test('a zero-sized fixed view is not accused — it asked for exactly that size', () => {
  const spacer = new Sized();
  spacer.setLayout({ size: { kind: 'fixed', cells: 0 } });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.add(spacer);

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  reflow(root, { width: 40, height: 10 });

  expect(warn).not.toHaveBeenCalled();
});

test('a hidden view is left out of layout entirely, so it is never diagnosed', () => {
  // Unmeasured: it *would* trip the collapse diagnostic if it were laid out at all.
  const widget = new Unmeasured();
  widget.state.visible = false;
  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.add(widget);

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  reflow(root, { width: 40, height: 10 });

  expect(warn).not.toHaveBeenCalled();
});
