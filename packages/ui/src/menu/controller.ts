/**
 * The menu navigation state machine that backs a {@link MenuBar}. It tracks which menu is open (a
 * stack of levels, one per nested submenu), mounts and unmounts the {@link MenuPopup} boxes plus a
 * full-viewport outside-click catcher into the app overlay, and moves the highlight and activates
 * items. It does no event dispatch itself — the menu bar translates keys and clicks into the method
 * calls on {@link MenuController}.
 *
 * The overlay is made visible before the catcher and first popup are mounted, and hidden again on
 * close, so an empty overlay never sits on top and swallows clicks.
 */
import { View } from '../view/index.js';
import type { Group, DispatchEvent, Point } from '../view/index.js';
import type { LayoutProps, Rect } from '../layout/index.js';
import { MenuPopup } from './popup.js';
import type { MenuItem } from './builders.js';
import { parseTilde, layoutTitles, titleIndexAt } from './builders.js';
import { syncOverlayVisible } from '../app/index.js';

/** The application-level operations the controller calls into for activation, greying, and focus. */
export interface MenuLoopSeam {
  /** Emit the activated item's command so the app can handle it. */
  emitCommand(command: string, arg?: unknown): void;
  /** Whether a command is enabled — a disabled item is greyed and cannot be activated. */
  isCommandEnabled(command: string): boolean;
  /** Focus a view — used to restore the pre-menu focus when the menu closes. */
  focusView(view: View): void;
  /** The currently-focused view, captured when a menu opens so it can be restored on close. */
  getFocused(): View | null;
  /**
   * Turn off the accelerator-hint overlay when a menu opens. Optional — a bare event loop without the
   * full app shell omits it. An open menu owns plain letter keys (for item hotkeys), so the overlay
   * must not also intercept them; the controller calls this on every open path.
   */
  dismissAccelerators?(): void;
}

/** The navigation surface a {@link MenuBar} drives — one method per navigation action. */
export interface MenuController {
  /** Whether a top-level menu is currently open. */
  isOpen(): boolean;
  /** The open top-level index (for the bar's title highlight), or `null` when closed. */
  openIndex(): number | null;
  /** Open the top-level menu at `index` (saving focus the first time); switches if already open. */
  openTop(index: number): void;
  /** Close the deepest open popup; closing the last level closes the whole menu. */
  closeLevel(): void;
  /** Close every level and the catcher, and restore the saved focus. */
  close(): void;
  /** Move the deepest level's highlight, skipping separators and disabled items. */
  move(dir: -1 | 1): void;
  /** Activate the deepest highlighted item: open a submenu, or emit an enabled item's command + close. */
  activate(): void;
  /** `←`: close a nested level, or (at the top level) switch to the previous top-level menu. */
  left(): void;
  /** `→`: open a highlighted submenu, else switch to the next top-level menu. */
  right(): void;
  /** `Alt+<char>`: open/switch to the top-level menu whose hotkey matches; `true` if consumed. */
  topHotkey(char: string): boolean;
  /** A plain `<char>` while open: activate the deepest item whose hotkey matches; `true` if consumed. */
  itemHotkey(char: string): boolean;
  /** Re-anchor the outside-click catcher after the viewport is resized so it still covers the screen. */
  resize(): void;
}

/** One open level — a mounted popup over its items. The popup owns the highlight index. */
interface Level {
  items: readonly MenuItem[];
  popup: MenuPopup;
}

/** Minimum popup width in cells. */
const POPUP_MIN_WIDTH = 10;
/** A safe fallback viewport used only before the overlay has a real rect. */
const FALLBACK_VIEWPORT: Rect = { x: 0, y: 0, width: 80, height: 24 };

/** A transparent full-viewport overlay child that closes (or switches) the menu on any mouse-down. */
class CatcherView extends View {
  /** Absolute, full-viewport; the controller sets `rect`. */
  override layout: LayoutProps = { position: 'absolute' };

  constructor(private readonly onDown: (local: Point | undefined) => void) {
    super();
  }

  /** Paint nothing — the catcher only intercepts outside clicks, but must stay visible to hit-test. */
  draw(): void {
    // intentionally empty (transparent)
  }

  /**
   * A mouse-down anywhere not covered by a popup (popups paint above the catcher): hand the point to
   * the controller, which switches menus on a bar-title hit or closes otherwise.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      this.onDown(ev.local);
      ev.handled = true;
    }
  }
}

/** A non-separator item is selectable for navigation only if it is a submenu or an enabled command. */
function isSelectable(node: MenuItem, isEnabled: (command: string) => boolean): boolean {
  if (node.kind === 'separator') return false;
  if (node.kind === 'sub') return true;
  return isEnabled(node.command);
}

/** The first non-separator row (the initial highlight — a disabled item may sit here; Enter no-ops). */
function firstSelectable(items: readonly MenuItem[]): number {
  const index = items.findIndex((node) => node.kind !== 'separator');
  return index === -1 ? 0 : index;
}

/**
 * One item's contribution to the popup width: the display name plus 6 chrome cells (outer blank
 * gutter + border + one inner pad, on each side), plus 3 for a submenu's ` ►` cascade marker or
 * `key.length + 2` for a right-aligned shortcut. Separators contribute 0.
 *
 * @param node A menu item.
 * @returns Its required popup width in cells.
 */
function itemWidth(node: MenuItem): number {
  if (node.kind === 'separator') return 0;
  let width = parseTilde(node.title).text.length + 6;
  if (node.kind === 'sub') width += 3;
  else if (node.key !== undefined) width += node.key.length + 2;
  return width;
}

/** The popup width: the widest item's contribution, floored at {@link POPUP_MIN_WIDTH}. */
function popupWidth(items: readonly MenuItem[]): number {
  let max = POPUP_MIN_WIDTH;
  for (const node of items) max = Math.max(max, itemWidth(node));
  return max;
}

/**
 * Create the menu navigation controller for a {@link MenuBar}. The bar wires this up for you; you
 * only call this directly if you are driving a menu without the app shell.
 *
 * @param tops    The top-level menu nodes (each usually a submenu).
 * @param overlay The app overlay layer the popups and outside-click catcher mount into.
 * @param seam    The application operations for activation, greying, and focus save/restore.
 * @returns A {@link MenuController} the menu bar drives.
 */
export function createMenuController(tops: readonly MenuItem[], overlay: Group, seam: MenuLoopSeam): MenuController {
  const levels: Level[] = [];
  let openTopIndex: number | null = null;
  let savedFocus: View | null = null;
  let catcher: CatcherView | null = null;

  const isEnabled = (command: string): boolean => seam.isCommandEnabled(command);
  const viewport = (): Rect => overlay.layout.rect ?? FALLBACK_VIEWPORT;
  const deepest = (): Level | null => levels[levels.length - 1] ?? null;
  const isOpen = (): boolean => openTopIndex !== null;

  /** The next selectable row from `from` stepping by `dir` (wrapping); `from` if none qualifies. */
  function nextSelectable(items: readonly MenuItem[], from: number, dir: -1 | 1): number {
    const count = items.length;
    for (let step = 1; step <= count; step += 1) {
      const index = (((from + dir * step) % count) + count) % count;
      const node = items[index];
      if (node !== undefined && isSelectable(node, isEnabled)) return index;
    }
    return from;
  }

  /** Clamp a popup origin so the whole popup stays on-screen (open up/left if it would overflow). */
  function clampRect(x: number, y: number, width: number, height: number): Rect {
    const vp = viewport();
    const nx = x + width > vp.width ? Math.max(0, vp.width - width) : x;
    const ny = y + height > vp.height ? Math.max(0, vp.height - height) : y;
    return { x: nx, y: ny, width, height };
  }

  /** Build, position, and mount a popup over `items` at the anchor; push it as the new deepest level. */
  function pushLevel(items: readonly MenuItem[], anchorX: number, anchorY: number): void {
    const popup = new MenuPopup();
    popup.castsShadow = true; // the menu box casts a drop shadow over what is behind it
    popup.items = items;
    popup.highlight = firstSelectable(items);
    popup.isEnabled = isEnabled;
    const width = popupWidth(items);
    const height = items.length + 2; // top + bottom border
    popup.layout = { position: 'absolute', rect: clampRect(anchorX, anchorY, width, height) };
    popup.onPick = (row) => pickRow(popup, row);
    overlay.add(popup);
    levels.push({ items, popup });
  }

  /** Open the level-0 popup for a top-level `sub` directly under its bar title. */
  function openLevelForTop(index: number): void {
    const node = tops[index];
    if (node === undefined || node.kind !== 'sub') return;
    const title = layoutTitles(tops)[index];
    // Anchor the popup one column left of its bar title, one row below the bar, so its border aligns
    // with the title.
    const anchorX = Math.max(0, (title?.x ?? 1) - 1);
    pushLevel(node.items, anchorX, 1);
  }

  /** Remove every mounted popup (leaving the catcher) and empty the level stack. */
  function clearLevels(): void {
    while (levels.length > 0) {
      const level = levels.pop();
      if (level !== undefined) overlay.remove(level.popup);
    }
  }

  /** Mount the outside-click catcher as the overlay's first (bottom-most) child. */
  function mountCatcher(): void {
    const vp = viewport();
    // A click on a bar title (row 0) switches directly to that menu; any other outside click closes.
    catcher = new CatcherView((local) => {
      if (local !== undefined && local.y === 0) {
        const index = titleIndexAt(tops, local.x);
        if (index !== null) {
          openTop(index);
          return;
        }
      }
      close();
    });
    catcher.layout = { position: 'absolute', rect: { x: 0, y: 0, width: vp.width, height: vp.height } };
    overlay.add(catcher);
  }

  function openTop(index: number): void {
    const wasOpen = isOpen();
    // Opening a menu turns off the accelerator-hint overlay so the open menu owns plain letter keys.
    if (!wasOpen) seam.dismissAccelerators?.();
    if (!wasOpen) savedFocus = seam.getFocused();
    clearLevels();
    if (!wasOpen) mountCatcher();
    openTopIndex = index;
    // Derive overlay visibility from its mounted children (the catcher is already added) rather than
    // toggling a flag, so a coexisting dropdown popup from elsewhere is not hidden.
    syncOverlayVisible(overlay);

    const node = tops[index];
    if (node !== undefined && node.kind === 'sub') {
      openLevelForTop(index);
    } else if (node !== undefined && node.kind === 'item') {
      // A bare top-level command item: emit (if enabled) then close.
      if (isEnabled(node.command)) seam.emitCommand(node.command);
      close();
    }
  }

  function close(): void {
    clearLevels();
    if (catcher !== null) {
      overlay.remove(catcher);
      catcher = null;
    }
    // Re-derive visibility from the live child count: the overlay hides only if nothing else still
    // has a child mounted; closing the last menu leaves it empty, so it hides.
    syncOverlayVisible(overlay);
    openTopIndex = null;
    const restore = savedFocus;
    savedFocus = null;
    if (restore !== null) seam.focusView(restore);
  }

  function closeLevel(): void {
    // Esc always makes progress: at the top level (one or zero popups) it closes the whole menu,
    // rather than leaving it stuck open.
    if (levels.length <= 1) {
      close();
      return;
    }
    const level = levels.pop();
    if (level !== undefined) overlay.remove(level.popup);
  }

  /** Re-anchor the outside-click catcher to a resized viewport so it still covers the full screen. */
  function resize(): void {
    if (catcher === null) return; // no open menu → nothing to re-anchor
    const vp = viewport();
    catcher.layout = { position: 'absolute', rect: { x: 0, y: 0, width: vp.width, height: vp.height } };
    catcher.invalidateLayout();
  }

  /** Switch the open top-level by `dir` (wrapping), re-opening at level 0. */
  function switchTop(dir: -1 | 1): void {
    if (openTopIndex === null) return;
    const count = tops.length;
    const next = (((openTopIndex + dir) % count) + count) % count;
    clearLevels();
    openTopIndex = next;
    openLevelForTop(next);
  }

  function move(dir: -1 | 1): void {
    const level = deepest();
    if (level === null) return;
    level.popup.highlight = nextSelectable(level.items, level.popup.highlight, dir);
    level.popup.invalidate();
  }

  /** Open a `sub`'s child popup to the right of `parent` at its highlighted row. */
  function openNested(parent: Level, node: Extract<MenuItem, { kind: 'sub' }>): void {
    const rect = parent.popup.layout.rect ?? FALLBACK_VIEWPORT;
    const anchorX = rect.x + rect.width - 1; // overlap the parent's right border by one column
    const anchorY = rect.y + parent.popup.highlight + 1; // align with the highlighted row
    pushLevel(node.items, anchorX, anchorY);
  }

  function activate(): void {
    const level = deepest();
    if (level === null) {
      // No popup is open, but a bare top-level command item (one with no submenu) is highlighted:
      // Enter emits its command (if enabled) and closes.
      if (openTopIndex !== null) {
        const top = tops[openTopIndex];
        if (top !== undefined && top.kind === 'item') {
          if (isEnabled(top.command)) seam.emitCommand(top.command);
          close();
        }
      }
      return;
    }
    const node = level.items[level.popup.highlight];
    if (node === undefined) return;
    if (node.kind === 'sub') {
      openNested(level, node);
    } else if (node.kind === 'item') {
      if (!isEnabled(node.command)) return; // disabled item does nothing
      seam.emitCommand(node.command);
      close();
    }
  }

  function left(): void {
    if (levels.length > 1) closeLevel();
    else switchTop(-1);
  }

  function right(): void {
    const level = deepest();
    if (level === null) return;
    const node = level.items[level.popup.highlight];
    if (node !== undefined && node.kind === 'sub') openNested(level, node);
    else switchTop(1);
  }

  /** A mouse-pick on a popup row: drop deeper levels, highlight the row, then activate it. */
  function pickRow(popup: MenuPopup, row: number): void {
    const index = levels.findIndex((level) => level.popup === popup);
    if (index === -1) return;
    while (levels.length - 1 > index) closeLevel();
    const node = levels[index]?.items[row];
    if (node === undefined || node.kind === 'separator') return;
    popup.highlight = row;
    activate();
  }

  function topHotkey(char: string): boolean {
    const lower = char.toLowerCase();
    const match = layoutTitles(tops).find((title) => title.label.hotkey === lower);
    if (match === undefined) return false;
    openTop(match.index);
    return true;
  }

  function itemHotkey(char: string): boolean {
    const level = deepest();
    if (level === null) return false;
    const lower = char.toLowerCase();
    const index = level.items.findIndex((node) => node.kind !== 'separator' && parseTilde(node.title).hotkey === lower);
    if (index === -1) return false;
    level.popup.highlight = index;
    activate();
    return true;
  }

  return {
    isOpen,
    openIndex: () => openTopIndex,
    openTop,
    closeLevel,
    close,
    move,
    activate,
    left,
    right,
    topHotkey,
    itemHotkey,
    resize,
  };
}
