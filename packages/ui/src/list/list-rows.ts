/**
 * The internal focusable rows renderer that {@link ListView} composes — it draws only the visible
 * window of a list and owns its keyboard/mouse/wheel handling. You normally use `ListView`/`ListBox`
 * rather than this class directly.
 *
 * Behavior:
 *   • Draws each visible row's text at column 1, blanking the row in its resolved colour. The focused
 *     row uses the `focused` role while the list itself holds focus, the `selected` role otherwise;
 *     other selected rows use the `selected` role and the rest use `normal`. Colour is the only focus
 *     indicator — there is no marker glyph or hardware caret. An empty list shows `<empty>`.
 *   • Row-colour priority is **focused > selected > normal**: a freshly clicked row is both focused
 *     and selected, so it draws in the `focused` colour; the `selected` colour only appears once focus
 *     moves elsewhere.
 *   • Keeps the focused item visible and clamps the focused index into range when the items change.
 *   • Keys: ↑↓ move one row, PgUp/PgDn a page, Home/End to the window ends, Space/Enter activate; a
 *     double-click also activates. Optional case-insensitive type-ahead jumps to the first match.
 *   • Multi-column mode (`numCols > 1`) flows items column-major with a `│` divider between columns
 *     (drawn in the `listDivider` role) while keeping the scroll model vertical; ←/→ jump a column.
 *     A single column draws that divider off-screen, so no divider is visible.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent, ThemeRoleName } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { KeyEvent } from '@jsvision/core';
import type { ScrollBar } from '../scroll/index.js';
import { clampIndex, keepVisible } from './virtual.js';

/** The text drawn once, top-left, for an empty list. */
const EMPTY_TEXT = '<empty>';

/**
 * The theme roles a list draws its rows in. Defaults to the standard `list*` roles; override them to
 * blend a list into a differently coloured surface — e.g. a dropdown popup uses white-on-blue /
 * white-on-green so its rows match the popup window background.
 */
export interface ListRoles {
  /** Unfocused / normal row. */
  readonly normal: ThemeRoleName;
  /** The focused row while the list holds focus. */
  readonly focused: ThemeRoleName;
  /** A selected row, or the focused row when the list does not hold focus. */
  readonly selected: ThemeRoleName;
}

/** The default list row roles (the standard `list*` theme roles). */
export const DEFAULT_LIST_ROLES: ListRoles = { normal: 'listNormal', focused: 'listFocused', selected: 'listSelected' };

/** Shared configuration handed from a `ListView` to its rows renderer. */
export interface ListRowsConfig<T> {
  /** Source items (source order; `sorted` reorders the *display* only). */
  items: Signal<T[]>;
  /** Render an item to its row text. */
  getText: (item: T) => string;
  /** The focused (highlighted) display index; shared with the owned `ScrollBar.value`. */
  focused: Signal<number>;
  /** The selected (chosen) display index (`-1` = none). */
  selected: Signal<number>;
  /** Display items in ascending `getText` order (stable). */
  sorted: boolean;
  /** Enable the linear case-insensitive prefix type-ahead. */
  typeAhead: boolean;
  /** Activation callback (Enter/Space or double-click); `index` is display order, `item` the value. */
  onSelect?: (index: number, item: T) => void;
  /** Command emitted on activation (like `Button`). */
  command?: string;
  /** Row theme roles (default {@link DEFAULT_LIST_ROLES}); override for a different surface colour. */
  roles?: ListRoles;
  /**
   * Number of columns (default `1`). `>1` flows items column-major with a `│` divider between columns
   * (drawn in the `listDivider` role); the scroll model stays vertical — `numCols` only reshapes the
   * draw and the bar's step.
   */
  numCols?: number;
}

/** The virtual-scroll rows renderer: draws only the visible window + owns list keyboard/mouse. */
export class ListRows<T> extends View {
  override focusable = true;
  protected readonly getText: (item: T) => string;
  protected readonly focused: Signal<number>;
  protected readonly selected: Signal<number>;
  protected readonly sortedMode: boolean;
  protected readonly typeAheadMode: boolean;
  protected readonly onSelect?: (index: number, item: T) => void;
  protected readonly command?: string;
  /** The row theme roles (`listNormal`/`listFocused`/`listSelected` by default). */
  protected readonly roles: ListRoles;
  /** Column count (`≥1`); `>1` = column-major flow with `│` dividers. */
  protected readonly numCols: number;
  /** The display list (source order, or a stable ascending `getText` sort when `sorted`). */
  protected readonly displayItems: () => T[];
  /** The first visible display index (the top of the scroll window). */
  protected topItem = 0;
  /** The accumulated type-ahead prefix (reset on focus-move). */
  protected typeBuffer = '';
  /** The owned scroll bar, wired by the `ListView` (its `value` is the shared `focused` signal). */
  bar?: ScrollBar;

  /**
   * @param cfg The shared list configuration (items, text, signals, modes, callbacks).
   */
  constructor(cfg: ListRowsConfig<T>) {
    super();
    this.getText = cfg.getText;
    this.focused = cfg.focused;
    this.selected = cfg.selected;
    this.sortedMode = cfg.sorted;
    this.typeAheadMode = cfg.typeAhead;
    this.onSelect = cfg.onSelect;
    this.command = cfg.command;
    this.roles = cfg.roles ?? DEFAULT_LIST_ROLES;
    this.numCols = Math.max(1, Math.floor(cfg.numCols ?? 1));
    this.displayItems = this.derived(() => {
      const arr = cfg.items();
      if (!this.sortedMode) return arr;
      // Stable ascending, case-insensitive by rendered text (JS sort is stable).
      return [...arr].sort((a, b) => this.getText(a).toLowerCase().localeCompare(this.getText(b).toLowerCase()));
    });

    this.onMount(() => {
      // Repaint + keep the focused item visible when focus moves (a key/click/type-ahead or a bar drag).
      this.bind(
        () => this.focused(),
        () => this.updateTop(),
      );
      // On an items/sort change: clamp focused into the new range + repaint.
      this.bind(
        () => this.displayItems().length,
        () => {
          this.clampFocusedToRange();
          this.updateTop();
        },
      );
      // Repaint on selection change, and on focus in/out (the focused-row colour toggles).
      this.bind(
        () => this.selected(),
        () => undefined,
      );
      this.bind(
        () => this.focusSignal()(),
        () => {
          this.typeBuffer = ''; // gaining or losing focus resets the type-ahead prefix buffer
        },
      );
    });
  }

  /** The number of visible rows (the renderer's laid-out height). */
  protected viewportRows(): number {
    return this.bounds.height;
  }

  /** Recompute `topItem` to keep the (clamped) focused item visible. */
  protected updateTop(): void {
    const range = this.displayItems().length;
    const focused = clampIndex(this.focused(), range);
    this.topItem = this.computeTop(focused, this.viewportRows(), range);
  }

  /**
   * The `topItem` that keeps `focused` visible. A single column delegates to the pure `keepVisible`;
   * multi-column snaps `topItem` to a column boundary and scrolls so the focused item's column is the
   * first (scrolling up) or last (scrolling down) in the visible `rows × numCols` window. The scroll
   * model stays vertical.
   */
  protected computeTop(focused: number, rows: number, range: number): number {
    if (this.numCols === 1) return keepVisible(focused, this.topItem, rows, range);
    if (rows <= 0) return 0;
    const cap = rows * this.numCols;
    let top = this.topItem;
    if (focused < top) top = focused - (focused % rows);
    else if (focused >= top + cap) top = focused - (focused % rows) - rows * (this.numCols - 1);
    return Math.max(0, top);
  }

  /** Clamp the focused signal into the current range (e.g. after the items list shrinks). */
  protected clampFocusedToRange(): void {
    const range = this.displayItems().length;
    const clamped = clampIndex(this.focused(), range);
    if (clamped !== this.focused()) this.focused.set(clamped);
  }

  /**
   * Paint the visible window: re-limit the owned bar, keep the focused item visible, then draw each
   * row in its resolved colour with the text at column 1.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const rows = ctx.size.height;
    const display = this.displayItems();
    const range = display.length;
    // Re-limit the owned bar to the item range. A single column leaves one row of context per page
    // (page step = rows − 1, arrow step 1); a multi-column list pages a full screen and arrows one
    // whole column.
    if (this.numCols === 1) this.bar?.setRange(0, Math.max(0, range - 1), Math.max(1, rows - 1));
    else this.bar?.setRange(0, Math.max(0, range - 1), rows * this.numCols, rows);

    const normal = ctx.color(this.roles.normal);
    if (range === 0) {
      ctx.fill(' ', normal);
      ctx.text(1, 0, EMPTY_TEXT, normal); // draw the empty placeholder at column 1
      return;
    }

    const focused = clampIndex(this.focused(), range);
    this.topItem = this.computeTop(focused, rows, range);
    const active = this.state.focused;
    const selected = this.selected();
    const divider = ctx.color('listDivider');
    // Text spans from column 1 of each column band; the `│` divider sits at the band's right edge. For
    // a single column that edge is at `size.x` (off-screen), so the clip drops it — no visible divider.
    const colWidth = Math.floor(ctx.size.width / this.numCols) + 1;
    const textWidth = Math.max(0, colWidth - 1);

    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < this.numCols; j += 1) {
        const item = j * rows + i + this.topItem; // items flow column-major (down a column, then across)
        const curCol = j * colWidth;
        if (item >= range) {
          ctx.fillRect(curCol, i, colWidth, 1, ' ', normal); // blank the empty cell
        } else {
          // Focused row → `focused` colour while the list holds focus (else `selected`); other selected
          // rows → `selected`; the rest → `normal`.
          const role =
            item === focused
              ? active
                ? this.roles.focused
                : this.roles.selected
              : item === selected
                ? this.roles.selected
                : this.roles.normal;
          const style = ctx.color(role);
          ctx.fillRect(curCol, i, colWidth, 1, ' ', style); // blank the cell in its colour
          const text = this.getText(display[item]).slice(0, textWidth);
          ctx.text(curCol + 1, i, text, style); // row text at column 1 (sanitized by ctx.text)
        }
        // The `│` divider at each column's right edge (in the `listDivider` role).
        ctx.text(curCol + colWidth - 1, i, '│', divider);
      }
    }
  }

  /**
   * Route the list's keyboard, mouse, and wheel handling.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'wheel') {
      if (inner.dir === 'up') this.focusBy(-3);
      else if (inner.dir === 'down') this.focusBy(3);
      ev.handled = true;
      return;
    }
    if (inner.type === 'mouse' && inner.kind === 'down') {
      const local = ev.local;
      if (local === undefined) return;
      const range = this.displayItems().length;
      // A click in the blank space below the last row focuses/selects the LAST item; an empty list is
      // a no-op. The `col` term is 0 for a single column, so this reduces to the plain row hit-test.
      if (range > 0) {
        const rows = this.viewportRows();
        const colWidth = Math.floor(this.bounds.width / this.numCols) + 1;
        const col = colWidth > 0 ? Math.floor(local.x / colWidth) : 0;
        const newItem = clampIndex(this.topItem + local.y + col * rows, range);
        this.typeBuffer = '';
        this.focusTo(newItem);
        this.select(newItem); // a single click both focuses and selects
        // A double-click also activates. The loop stamps the click count on each mouse-down.
        if (ev.clickCount === 2) this.activate(ev);
      }
      ev.handled = true;
      return;
    }
    if (inner.type !== 'key') return;
    if (this.handleKey(inner, ev)) ev.handled = true;
  }

  /** Apply a navigation/activation key; returns whether it was consumed. */
  protected handleKey(inner: KeyEvent, ev: DispatchEvent): boolean {
    const rows = this.viewportRows();
    const cap = rows * this.numCols; // the on-screen item capacity (rows × columns)
    switch (inner.key) {
      case 'up':
        this.focusBy(-1);
        return true;
      case 'down':
        this.focusBy(1);
        return true;
      case 'left':
        // A multi-column list jumps one column back; a single column ignores ←/→ (leaves them to bubble).
        if (this.numCols > 1) {
          this.focusBy(-rows);
          return true;
        }
        return false;
      case 'right':
        if (this.numCols > 1) {
          this.focusBy(rows);
          return true;
        }
        return false;
      case 'pageup':
        this.focusBy(-cap); // one screen back
        return true;
      case 'pagedown':
        this.focusBy(cap); // one screen forward
        return true;
      case 'home':
        this.typeBuffer = '';
        this.focusTo(this.topItem);
        return true;
      case 'end':
        this.typeBuffer = '';
        this.focusTo(this.topItem + cap - 1); // the last item in the on-screen window
        return true;
      case 'enter':
      case 'space':
        this.activate(ev);
        return true;
      case 'backspace':
        if (this.typeAheadMode && this.typeBuffer.length > 0) {
          this.typeBuffer = this.typeBuffer.slice(0, -1);
          this.search();
          return true;
        }
        return false;
      default:
        return this.typeAheadKey(inner);
    }
  }

  /** Move focus by `delta` rows (resets the type-ahead buffer — a focus move). */
  protected focusBy(delta: number): void {
    this.typeBuffer = '';
    this.focusTo(this.focused() + delta);
  }

  /** Focus the given display index, clamped into range (the bind updates `topItem` + repaints). */
  protected focusTo(index: number): void {
    this.focused.set(clampIndex(index, this.displayItems().length));
  }

  /** Set the selected (chosen) index (visual selection). */
  protected select(index: number): void {
    this.selected.set(index);
  }

  /** Activate the focused item: select it, call `onSelect`, emit `command` (Enter/Space). */
  protected activate(ev: DispatchEvent): void {
    const display = this.displayItems();
    const index = this.focused();
    if (index < 0 || index >= display.length) return;
    this.select(index);
    this.onSelect?.(index, display[index]);
    if (this.command !== undefined) ev.emit?.(this.command);
  }

  /** Append a printable key to the type-ahead buffer + search; returns whether consumed. */
  protected typeAheadKey(inner: KeyEvent): boolean {
    if (!this.typeAheadMode || inner.ctrl || inner.alt) return false;
    const ch = [...inner.key].length === 1 ? inner.key : null;
    if (ch === null) return false;
    this.typeBuffer += ch;
    this.search();
    return true;
  }

  /** Linear case-insensitive prefix scan over the display text; focus the first match. */
  protected search(): void {
    const prefix = this.typeBuffer.toLowerCase();
    if (prefix.length === 0) return;
    const display = this.displayItems();
    for (let k = 0; k < display.length; k += 1) {
      if (this.getText(display[k]).toLowerCase().startsWith(prefix)) {
        this.focusTo(k);
        return;
      }
    }
  }
}
