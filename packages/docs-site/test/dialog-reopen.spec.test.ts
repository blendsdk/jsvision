/**
 * Specification test (immutable oracle) — dialog reopen (bug #7).
 *
 * The two rebuilt dialog laboratories must keep their template1 teaching dialog mounted while a
 * real modal opens, cancels, and opens again. Driven headlessly through the loop — no browser.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Dialog, createRoot } from '@jsvision/ui';
import type { Application, Desktop, View } from '@jsvision/ui';
import formDialog from '../examples/controls/form-dialog.js';
import fileDialog from '../examples/files/file-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const VP = { width: 80, height: 24 };

/** Flush pending microtasks + timers so an execView promise's `finally` (removeWindow) runs. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * The desktop of an app that must have one. `Application.desktop` is optional on the type — an app
 * can be built without a desktop — but every example here builds one, so its absence is a broken
 * fixture rather than a case to tolerate.
 */
function desktopOf(app: Application): Desktop {
  if (app.desktop === undefined) throw new Error('the example built an application without a desktop');
  return app.desktop;
}

/** The open modal dialogs on the desktop (a `Dialog`, or its `FileDialog` subclass). */
function openDialogs(app: Application): View[] {
  return desktopOf(app).children.filter((c) => c instanceof Dialog);
}

/** Build one laboratory, run the modal open → cancel → reopen cycle, and assert the lab survives. */
async function assertReopenable(build: (ctx: { width: number; height: number; caps: typeof caps }) => Application) {
  let app!: Application;
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    app = build({ width: VP.width, height: VP.height, caps });
  });
  expect(openDialogs(app).length, 'the template1 teaching dialog is mounted').toBe(1);
  app.loop.dispatch({ type: 'key', key: 'o', ctrl: false, alt: true, shift: false });
  expect(openDialogs(app).length, 'the real modal opens over the laboratory').toBe(2);
  app.loop.dispatch({ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false });
  await tick();
  expect(openDialogs(app).length, 'cancelling removes only the real modal').toBe(1);

  app.loop.dispatch({ type: 'key', key: 'o', ctrl: false, alt: true, shift: false });
  expect(openDialogs(app).length, 'the laboratory can open a fresh modal').toBe(2);

  dispose();
}

test('ST-C1: the form-dialog laboratory reopens its real modal', async () => {
  await assertReopenable((ctx) => formDialog.build(ctx) as Application);
});

test('ST-C1: the file-dialog laboratory reopens its real modal', async () => {
  await assertReopenable((ctx) => fileDialog.build(ctx) as Application);
});
