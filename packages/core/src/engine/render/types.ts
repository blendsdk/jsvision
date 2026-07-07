/**
 * Cell and style types for the rendering engine.
 *
 * The buffer stores your colors and an attribute bitmask per cell; turning a
 * `Color` + `AttrMask` into an SGR escape sequence is the {@link StyleEncoder}'s
 * job, not the cell's. Keeping `Color` a string union keeps cells small and makes
 * the serializer's run-merge comparisons cheap (plain string equality).
 */

/** The 16 named ANSI colors; the style encoder maps each to the terminal's actual color depth. */
export type Ansi16Name =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'brightBlack'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite';

/** An app-specified color: a 24-bit hex, a named ANSI-16 color, or the terminal default. */
export type Color = `#${string}` | Ansi16Name | 'default';

/** Text-attribute bitmask. One bit per attribute; combine several with bitwise `|`. */
export type AttrMask = number;

/**
 * Attribute bit constants. Combine them with bitwise OR, e.g.
 * `Attr.bold | Attr.underline`. The buffer stores them; the style encoder turns
 * them into SGR at serialize time.
 */
export const Attr = {
  none: 0,
  bold: 1 << 0,
  dim: 1 << 1,
  italic: 1 << 2,
  underline: 1 << 3,
  blink: 1 << 4,
  reverse: 1 << 5,
  strike: 1 << 6,
} as const;

/** A foreground/background/attribute style; used by every drawing helper. */
export interface Style {
  readonly fg: Color;
  readonly bg: Color;
  /** Attribute bitmask; defaults to `Attr.none`. */
  readonly attrs?: AttrMask;
}

/**
 * A single screen cell. `width` distinguishes normal (1), wide-lead (2), and
 * continuation (0) cells. A continuation cell emits no glyph.
 */
export interface Cell {
  char: string;
  fg: Color;
  bg: Color;
  attrs: AttrMask;
  /** Display width: 1 = normal, 2 = lead of a wide glyph, 0 = trailing continuation. */
  width: 0 | 1 | 2;
}
