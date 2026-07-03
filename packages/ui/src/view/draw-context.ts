/**
 * The stateless, view-local, auto-clipped paint facade (RD-03, AR-38/AR-39). `makeDrawContext`
 * builds the object handed to `View.draw(ctx)` for one compose pass, from: the shared
 * `ScreenBuffer`, the view's absolute rect (origin + size), the absolute clip rect (view rect ∩
 * ancestor clip), and the active `Theme`.
 *
 * Every coordinate is view-local (origin = the view's top-left). Each writer translates to
 * absolute coords, drops cells outside the clip, and routes the survivors through `ScreenBuffer`
 * — which also clips to the screen edge and runs `sanitize` on text, preserving core's injection
 * boundary (AC-16). RD-03 never emits raw escape sequences.
 */
import { Attr, charWidth, sanitize } from '@jsvision/core';
import type { Style, Theme, ScreenBuffer, CapabilityProfile } from '@jsvision/core';
import type { Rect, Size2D } from '../layout/index.js';
import type { DrawContext, ThemeRoleName } from './types.js';
import { themeRoleToStyle } from './theme-style.js';
import { intersect } from './geometry.js';

/** Style used when a writer's `style` argument is omitted (terminal default fg/bg). */
const DEFAULT_STYLE: Style = { fg: 'default', bg: 'default' };

/** Width-resolution mode — matches `ScreenBuffer`'s own default so clip math agrees with the buffer. */
const WIDTH_MODE = 'wcwidth';

/** Sum of the display widths of a string's code points (combining marks count 0). HR-30. */
function displayWidth(str: string): number {
  let total = 0;
  for (const glyph of str) total += charWidth(glyph.codePointAt(0) ?? 0x20, WIDTH_MODE);
  return total;
}

/** Clip `str` to at most `maxWidth` display columns without splitting a wide glyph. HR-30. */
function clipToWidth(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  let out = '';
  let used = 0;
  for (const glyph of str) {
    const w = charWidth(glyph.codePointAt(0) ?? 0x20, WIDTH_MODE);
    if (used + w > maxWidth) break;
    out += glyph;
    used += w;
  }
  return out;
}

/**
 * Single-line box glyphs. Core's `BOX` table is not exported, so this small set is duplicated here
 * so `box()` can clip per cell; the serializer still substitutes ASCII when `boxDrawing` is off.
 */
const BOX_SINGLE = { tl: '\u250C', tr: '\u2510', bl: '\u2514', br: '\u2518', h: '\u2500', v: '\u2502' } as const; // ┌┐└┘─│

/**
 * Build a clipped, view-local `DrawContext` over the shared buffer for one view's compose pass.
 *
 * @param buffer   The shared screen buffer (the single compose target).
 * @param viewRect The view's **absolute** rect (origin + content size).
 * @param clip     The **absolute** clip rect (view rect ∩ ancestor clip); out-of-clip writes drop.
 * @param theme    The active theme, for `color(role)` resolution.
 * @param caps     The resolved terminal capabilities for this frame (RD-18 PA-1) — surfaced on the
 *                 context so a widget can pick its ASCII glyph form at draw time; the render root
 *                 passes the same profile `serialize()` encodes with.
 * @returns A `DrawContext` whose writes are offset to `viewRect` and clipped to `clip`.
 */
export function makeDrawContext(
  buffer: ScreenBuffer,
  viewRect: Rect,
  clip: Rect,
  theme: Theme,
  caps: CapabilityProfile,
): DrawContext {
  const ox = viewRect.x;
  const oy = viewRect.y;
  const size: Size2D = { width: viewRect.width, height: viewRect.height };
  const clipRight = clip.x + clip.width;
  const clipBottom = clip.y + clip.height;

  /** True when an absolute cell lies inside the clip rect. */
  function inClip(absX: number, absY: number): boolean {
    return absX >= clip.x && absX < clipRight && absY >= clip.y && absY < clipBottom;
  }

  /**
   * Write one glyph at an absolute cell, dropping it if outside the clip. A wide glyph (width 2)
   * straddling the clip's right edge is dropped whole — never a half-glyph.
   */
  function putGlyph(absX: number, absY: number, glyph: string, style: Style, w: 0 | 1 | 2): void {
    if (absY < clip.y || absY >= clipBottom) return;
    if (absX < clip.x) return;
    if (absX + Math.max(1, w) > clipRight) return;
    buffer.set(absX, absY, glyph, style, WIDTH_MODE);
  }

  function text(x: number, y: number, str: string, style: Style = DEFAULT_STYLE): void {
    const absY = oy + y;
    let absX = ox + x;
    // HR-30: accumulate each base glyph plus its trailing combining marks into one cluster so the
    // marks compose onto the base cell (via ScreenBuffer.set storing the whole cluster) instead of
    // being dropped. A leading mark with no base has nothing to compose onto and is skipped.
    let cluster = '';
    let clusterWidth: 0 | 1 | 2 = 1;
    let clusterX = absX;
    const emit = (): void => {
      if (cluster !== '') putGlyph(clusterX, absY, cluster, style, clusterWidth);
    };
    for (const glyph of sanitize(str)) {
      const cp = glyph.codePointAt(0) ?? 0x20;
      const w = charWidth(cp, WIDTH_MODE);
      if (w === 0) {
        if (cluster !== '') cluster += glyph;
        continue;
      }
      emit();
      cluster = glyph;
      clusterWidth = w;
      clusterX = absX;
      absX += w;
    }
    emit();
  }

  function fillRect(x: number, y: number, w: number, h: number, char: string, style: Style = DEFAULT_STYLE): void {
    const region = intersect({ x: ox + x, y: oy + y, width: w, height: h }, clip);
    if (region.width <= 0 || region.height <= 0) return;
    buffer.fillRect(region.x, region.y, region.width, region.height, char, style);
  }

  function fill(char: string, style: Style = DEFAULT_STYLE): void {
    fillRect(0, 0, size.width, size.height, char, style);
  }

  function box(x: number, y: number, w: number, h: number, style: Style = DEFAULT_STYLE, title?: string): void {
    if (w < 2 || h < 2) return;
    const ax = ox + x;
    const ay = oy + y;
    const g = BOX_SINGLE;
    fillRect(x, y, w, h, ' ', style); // opaque interior (clipped)
    putGlyph(ax, ay, g.tl, style, 1);
    putGlyph(ax + w - 1, ay, g.tr, style, 1);
    putGlyph(ax, ay + h - 1, g.bl, style, 1);
    putGlyph(ax + w - 1, ay + h - 1, g.br, style, 1);
    for (let col = 1; col < w - 1; col += 1) {
      putGlyph(ax + col, ay, g.h, style, 1);
      putGlyph(ax + col, ay + h - 1, g.h, style, 1);
    }
    for (let row = 1; row < h - 1; row += 1) {
      putGlyph(ax, ay + row, g.v, style, 1);
      putGlyph(ax + w - 1, ay + row, g.v, style, 1);
    }
    if (title !== undefined && title.length > 0) {
      // HR-30: center by DISPLAY width (not code-point count) and clip to the interior, so a
      // CJK/emoji title stays centered and never overruns the frame (same contract as core HR-25).
      const interior = w - 2;
      const label = clipToWidth(` ${title} `, interior);
      const tx = x + 1 + Math.max(0, Math.floor((interior - displayWidth(label)) / 2));
      text(tx, y, label, style); // view-local coords → clipped like any text
    }
  }

  function shadow(x: number, y: number, w: number, h: number, style: Style = DEFAULT_STYLE): void {
    const attrs = style.attrs ?? Attr.none;
    const darken = (absX: number, absY: number): void => {
      if (!inClip(absX, absY)) return;
      const cell = buffer.get(absX, absY);
      if (cell) {
        // Keep the glyph (and its width) — only the colors change, like core's shadow.
        cell.fg = style.fg;
        cell.bg = style.bg;
        cell.attrs = attrs;
      }
    };
    const ax = ox + x;
    const ay = oy + y;
    // TV `shadowSize = {2,1}`: a 2-column right edge + a 1-row bottom edge (the L-shaped drop shadow).
    for (let row = 0; row < h; row += 1) {
      darken(ax + w, ay + row + 1);
      darken(ax + w + 1, ay + row + 1);
    }
    for (let col = 0; col < w; col += 1) darken(ax + col + 1, ay + h);
  }

  function color(role: ThemeRoleName): Style {
    return themeRoleToStyle(theme[role]);
  }

  /** Raw role access (RD-05 PA-16): the full `Theme[K]` incl. role-only extras `color` drops. */
  function role<K extends ThemeRoleName>(name: K): Theme[K] {
    return theme[name];
  }

  return { text, fillRect, fill, box, shadow, color, role, size, caps };
}
