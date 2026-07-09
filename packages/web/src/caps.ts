/**
 * `buildBrowserCaps` — build the capability profile a browser xterm.js terminal advertises.
 *
 * xterm.js is a truecolor terminal with SGR mouse, drag tracking, and bracketed paste, and there is no
 * `process.env` to sniff, so this injects those facts directly. The synthetic `LANG=…UTF-8` flips
 * `unicode.utf8` + `glyphs.boxDrawing`/`halfBlocks` on, so `serialize()` emits real box-drawing
 * (`┌─┐│└┘`) and block glyphs (`█▄▀▒`) instead of the ASCII fallback. `colorDepth` is overridable, so a
 * lower depth exercises the existing truecolor→256→16→mono downsample chain (no new downsample code).
 */
import { resolveCapabilities } from '@jsvision/core';
import type { CapabilityProfile } from '@jsvision/core';

/** Options for {@link buildBrowserCaps}. */
export interface BrowserCapsOptions {
  /** Colour depth the profile advertises; a lower value makes `serialize()` downsample. Default `'truecolor'`. */
  readonly colorDepth?: 'truecolor' | '256' | '16' | 'mono';
}

/**
 * Build the browser {@link CapabilityProfile}: truecolor + UTF-8, with `colorDepth` overridable.
 *
 * @param options - optional overrides; `colorDepth` defaults to `'truecolor'`.
 * @returns the capability profile to hand `createBrowserHost` / `mountApp`.
 *
 * @example
 * import { buildBrowserCaps } from '@jsvision/web';
 *
 * const caps = buildBrowserCaps();                    // truecolor + UTF-8
 * const caps16 = buildBrowserCaps({ colorDepth: '16' }); // force serialize() to downsample to 16 colours
 */
export function buildBrowserCaps(options: BrowserCapsOptions = {}): CapabilityProfile {
  return resolveCapabilities({
    env: { COLORTERM: 'truecolor', TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
    platform: 'linux',
    override: { colorDepth: options.colorDepth ?? 'truecolor' },
  }).profile;
}
