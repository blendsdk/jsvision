/**
 * The application menu bar: the top row of menu titles and the entry point for keyboard/mouse menu
 * navigation.
 *
 * The bar sees keys before the focused window, so its accelerators always work. It draws the
 * top-level titles with their `~hotkey~` character accented, and opens a menu on F10, on `Alt`+a
 * title's hotkey, or on a title click. While a menu is open it drives navigation — `↑↓` to move,
 * `Enter` to activate, `←→` to switch/open submenus, `Esc` to back out, and typing an item's hotkey
 * letter — consuming those keys so they never reach the focused window. The dropdown popups are
 * hosted in the app's overlay layer.
 *
 * You normally build one with {@link menuBar} and pass it to `createApplication({ menuBar })` rather
 * than constructing it directly.
 */
import type { Style } from '@jsvision/core';
import { View } from '../view/index.js';
import type { Group, DrawContext, DispatchEvent } from '../view/index.js';
import type { MenuItem } from './builders.js';
import { layoutTitles, titleIndexAt, accentStyle } from './builders.js';
import { createMenuController } from './controller.js';
import type { MenuController, MenuLoopSeam } from './controller.js';

/**
 * The application menu bar. Build one with {@link menuBar} and give it to the application.
 *
 * @example
 * import { createApplication, menuBar, subMenu, item, separator, Commands } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({
 *   caps,
 *   menuBar: menuBar([
 *     subMenu('~F~ile', [item('~N~ew', 'file.new'), separator(), item('E~x~it', Commands.quit, 'Alt+X')]),
 *     subMenu('~W~indow', [item('~T~ile', Commands.tile, 'F4'), item('~C~ascade', Commands.cascade, 'F5')]),
 *   ]),
 * });
 * // Press F10, then Alt+F, or click a title to open a menu.
 */
export class MenuBar extends View {
  /** The top-level menu nodes (usually set for you by the {@link menuBar} builder). */
  items: readonly MenuItem[] = [];
  /** The navigation controller; `null` until the application wires it in via {@link attach}. */
  controller: MenuController | null = null;

  constructor() {
    super();
    this.preProcess = true; // see accelerator keys before the focused window does
  }

  /**
   * @internal Wire the navigation controller. Called once by `createApplication` with the overlay
   * layer that hosts the popups and the loop seam used for activation/greying/focus.
   *
   * @param overlay The app-root overlay layer (top-most, absolute, full-viewport).
   * @param seam    The loop seam (`emitCommand`/`isCommandEnabled`/`focusView`/`getFocused`).
   */
  attach(overlay: Group, seam: MenuLoopSeam): void {
    this.controller = createMenuController(this.items, overlay, seam);
  }

  /** Draw the bar background then each top-level title, accenting its `~hotkey~` character. */
  draw(ctx: DrawContext): void {
    const base = ctx.color('menuBar');
    const selected = ctx.color('menuSelected');
    // The accelerator character is always drawn in the hotkey accent (whether the menu is open or
    // closed); the open title uses the selected palette. The accent also picks up an underline while
    // the accelerator overlay is being revealed.
    const baseAccent: Style = accentStyle(
      { fg: ctx.role('menuBar').hotkey ?? base.fg, bg: base.bg },
      ctx.revealAccelerators,
    );
    const selAccent: Style = accentStyle(
      { fg: ctx.role('menuSelected').hotkey ?? selected.fg, bg: selected.bg },
      ctx.revealAccelerators,
    );
    const open = this.controller?.isOpen() === true;

    const openIndex = this.controller?.openIndex() ?? null;
    ctx.fillRect(0, 0, ctx.size.width, 1, ' ', base);
    for (const title of layoutTitles(this.items)) {
      const isOpen = open && openIndex === title.index;
      const style = isOpen ? selected : base;
      const accent = isOpen ? selAccent : baseAccent;
      // Each title is a ` text ` button: the whole button (both pad spaces included) carries the
      // colour, and the text is inset one column past the leading pad.
      ctx.fillRect(title.x, 0, title.width, 1, ' ', style);
      ctx.text(title.x + 1, 0, title.label.text, style);
      if (title.label.hotkeyCol >= 0) {
        const hotChar = title.label.text[title.label.hotkeyCol] ?? '';
        ctx.text(title.x + 1 + title.label.hotkeyCol, 0, hotChar, accent);
      }
    }
  }

  /**
   * Handle a key or a title click. Keys reach the bar before the focused window; mouse-downs arrive
   * when they land on the bar row.
   *
   * @param ev The dispatch envelope; setting `ev.handled = true` consumes the event.
   */
  override onEvent(ev: DispatchEvent): void {
    const controller = this.controller;
    if (controller === null) return;
    const inner = ev.event;

    if (inner.type === 'mouse') {
      if (inner.kind === 'down' && ev.local !== undefined) {
        const index = titleIndexAt(this.items, ev.local.x);
        if (index !== null) {
          controller.openTop(index);
          ev.handled = true;
        }
      }
      return;
    }
    if (inner.type !== 'key') return;

    // Alt+<letter> opens/switches to that top-level menu, whether the menu is open or closed.
    if (inner.alt && inner.key.length === 1) {
      if (controller.topHotkey(inner.key)) ev.handled = true;
      return;
    }
    if (inner.key === 'f10') {
      if (controller.isOpen()) controller.close();
      else controller.openTop(0);
      ev.handled = true;
      return;
    }
    if (!controller.isOpen()) return; // closed: pass every other key to the focused view

    switch (inner.key) {
      case 'up':
        controller.move(-1);
        ev.handled = true;
        break;
      case 'down':
        controller.move(1);
        ev.handled = true;
        break;
      case 'left':
        controller.left();
        ev.handled = true;
        break;
      case 'right':
        controller.right();
        ev.handled = true;
        break;
      case 'enter':
        controller.activate();
        ev.handled = true;
        break;
      case 'escape':
        controller.closeLevel();
        ev.handled = true;
        break;
      default:
        if (inner.key.length === 1 && controller.itemHotkey(inner.key)) ev.handled = true;
        break;
    }
  }
}

/**
 * Build a {@link MenuBar} from a list of top-level menu entries. This only assembles the data; the
 * application wires up navigation when you pass the bar to `createApplication`.
 *
 * @param items The top-level menu nodes (each usually a {@link subMenu}).
 * @returns A constructed `MenuBar`.
 * @example
 * import { createApplication, menuBar, subMenu, item, Commands } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const bar = menuBar([
 *   subMenu('~W~indow', [item('~T~ile', Commands.tile, 'F4'), item('E~x~it', Commands.quit)]),
 * ]);
 * const app = createApplication({ caps: resolveCapabilities().profile, menuBar: bar });
 */
export function menuBar(items: MenuItem[]): MenuBar {
  const bar = new MenuBar();
  bar.items = items;
  return bar;
}
