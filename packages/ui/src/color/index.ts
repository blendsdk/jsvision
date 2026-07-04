/**
 * Barrel for the RD-21 color family: the `ColorSwatch` color-grid view (a faithful `TColorSelector`
 * decode + extensions) + the `ColorPicker` dropdown (chip + anchored swatch/hex popup). The pure
 * `color-grid.ts` geometry/nav helpers stay internal (mirroring `calendar-grid`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
export { ColorSwatch } from './color-swatch.js';
export type { ColorSwatchOptions } from './color-swatch.js';
export { ColorPicker } from './color-picker.js';
export type { ColorPickerOptions } from './color-picker.js';
