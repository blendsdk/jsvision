/**
 * Implementation tests — RD-05 Application + run() internals (Phase 2).
 *
 * Edge cases beyond ST-01…ST-05: viewport default resolution; onFrame→host.render wiring across the
 * run lifecycle; clean-quit restore (idempotent stop); quit-arg coercion; first-frame paint.
 *
 * Trace: RD-05 03-01 (Error Handling table) · PA-3/PA-6/AR-86.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import type { ApplicationOptions } from '../src/app/index.js';
import { FakeRuntimeAdapter, CaptureStream, FakeInput } from './app-shell.fixtures.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', altScreen: true },
}).profile;

function doubles(): { runtime: FakeRuntimeAdapter; input: FakeInput; output: CaptureStream } {
  return { runtime: new FakeRuntimeAdapter(), input: new FakeInput(), output: new CaptureStream() };
}

function appWith(
  opts: Partial<ApplicationOptions> & { output: CaptureStream; input: FakeInput; runtime: FakeRuntimeAdapter },
) {
  const { output, input, runtime, ...rest } = opts;
  return createApplication({
    caps,
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    ...rest,
  });
}

/** The overlay (absolute child) of an app's mounted root. */
function overlayOf(app: ReturnType<typeof createApplication>): Group {
  const root = app.desktop.parent as Group;
  return root.children.find((c) => c.layout.position === 'absolute') as Group;
}

test('viewport defaults to the output stream columns×rows when no viewport is given', () => {
  const d = doubles();
  d.output.columns = 100;
  d.output.rows = 30;
  const app = appWith({ ...d }); // no explicit viewport
  expect(overlayOf(app).layout.rect).toEqual({ x: 0, y: 0, width: 100, height: 30 });
});

test('an explicit viewport overrides the stream size', () => {
  const d = doubles();
  d.output.columns = 100;
  d.output.rows = 30;
  const app = appWith({ ...d, viewport: { width: 40, height: 12 } });
  expect(overlayOf(app).layout.rect).toEqual({ x: 0, y: 0, width: 40, height: 12 });
});

test('onFrame is wired to host.render during the run and cleared after it resolves', async () => {
  const d = doubles();
  const app = appWith({ ...d, viewport: { width: 40, height: 12 } });

  const runP = app.run();
  expect(typeof app.loop.onFrame).toBe('function'); // bridged to host.render

  app.loop.emitCommand('quit');
  await runP;
  expect(app.loop.onFrame).toBeUndefined(); // cleared on stop
});

test('a resize during the run pushes a fresh frame to the host (onFrame per flush)', async () => {
  const d = doubles();
  const app = appWith({ ...d, viewport: { width: 40, height: 12 } });
  const runP = app.run();
  await new Promise((r) => setImmediate(r)); // let the first frame paint

  const before = d.output.data.length;
  d.output.columns = 60;
  d.output.rows = 20;
  d.runtime.emit('resize');
  d.runtime.flushImmediates(); // onResize → loop.resize → flush → onFrame → host.render
  expect(d.output.data.length).toBeGreaterThan(before);

  app.loop.emitCommand('quit');
  await runP;
});

test('a clean quit restores the terminal without calling process.exit (idempotent stop)', async () => {
  const d = doubles();
  const app = appWith({ ...d, viewport: { width: 40, height: 12 } });
  const runP = app.run();
  app.loop.emitCommand('quit');
  await runP;

  expect(d.runtime.restored).toBe(true); // cooked mode restored by host.stop()
  expect(d.runtime.exits).toEqual([]); // a clean quit does not call process.exit
});

test('a non-numeric quit arg coerces to exit code 0', async () => {
  const d = doubles();
  const app = appWith({ ...d, viewport: { width: 40, height: 12 } });
  const runP = app.run();
  app.loop.emitCommand('quit', 'not-a-number');
  expect(await runP).toBe(0);
});

test('the first frame paints after start (a frame is written beyond enter-mode)', async () => {
  const d = doubles();
  const app = appWith({ ...d, viewport: { width: 40, height: 12 } });
  const runP = app.run();
  const afterEnterMode = d.output.data.length; // enter-mode written synchronously in start()
  await new Promise((r) => setImmediate(r)); // let host.render(first frame) run

  // The first frame (the desktop fill) is serialized and written beyond the enter-mode prefix.
  expect(d.output.data.length).toBeGreaterThan(afterEnterMode);

  app.loop.emitCommand('quit');
  await runP;
});
