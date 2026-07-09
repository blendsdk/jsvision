/**
 * Implementation tests — `setClipboard` internals/edges (beyond the ST-6 oracle): a gesture-gated
 * rejection propagates to the caller, and an absent clipboard is a graceful no-op. `.js` per NodeNext.
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { setClipboard } from '@jsvision/web';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// A browser rejects writeText without a user gesture; the rejection propagates for the caller to catch.
test('a rejected write propagates (gesture-gated)', async () => {
  const rejecting = { writeText: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) };
  await expect(setClipboard('x', caps, rejecting)).rejects.toThrow('NotAllowedError');
  expect(rejecting.writeText).toHaveBeenCalledTimes(1);
});

// With no injected bridge and no global clipboard, the call resolves to a no-op instead of throwing.
test('an absent clipboard is a graceful no-op', async () => {
  vi.stubGlobal('navigator', undefined);
  try {
    await expect(setClipboard('x', caps)).resolves.toBeUndefined();
  } finally {
    vi.unstubAllGlobals();
  }
});
