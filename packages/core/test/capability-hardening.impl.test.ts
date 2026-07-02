/**
 * Implementation tests — capability/glyph hardening (RD-13, HR-07).
 *
 * Edge coverage beyond ST-2.4: locale-variable precedence (LC_ALL > LC_CTYPE > LANG) and the
 * locale-not-flag trigger (an override.unicode.utf8 without a UTF-8 locale does not enable glyphs).
 */
import { test, expect } from 'vitest';

import { resolveCapabilities } from '../src/engine/capability/index.js';

function glyphs(env: NodeJS.ProcessEnv, override = {}): { boxDrawing: boolean; halfBlocks: boolean } {
  const { profile } = resolveCapabilities({ env, platform: 'linux', override });
  return { boxDrawing: profile.glyphs.boxDrawing, halfBlocks: profile.glyphs.halfBlocks };
}

test('LC_ALL UTF-8 enables glyphs even when LANG is C', () => {
  expect(glyphs({ LC_ALL: 'en_US.UTF-8', LANG: 'C' })).toEqual({ boxDrawing: true, halfBlocks: true });
});

test('LC_CTYPE UTF-8 (no LC_ALL) enables glyphs', () => {
  expect(glyphs({ LC_CTYPE: 'de_DE.UTF-8', LANG: 'C' })).toEqual({ boxDrawing: true, halfBlocks: true });
});

test('a C/POSIX locale keeps glyphs off', () => {
  expect(glyphs({ LANG: 'C' })).toEqual({ boxDrawing: false, halfBlocks: false });
  expect(glyphs({ LANG: 'POSIX' })).toEqual({ boxDrawing: false, halfBlocks: false });
});

test('override.unicode.utf8 without a UTF-8 locale does NOT enable glyphs (locale is the trigger)', () => {
  expect(glyphs({ TERM: 'xterm' }, { unicode: { utf8: true } })).toEqual({ boxDrawing: false, halfBlocks: false });
});

test('a lowercase utf8 spelling is honored', () => {
  expect(glyphs({ LANG: 'en_US.utf8' })).toEqual({ boxDrawing: true, halfBlocks: true });
});
