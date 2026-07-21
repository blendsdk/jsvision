/**
 * Specification oracle (immutable) — render-path control-byte safety for an ASYNC error message.
 *
 * The store keeps an async validator's returned message as opaque data. This oracle proves that when
 * a control-byte-laden async message is bound to a real `Text` and rendered, nothing unsafe reaches
 * the screen buffer: sanitization lives in @jsvision/ui — the screen buffer drops ESC / C0 / C1 / DEL
 * on the way in — and the forms engine never bypasses it. It mirrors `security.spec.test.ts` (which
 * pins the bound-`Input` value path) for the `field.asyncError()` surface. If this ever fails, the
 * render/bind path is wrong, not this test.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createRoot, createRenderRoot, Text } from '@jsvision/ui';
import { createForm } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

afterEach(() => {
  vi.useRealTimers();
});

// ST-A-SEC (AC-15) — a control-byte async message is sanitized when rendered through a bound Text.
test('an async error message with control bytes is sanitized when rendered through a bound Text', async () => {
  vi.useFakeTimers();
  const nasty = 'a\x00b\x1b[31mc\x07\r\n\x9b';
  const schema = z.object({ username: z.string() });
  const form = createForm({
    schema,
    initial: { username: '' },
    asyncValidators: { username: () => Promise.resolve(nasty) },
  });
  const field = form.field('username');

  field.value.set('trigger'); // sync-clean change → debounced run
  await vi.advanceTimersByTimeAsync(300); // fire the debounce
  await vi.advanceTimersByTimeAsync(0); // settle the (immediate) validator
  expect(field.asyncError()).toBe(nasty); // the engine stored the string as inert data, verbatim

  createRoot((dispose) => {
    // Coerce at the boundary (the getter is typed `() => string`; asyncError() is `string | null`).
    const text = new Text(() => field.asyncError() ?? '', { severity: 'error' });
    text.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 1 } });
    const rr = createRenderRoot({ width: 40, height: 1 }, { caps });
    rr.mount(text);
    for (const row of rr.buffer().rows())
      for (const cell of row) {
        const cp = cell.char.charCodeAt(0);
        // No C0 (< 0x20), DEL (0x7f), or C1 (0x80–0x9f) may reach the buffer. The C1 clause is
        // load-bearing: a raw 0x9b (single-byte CSI) is >= 0x20 and would slip a naive >= 0x20 check.
        expect(cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f), `control byte painted: ${cp}`).toBe(false);
      }
    dispose();
  });
});
