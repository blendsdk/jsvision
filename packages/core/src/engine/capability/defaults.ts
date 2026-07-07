/**
 * The conservative fallback capabilities.
 *
 * These are the lowest-precedence values: any field that no stronger signal
 * (override, live probe, environment, or known-terminal table) determines falls
 * back to a safe, minimal assumption. `colorDepth` is `'16'` (the widely-safe
 * baseline), all capability booleans are `false`, Unicode width is `wcwidth`, and
 * `emoji` is `unknown`. `platform` here is a placeholder — the resolver always
 * replaces it with the real platform.
 */
import type { CapabilityProfile } from './profile.js';

/** Conservative defaults used when no stronger signal determines a field. */
export const CONSERVATIVE_DEFAULTS: CapabilityProfile = {
  colorDepth: '16',
  mouse: { sgr: false, drag: false, wheel: false },
  unicode: { utf8: false, widthMode: 'wcwidth', emoji: 'unknown' },
  osc: {
    hyperlink8: false,
    clipboard52: false,
    title: false,
    notify9: false,
    notify777: false,
    notify99: false,
    progress9_4: false,
  },
  sync2026: false,
  altScreen: false,
  bracketedPaste: false,
  keyboard: { kittyFlags: false, modifyOtherKeys: false },
  glyphs: { boxDrawing: false, halfBlocks: false, ambiguousWide: false },
  // Overridden by options.platform / process.platform during resolve.
  platform: 'linux',
  multiplexer: false,
};
