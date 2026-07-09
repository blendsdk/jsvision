/**
 * Specification test (immutable oracle) — security (ST-9).
 *
 * ST-9 (injection boundary + no exfiltration): untrusted file/paste content carrying a raw `ESC` is
 * neutralized by `@jsvision/core`'s `sanitize()` before it can reach the terminal — no cell ever stores
 * a raw `ESC`, so `serialize()` can never emit the attacker's control sequence. And the virtual FS is
 * pure in-memory: its open/save path issues **no** network request. `.js` per NodeNext.
 */
import { test, expect, vi } from 'vitest';
import { sanitize, resolveCapabilities } from '@jsvision/core';
import { Group, View, createEventLoop } from '@jsvision/ui';
import type { DrawContext, Size2D } from '@jsvision/ui';
import { createBrowserFileSystem } from '@jsvision/web';

const ESC = '\x1b';
const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// ST-9 — sanitize() removes a raw ESC from untrusted content (the canonical injection boundary).
test('ST-9: sanitize strips a raw ESC from untrusted content', () => {
  expect(sanitize(`${ESC}[31mHACK${ESC}[0m`)).not.toContain(ESC);
});

// ST-9 — untrusted content drawn through a view stores no raw ESC in any cell.
test('ST-9: untrusted content rendered through a view leaves no raw ESC in the buffer', () => {
  class Evil extends View {
    override measure(available: Size2D): Size2D {
      return available;
    }
    override draw(ctx: DrawContext): void {
      ctx.text(0, 0, `${ESC}[2J${ESC}[31mHACK`, { fg: 'default', bg: 'default' });
    }
  }

  const loop = createEventLoop({ width: 20, height: 3 }, { caps });
  const root = new Group();
  const evil = new Evil();
  evil.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 3 } };
  root.add(evil);
  loop.mount(root); // paints the initial frame

  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      expect(buf.get(x, y)?.char).not.toBe(ESC);
    }
  }
});

// ST-9 — virtual-FS reads and writes never touch the network.
test('ST-9: virtual-FS operations issue no network request', () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  try {
    const fs = createBrowserFileSystem({ tree: { '/d': { 'a.txt': 'x' } }, home: '/d' });
    fs.readDir('/d');
    fs.writeFile('/d/b.txt', 'y');
    fs.readFile('/d/b.txt');
    fs.rename('/d/b.txt', '/d/c.txt');
    fs.unlink('/d/c.txt');
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
