/**
 * Specification tests (immutable oracles) — Tab-traversal order of `formDialog()`.
 *
 * The dialog's OK/Cancel pair is being recomposed from two individually-placed buttons into a single
 * centred band. Their *positions* may move; the **order the user Tabs through the dialog must not**:
 * the caller's body fields come first, in the order the body built them, then OK, then Cancel.
 *
 * Cancel is deliberately reachable by Tab even though it declines to take focus on a mouse click —
 * declining a click-to-focus must not remove it from the keyboard path.
 *
 * Expectations derive from the dialog's documented contract (the body binds the fields; OK submits;
 * Cancel discards), never from the implementation. Focus is driven through the PUBLIC loop surface
 * (`focusNext`/`getFocused`). The `.js` extension in import specifiers is required by NodeNext ESM
 * resolution.
 */
import { test, expect } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createEventLoop, Commands, Group, Input, Button } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { formDialog } from '../src/index.js';
import type { Form } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const Schema = z.object({ name: z.string().min(1, 'Required'), port: z.coerce.number().int().min(1) });
type Init = { name: string; port: string };
const initial: Init = { name: '', port: '8080' };

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

test('ST-T3: formDialog Tab-traverses [body field, OK, Cancel] and wraps', async () => {
  const { loop, host } = makeHost();
  let field!: Input;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    body: (f: Form<typeof Schema, Init>) => {
      const g = new Group();
      field = new Input({ value: f.field('name').value });
      field.layout = { position: 'absolute', rect: { x: 2, y: 1, width: 24, height: 1 } };
      g.add(field);
      return g;
    },
  });
  loop.renderRoot.flush();

  // The modal opens on the body's first focusable — the field the caller bound.
  expect(loop.getFocused()).toBe(field);

  // The buttons are identified by their `~X~` hotkey, so this survives their move into a band.
  loop.focusNext();
  const afterField = loop.getFocused();
  expect(afterField).toBeInstanceOf(Button);
  expect((afterField as Button).accelerators()[0]).toBe('o'); // OK

  loop.focusNext();
  const afterOk = loop.getFocused();
  expect(afterOk).toBeInstanceOf(Button);
  expect((afterOk as Button).accelerators()[0]).toBe('c'); // Cancel — Tab-reachable

  loop.focusNext();
  expect(loop.getFocused()).toBe(field); // wraps back to the body

  loop.emitCommand(Commands.cancel);
  await p;
});
