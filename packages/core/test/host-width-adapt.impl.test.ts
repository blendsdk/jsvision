/**
 * Implementation tests — width-adaptation degrade helpers + host resilience.
 *
 * Covers behaviour beyond the ST oracle: `degradeCapsForWidth`/`degradeCapsFully`/
 * `isAsciiSafe` purity + frozen-caps safety, both-groups-wide adaptation, silent
 * adaptation (adapt on, warn off), and a probe failure leaving startup un-adapted.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { describe, test, expect } from 'vitest';

import { createHost } from '../src/engine/host/host.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import type { Style } from '../src/engine/render/types.js';
import {
  degradeCapsForWidth,
  degradeCapsFully,
  isAsciiSafe,
  type WidthProbeResult,
} from '../src/engine/host/width-probe.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './host-doubles.js';

const STYLE: Style = { fg: 'default', bg: 'default' };

function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({
    env: {},
    platform: 'linux',
    override: {
      altScreen: true,
      unicode: { utf8: true },
      glyphs: { boxDrawing: true, halfBlocks: true },
      ...override,
    },
  }).profile;
}

/** A probe result with the given per-group wide flags. */
function result(arrowsWide: boolean, boxesWide: boolean): WidthProbeResult {
  return {
    probed: true,
    arrows: { expectedWidth: 8, measuredWidth: arrowsWide ? 16 : 8, wide: arrowsWide },
    boxes: { expectedWidth: 8, measuredWidth: boxesWide ? 16 : 8, wide: boxesWide },
  };
}

function twoCprs(arrowsCol: number, boxesCol: number): Uint8Array {
  const one = (col: number): number[] => [...Buffer.from(`\x1b[1;${col}R`, 'latin1')];
  return new Uint8Array([...one(arrowsCol), ...one(boxesCol)]);
}

function tick(): Promise<void> {
  return Promise.resolve();
}

function rowBuffer(glyphs: string[]): ScreenBuffer {
  const buf = new ScreenBuffer(Math.max(glyphs.length, 1), 1, STYLE);
  glyphs.forEach((g, x) => buf.set(x, 0, g, STYLE));
  return buf;
}

describe('degrade helpers (pure, downgrade-only)', () => {
  test('degradeCapsForWidth flips only the wide group, leaving the input untouched', () => {
    const base = caps(); // frozen by resolveCapabilities
    const out = degradeCapsForWidth(base, result(true, false));
    expect(out.glyphs.ambiguousWide).toBe(true);
    expect(out.glyphs.boxDrawing).toBe(true); // boxes not wide ⇒ unchanged
    expect(out.glyphs.halfBlocks).toBe(true);
    // Purity: the (frozen) input is unmodified and a new object is returned.
    expect(base.glyphs.ambiguousWide).toBe(false);
    expect(out).not.toBe(base);
  });

  test('degradeCapsForWidth with both groups wide flips all three flags', () => {
    const out = degradeCapsForWidth(caps(), result(true, true));
    expect(out.glyphs).toMatchObject({ boxDrawing: false, halfBlocks: false, ambiguousWide: true });
  });

  test('degradeCapsForWidth returns the same reference when nothing is wide', () => {
    const base = caps();
    expect(degradeCapsForWidth(base, result(false, false))).toBe(base);
  });

  test('degradeCapsFully forces ASCII-safe chrome, preserving utf8', () => {
    const out = degradeCapsFully(caps());
    expect(out.glyphs).toMatchObject({ boxDrawing: false, halfBlocks: false, ambiguousWide: true });
    expect(out.unicode.utf8).toBe(true);
  });

  test('isAsciiSafe: utf8 off ⇒ true; fully degraded ⇒ true; rich ⇒ false', () => {
    expect(isAsciiSafe(caps({ unicode: { utf8: false } }))).toBe(true);
    expect(isAsciiSafe(degradeCapsFully(caps()))).toBe(true);
    expect(isAsciiSafe(caps())).toBe(false);
  });

  test('degradeCapsForWidth does not throw on a deep-frozen caps profile', () => {
    const frozen = caps();
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() => degradeCapsForWidth(frozen, result(true, true))).not.toThrow();
  });
});

describe('host adaptation resilience', () => {
  test('both groups wide ⇒ arrows, box, and shade all degrade', async () => {
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
    input.feed(twoCprs(17, 17));
    await startP;

    output.data = '';
    host.render(rowBuffer(['▲', '┌', '▒']));
    expect(output.data).toContain('^');
    expect(output.data).toContain('+');
    expect(output.data).toContain('#');
    await host.stop();
  });

  test('silent adaptation: adapt on, warn off ⇒ caps adapt with no warning', async () => {
    const output = new CaptureStream();
    const input = new FakeInput(true);
    const warnings: string[] = [];
    const host = createHost({
      caps: caps(),
      runtime: new FakeRuntimeAdapter(),
      input: input.asInput(),
      output: output.asOutput(),
      adaptAmbiguousWidth: true,
      // warnAmbiguousWidth omitted ⇒ warning off
      onWidthWarning: (m) => warnings.push(m),
    });

    const startP = host.start();
    await tick();
    input.feed(twoCprs(17, 9)); // arrows wide
    await startP;

    expect(warnings).toStrictEqual([]); // no warning (warn off)
    output.data = '';
    host.render(rowBuffer(['▲']));
    expect(output.data).toContain('^'); // but adaptation still happened
    await host.stop();
  });

  test('a probe write failure leaves startup un-adapted (Unicode chrome preserved)', async () => {
    const output = new CaptureStream();
    output.failNextWrite = true; // the probe's first write throws → probed:false
    const input = new FakeInput(true);
    const host = createHost({
      caps: caps(),
      runtime: new FakeRuntimeAdapter(),
      input: input.asInput(),
      output: output.asOutput(),
      adaptAmbiguousWidth: true,
    });

    await host.start(); // must not throw despite the probe write failing

    output.data = '';
    host.render(rowBuffer(['▲']));
    expect(output.data).toContain('▲'); // un-adapted: still the Unicode glyph
    expect(output.data).not.toContain('^');
    await host.stop();
  });
});

describe('render gating across start()/stop()', () => {
  const ALT_ENTER = '\x1b[?1049h'; // the alternate-screen enter written at the end of start()

  // A frame produced during start()'s async width probe (before the alternate screen is entered) must
  // never reach the terminal: it would land on the primary screen, blank the alt-screen's first diff
  // (the frame equals prev, so nothing repaints), and reappear on the primary screen on exit. The UI
  // event loop can produce exactly such a frame — a coalesced out-of-tick paint queued at mount fires
  // on the first microtask, which is inside `await host.start()`.
  test('render() during the start() probe window writes nothing; the frame lands after the alt-screen', async () => {
    const output = new CaptureStream();
    const input = new FakeInput(true);
    const host = createHost({
      caps: caps(), // utf8 + box-drawing ⇒ not ASCII-safe ⇒ start() runs the probe and awaits
      runtime: new FakeRuntimeAdapter(),
      input: input.asInput(),
      output: output.asOutput(),
      adaptAmbiguousWidth: true,
    });

    const startP = host.start();
    await tick(); // start() is now suspended on the width probe — streams bound, alt-screen not entered
    expect(output.data).not.toContain(ALT_ENTER); // sanity: still on the primary screen

    host.render(rowBuffer(['Z', 'Z', 'Z'])); // a paint arriving mid-start
    expect(output.data).not.toContain('Z'); // dropped: nothing written before the host is ready

    input.feed(twoCprs(9, 9)); // narrow reply ⇒ probe resolves, start() enters the alternate screen
    await startP;
    expect(output.data).toContain(ALT_ENTER);

    // The host is ready now: the same frame reaches the output as a full first frame (the dropped paint
    // never set the diff baseline, so this is not an empty diff).
    const afterEnter = output.data.length;
    host.render(rowBuffer(['Z', 'Z', 'Z']));
    expect(output.data.slice(afterEnter)).toContain('Z');
    await host.stop();
  });

  test('render() after stop() writes nothing (the terminal is being restored)', async () => {
    const output = new CaptureStream();
    const input = new FakeInput(true);
    const host = createHost({
      caps: caps(),
      runtime: new FakeRuntimeAdapter(),
      input: input.asInput(),
      output: output.asOutput(),
      // probe off (default) ⇒ start() completes synchronously
    });

    await host.start();
    await host.stop();

    output.data = '';
    host.render(rowBuffer(['Z']));
    expect(output.data).toBe(''); // gated: no frame after teardown
  });
});
