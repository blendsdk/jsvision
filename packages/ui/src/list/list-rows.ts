/**
 * `ListRows<T>` — the internal focusable rows-renderer of a `ListView` (RD-11, PA-2/PA-3/PA-5/PA-10).
 *
 * Faithful transcription of `TListViewer` (`source/tvision/tlstview.cpp`, GATE-1 verified + GATE-2
 * diffed). Single column by default; `numCols > 1` renders TV's full **column-major** flow (the
 * jsvision-ui/RD-09 PA-14 seam — the multi-column work RD-11 reserved for "→ RD-07, AR-104"):
 *   • **`draw`** `:96-141` — `colWidth = size.x/numCols + 1`; for each row `i` and column `j`,
 *     `item = j*size.y + i + topItem` (column-major); blank the cell in its colour then draw
 *     `getText(item)` at `curCol+1`; the focused cell uses `getColor(3)` when the list is active, a
 *     selected cell `getColor(4)`, else `getColor(1)`. The **colour is the only focus indicator**
 *     (PA-5 — no glyph, no hardware caret, unlike TV's `setCursor`). A `│` (`0xB3`) divider is drawn at
 *     each column's right edge `curCol+colWidth-1` in `getColor(5)` (→ `listDivider`); for a **single
 *     column** that lands at `size.x` (off-screen) so ctx clips it ⇒ **no visible divider**.
 *     `showMarkers` (`»«`) is monochrome-only and omitted in colour. `emptyText="<empty>"` when empty.
 *   • **`focusItem`** `:159` keep-visible (single-col via `virtual.ts`; multi-col column-aligned in
 *     {@link computeTop}) + **`focusItemNum`** `:175` clamp.
 *   • **`handleEvent`** `:213` — mouse-down `newItem = mouse.y + size.y*(mouse.x/colWidth) + topItem`;
 *     keys ↑↓ ±1, PgUp/PgDn ±`size.y*numCols`, Home=`topItem`, End=`topItem+size.y*numCols-1`, ←/→
 *     jump a column (±`size.y`) when `numCols>1` (ignored single-column); Space/Enter activate.
 *     **Double-click** activation is deferred (the input model has no click-count).
 *   • **Palette** `cpListViewer` `:30` → `listNormal`/`listFocused`/`listSelected`/`listDivider` (PA-10).
 *
 * jsvision extensions (behaviour, not TV drawing): `sorted` display, linear `typeAhead` prefix search
 * (PA-3), Enter-to-activate, and mouse-wheel over the rows (`±3`, PF-008).
 *
 * **GATE-2 note:** the row-colour priority is **focused > selected > normal** (TV `draw`
 * `tlstview.cpp:66-70` tests `focused==item` *before* `isSelected`). A clicked row is both focused and
 * selected and therefore draws `listFocused`; `listSelected` shows only once focus moves away. This
 * corrected the ST-06 spec oracle (which had asserted the clicked row draws `listSelected`) per the
 * fidelity directive (the C++ outranks a mis-decoded oracle). `.js` per NodeNext.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent, ThemeRoleName } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { KeyEvent } from '@jsvision/core';
import type { ScrollBar } from '../scroll/index.js';
import { clampIndex, keepVisible } from './virtual.js';

/** The text drawn once, top-left, for an empty list (TV `emptyText`, `tvtext2.cpp:147`). */
const EMPTY_TEXT = '<empty>';

/**
 * The theme roles a list draws its rows in. Defaults to the RD-11 `cpListViewer` roles; a caller can
 * override them for a TV viewer with a different palette — e.g. `History` uses the `cpHistoryViewer`
 * roles (white-on-blue / white-on-green) so its rows blend into the blue popup window (RD-14 PA-12).
 */
export interface ListRoles {
  /** Unfocused / normal row (TV `cpListViewer[1]`). */
  readonly normal: ThemeRoleName;
  /** The focused row while the list is active (TV `cpListViewer[3]`). */
  readonly focused: ThemeRoleName;
  /** A selected row, or the focused row when the list is inactive (TV `cpListViewer[4]`). */
  readonly selected: ThemeRoleName;
}

/** The default list row roles — the RD-11 `cpListViewer` decode. */
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
  /** Enable the linear case-insensitive prefix type-ahead (PA-3). */
  typeAhead: boolean;
  /** Activation callback (Enter/Space); `index` is DISPLAY order, `item` the `T` (PF-003). */
  onSelect?: (index: number, item: T) => void;
  /** Command emitted on activation (like `Button`). */
  command?: string;
  /** Row theme roles (default {@link DEFAULT_LIST_ROLES}); override for a different viewer palette. */
  roles?: ListRoles;
  /**
   * Number of columns (default `1`). `>1` renders the faithful `TListViewer` **column-major** flow
   * with a `│` interior divider (`getColor(5)` → `listDivider`), decoded from `tlstview.cpp:96-141`.
   * The scroll model stays **vertical** — `numCols` only reshapes the draw + the bar's step (PA-14).
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
  /** The row theme roles (RD-11 `listNormal`/`listFocused`/`listSelected` by default; RD-14 override). */
  protected readonly roles: ListRoles;
  /** Column count (TV `numCols`, `≥1`); `>1` = column-major flow + `│` dividers (PA-14). */
  protected readonly numCols: number;
  /** The display list (source order, or a stable ascending `getText` sort when `sorted`). */
  protected readonly displayItems: () => T[];
  /** The first visible display index (TV `topItem`). */
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
      // On an items/sort change: clamp focused into the new range (TV `newList`) + repaint.
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
          this.typeBuffer = ''; // focus edge resets the type-ahead buffer (TV `cmReleasedFocus`)
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
   * The `topItem` that keeps `focused` visible. Single column delegates to the pure `keepVisible`;
   * multi-column applies TV's column-aligned `focusItem` rules (`tlstview.cpp:168-181`): scroll so
   * `topItem` lands on a column boundary and the focused item's column is first (scroll-up) or last
   * (scroll-down) in the `size.y × numCols` window. The scroll model stays vertical.
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

  /** Clamp the focused signal into the current range (TV `focusItemNum`/`newList`). */
  protected clampFocusedToRange(): void {
    const range = this.displayItems().length;
    const clamped = clampIndex(this.focused(), range);
    if (clamped !== this.focused()) this.focused.set(clamped);
  }

  /**
   * Paint the visible window (TV `draw`): re-limit the owned bar, keep the focus visible, then draw
   * each row in its resolved colour with the text at column 1.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const rows = ctx.size.height;
    const display = this.displayItems();
    const range = display.length;
    // TV setStep (tlstview.cpp:41-52): bar value = focused, range [0, range-1]. Single column keeps
    // HR-53 pgStep = size.y-1 (a page leaves one row of context, arStep left at 1); a multi-column
    // list pages a full screen (size.y*numCols) and arrows one column (size.y).
    if (this.numCols === 1) this.bar?.setRange(0, Math.max(0, range - 1), Math.max(1, rows - 1));
    else this.bar?.setRange(0, Math.max(0, range - 1), rows * this.numCols, rows);

    const normal = ctx.color(this.roles.normal);
    if (range === 0) {
      ctx.fill(' ', normal);
      ctx.text(1, 0, EMPTY_TEXT, normal); // HR-51: TV draws emptyText at curCol+1 (tlstview.cpp:147-148)
      return;
    }

    const focused = clampIndex(this.focused(), range);
    this.topItem = this.computeTop(focused, rows, range);
    const active = this.state.focused;
    const selected = this.selected();
    const divider = ctx.color('listDivider');
    // TV colWidth = size.x/numCols + 1 (tlstview.cpp:118). Text spans curCol+1..; the `│` divider sits
    // at curCol+colWidth-1 (= size.x for a single column ⇒ off-screen, so ctx clips it — no divider).
    const colWidth = Math.floor(ctx.size.width / this.numCols) + 1;
    const textWidth = Math.max(0, colWidth - 1);

    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < this.numCols; j += 1) {
        const item = j * rows + i + this.topItem; // column-major (tlstview.cpp:120)
        const curCol = j * colWidth;
        if (item >= range) {
          ctx.fillRect(curCol, i, colWidth, 1, ' ', normal); // blank the empty cell
        } else {
          // HR-50 (tlstview.cpp:122-141): the cursor cell draws `listFocused` (bright) while the list
          // is focused, keeps a `listSelected` highlight when focus moves away; other selected cells
          // draw `listSelected`; the rest `listNormal`.
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
          ctx.text(curCol + 1, i, text, style); // TV draws item text at curCol+1 (sanitized by ctx.text)
        }
        // The `│` (`0xB3`) interior divider at each column's right edge, getColor(5) → listDivider.
        ctx.text(curCol + colWidth - 1, i, '│', divider);
      }
    }
  }

  /**
   * Route list keyboard/mouse/wheel (TV `handleEvent` + the jsvision extensions).
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
      // HR-62 (tlstview.cpp:185-195 `focusItemNum` clamp): a click in the blank space below the last
      // row focuses/selects the LAST item; an empty list stays a no-op. Multi-column hit-test
      // (tlstview.cpp:230): newItem = mouse.y + size.y*(mouse.x/colWidth) + topItem — the `/colWidth`
      // term is 0 for a single column (colWidth = size.x+1 > mouse.x), so this reduces exactly.
      if (range > 0) {
        const rows = this.viewportRows();
        const colWidth = Math.floor(this.bounds.width / this.numCols) + 1;
        const col = colWidth > 0 ? Math.floor(local.x / colWidth) : 0;
        const newItem = clampIndex(this.topItem + local.y + col * rows, range);
        this.typeBuffer = '';
        this.focusTo(newItem);
        this.select(newItem); // a single click focuses + selects (ST-06)
        // Double-click = activate (TV `tlstview.cpp:276-277`: `meDoubleClick` ⇒ `selectItem`). The
        // loop stamps `ev.clickCount` on a mouse-`down` (double-click-activation FR-3/AR-7).
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
    const cap = rows * this.numCols; // the on-screen item capacity (size.y × numCols)
    switch (inner.key) {
      case 'up':
        this.focusBy(-1);
        return true;
      case 'down':
        this.focusBy(1);
        return true;
      case 'left':
        // TV kbLeft (tlstview.cpp:302): a multi-column list jumps one column back (−size.y); a single
        // column ignores ←/→ (not consumed, so it can bubble).
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
        this.focusBy(-cap); // TV kbPgUp: −size.y*numCols (tlstview.cpp:311)
        return true;
      case 'pagedown':
        this.focusBy(cap); // TV kbPgDn: +size.y*numCols (tlstview.cpp:309)
        return true;
      case 'home':
        this.typeBuffer = '';
        this.focusTo(this.topItem);
        return true;
      case 'end':
        this.typeBuffer = '';
        this.focusTo(this.topItem + cap - 1); // TV kbEnd: topItem + size.y*numCols − 1 (tlstview.cpp:319)
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

  /** Linear case-insensitive prefix scan over the display text (PA-3); focus the first match. */
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
