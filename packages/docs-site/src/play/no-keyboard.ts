/**
 * No-keyboard detection and the fallback decision for the Play component.
 *
 * The live terminal needs a hardware keyboard, so a touch-primary device (a
 * coarse pointer with no hover) is offered a recorded screenshot instead. If that
 * screenshot asset does not exist yet, the region degrades to a note plus the
 * always-present source — never a broken image.
 */

/** A `matchMedia`-style query function. */
export type MatchMedia = (query: string) => { matches: boolean };

/** The global `matchMedia`, if present (absent under SSR / headless). */
function readGlobalMatchMedia(): MatchMedia | undefined {
  const scope: { matchMedia?: MatchMedia } = globalThis;
  return scope.matchMedia;
}

/**
 * Whether the device is touch-primary with no hardware keyboard (a coarse pointer
 * and no hover).
 *
 * @param mm - the media-query function; defaults to the global `matchMedia`, and is
 *   `undefined` under SSR/headless (treated as keyboard-capable).
 * @returns `true` for a touch-primary device, else `false`.
 * @example
 * import { isNoKeyboardDevice } from '../src/play/no-keyboard.js';
 *
 * if (isNoKeyboardDevice()) showScreenshotFallback();
 * else showPlayButton();
 */
export function isNoKeyboardDevice(mm?: MatchMedia): boolean {
  const fn = mm ?? readGlobalMatchMedia();
  return fn !== undefined && fn('(hover: none) and (pointer: coarse)').matches;
}

/** What the Play region renders. */
export type FallbackKind = 'interactive' | 'screenshot' | 'note-only';

/**
 * Decide what the Play region renders: the interactive terminal (keyboard
 * present), a recorded screenshot (no keyboard + the asset exists), or a note plus
 * the always-present source (no keyboard, asset missing).
 *
 * @param noKeyboard - whether the device lacks a hardware keyboard.
 * @param hasScreenshot - whether the recorded screenshot asset exists.
 * @returns the fallback kind to render.
 * @example
 * fallbackDecision(false, false); // 'interactive'
 * fallbackDecision(true, true);   // 'screenshot'
 * fallbackDecision(true, false);  // 'note-only'
 */
export function fallbackDecision(noKeyboard: boolean, hasScreenshot: boolean): FallbackKind {
  if (!noKeyboard) return 'interactive';
  return hasScreenshot ? 'screenshot' : 'note-only';
}

/**
 * The conventional recorded-screenshot path for an example id.
 *
 * @param id - the example id (`'controls/button'`).
 * @returns the public asset path (`'/screenshots/controls/button.gif'`).
 * @example
 * screenshotPath('controls/button'); // '/screenshots/controls/button.gif'
 */
export function screenshotPath(id: string): string {
  return `/screenshots/${id}.gif`;
}
