/**
 * Immutable consumer oracles for FormDialog localization. The dialog owns its default action text,
 * while a caller-supplied label remains application data.
 */
import { expect, test } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { Commands, Group, createEventLoop } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { formDialog } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const schema = z.object({ name: z.string() });

const formsDutch = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'forms.action.ok': '~G~ereed',
  },
});

function open(okText?: string) {
  const root = new Group();
  const loop = createEventLoop({ width: 48, height: 12 }, { caps });
  loop.mount(root);
  const host = {
    i18n: createI18n({ locale: 'nl', catalogs: [formsDutch] }),
    loop,
    desktop: {
      bounds: { x: 0, y: 0, width: 48, height: 12 },
      addWindow: (view: View) => root.add(view),
      removeWindow: (view: View) => root.remove(view),
    },
  };
  const result = formDialog(host, {
    schema,
    initial: { name: 'Ada' },
    width: 36,
    height: 8,
    body: () => new Group(),
    ...(okText === undefined ? {} : { okText }),
  });
  loop.renderRoot.flush();
  return { loop, result };
}

function screen(loop: ReturnType<typeof createEventLoop>): string {
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

test('FormDialog gets its default OK label from host.i18n', async () => {
  const { loop, result } = open();
  expect(screen(loop)).toContain('Gereed');
  loop.emitCommand(Commands.cancel);
  await expect(result).resolves.toBeNull();
});

test('FormDialog preserves an explicit OK label byte-for-byte', async () => {
  const callerLabel = 'Ω-OK';
  const { loop, result } = open(callerLabel);
  expect(screen(loop)).toContain(callerLabel);
  expect(screen(loop)).not.toContain('Gereed');
  loop.emitCommand(Commands.cancel);
  await expect(result).resolves.toBeNull();
});
