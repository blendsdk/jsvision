/**
 * Specification tests (immutable oracles) — capability/glyph hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-07 + PA-9, plan docs 03-03-core-safety-capability-host.md and
 * 07-testing-strategy.md (ST-2.4). A detected UTF-8 locale must additionally enable box-drawing and
 * half-block glyphs (so `┌─│` no longer degrade to `+-|`), while `ambiguousWide` stays conservatively
 * false; a non-UTF-8 / dumb environment keeps all glyph caps false. Locale is the trigger.
 * Expectations derive from the RD/PA, never from the implementation.
 */
import { test, expect } from 'vitest';

import { resolveCapabilities, resolveCapabilitiesAsync } from '../src/engine/capability/index.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import { serialize } from '../src/engine/render/serialize.js';
import type { Style } from '../src/engine/render/types.js';
import type { TerminalQuery } from '../src/engine/capability/profile.js';
import { createDecoderState, decode } from '../src/engine/input/decoder.js';

const STYLE: Style = { fg: 'default', bg: 'default' };
/** The overrides the demos keep after HR-07 (mouse + UTF-8), with NO glyph override. */
const DEMO_OVERRIDE = { mouse: { sgr: true, drag: true, wheel: true }, unicode: { utf8: true } };

/** Render a `box()` under `env`+demo overrides and return the serialized stream. */
function renderBox(env: NodeJS.ProcessEnv): string {
  const caps = resolveCapabilities({ env, platform: 'linux', override: DEMO_OVERRIDE }).profile;
  const buf = new ScreenBuffer(6, 3, STYLE);
  buf.box(0, 0, 6, 3, STYLE, 'single');
  return serialize(buf, null, { caps });
}

// ST-2.4 — a UTF-8 locale enables boxDrawing + halfBlocks; ambiguousWide stays false.
test('ST-2.4: a UTF-8 locale enables box-drawing and half-block glyphs', () => {
  const { profile } = resolveCapabilities({
    env: { TERM: 'xterm-kitty', COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' },
    platform: 'linux',
  });
  expect(profile.glyphs.boxDrawing).toBe(true);
  expect(profile.glyphs.halfBlocks).toBe(true);
  expect(profile.glyphs.ambiguousWide).toBe(false); // conservative (width probe owns this upgrade)
});

// ST-2.4 — a non-UTF-8 / dumb environment keeps all glyph caps false.
test('ST-2.4: a non-UTF-8 (dumb) environment keeps all glyph caps false', () => {
  const { profile } = resolveCapabilities({ env: { TERM: 'dumb' }, platform: 'linux' });
  expect(profile.glyphs.boxDrawing).toBe(false);
  expect(profile.glyphs.halfBlocks).toBe(false);
  expect(profile.glyphs.ambiguousWide).toBe(false);
});

// ST-2.4 (demo golden) — a demo minus its glyph override, caps resolved with an explicit UTF-8
// locale, still renders box-drawing (┌/─), not ASCII (+/-). The trigger is the LOCALE (PF-002).
test('ST-2.4: a demo frame under a UTF-8 locale renders box-drawing, not ASCII', () => {
  const out = renderBox({ LANG: 'en_US.UTF-8' });
  expect(out.includes('┌')).toBe(true); // ┌ corner rendered
  expect(out.includes('─')).toBe(true); // ─ top edge rendered
  expect(out.includes('+')).toBe(false); // no ASCII corner fallback
});

// ST-2.4 (locale is the trigger) — the SAME demo overrides (incl. unicode.utf8) but NO UTF-8 locale
// fall back to ASCII, proving glyph enablement is locale-gated, not unicode.utf8-gated (PF-002).
test('ST-2.4: the same overrides without a UTF-8 locale fall back to ASCII box chars', () => {
  const out = renderBox({ TERM: 'xterm' }); // unicode.utf8 forced by override, but no UTF-8 locale
  expect(out.includes('+')).toBe(true); // ASCII corner fallback
  expect(out.includes('┌')).toBe(false); // no box-drawing glyph
});

// ---------------------------------------------------------------------------
// ST-5.h — passthrough re-injection during async detection (HR-22)
// ---------------------------------------------------------------------------

/** A stub terminal-query seam that replays fixed chunks then ends the stream. */
function stubQuery(chunks: Uint8Array[]): TerminalQuery {
  return {
    write() {
      /* the queries are ignored; only the canned reply matters */
    },
    async *read(): AsyncIterable<Uint8Array> {
      for (const chunk of chunks) yield chunk;
    },
  };
}

// ST-5.h — genuine input typed during async detection is surfaced as `passthrough` and, re-injected
// into the decoder, becomes key events after detection completes (HR-22/AC-4).
test('ST-5.h: input mixed into query replies surfaces as passthrough → key events', async () => {
  const enc = new TextEncoder();
  // A recognized Primary-DA reply (consumed) followed by two genuine keystrokes 'ab'.
  const stream = new Uint8Array([...enc.encode('\x1b[?64;1;2c'), ...enc.encode('ab')]);
  const res = await resolveCapabilitiesAsync({ env: {}, platform: 'linux', query: stubQuery([stream]) });

  const bytes = res.passthrough;
  expect(bytes).toBeDefined();
  if (bytes === undefined) return;
  expect(new TextDecoder().decode(bytes)).toBe('ab'); // no response bytes leaked
  expect(bytes.includes(0x1b)).toBe(false);

  // Re-injecting the passthrough into the decoder yields the two keystrokes in order.
  const decoded = decode(bytes, createDecoderState());
  expect(decoded.events.map((e) => (e.type === 'key' ? e.key : null))).toEqual(['a', 'b']);
});
