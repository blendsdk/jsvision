/**
 * Specification test (immutable oracle) — `setClipboard` (ST-6).
 *
 * ST-6 (write-only): `setClipboard('copied', caps, mock)` triggers **exactly one** `writeText('copied')`
 * and **never** calls `readText` — the runtime writes the clipboard outbound (on a user gesture) but
 * never reads it. The clipboard bridge is injected (hand-mocked, no jsdom). `.js` per NodeNext.
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { setClipboard } from '@jsvision/web';

const caps = resolveCapabilities({
  env: { COLORTERM: 'truecolor', TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

// ST-6 — one outbound write, zero reads.
test('ST-6: setClipboard writes once and never reads', async () => {
  const mock = {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('')),
  };

  await setClipboard('copied', caps, mock);

  expect(mock.writeText).toHaveBeenCalledTimes(1);
  expect(mock.writeText).toHaveBeenCalledWith('copied');
  expect(mock.readText).not.toHaveBeenCalled();
});
