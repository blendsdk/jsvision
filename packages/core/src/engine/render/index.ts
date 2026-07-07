/**
 * Public entry point of the rendering engine.
 *
 * Re-exports the rendering subsystem's public API: the width-correct
 * {@link ScreenBuffer} and cell/style types, the pure damage-diff {@link serialize}
 * with its {@link StyleEncoder} seam, the capability-driven {@link fallbackGlyph},
 * the OSC feature surface (hyperlinks, clipboard, title, bell, notifications), the
 * {@link cursor} controls, and {@link charWidth}.
 */

// Cell & style model.
export { ScreenBuffer } from './buffer.js';
export { Attr } from './types.js';
export type { Cell, Style, Color, Ansi16Name, AttrMask } from './types.js';

// Character width.
export { charWidth } from './width.js';
export type { WidthMode } from './width.js';

// Damage-diff serializer + style seam.
export { serialize, defaultEncodeStyle } from './serialize.js';
export type { StyleEncoder, RenderOptions } from './serialize.js';

// Glyph fallback.
export { fallbackGlyph } from './glyphs.js';

// ANSI vocabulary (shared with the host).
export { CSI, SGR_RESET, SYNC_BEGIN, SYNC_END, cursorTo } from './ansi.js';

// OSC features + cursor.
export { hyperlink, setClipboard, setTitle, bell, notify, cursor } from './osc.js';
