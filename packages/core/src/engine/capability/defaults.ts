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
import type { CapabilityProfile, DeepPartial, Platform } from './profile.js';

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

/**
 * The best-known baseline for a modern Windows console.
 *
 * Windows exports no POSIX locale (`LC_*`/`LANG`), and a double-clicked
 * executable is handed to the terminal without `WT_SESSION`, so neither the
 * environment nor the known-terminal table reveals what the console can do —
 * leaving detection at the bare conservative floor (16-color, ASCII glyphs, no
 * mouse). Yet every supported Windows console (Windows Terminal, or a modern
 * conhost — the floor for a current Node runtime) provides 24-bit color, Unicode
 * with box-drawing/half-block glyphs, SGR mouse, the alternate screen, and
 * bracketed paste. This partial asserts exactly that, and only that: OSC
 * features, synchronized output, and enhanced keyboard protocols are
 * terminal-specific and stay for the table or a live probe to establish.
 */
const WIN32_BASELINE: DeepPartial<CapabilityProfile> = {
  colorDepth: 'truecolor',
  unicode: { utf8: true },
  glyphs: { boxDrawing: true, halfBlocks: true },
  mouse: { sgr: true, drag: true, wheel: true },
  altScreen: true,
  bracketedPaste: true,
};

/**
 * The platform-specific default overlay: the fields a platform is known to
 * guarantee beyond {@link CONSERVATIVE_DEFAULTS}. Windows returns the modern
 * console baseline (see {@link WIN32_BASELINE}); other platforms add nothing and
 * stay at the conservative floor, where a POSIX UTF-8 locale and the terminal
 * table already carry the signal.
 *
 * @param platform - the resolved host platform.
 * @returns a capability partial to merge over the conservative defaults (`{}` off Windows).
 */
export function platformDefaults(platform: Platform): DeepPartial<CapabilityProfile> {
  return platform === 'win32' ? WIN32_BASELINE : {};
}
