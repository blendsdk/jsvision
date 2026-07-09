/**
 * A well-formed `#rrggbb` (or short `#rgb`) hex-color field validator for an `@jsvision/ui` `Input`.
 *
 * Unlike a bare charset filter, it distinguishes a *complete* value from the *growing prefix* the user
 * is still typing: `isValidInput` accepts `#` followed by up to 6 hex digits (so every keystroke of a
 * valid value passes), while `isValid` accepts only a finished `#rrggbb` or `#rgb`.
 */
import type { Validator } from '@jsvision/ui';

/** The growing prefix: `#` then 0–6 hex digits (empty is allowed so the field can be cleared). */
const PREFIX_RE = /^#[0-9a-fA-F]{0,6}$/;
/** A complete color: `#rgb` (3 digits) or `#rrggbb` (6 digits). */
const COMPLETE_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * The `#rrggbb`/`#rgb` hex validator — attach it to an `Input` for a color field.
 *
 * @example
 * import { Input, signal } from '@jsvision/ui';
 * import { hexValidator } from './model/hex-validator.js';
 *
 * const text = signal('#3b82f6');
 * const field = new Input({ value: text, validator: hexValidator });
 * hexValidator.isValid('#3b82f6'); // true
 * hexValidator.isValid('#12');     // false — incomplete
 */
export const hexValidator: Validator = {
  isValidInput: (s: string): boolean => s === '' || PREFIX_RE.test(s),
  isValid: (s: string): boolean => COMPLETE_RE.test(s),
  error: 'expected a hex color like #rrggbb or #rgb',
};
