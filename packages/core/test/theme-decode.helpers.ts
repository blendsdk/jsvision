/**
 * Shared Turbo Vision palette-decode tables + helper for theme spec oracles.
 *
 * These are the source-of-truth CGA palette tables copied verbatim from `magiblot/tvision`
 * (the project fidelity directive): a dialog slot (1-based) resolves through `cpGrayDialog` →
 * `cpAppColor` → an attribute byte `0xHL` (high nibble = background, low nibble = foreground) →
 * a DOS-16 `PALETTE` name. Both the RD-06 control-role oracle (`color-palette-theme.spec`) and the
 * RD-11 scrollbar/list-role oracle (`theme-roles.spec`) compute their expectations DIRECTLY from
 * these tables — never from the implementation — so a hand-decode error in `theme.ts` fails the
 * spec (RED), not the oracle.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { PALETTE } from '../src/engine/color/index.js';

/** The 16 DOS/CGA color indices in attribute-nibble order → our DOS-16 `PALETTE` names. */
export const DOS16: readonly (keyof typeof PALETTE)[] = [
  'black',
  'blue',
  'green',
  'cyan',
  'red',
  'magenta',
  'brown',
  'lightGray',
  'darkGray',
  'brightBlue',
  'brightGreen',
  'brightCyan',
  'brightRed',
  'brightMagenta',
  'yellow',
  'white',
];

/** `cpAppColor` (TV `include/tvision/app.h:142-151`), color number 1 → attribute byte, by row. */
export const CP_APP_COLOR: readonly number[] = [
  // prettier-ignore
  ...[0x71, 0x70, 0x78, 0x74, 0x20, 0x28, 0x24, 0x17, 0x1f, 0x1a, 0x31, 0x31, 0x1e, 0x71, 0x1f], // 1-15
  ...[0x37, 0x3f, 0x3a, 0x13, 0x13, 0x3e, 0x21, 0x3f, 0x70, 0x7f, 0x7a, 0x13, 0x13, 0x70, 0x7f, 0x7e], // 16-31
  ...[0x70, 0x7f, 0x7a, 0x13, 0x13, 0x70, 0x70, 0x7f, 0x7e, 0x20, 0x2b, 0x2f, 0x78, 0x2e, 0x70, 0x30], // 32-47
  ...[0x3f, 0x3e, 0x1f, 0x2f, 0x1a, 0x20, 0x72, 0x31, 0x31, 0x30, 0x2f, 0x3e, 0x31, 0x13, 0x38, 0x00], // 48-63
];

/** `cpGrayDialog` (TV `include/tvision/dialogs.h:80-82`), dialog slot 1 → `cpAppColor` number. */
export const CP_GRAY_DIALOG: readonly number[] = [
  // prettier-ignore
  ...[0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f], // 1-16
  ...[0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f], // 17-32
];

/** `cpBlueWindow` (TV `include/tvision/views.h:955`), window slot 1 → `cpAppColor` number. The blue
 *  window is the default `TWindow` palette — the canonical host for a `TOutlineViewer` (RD-15 PA-16). */
export const CP_BLUE_WINDOW: readonly number[] = [
  // prettier-ignore
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, // slots 1-8
];

/** Decode a gray-dialog slot (1-based) → the `{ fg, bg }` PALETTE pair the TV source produces. */
export function decodeGrayDialogSlot(slot: number): { fg: string; bg: string } {
  const colorNumber = CP_GRAY_DIALOG[slot - 1]; // slot → cpAppColor color number
  const attr = CP_APP_COLOR[colorNumber - 1]; // color number → attribute byte 0xHL
  return { fg: PALETTE[DOS16[attr & 0x0f]], bg: PALETTE[DOS16[(attr >> 4) & 0x0f]] };
}

/** Decode a blue-window slot (1-based) → the `{ fg, bg }` PALETTE pair the TV source produces. */
export function decodeBlueWindowSlot(slot: number): { fg: string; bg: string } {
  const colorNumber = CP_BLUE_WINDOW[slot - 1]; // slot → cpAppColor color number
  const attr = CP_APP_COLOR[colorNumber - 1]; // color number → attribute byte 0xHL
  return { fg: PALETTE[DOS16[attr & 0x0f]], bg: PALETTE[DOS16[(attr >> 4) & 0x0f]] };
}
