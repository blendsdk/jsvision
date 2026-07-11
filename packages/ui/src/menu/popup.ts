/**
 * A single dropdown menu box — the visual list of items that appears when a menu opens.
 *
 * A `MenuPopup` is purely presentational: a bordered list of item rows where the highlighted row is
 * shown selected, disabled items are greyed, a submenu row shows a `►` cascade marker, and a
 * separator is a horizontal rule. It holds no navigation state of its own — the menu bar's controller
 * sets its `items`, `highlight`, and screen position and mounts it into the app overlay. You don't
 * construct these directly; a {@link MenuBar} creates them as menus open.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { Style } from '@jsvision/core';
import type { LayoutProps } from '../layout/index.js';
import type { MenuItem } from './builders.js';
import { parseTilde } from './builders.js';

/** The submenu cascade indicator (`►`), drawn near a submenu row's right border. */
const SUB_ARROW = '\u25BA'; // ►

/**
 * Single-line frame glyphs (`┌─┐ │ └┘ ├┤`). The box is inset by one blank gutter column on each side.
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

/**
 * A single dropdown menu box, driven by the menu bar's controller and mounted into the app overlay.
 * You do not create these yourself — build a menu with {@link menuBar} and the bar produces its
 * popups as menus open.
 *
 * @example
 * import { menuBar, subMenu, item } from '@jsvision/ui';
 *
 * // A MenuBar renders MenuPopup boxes for you when a menu opens:
 * const bar = menuBar([subMenu('~F~ile', [item('~O~pen', 'file.open'), item('E~x~it', 'quit')])]);
 * // Pass `bar` to createApplication; opening "File" shows its MenuPopup.
 */
export class MenuPopup extends View {
  /** The items shown in this box. */
  items: readonly MenuItem[] = [];
  /** The highlighted row index. */
  highlight = 0;
  /** Predicate for whether a command is enabled — a disabled item is greyed and non-selectable. */
  isEnabled: (command: string) => boolean = () => true;
  /** Called when a content row is clicked, with the 0-based item index. */
  onPick?: (row: number) => void;
  /** Absolute placement in the overlay; the controller sets `rect`. */
  override layout: LayoutProps = { position: 'absolute' };

  /**
   * Route a mouse-down on an item row to {@link onPick}. Row 0 is the top border and the last row the
   * bottom border, so an interior click at view-local `y` selects item `y - 1`; clicks outside the
   * item range are ignored. The clicked column does not matter.
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
   * Draw the menu box: a single-line frame inset by one blank gutter column on each side, item text
   * padded one cell past the border, the highlighted row filled with the selected colour, disabled
   * items greyed, separators joined with `├─┤`, a submenu row's `►` cascade marker near the right
   * border, and an item's shortcut key right-aligned. Column layout (width `w`): gutter 0 · border 1
   * · pad 2 · text 3 … · border `w-2` · gutter `w-1`.
   */
  draw(ctx: DrawContext): void {
    const w = ctx.size.width;
    const h = ctx.size.height;
    const base = ctx.color('menuBar');
    const selected = ctx.color('menuSelected');
    const disabledFg = ctx.role('shadow').fg; // darkGray — the greyed foreground for disabled rows
    const disabled: Style = { fg: disabledFg, bg: base.bg };
    const selectedDisabled: Style = { fg: disabledFg, bg: selected.bg }; // greyed on the selected bg
    // Accelerator-character accent colours on each row background.
    const baseHot: Style = { fg: ctx.role('menuBar').hotkey ?? base.fg, bg: base.bg };
    const selHot: Style = { fg: ctx.role('menuSelected').hotkey ?? selected.fg, bg: selected.bg };

    // Whole box in the menu base colour; the outer col-0 / col-(w-1) gutters stay blank (the inset).
    ctx.fillRect(0, 0, w, h, ' ', base);

    // Single-line frame inset by the gutter: corners + edges + side verticals.
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
      if (node.kind === 'separator' || node.kind === 'spacer') {
        // A separator joins the side borders with ├───┤ (a stray top-level spacer is drawn the same).
        ctx.text(1, y, FRAME.lt, base);
        ctx.fillRect(2, y, w - 4, 1, FRAME.h, base);
        ctx.text(w - 2, y, FRAME.rt, base);
        continue;
      }
      const enabled = node.kind === 'item' ? this.isEnabled(node.command) : true;
      const highlighted = i === this.highlight;
      // Row colour: a highlighted enabled row is selected; a highlighted disabled row is greyed on
      // the selected background; otherwise normal / greyed on the menu base.
      const style = highlighted ? (enabled ? selected : selectedDisabled) : enabled ? base : disabled;
      // The highlight fills the interior between the borders.
      if (highlighted) ctx.fillRect(2, y, w - 4, 1, ' ', style);
      const label = parseTilde(node.title);
      ctx.text(3, y, label.text, style); // text inset past gutter + border + pad
      // Accelerator-character accent — only on enabled rows; a greyed row has no accent.
      if (enabled && label.hotkeyCol >= 0) {
        ctx.text(3 + label.hotkeyCol, y, label.text[label.hotkeyCol] ?? '', highlighted ? selHot : baseHot);
      }
      if (node.kind === 'sub') {
        ctx.text(w - 4, y, SUB_ARROW, style); // submenu cascade marker
      } else if (node.kind === 'item' && node.key !== undefined) {
        ctx.text(w - 3 - node.key.length, y, node.key, style); // right-aligned shortcut key
      }
    }
  }
}
