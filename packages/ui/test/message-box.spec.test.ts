/**
 * Specification tests (immutable oracles) — the async modal helpers `messageBox`/`confirm`/`inputBox`.
 *
 * Each helper opens a modal `Dialog` over the `{ loop, desktop }` host and resolves once the user
 * dismisses it. The modal is driven headlessly by emitting the terminating command a button would emit
 * (`ok`/`cancel`/`yes`/`no`) or dispatching Esc, then awaiting the helper's promise.
 *
 * Expectations derive from the requirements, never the implementation.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import type { DesktopApplication } from '../src/app/index.js';
import { messageBox, confirm, inputBox } from '../src/dialog/index.js';
import { signal } from '../src/reactive/index.js';
import { Commands } from '../src/status/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function makeApp(): DesktopApplication {
  return createApplication({ caps, viewport: { width: 60, height: 20 } });
}

function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}

// ST-13 — an OK-only message box resolves 'ok' when OK is activated.
test('should resolve ok when the user activates OK on a message box', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'hi' });
  app.loop.renderRoot.flush();
  app.loop.emitCommand(Commands.ok);
  expect(await p).toBe('ok');
});

// ST-14 — an OK/Cancel message box resolves 'cancel' when Cancel is chosen.
test('should resolve cancel when the user cancels an okCancel message box', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'hi', buttons: 'okCancel' });
  app.loop.renderRoot.flush();
  app.loop.emitCommand(Commands.cancel);
  expect(await p).toBe('cancel');
});

// ST-15 — confirm resolves true on Yes.
test('should resolve true when the user chooses Yes on a confirm', async () => {
  const app = makeApp();
  const p = confirm(app, 'Sure?');
  app.loop.renderRoot.flush();
  app.loop.emitCommand(Commands.yes);
  expect(await p).toBe(true);
});

// ST-16 — confirm resolves false on No, and equally on Esc.
test('should resolve false when the user chooses No on a confirm', async () => {
  const app = makeApp();
  const p = confirm(app, 'Sure?');
  app.loop.renderRoot.flush();
  app.loop.emitCommand(Commands.no);
  expect(await p).toBe(false);
});

test('should resolve false when the user dismisses a confirm with Esc', async () => {
  const app = makeApp();
  const p = confirm(app, 'Sure?');
  app.loop.renderRoot.flush();
  app.loop.dispatch(key('escape'));
  expect(await p).toBe(false);
});

// ST-17 — inputBox resolves the entered value on OK.
test('should resolve the entered value when the user activates OK on an input box', async () => {
  const app = makeApp();
  const p = inputBox(app, { title: 'T', label: 'N', value: signal('abc') });
  app.loop.renderRoot.flush();
  app.loop.emitCommand(Commands.ok);
  expect(await p).toBe('abc');
});

// ST-18 — inputBox resolves null on cancel.
test('should resolve null when the user cancels an input box', async () => {
  const app = makeApp();
  const p = inputBox(app, { title: 'T', label: 'N', value: signal('abc') });
  app.loop.renderRoot.flush();
  app.loop.emitCommand(Commands.cancel);
  expect(await p).toBeNull();
});
