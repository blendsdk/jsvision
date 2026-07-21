/**
 * Specification oracle (immutable) — render-path control-byte safety for @jsvision/forms.
 *
 * The store keeps a field's value as opaque bytes (a sibling impl test pins that round-trip). This
 * oracle proves the other half of the promise: when a control-byte-laden value is bound to a real
 * Input and rendered, nothing unsafe reaches the screen buffer. Sanitization lives in @jsvision/ui —
 * it drops ESC / C0 / C1 on the way in and the screen buffer replaces any surviving C0 / DEL with a
 * space — and the forms engine never bypasses it. If this ever fails, the render/bind path is wrong,
 * not this test.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createRoot, createRenderRoot, Input } from '@jsvision/ui';
import { createForm } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

test('a control-byte field value is sanitized when rendered through a bound Input', () => {
  const schema = z.object({ text: z.string() });
  const nasty = 'a\x00b\x1b[31mc\x07\r\n\x9b';
  const form = createForm({ schema, initial: { text: '' } });
  form.field('text').value.set(nasty);

  createRoot((dispose) => {
    const input = new Input({ value: form.field('text').value });
    input.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 1 } });
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
