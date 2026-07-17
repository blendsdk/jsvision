/**
 * Specification oracle (immutable) — render-path control-byte safety for a value bound inside a
 * `formDialog()` body.
 *
 * `formDialog` adds no raw-control render path of its own: a control-byte-laden string initialised
 * into a form field and bound to a widget in the dialog body must be sanitized on the way to the
 * screen — sanitization lives in @jsvision/ui (the screen buffer drops ESC / C0 / C1 / DEL), and the
 * forms engine never bypasses it. This mirrors `security.spec.test.ts` (the bound-`Input` value
 * path) for the modal-dialog surface. If this ever fails, the render/bind path is wrong, not the test.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createEventLoop, Commands, Group, Input } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { formDialog } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A fake execView host that mounts added windows into a live render root. */
function makeHost(w = 60, h = 20) {
  const root = new Group();
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const host = {
    loop,
    desktop: {
      addWindow: (v: View) => root.add(v),
      removeWindow: (v: View) => root.remove(v),
      bounds: { x: 0, y: 0, width: w, height: h },
    },
  };
  return { loop, host };
}

// ST-D-SEC (RD-08 AC #13) — a control-byte value bound in the dialog body is sanitized when rendered.
test('ST-D-SEC a control-byte field value bound in a formDialog body never paints a control byte', async () => {
  const nasty = 'a\x00b\x1b[31mc\x9b'; // NUL, ESC-CSI, and a raw C1 (0x9b) — none may reach the buffer
  const schema = z.object({ name: z.string() });
  const { loop, host } = makeHost();

  const p = formDialog(host, {
    schema,
    initial: { name: nasty },
    width: 44,
    height: 9,
    body: (form) => {
      const g = new Group();
      const input = new Input({ value: form.field('name').value });
      input.layout = { position: 'absolute', rect: { x: 2, y: 1, width: 30, height: 1 } };
      g.add(input);
      return g;
    },
  });

  await Promise.resolve(); // let the open frame paint

  for (const row of loop.renderRoot.buffer().rows())
    for (const cell of row) {
      const cp = cell.char.charCodeAt(0);
      // No C0 (< 0x20), DEL (0x7f), or C1 (0x80–0x9f) may reach the buffer. The C1 clause is
      // load-bearing: a raw 0x9b (single-byte CSI) is >= 0x20 and would slip a naive >= 0x20 check.
      expect(cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f), `control byte painted: ${cp}`).toBe(false);
    }

  loop.emitCommand(Commands.cancel);
  await p;
});
