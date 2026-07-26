/**
 * Immutable requirements for translated FormDialog geometry.
 *
 * Caller dimensions are requested minima because the caller body is opaque. Framework-owned actions
 * may enlarge or wrap the surface within the viewport, while legacy English requests remain exact.
 */
import { expect, test } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { Button, Commands, createEventLoop, Group, measureButtonGroup } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { formDialog } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const schema = z.object({ name: z.string() });

/** Build a real modal host and capture the mounted dialog. */
function host(width: number, height: number, i18n = createI18n()) {
  const root = new Group();
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  let dialog: View | null = null;
  return {
    loop,
    dialog: (): View | null => dialog,
    value: {
      i18n,
      loop,
      desktop: {
        bounds: { x: 0, y: 0, width, height },
        addWindow: (view: View) => {
          dialog = view;
          root.add(view);
        },
        removeWindow: (view: View) => root.remove(view),
      },
    },
  };
}

/** Return every Button below a mounted form dialog. */
function buttons(view: View): readonly Button[] {
  if (!(view instanceof Group)) return [];
  return view.children.flatMap((child) => [...(child instanceof Button ? [child] : []), ...buttons(child)]);
}

const longCancel = createI18n({
  locale: 'de',
  catalogs: [
    defineCatalog({
      schema: 1,
      locale: 'de',
      messages: {
        'forms.action.cancel': '~V~organg vollständig abbrechen',
      },
    }),
  ],
});

test('requested dimensions expand within a feasible viewport for complete translated actions', async () => {
  const h = host(80, 24, longCancel);
  const okText = '~Ä~nderungen übernehmen';
  const pending = formDialog(h.value, {
    schema,
    initial: { name: 'Ada' },
    width: 24,
    height: 6,
    okText,
    body: () => new Group(),
  });
  h.loop.renderRoot.flush();

  const dialog = h.dialog();
  expect(dialog).not.toBeNull();
  const actions = buttons(dialog!);
  expect(actions).toHaveLength(2);
  const metrics = measureButtonGroup(actions, { gap: 2 });
  expect(dialog!.bounds.width).toBeGreaterThanOrEqual(metrics.width + 4);
  expect(dialog!.bounds.width).toBeGreaterThanOrEqual(24);
  expect(dialog!.bounds.height).toBeGreaterThanOrEqual(6);
  expect(actions.every((button) => button.bounds.width >= button.measure().width)).toBe(true);

  h.loop.emitCommand(Commands.cancel);
  await pending;
});

test('legacy English requested dimensions remain exact', async () => {
  const h = host(60, 20);
  const pending = formDialog(h.value, {
    schema,
    initial: { name: 'Ada' },
    width: 44,
    height: 9,
    body: () => new Group(),
  });
  h.loop.renderRoot.flush();

  expect(h.dialog()?.bounds).toMatchObject({ width: 44, height: 9 });

  h.loop.emitCommand(Commands.cancel);
  await pending;
});

test('a hard smaller viewport retains both translated actions in the focus tree', async () => {
  const h = host(24, 7, longCancel);
  const pending = formDialog(h.value, {
    schema,
    initial: { name: 'Ada' },
    width: 20,
    height: 6,
    okText: '~Ä~nderungen übernehmen',
    body: () => new Group(),
  });
  h.loop.renderRoot.flush();
  const actions = buttons(h.dialog()!);

  expect(h.loop.getFocused()).toBe(actions[0]);
  h.loop.focusNext();
  expect(h.loop.getFocused()).toBe(actions[1]);
  expect(actions.every((button) => button.parent !== null && button.focusable)).toBe(true);

  h.loop.emitCommand(Commands.cancel);
  await pending;
});
