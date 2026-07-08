/**
 * Implementation tests — modal-helper sizing edges, the input-box validator veto, and the OK-only
 * message-box Esc behavior.
 *
 * Covers behaviors the spec oracles imply but do not pin: the boxes size within their min/max clamp;
 * an invalid field vetoes OK, keeps the box open, and refocuses the field; and an OK-only message box
 * resolves `'cancel'` on Esc (the box closes — it does not stay open until OK).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { messageBox, inputBox } from '../src/dialog/index.js';
import { Input, range } from '../src/controls/index.js';
import { signal } from '../src/reactive/index.js';
import type { View } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function makeApp(): ReturnType<typeof createApplication> {
  return createApplication({ caps, viewport: { width: 80, height: 24 } });
}

function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}

/** All descendants of a view (children walk). */
function descendants(v: View): View[] {
  const out: View[] = [];
  const kids = (v as unknown as { children?: View[] }).children ?? [];
  for (const c of kids) out.push(c, ...descendants(c));
  return out;
}

test('should clamp an OK-only message box to its min width for short text', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'hi' });
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()!.bounds.width).toBe(24); // max(24, 2+6)
  app.loop.emitCommand('ok');
  await p;
});

test('should widen an okCancel message box to fit two buttons', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'hi', buttons: 'okCancel' });
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()!.bounds.width).toBe(40); // max(40, 2+6)
  app.loop.emitCommand('cancel');
  await p;
});

test('should cap a message box at width 60 for long text', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'x'.repeat(80) });
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()!.bounds.width).toBe(60); // min(60, 86)
  app.loop.emitCommand('ok');
  await p;
});

test('should veto OK, keep the box open, and refocus the field when the value is invalid', async () => {
  const app = makeApp();
  const value = signal('abc'); // not a valid integer for range(0, 120)
  const p = inputBox(app, { title: 'Age', label: 'N', value, validator: range(0, 120) });
  app.loop.renderRoot.flush();

  const dialog = app.desktop.activeWindow()!;
  const input = descendants(dialog).find((v): v is Input => v instanceof Input)!;

  // OK on an invalid value is vetoed: the box stays open and focus lands on the invalid field.
  let resolved = false;
  void p.then(() => {
    resolved = true;
  });
  app.loop.emitCommand('ok');
  await Promise.resolve();
  expect(resolved).toBe(false); // still open
  expect(app.desktop.activeWindow()).toBe(dialog); // not torn down
  expect(app.loop.getFocused()).toBe(input); // refocused the invalid field
  expect(input.invalid).toBe(true);

  // Correct the value and accept: OK now passes and the box resolves the entered text.
  value.set('50');
  app.loop.emitCommand('ok');
  expect(await p).toBe('50');
});

test('should resolve cancel and close an OK-only message box on Esc', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'hi' });
  app.loop.renderRoot.flush();
  const dialog = app.desktop.activeWindow();

  app.loop.dispatch(key('escape'));

  expect(await p).toBe('cancel'); // Esc dismisses to cancel — the box does not stay open
  expect(app.desktop.activeWindow()).not.toBe(dialog); // and it was removed
});
