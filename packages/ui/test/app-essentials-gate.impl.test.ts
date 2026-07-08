/**
 * Implementation tests (edges/internals) — the essentials gate in `run()` (written AFTER impl).
 *
 * Covers that the gate is fatal ONLY on a missing TTY — capability *degradations* (no mouse, mono,
 * no alternate screen) do not stop a TTY run — and that a gate rejection happens strictly before the
 * host starts: no raw mode entered, no process exit, nothing written to the terminal. The `.js`
 * extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, EssentialsNotMetError } from '@jsvision/core';
import type { CapabilityProfile } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { FakeRuntimeAdapter, CaptureStream, FakeInput } from './app-shell.fixtures.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function makeApp(opts: { isTTY: boolean; caps?: CapabilityProfile }) {
  const runtime = new FakeRuntimeAdapter();
  const input = new FakeInput();
  const output = new CaptureStream();
  input.isTTY = opts.isTTY;
  output.isTTY = opts.isTTY;
  const app = createApplication({
    warnAmbiguousWidth: false,
    caps: opts.caps ?? caps,
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    viewport: { width: 40, height: 12 },
  });
  return { app, runtime, input, output };
}

// ── IT-3: degradations are not essential — a TTY run with only degradations starts ──────────────────

test('IT-3: no mouse / mono / no alt-screen do not gate a TTY run (only a missing TTY is fatal)', async () => {
  // A degraded-but-interactive terminal: mouse off, monochrome, no alternate screen — all degradations.
  const degraded: CapabilityProfile = {
    ...caps,
    colorDepth: 'mono',
    altScreen: false,
    mouse: { ...caps.mouse, sgr: false },
  };
  const { app } = makeApp({ isTTY: true, caps: degraded });
  const runP = app.run();
  app.loop.emitCommand('quit');
  expect(await runP, 'the degraded TTY run starts and quits normally (no throw)').toBe(0);
});

// ── IT-4: a gate rejection is strictly pre-host.start() — nothing entered, nothing to restore ────────

test('IT-4: a non-TTY rejection enters no raw mode, records no exit, and writes nothing', async () => {
  const { app, runtime, output } = makeApp({ isTTY: false });
  const runP = app.run();
  await expect(runP).rejects.toThrow(EssentialsNotMetError);
  expect(runtime.rawModeCalls, 'no raw-mode toggle — the host never started').toEqual([]);
  expect(runtime.exits, 'no process exit was triggered by the gate').toEqual([]);
  expect(output.data, 'nothing was written to the terminal before the throw').toBe('');
});
