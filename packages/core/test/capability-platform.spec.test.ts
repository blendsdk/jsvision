/**
 * Specification tests — the Windows platform capability baseline.
 *
 * On Windows there is no POSIX locale (`LC_*`/`LANG`) and a double-clicked
 * executable is handed to the terminal without `WT_SESSION`, so neither the
 * environment nor the known-terminal table reveals what the console can do. The
 * supported Windows baseline (the modern-runtime floor) nonetheless always
 * provides a VT-capable console — Windows Terminal or a modern conhost — with
 * 24-bit color, Unicode, mouse, the alternate screen, and bracketed paste.
 *
 * These are the immutable oracle for that behavior: `win32` raises the default
 * floor to that baseline, other platforms are unchanged, and every stronger
 * signal (an explicit override, `NO_COLOR`/`FORCE_COLOR`, a known terminal) still
 * wins. Driven entirely through injectable inputs (`options.env`,
 * `options.platform`) so every case is hermetic and cross-platform.
 */
import { test, expect } from 'vitest';

import { resolveCapabilities } from '../src/engine/capability/index.js';

// ---------------------------------------------------------------------------
// The win32 baseline: a bare Windows launch (no env, no table) is configured for
// a modern console, not the conservative fallback.
// ---------------------------------------------------------------------------

test('win32 with no env signals resolves to the modern-console baseline', () => {
  const { profile } = resolveCapabilities({ env: {}, platform: 'win32' });

  expect(profile.colorDepth).toBe('truecolor');
  expect(profile.unicode.utf8).toBe(true);
  expect(profile.glyphs.boxDrawing).toBe(true);
  expect(profile.glyphs.halfBlocks).toBe(true);
  expect(profile.mouse).toStrictEqual({ sgr: true, drag: true, wheel: true });
  expect(profile.altScreen).toBe(true);
  expect(profile.bracketedPaste).toBe(true);
});

test('the win32 baseline stays conservative on terminal-specific capabilities', () => {
  // The baseline asserts only what every supported Windows console provides.
  // OSC features, synchronized output, and enhanced keyboard protocols are
  // terminal-specific and remain for the table / a live probe to establish.
  const { profile } = resolveCapabilities({ env: {}, platform: 'win32' });

  expect(profile.osc.hyperlink8).toBe(false);
  expect(profile.osc.clipboard52).toBe(false);
  expect(profile.sync2026).toBe(false);
  expect(profile.keyboard.modifyOtherKeys).toBe(false);
  expect(profile.multiplexer).toBe(false);
  // A UTF-8 console does not imply a known width policy; that stays conservative.
  expect(profile.unicode.widthMode).toBe('wcwidth');
  expect(profile.unicode.emoji).toBe('unknown');
});

// ---------------------------------------------------------------------------
// No regression off Windows: the baseline is win32-only.
// ---------------------------------------------------------------------------

test('linux with no env signals keeps the conservative defaults', () => {
  const { profile } = resolveCapabilities({ env: {}, platform: 'linux' });

  expect(profile.colorDepth).toBe('16');
  expect(profile.unicode.utf8).toBe(false);
  expect(profile.glyphs.boxDrawing).toBe(false);
  expect(profile.mouse.sgr).toBe(false);
  expect(profile.altScreen).toBe(false);
  expect(profile.bracketedPaste).toBe(false);
});

test('darwin with no env signals keeps the conservative defaults', () => {
  const { profile } = resolveCapabilities({ env: {}, platform: 'darwin' });

  expect(profile.colorDepth).toBe('16');
  expect(profile.unicode.utf8).toBe(false);
  expect(profile.glyphs.boxDrawing).toBe(false);
  expect(profile.mouse.sgr).toBe(false);
});

// ---------------------------------------------------------------------------
// The baseline is a floor, never a ceiling: stronger signals still win.
// ---------------------------------------------------------------------------

test('NO_COLOR forces mono even on the win32 baseline', () => {
  // A user opting out of color must win over the platform baseline's truecolor.
  const { profile } = resolveCapabilities({ env: { NO_COLOR: '1' }, platform: 'win32' });
  expect(profile.colorDepth).toBe('mono');
});

test('FORCE_COLOR pins the depth over the win32 baseline', () => {
  const { profile } = resolveCapabilities({ env: { FORCE_COLOR: '2' }, platform: 'win32' });
  expect(profile.colorDepth).toBe('256');
});

test('an explicit override wins over the win32 baseline', () => {
  // The escape hatch: an app can still force a field off (e.g. ASCII chrome).
  const { profile, reasons } = resolveCapabilities({
    env: {},
    platform: 'win32',
    override: { glyphs: { boxDrawing: false }, colorDepth: 'mono' },
  });

  expect(profile.glyphs.boxDrawing).toBe(false);
  expect(profile.glyphs.halfBlocks).toBe(true); // untouched leaf stays at the baseline
  expect(profile.colorDepth).toBe('mono');
  expect(reasons.glyphs).toBe('override');
  expect(reasons.colorDepth).toBe('override');
});
