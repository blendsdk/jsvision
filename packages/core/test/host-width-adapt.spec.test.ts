/**
 * Specification tests (immutable oracles) — host adaptation of the two-group
 * width probe + the `JSVISION_ASCII` force switch (feature glyph-auto-swap).
 *
 * Source: `01-requirements.md` FR-4/FR-5/FR-6/FR-7, `03-01-core-glyph-swap.md` §4,
 * the Ambiguity Register (AR-4/8/9/10/13/15) and preflight PF-001/PF-003.
 * Traceability: ST-08…ST-13, ST-15, ST-16 in `07-testing-strategy.md`.
 * Expectations derive from the acceptance criteria, NEVER the implementation.
 *
 * Driven headlessly via the FakeRuntimeAdapter + CaptureStream + FakeInput doubles;
 * the two CPR replies are fed on the input double once `start()` has attached the
 * probe. `output.data` is reset after `start()` so the rendered frame is isolated.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import { createHost } from '../src/engine/host/host.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import type { Style } from '../src/engine/render/types.js';
import { WIDTH_ADAPTED_MESSAGE } from '../src/engine/host/width-probe.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './host-doubles.js';

const STYLE: Style = { fg: 'default', bg: 'default' };

/** A rich TTY profile: utf8 + box/half glyphs on, so the ONLY changes come from the probe/env. */
function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({
    env: {},
    platform: 'linux',
    override: {
      altScreen: true,
      bracketedPaste: true,
      unicode: { utf8: true },
      glyphs: { boxDrawing: true, halfBlocks: true },
      ...override,
    },
  }).profile;
}

/** Bytes for two sequential CPR replies (arrows group, then boxes group). */
function twoCprs(arrowsCol: number, boxesCol: number): Uint8Array {
  const one = (col: number): number[] => [...Buffer.from(`\x1b[1;${col}R`, 'latin1')];
  return new Uint8Array([...one(arrowsCol), ...one(boxesCol)]);
}

/** Yield one microtask so `start()` reaches the probe's `read()` before we feed. */
function tick(): Promise<void> {
  return Promise.resolve();
}

/** A buffer of the given single-row glyphs starting at column 0. */
function rowBuffer(glyphs: string[]): ScreenBuffer {
  const buf = new ScreenBuffer(Math.max(glyphs.length, 1), 1, STYLE);
  glyphs.forEach((g, x) => buf.set(x, 0, g, STYLE));
  return buf;
}

// ST-08 / AC-1 — arrows-wide only: ▲ swaps to ^, box-drawing stays Unicode.
test('ST-08: adapt on, arrows-wide only ⇒ ▲→^ and ┌ stays', async () => {
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const host = createHost({
    caps: caps(),
    runtime: new FakeRuntimeAdapter(),
    input: input.asInput(),
    output: output.asOutput(),
    adaptAmbiguousWidth: true,
  });

  const startP = host.start();
  await tick();
  input.feed(twoCprs(17, 9)); // arrows advance 16 (wide), boxes advance 8 (narrow)
  await startP;

  output.data = '';
  host.render(rowBuffer(['▲', '┌']));
  expect(output.data).toContain('^');
  expect(output.data).toContain('┌');
  expect(output.data).not.toContain('▲');
  await host.stop();
});

// ST-09 / AC-2 — boxes-wide only: box/shade degrade, arrows stay Unicode.
test('ST-09: adapt on, boxes-wide only ⇒ ▲ stays, ┌→+, ▒→#', async () => {
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const host = createHost({
    caps: caps(),
    runtime: new FakeRuntimeAdapter(),
    input: input.asInput(),
    output: output.asOutput(),
    adaptAmbiguousWidth: true,
  });

  const startP = host.start();
  await tick();
  input.feed(twoCprs(9, 17)); // arrows narrow, boxes wide
  await startP;

  output.data = '';
  host.render(rowBuffer(['▲', '┌', '▒']));
  expect(output.data).toContain('▲');
  expect(output.data).toContain('+');
  expect(output.data).toContain('#');
  await host.stop();
});

// ST-10 / AC-4 — adapt + warn on, a wide group ⇒ the adapted-variant message, once.
test('ST-10: adapt+warn on, wide ⇒ WIDTH_ADAPTED_MESSAGE exactly once', async () => {
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const warnings: string[] = [];
  const host = createHost({
    caps: caps(),
    runtime: new FakeRuntimeAdapter(),
    input: input.asInput(),
    output: output.asOutput(),
    adaptAmbiguousWidth: true,
    warnAmbiguousWidth: true,
    onWidthWarning: (m) => warnings.push(m),
  });

  const startP = host.start();
  await tick();
  input.feed(twoCprs(17, 9));
  await startP;

  expect(warnings).toStrictEqual([WIDTH_ADAPTED_MESSAGE]);
  await host.stop();
});

// ST-11 / AC-4 — warn on, adapt off, wide ⇒ the warn-only message naming JSVISION_ASCII=1.
test('ST-11: warn on, adapt off, wide ⇒ warn-only message names JSVISION_ASCII=1', async () => {
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const warnings: string[] = [];
  const host = createHost({
    caps: caps(),
    runtime: new FakeRuntimeAdapter(),
    input: input.asInput(),
    output: output.asOutput(),
    adaptAmbiguousWidth: false,
    warnAmbiguousWidth: true,
    onWidthWarning: (m) => warnings.push(m),
  });

  const startP = host.start();
  await tick();
  input.feed(twoCprs(17, 17));
  await startP;

  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('JSVISION_ASCII=1');
  await host.stop();
});

// ST-12 / AC-3 — JSVISION_ASCII set (empty string) ⇒ fully ASCII, probe skipped (no query bytes).
test('ST-12: env JSVISION_ASCII="" ⇒ ▲┌▒ render as ^ + #, and NO probe bytes are written', async () => {
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const host = createHost({
    caps: caps(),
    runtime: new FakeRuntimeAdapter(),
    input: input.asInput(),
    output: output.asOutput(),
    adaptAmbiguousWidth: true,
    warnAmbiguousWidth: true,
    env: { JSVISION_ASCII: '' },
  });

  await host.start();
  expect(output.data).not.toContain('\x1b[6n'); // the probe was skipped

  output.data = '';
  host.render(rowBuffer(['▲', '┌', '▒']));
  expect(output.data).toContain('^');
  expect(output.data).toContain('+');
  expect(output.data).toContain('#');
  await host.stop();
});

// ST-13 — caps already fully ASCII-safe ⇒ probe skipped, no warning.
test('ST-13: already-degraded caps ⇒ no probe bytes and no warning', async () => {
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const warnings: string[] = [];
  const host = createHost({
    caps: caps({ glyphs: { boxDrawing: false, halfBlocks: false, ambiguousWide: true } }),
    runtime: new FakeRuntimeAdapter(),
    input: input.asInput(),
    output: output.asOutput(),
    adaptAmbiguousWidth: true,
    warnAmbiguousWidth: true,
    onWidthWarning: (m) => warnings.push(m),
  });

  await host.start();
  expect(output.data).not.toContain('\x1b[6n');
  expect(warnings).toStrictEqual([]);
  await host.stop();
});

// ST-15 / PF-001 — the SIGCONT resume repaint uses the EFFECTIVE (adapted) caps.
test('ST-15: after arrows-wide adaptation, the resume repaint emits ^ never ▲', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const host = createHost({
    caps: caps(),
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    adaptAmbiguousWidth: true,
  });

  const startP = host.start();
  await tick();
  input.feed(twoCprs(17, 9)); // arrows wide
  await startP;

  host.render(rowBuffer(['▲']));
  output.data = '';
  adapter.emit('continue'); // SIGCONT full repaint of the last buffer
  expect(output.data).toContain('^');
  expect(output.data).not.toContain('▲');
  await host.stop();
});

// ST-16 / PF-003 — unicode.utf8 off counts as ASCII-safe: probe skipped, no warning.
test('ST-16: utf8 off (box/half on) ⇒ no probe bytes and no warning', async () => {
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const warnings: string[] = [];
  const host = createHost({
    caps: caps({ unicode: { utf8: false } }),
    runtime: new FakeRuntimeAdapter(),
    input: input.asInput(),
    output: output.asOutput(),
    adaptAmbiguousWidth: true,
    warnAmbiguousWidth: true,
    onWidthWarning: (m) => warnings.push(m),
  });

  await host.start();
  expect(output.data).not.toContain('\x1b[6n');
  expect(warnings).toStrictEqual([]);
  await host.stop();
});
