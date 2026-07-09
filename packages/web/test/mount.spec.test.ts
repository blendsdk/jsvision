/**
 * Specification test (immutable oracle) — `mountApp` (ST-10, Should-Have).
 *
 * `mountApp` is the browser mirror of `run()`: it wires an `@jsvision/ui` application's loop to a
 * terminal (frame/caret/clipboard sinks, first paint, resize, optional focus) in a few lines. ST-10
 * boots it end-to-end over an `@xterm/headless` terminal + a trivial app and asserts (a) the first
 * frame paints a non-empty terminal buffer and (b) a byte fed to the terminal's `onData` decodes and
 * reaches the app's loop.
 *
 * The terminal here is a thin wrapper that backs writes with a real `@xterm/headless` emulator (so the
 * buffer is real) while capturing the host's `onData` handler so the test can inject input. It has no
 * `focus()` — proving `mountApp` calls it optionally. `.js` per NodeNext.
 */
import { test, expect, vi } from 'vitest';
import xtermHeadless from '@xterm/headless';
import type { Terminal as XTerm } from '@xterm/headless';
import { createApplication, Window } from '@jsvision/ui';
import { buildBrowserCaps, mountApp } from '@jsvision/web';

const { Terminal } = xtermHeadless;

/** True if any cell in the emulator grid holds a visible (non-space) glyph. */
function hasContent(term: XTerm): boolean {
  const active = term.buffer.active;
  for (let y = 0; y < term.rows; y += 1) {
    const line = active.getLine(y);
    if (!line) continue;
    for (let x = 0; x < term.cols; x += 1) {
      const chars = line.getCell(x)?.getChars();
      if (chars && chars !== ' ') return true;
    }
  }
  return false;
}

// ST-10 — mountApp paints a first frame and routes a decoded key into the app's loop.
test('ST-10: mountApp paints a non-empty first frame and routes a key to the app', async () => {
  const headless = new Terminal({ cols: 40, rows: 12, allowProposedApi: true });
  let dataHandler: ((data: string) => void) | undefined;
  const term = {
    write: (data: string) => {
      headless.write(data);
    },
    onData: (handler: (data: string) => void) => {
      dataHandler = handler; // capture so the test can inject input
      return { dispose: () => (dataHandler = undefined) };
    },
    onResize: (handler: (size: { cols: number; rows: number }) => void) => headless.onResize(handler),
  };

  const caps = buildBrowserCaps();
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const win = new Window('Demo');
  win.layout.rect = { x: 1, y: 1, width: 20, height: 6 };
  app.desktop.addWindow(win);

  const dispatchSpy = vi.spyOn(app.loop, 'dispatch');
  const mounted = mountApp({ element: { tagName: 'div' }, app, caps, term });

  // Flush the emulator's write queue (a trailing empty write resolves after prior writes parse).
  await new Promise<void>((resolve) => headless.write('', () => resolve()));
  expect(hasContent(headless)).toBe(true);

  dataHandler?.('\x1b[A'); // an up-arrow byte sequence arrives from the terminal
  expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'key', key: 'up' }));

  mounted.dispose();
});
