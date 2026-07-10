/**
 * Specification test (immutable oracle) — dialog reopen (bug #7).
 *
 * The two dialog examples must be reopenable: after `build()` a modal dialog is
 * open; closing it (OK / Cancel / Esc) leaves the stage Window and its "Open the
 * dialog" Button alive on the desktop; emitting `demo.openDialog` re-activates a
 * fresh modal. Driven headlessly through the loop — no browser.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Dialog, Window, Button, Commands, createRoot } from '@jsvision/ui';
import type { Application, View } from '@jsvision/ui';
import formDialog from '../examples/controls/form-dialog.js';
import fileDialog from '../examples/files/file-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const VP = { width: 80, height: 24 };

/** Flush pending microtasks + timers so an execView promise's `finally` (removeWindow) runs. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The open modal dialogs on the desktop (a `Dialog`, or its `FileDialog` subclass). */
function openDialogs(app: Application): View[] {
  return app.desktop.children.filter((c) => c instanceof Dialog);
}

/** The stage window — the only plain `Window` on the desktop (a `Dialog` is a `Window` subclass). */
function stageWindow(app: Application): Window | undefined {
  return app.desktop.children.find((c): c is Window => c instanceof Window && !(c instanceof Dialog));
}

/** Build one dialog example, run the open → close → reopen cycle, and assert the stage survives. */
async function assertReopenable(build: (ctx: { width: number; height: number; caps: typeof caps }) => Application) {
  let app!: Application;
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    app = build({ width: VP.width, height: VP.height, caps });
  });
  await tick(); // let the initial execView settle

  // After build: a modal dialog is open, and a stage window hosts the reopen button.
  expect(openDialogs(app).length, 'a modal is open after build').toBe(1);
  const stage = stageWindow(app);
  expect(stage, 'a stage window hosts the reopen affordance').toBeDefined();
  expect(
    stage!.children.some((c) => c instanceof Button),
    'the stage carries an "Open the dialog" button',
  ).toBe(true);

  // Close it (Cancel always closes): the dialog is removed, the stage + button survive.
  app.loop.emitCommand(Commands.cancel);
  await tick();
  expect(openDialogs(app).length, 'the dialog closed and was removed').toBe(0);
  expect(stageWindow(app), 'the stage window survives the close').toBeDefined();

  // Reopen via the command the stage button emits: a fresh modal re-activates.
  app.loop.emitCommand('demo.openDialog');
  await tick();
  expect(openDialogs(app).length, 'emitting demo.openDialog re-activates a modal').toBe(1);

  dispose();
}

test('ST-C1: the form-dialog example reopens (build → close → demo.openDialog)', async () => {
  await assertReopenable((ctx) => formDialog.build(ctx) as Application);
});

test('ST-C1: the file-dialog example reopens (build → close → demo.openDialog)', async () => {
  await assertReopenable((ctx) => fileDialog.build(ctx) as Application);
});
