/**
 * Specification test (immutable oracle) — no-keyboard detection and the fallback
 * decision.
 *
 * The terminal needs a hardware keyboard to be useful, so a touch-primary device
 * (coarse pointer, no hover) is offered a recorded screenshot instead of the live
 * terminal. When the screenshot asset is not present yet, the region degrades to a
 * note plus the always-present source — never a broken image.
 */
import { test, expect } from 'vitest';
import { fallbackDecision, isNoKeyboardDevice, screenshotPath } from '../src/play/no-keyboard.js';

test('ST-12: isNoKeyboardDevice detects a coarse-pointer, no-hover device', () => {
  const coarseNoHover = (query: string) => ({ matches: query === '(hover: none) and (pointer: coarse)' });
  const desktop = () => ({ matches: false });
  expect(isNoKeyboardDevice(coarseNoHover)).toBe(true);
  expect(isNoKeyboardDevice(desktop)).toBe(false);
  // No matchMedia at all (SSR / headless) → treat as keyboard-capable.
  expect(isNoKeyboardDevice(undefined)).toBe(false);
});

test('ST-12: the fallback degrades interactive → screenshot → note-only', () => {
  expect(fallbackDecision(false, false)).toBe('interactive'); // has a keyboard
  expect(fallbackDecision(false, true)).toBe('interactive');
  expect(fallbackDecision(true, true)).toBe('screenshot'); // no keyboard + a recorded asset
  expect(fallbackDecision(true, false)).toBe('note-only'); // no keyboard, asset missing → note + source
});

test('ST-12: the screenshot path is derived from the example id', () => {
  expect(screenshotPath('controls/button')).toBe('/screenshots/controls/button.gif');
});
