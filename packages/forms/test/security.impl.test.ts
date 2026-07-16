/**
 * Security assertion for @jsvision/forms.
 *
 * The store is a transparent data holder: it stores exactly the string a widget produced
 * and performs no encoding, escaping, or sanitization of its own. Control-byte safety is
 * the render layer's responsibility (text is written through the sanitizing screen
 * buffer), never bypassed here — the store never renders. This test pins that contract:
 * a control-byte-laden value round-trips byte-for-byte through the field and the coerced
 * output, unchanged.
 */
import { test, expect } from 'vitest';
import { z } from 'zod';
import { createForm } from '../src/index.js';

test('security: the store round-trips control bytes as opaque data, adding no encoding', () => {
  const schema = z.object({ text: z.string() });
  const nasty = 'a\x00b\x1b[31mc\x07\r\n\x9b';
  const f = createForm({ schema, initial: { text: '' } });

  f.field('text').value.set(nasty);

  expect(f.field('text').value.peek()).toBe(nasty);
  expect(f.rawValues().text).toBe(nasty);
  expect(f.values()).toEqual({ text: nasty });
});
