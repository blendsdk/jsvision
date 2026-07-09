/**
 * Specification test (immutable oracle) — `buildBrowserCaps` (ST-7).
 *
 * The browser profile is truecolor + UTF-8 by default, and its `colorDepth` is overridable so a lower
 * depth makes the *existing* `serialize()` downsample chain kick in — no new downsample code. ST-7
 * proves the override drives the chain: a known truecolor background emits a truecolor SGR at the
 * default depth and a 16-colour SGR (no `48;2` truecolor sequence) at `colorDepth: '16'`.
 *
 * `.js` specifiers per NodeNext.
 */
import { test, expect } from 'vitest';
import { serialize, ScreenBuffer } from '@jsvision/core';
import { buildBrowserCaps } from '@jsvision/web';

/** A 1×1 buffer whose only cell carries a known truecolor background (`#0000a8`, DOS blue). */
function blueCell(): ScreenBuffer {
  const buf = new ScreenBuffer(1, 1, { fg: 'default', bg: 'default' });
  buf.set(0, 0, 'X', { fg: 'default', bg: '#0000a8' });
  return buf;
}

// ST-7 — the default profile is truecolor and serialize() emits the truecolor background SGR.
test('ST-7: default caps are truecolor and emit a truecolor background SGR', () => {
  const caps = buildBrowserCaps();
  expect(caps.colorDepth).toBe('truecolor');
  const out = serialize(blueCell(), null, { caps });
  expect(out).toContain('48;2;0;0;168');
});

// ST-7 — colorDepth:'16' drives the downsample chain: the same truecolor bg becomes a 16-colour SGR.
test('ST-7: colorDepth:16 downsamples the truecolor background to a 16-colour SGR', () => {
  const caps = buildBrowserCaps({ colorDepth: '16' });
  expect(caps.colorDepth).toBe('16');
  const out = serialize(blueCell(), null, { caps });
  expect(out).not.toContain('48;2'); // no truecolor sequence survived
  expect(out).toContain('44'); // DOS blue as a 16-colour background (matches encode('#0000a8','bg','16'))
});
