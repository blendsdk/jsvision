/**
 * Specification oracle (immutable) — render-path control-byte safety for a LOADED value.
 *
 * `form.load` applies a raw record straight into the field value signals; the store keeps each value
 * as opaque bytes. This oracle proves the other half of the promise: when a control-byte-laden value
 * arrives via `load()` and is bound to a real `Input` and rendered, nothing unsafe reaches the screen
 * buffer. Sanitization lives in @jsvision/ui — it drops ESC / C0 / C1 on the way in and the screen
 * buffer replaces any surviving C0 / DEL with a space — and the load path never bypasses it. It
 * mirrors `security.spec.test.ts` (the bound-`Input` value path) for the load surface. If this ever
 * fails, the render/bind path is wrong, not this test.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createRoot, createRenderRoot, Input } from '@jsvision/ui';
import { createForm } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// ST-L-SEC (AC-14) — a control-byte string applied via load() is sanitized when rendered via a bound Input.
test('a loaded control-byte string value is sanitized when rendered through a bound Input', async () => {
  const schema = z.object({ text: z.string() });
  const nasty = 'a\x00b\x1b[31mc\x07\r\n\x9b';
  const form = createForm({ schema, initial: { text: '' } });

  const ok = await form.load(async () => ({ text: nasty }));
  expect(ok).toBe(true);
  expect(form.field('text').value()).toBe(nasty); // stored verbatim as inert data

  createRoot((dispose) => {
    const input = new Input({ value: form.field('text').value });
    input.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 1 } };
    const rr = createRenderRoot({ width: 40, height: 1 }, { caps });
    rr.mount(input);
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
