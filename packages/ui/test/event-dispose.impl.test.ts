/**
 * Implementation edges for permanent event-loop disposal.
 *
 * The lifecycle contract is exercised through public methods so a disposed long-lived host cannot
 * retain focus paths or application command closures from a previous mounted tree.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Button, createEventLoop, Group, at } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

test('clears focus and command handlers when the mounted tree is disposed', () => {
  const root = new Group();
  const button = at(new Button('Probe'), 0, 0, 9, 2);
  root.add(button);
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  loop.mount(root);
  loop.focusView(button);
  let calls = 0;
  loop.onCommand('probe', () => {
    calls += 1;
  });

  loop.dispose();
  loop.emitCommand('probe');

  expect(root.mounted).toBe(false);
  expect(loop.getFocused()).toBeNull();
  expect(calls).toBe(0);
});

test('settles and releases every active modal when disposed', async () => {
  const root = new Group();
  const first = at(new Button('First'), 0, 0, 9, 2);
  const second = at(new Button('Second'), 10, 0, 10, 2);
  root.add(first);
  root.add(second);
  const loop = createEventLoop({ width: 24, height: 5 }, { caps });
  loop.mount(root);

  const firstResult = loop.execView<string>(first);
  const secondResult = loop.execView<number>(second);
  loop.dispose();

  await expect(secondResult).resolves.toBeUndefined();
  await expect(firstResult).resolves.toBeUndefined();
  expect(loop.getFocused()).toBeNull();
  expect(first.mounted).toBe(false);
  expect(second.mounted).toBe(false);
});
