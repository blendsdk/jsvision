/**
 * Implementation tests — the modal helpers actually paint their content and controls.
 *
 * These boxes pin no child rectangles anywhere in the suite: their sizing oracles assert only the
 * dialog's outer width, and their behavior oracles assert only the resolved promise. That leaves one
 * failure mode completely unguarded — a body that lays out to nothing. A container that resolves to
 * zero width clips every child away, so the box still opens, still resolves, and still passes every
 * other test while showing the user an empty frame.
 *
 * So this file guards the floor: the message text reaches the screen buffer, and every button solves
 * to a non-zero rectangle. It is the same guard the form-dialog suite keeps over its body group, kept
 * here because this family carries no child-geometry assertions of its own.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { Cell } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import type { DesktopApplication } from '../src/app/index.js';
import { messageBox, confirm, inputBox } from '../src/dialog/index.js';
import { Button } from '../src/controls/index.js';
import { signal } from '../src/reactive/index.js';
import { Commands } from '../src/status/index.js';
import type { View } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function makeApp(): DesktopApplication {
  return createApplication({ caps, viewport: { width: 80, height: 24 } });
}

/** All descendants of a view (children walk). */
function descendants(v: View): View[] {
  const out: View[] = [];
  const kids = (v as unknown as { children?: View[] }).children ?? [];
  for (const c of kids) out.push(c, ...descendants(c));
  return out;
}

/** The whole painted frame as text, for "did this string reach the screen" assertions. */
function painted(app: DesktopApplication): string {
  return app.loop.renderRoot
    .buffer()
    .rows()
    .map((row: readonly Cell[]) => row.map((cell: Cell) => cell.char).join(''))
    .join('\n');
}

/** Every button in the active dialog must occupy a real rectangle (not collapsed to nothing). */
function expectButtonsSolved(app: DesktopApplication, count: number): void {
  const buttons = descendants(app.desktop.activeWindow()!).filter((v): v is Button => v instanceof Button);
  expect(buttons.length).toBe(count);
  for (const b of buttons) {
    expect(b.bounds.width).toBeGreaterThan(0);
    expect(b.bounds.height).toBeGreaterThan(0);
  }
}

test('impl: an OK-only messageBox paints its text and solves its button to a real rect', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'Zephyrus' });
  app.loop.renderRoot.flush();

  expect(painted(app)).toContain('Zephyrus'); // the message is visible, not clipped away
  expectButtonsSolved(app, 1);

  app.loop.emitCommand(Commands.ok);
  await p;
});

test('impl: an okCancel messageBox paints its text and solves both buttons', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'Zephyrus', buttons: 'okCancel' });
  app.loop.renderRoot.flush();

  expect(painted(app)).toContain('Zephyrus');
  expectButtonsSolved(app, 2);

  app.loop.emitCommand(Commands.cancel);
  await p;
});

test('impl: confirm paints its question and solves both buttons', async () => {
  const app = makeApp();
  const p = confirm(app, 'Zephyrus?');
  app.loop.renderRoot.flush();

  expect(painted(app)).toContain('Zephyrus?');
  expectButtonsSolved(app, 2);

  app.loop.emitCommand(Commands.no);
  await p;
});

test('impl: inputBox paints its caption and bound value, and solves both buttons', async () => {
  const app = makeApp();
  const value = signal('Zephyrus');
  const p = inputBox(app, { title: 'Rename', label: 'New name', value });
  app.loop.renderRoot.flush();

  const screen = painted(app);
  expect(screen).toContain('New name'); // the caption reaches the screen
  expect(screen).toContain('Zephyrus'); // and so does the field's bound value
  expectButtonsSolved(app, 2);

  app.loop.emitCommand(Commands.cancel);
  await p;
});
