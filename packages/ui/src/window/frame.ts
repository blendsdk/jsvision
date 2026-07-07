/**
 * Window frame drawing and hit-zone geometry — the internal helpers behind `Window`'s chrome.
 *
 * These are plain functions (not a `View`) used by `Window`. `drawFrame` paints the border, centered
 * title, window number, close box `[×]`, zoom box `[↑]`/`[↕]`, and — on an active resizable window —
 * the bottom corner drag grips, all in the window-local coordinate space. `frameZoneAt` is the
 * inverse: given a window-local point, it says which of those regions a mouse-down landed on. Border
 * and title colours come from the theme role, so an active window and an inactive one differ in the
 * whole border/title styling, not just the foreground.
 *
 * Chrome layout (window-local, size w×h): close `[×]` at columns 2–4, zoom `[↑]`/`[↕]` at columns
 * w-5…w-3, the number at column w-7, the title centered and truncated so it never overruns those, and
 * the grips `└─` at columns (0,1) and `─┘` at columns (w-2, w-1) of the bottom row. The boxes are
 * drawn last so they sit over the title. The close/zoom boxes and both grips appear only on the
 * active window; the number is shown on active and inactive windows alike. The bottom-right grip
 * resizes from that corner; the bottom-left grip grows the window leftward with the right edge fixed.
 * The close glyph is `×` (rather than a filled square) because a square renders at an ambiguous width
 * on many terminals and would misalign.
 */
import type { Style } from '@jsvision/core';
import type { DrawContext, Point } from '../view/index.js';
import type { Size2D } from '../layout/index.js';

/** A frame hit-zone — what a mouse-down at a window-local point means. */
export type FrameZone = 'close' | 'zoom' | 'resize' | 'resize-left' | 'title' | 'interior' | 'border';

/** The window flags that gate which affordances exist (a disabled affordance is not a hit-zone). */
export interface WindowFlags {
  movable: boolean;
  resizable: boolean;
  zoomable: boolean;
  closable: boolean;
}

/** The window state the frame draws. */
export interface FrameState {
  title: string;
  number?: number;
  active: boolean;
  zoomed: boolean;
  /** Whether the window can be resized — shows the corner drag grips. */
  resizable: boolean;
  /** Whether the window can be closed — shows the close `[×]` box. Defaults to `true`. */
  closable?: boolean;
  /** Whether the window can be zoomed — shows the zoom `[↑]`/`[↕]` box. Defaults to `true`. */
  zoomable?: boolean;
}

/**
 * The theme role a frame is drawn in: an active window, an inactive window, or a dialog. The role
 * supplies the border, title, and icon colours.
 */
export type FrameRole = 'window' | 'windowInactive' | 'dialog';

/** Chrome glyphs (stored as-is in the buffer; the renderer handles any ASCII fallback). */
const CLOSE_GLYPH = '\u00D7'; // ×
const MAXIMIZE_GLYPH = '\u2191'; // ↑ maximize
const RESTORE_GLYPH = '\u2195'; // ↕ restore (un-maximize) arrow

/** A rectangular-border glyph set (corners + horizontal/vertical edges). */
interface BorderGlyphs {
  readonly tl: string;
  readonly tr: string;
  readonly bl: string;
  readonly br: string;
  readonly h: string;
  readonly v: string;
}

/** Single-line border (┌┐└┘─│) — drawn around an inactive window. */
const SINGLE_BORDER: BorderGlyphs = {
  tl: '\u250C',
  tr: '\u2510',
  bl: '\u2514',
  br: '\u2518',
  h: '\u2500',
  v: '\u2502',
}; // ┌┐└┘─│
/** Double-line border (╔╗╚╝═║) — drawn around the active (focused) window. */
const DOUBLE_BORDER: BorderGlyphs = {
  tl: '\u2554',
  tr: '\u2557',
  bl: '\u255A',
  br: '\u255D',
  h: '\u2550',
  v: '\u2551',
}; // ╔╗╚╝═║

/**
 * Draw a rectangular border with `glyphs` over a `w×h` window-local rect, filling the interior
 * opaquely first so content children inset over a solid field.
 *
 * @param ctx    The window's clipped draw context.
 * @param w      Full width (border included).
 * @param h      Full height (border included).
 * @param glyphs The corner/edge glyph set (single- or double-line).
 * @param style  The border fg/bg style.
 */
function drawBorder(ctx: DrawContext, w: number, h: number, glyphs: BorderGlyphs, style: Style): void {
  ctx.fillRect(0, 0, w, h, ' ', style); // opaque interior
  ctx.text(0, 0, glyphs.tl, style);
  ctx.text(w - 1, 0, glyphs.tr, style);
  ctx.text(0, h - 1, glyphs.bl, style);
  ctx.text(w - 1, h - 1, glyphs.br, style);
  for (let col = 1; col < w - 1; col += 1) {
    ctx.text(col, 0, glyphs.h, style);
    ctx.text(col, h - 1, glyphs.h, style);
  }
  for (let row = 1; row < h - 1; row += 1) {
    ctx.text(0, row, glyphs.v, style);
    ctx.text(w - 1, row, glyphs.v, style);
  }
}

/**
 * Draw the window frame chrome into its window-local rect. The border also fills the interior with
 * the role background, so content children compose over an opaque field.
 *
 * @param ctx   The window's clipped draw context (window-local origin).
 * @param size  The window's full rect size (border included).
 * @param state The title/number/active/zoomed state to render.
 * @param role  The theme role (active `window`, `windowInactive`, or `dialog`) for the border/title/icon colours.
 */
export function drawFrame(ctx: DrawContext, size: Size2D, state: FrameState, role: FrameRole): void {
  const { width: w, height: h } = size;
  if (w < 2 || h < 2) return; // too small for a frame — draw nothing
  const theme = ctx.role(role);
  const borderStyle = { fg: theme.border, bg: theme.bg };
  const titleStyle = { fg: theme.title, bg: theme.bg };
  // The brighter icon accent: the `[ ]` brackets keep the border colour, while the inner icon glyph
  // and the resize grips use this so they stand out.
  const iconStyle = { fg: theme.icon, bg: theme.bg };

  // A double-line border for the active window, single for an inactive one. Also fills the interior
  // so content insets over an opaque field.
  drawBorder(ctx, w, h, state.active ? DOUBLE_BORDER : SINGLE_BORDER, borderStyle);

  // Window number (1–9) at column w-7, in the border colour — shown on both active and inactive
  // windows (unlike the close/zoom boxes, which are active-only).
  if (state.number !== undefined && state.number >= 1 && state.number <= 9 && w >= 8) {
    ctx.text(w - 7, 0, String(state.number), borderStyle);
  }

  // Centered title, truncated so it can never overrun the icon/number zones: start from width−10,
  // reserve 6 more for the close/zoom boxes, and 4 more when a number is shown. Padded with one
  // space on each side.
  if (state.title.length > 0) {
    let max = w - 10 - 6; // −6: close + zoom boxes
    if (state.number !== undefined) max -= 4; // −4: window number
    const titleText = max > 0 ? [...state.title].slice(0, max).join('') : '';
    if (titleText.length > 0) {
      const i = Math.max(1, Math.floor((w - titleText.length) / 2));
      ctx.text(i - 1, 0, ` ${titleText} `, titleStyle);
    }
  }

  // Close box [×] (cols 2–4) and zoom box [↑]/[↕] (cols w-5…w-3) — only on the active window, and
  // each only when its flag is set (a dialog, for example, is closable but not zoomable, so it shows
  // the close box and no zoom box). Both default to shown. Brackets in the border colour, inner glyph
  // in the icon accent.
  const closable = state.closable ?? true;
  const zoomable = state.zoomable ?? true;
  if (state.active && w >= 8) {
    if (closable) {
      ctx.text(2, 0, '[', borderStyle);
      ctx.text(3, 0, CLOSE_GLYPH, iconStyle);
      ctx.text(4, 0, ']', borderStyle);
    }
    if (zoomable) {
      ctx.text(w - 5, 0, '[', borderStyle);
      ctx.text(w - 4, 0, state.zoomed ? RESTORE_GLYPH : MAXIMIZE_GLYPH, iconStyle);
      ctx.text(w - 3, 0, ']', borderStyle);
    }
  }

  // Drag grips: only on an active, resizable window. They overlay both bottom corners with the
  // single-line `└─` (cols 0,1) and `─┘` (cols w-2,w-1) in the icon accent so they stand out against
  // the double-line active border.
  if (state.active && state.resizable && w >= 4) {
    ctx.text(0, h - 1, SINGLE_BORDER.bl, iconStyle); // └
    ctx.text(1, h - 1, SINGLE_BORDER.h, iconStyle); // ─
    ctx.text(w - 2, h - 1, SINGLE_BORDER.h, iconStyle); // ─
    ctx.text(w - 1, h - 1, SINGLE_BORDER.br, iconStyle); // ┘
  }
}

/**
 * Given a window-local point, report which frame region a mouse-down there means. A disabled
 * affordance never returns its zone — those points fall through to `title` or `border`.
 *
 * @param size  The window's full rect size.
 * @param local The window-local point of the mouse-down.
 * @param flags The window's movable/resizable/zoomable/closable flags.
 * @returns The hit-zone the point lands in.
 */
export function frameZoneAt(size: Size2D, local: Point, flags: WindowFlags): FrameZone {
  const { width: w, height: h } = size;
  const { x, y } = local;

  // Bottom-row resize grips take precedence over the border. The two left cells (0,1) grow the
  // window leftward; the bottom-right corner grows it from that corner. Both require `resizable`, so
  // a fixed window's bottom row falls through to `border`.
  if (flags.resizable && y === h - 1 && x <= 1) return 'resize-left';
  if (flags.resizable && x === w - 1 && y === h - 1) return 'resize';

  // The top border row: close box (cols 2–4), zoom box (cols w-5…w-3), else the draggable title.
  if (y === 0) {
    if (flags.closable && x >= 2 && x <= 4) return 'close';
    if (flags.zoomable && x >= w - 5 && x <= w - 3) return 'zoom';
    return 'title';
  }

  if (x === 0 || x === w - 1 || y === h - 1) return 'border';
  return 'interior';
}
