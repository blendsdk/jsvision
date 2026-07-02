/**
 * `ListRows<T>` — the internal focusable rows-renderer of a `ListView` (RD-11, PA-2/PA-3/PA-5/PA-10).
 *
 * Faithful transcription of `TListViewer` (`source/tvision/tlstview.cpp`, GATE-1 verified + GATE-2
 * diffed) for the **single-column** case:
 *   • **`draw`** `:77` — for each visible row `i`, item `= topItem + i`; blank the row in its colour
 *     then draw `getText(item)` at column 1 (TV `curCol+1`); the focused row uses `getColor(3)` when
 *     the list is active, a selected row `getColor(4)`, else `getColor(1)`. The **colour is the only
 *     focus indicator** (PA-5 — no glyph, no hardware caret, unlike TV's `setCursor`). Single column ⇒
 *     the divider column `curCol+colWidth-1 = size.x` is off-screen, so **no divider is drawn**.
 *     `showMarkers` (`»«`) is monochrome-only and omitted in colour. `emptyText="<empty>"` when empty.
 *   • **`focusItem`** `:159` keep-visible + **`focusItemNum`** `:175` clamp → `virtual.ts`.
 *   • **`handleEvent`** `:213` — mouse-down `newItem = mouse.y + topItem`; keys ↑↓ ±1, PgUp/PgDn
 *     ±viewportRows, Home=`topItem`, End=`topItem+rows-1`; ←/→ ignored (single column); Space/Enter
 *     activate. **Double-click** activation is deferred (the input model has no click-count).
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
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { computed } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { KeyEvent } from '@jsvision/core';
import type { ScrollBar } from '../scroll/index.js';
import { clampIndex, keepVisible } from './virtual.js';

/** The text drawn once, top-left, for an empty list (TV `emptyText`, `tvtext2.cpp:147`). */
const EMPTY_TEXT = '<empty>';

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
    this.displayItems = computed(() => {
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
    this.topItem = keepVisible(focused, this.topItem, this.viewportRows(), range);
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
    // TV setRange (tlstview.cpp:48-52): bar value = focused, range [0, range-1], HR-53 pgStep =
    // size.y - 1 so a page keeps one row of context.
    this.bar?.setRange(0, Math.max(0, range - 1), Math.max(1, rows - 1));

    const normal = ctx.color('listNormal');
    if (range === 0) {
      ctx.fill(' ', normal);
      ctx.text(1, 0, EMPTY_TEXT, normal); // HR-51: TV draws emptyText at curCol+1 (tlstview.cpp:147-148)
      return;
    }

    const focused = clampIndex(this.focused(), range);
    this.topItem = keepVisible(focused, this.topItem, rows, range);
    const active = this.state.focused;
    const selected = this.selected();
    const textWidth = Math.max(0, ctx.size.width - 1);

    for (let i = 0; i < rows; i += 1) {
      const item = this.topItem + i;
      if (item >= range) {
        ctx.fillRect(0, i, ctx.size.width, 1, ' ', normal); // blank trailing row
        continue;
      }
      // HR-50 (tlstview.cpp:86-130,208-211): the cursor row draws `listFocused` (bright) while the
      // list is focused, but keeps a `listSelected` highlight when focus moves away — `listFocused` is
      // reserved for the focused-list state. Any other selected row also draws `listSelected`.
      const role =
        item === focused
          ? active
            ? 'listFocused'
            : 'listSelected'
          : item === selected
            ? 'listSelected'
            : 'listNormal';
      const style = ctx.color(role);
      ctx.fillRect(0, i, ctx.size.width, 1, ' ', style); // blank the row in its colour
      const text = this.getText(display[item]).slice(0, textWidth);
      ctx.text(1, i, text, style); // TV draws item text at curCol+1 (sanitized by ctx.text)
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
      // row focuses/selects the LAST item; an empty list stays a no-op.
      if (range > 0) {
        const newItem = Math.min(this.topItem + local.y, range - 1);
        this.typeBuffer = '';
        this.focusTo(newItem);
        this.select(newItem); // a row click focuses + selects (ST-06)
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
    switch (inner.key) {
      case 'up':
        this.focusBy(-1);
        return true;
      case 'down':
        this.focusBy(1);
        return true;
      case 'pageup':
        this.focusBy(-rows);
        return true;
      case 'pagedown':
        this.focusBy(rows);
        return true;
      case 'home':
        this.typeBuffer = '';
        this.focusTo(this.topItem);
        return true;
      case 'end':
        this.typeBuffer = '';
        this.focusTo(this.topItem + rows - 1);
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
