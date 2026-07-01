/**
 * `MenuPopup` — a presentational dropdown (RD-05 AR-68).
 *
 * A `View` rendered from the controller's per-level state: a bordered list of item rows where the
 * highlighted row uses the `menuSelected` role, a disabled item is greyed, a `sub` item shows a `▸`,
 * and a separator is a horizontal rule. It owns no navigation state — the `MenuBar`-owned controller
 * (controller.ts) drives `items`/`highlight` and positions it (`layout.rect`) in the overlay.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { Style } from '@jsvision/core';
import type { LayoutProps } from '../layout/index.js';
import type { MenuItem } from './builders.js';
import { parseTilde } from './builders.js';

/** The sub-menu cascade indicator (Turbo Vision's CP437 0x10 `►`), drawn near a `sub` row's right border. */
const SUB_ARROW = '\u25BA'; // ►

/**
 * Single-line frame glyphs — the CP437 set Turbo Vision's `TMenuBox::frameChars` uses
 * (`┌─┐ │ └┘ ├┤`). The box is inset by one blank gutter column on each side, as TV draws it.
 */
const FRAME = {
  tl: '\u250C',
  tr: '\u2510',
  bl: '\u2514',
  br: '\u2518',
  h: '\u2500',
  v: '\u2502',
  lt: '\u251C',
  rt: '\u2524',
} as const; // ┌┐└┘─│├┤

/** A presentational dropdown driven by the controller (mounted into the overlay). */
export class MenuPopup extends View {
  /** The level's items. */
  items: readonly MenuItem[] = [];
  /** The highlighted row index. */
  highlight = 0;
  /** Whether a command is currently enabled (for greying). */
  isEnabled: (command: string) => boolean = () => true;
  /** Controller callback for a mouse-down on a content row (0-based item index). */
  onPick?: (row: number) => void;
  /** Free-floating placement in the overlay; the controller sets `rect`. */
  override layout: LayoutProps = { position: 'absolute' };

  /**
   * Route a mouse-down on an item row to the controller (AR-68). The top border is row 0 and the
   * bottom border the last row; an interior `y` maps to item index `y - 1`. Out-of-range clicks are
   * ignored. (Columns are irrelevant to which item a row click selects.)
   *
   * @param ev The dispatch envelope (mouse coords are view-local in `ev.local`).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse' || inner.kind !== 'down' || ev.local === undefined) return;
    const row = ev.local.y - 1; // skip the top border row
    if (row >= 0 && row < this.items.length) {
      this.onPick?.(row);
      ev.handled = true;
    }
  }

  /**
   * Draw the menu box exactly as Turbo Vision's `TMenuBox`: a single-line frame inset by one blank
   * gutter column on each side, item text padded one cell past the border (col 3), the highlighted
   * row's interior filled with `menuSelected`, disabled items greyed, separators joined with `├─┤`,
   * a `sub` row's `►` cascade marker near the right border, and an `item`'s `key` shortcut
   * right-aligned. Column layout (width `w`): gutter 0 · border 1 · pad 2 · text 3 … · border `w-2`
   * · gutter `w-1`.
   */
  draw(ctx: DrawContext): void {
    const w = ctx.size.width;
    const h = ctx.size.height;
    const base = ctx.color('menuBar');
    const selected = ctx.color('menuSelected');
    const disabledFg = ctx.role('shadow').fg; // darkGray — TV `cNormDisabled`/`cSelDisabled` fg (0x78/0x28)
    const disabled: Style = { fg: disabledFg, bg: base.bg };
    const selectedDisabled: Style = { fg: disabledFg, bg: selected.bg }; // TV `cSelDisabled` = darkGray on green
    // Accelerator-char accents (TV `cNormal`/`cSelect` high byte): red on the row's bg.
    const baseHot: Style = { fg: ctx.role('menuBar').hotkey ?? base.fg, bg: base.bg };
    const selHot: Style = { fg: ctx.role('menuSelected').hotkey ?? selected.fg, bg: selected.bg };

    // Whole box in the menu base color; the outer col-0 / col-(w-1) gutters stay blank (TV inset).
    ctx.fillRect(0, 0, w, h, ' ', base);

    // Single-line frame inset by the gutter: corners + edges + side verticals (TMenuBox::frameLine).
    ctx.text(1, 0, FRAME.tl, base);
    ctx.text(w - 2, 0, FRAME.tr, base);
    ctx.text(1, h - 1, FRAME.bl, base);
    ctx.text(w - 2, h - 1, FRAME.br, base);
    ctx.fillRect(2, 0, w - 4, 1, FRAME.h, base); // top edge
    ctx.fillRect(2, h - 1, w - 4, 1, FRAME.h, base); // bottom edge
    for (let y = 1; y < h - 1; y += 1) {
      ctx.text(1, y, FRAME.v, base);
      ctx.text(w - 2, y, FRAME.v, base);
    }

    for (let i = 0; i < this.items.length; i += 1) {
      const node = this.items[i];
      const y = i + 1;
      if (node.kind === 'separator') {
        // A separator joins the side borders with ├───┤ (frameChars n=15).
        ctx.text(1, y, FRAME.lt, base);
        ctx.fillRect(2, y, w - 4, 1, FRAME.h, base);
        ctx.text(w - 2, y, FRAME.rt, base);
        continue;
      }
      const enabled = node.kind === 'item' ? this.isEnabled(node.command) : true;
      const highlighted = i === this.highlight;
      // Row color: a highlighted enabled row uses the green `cSelect`; a highlighted disabled row the
      // dimmed `cSelDisabled` (darkGray on green); otherwise normal / disabled on the menu base.
      const style = highlighted ? (enabled ? selected : selectedDisabled) : enabled ? base : disabled;
      // Highlight fills the interior between the borders (TMenuBox getItemRect: cols 2..w-3).
      if (highlighted) ctx.fillRect(2, y, w - 4, 1, ' ', style);
      const label = parseTilde(node.title);
      ctx.text(3, y, label.text, style); // text inset past gutter + border + pad (TV col 3)
      // Accelerator-char accent (red) — only on enabled rows; TV's disabled palettes have no accent.
      if (enabled && label.hotkeyCol >= 0) {
        ctx.text(3 + label.hotkeyCol, y, label.text[label.hotkeyCol] ?? '', highlighted ? selHot : baseHot);
      }
      if (node.kind === 'sub') {
        ctx.text(w - 4, y, SUB_ARROW, style); // cascade marker (TV putChar size.x-4)
      } else if (node.kind === 'item' && node.key !== undefined) {
        ctx.text(w - 3 - node.key.length, y, node.key, style); // right-aligned shortcut (TV size.x-3-len)
      }
    }
  }
}
