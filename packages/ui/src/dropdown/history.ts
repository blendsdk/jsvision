/**
 * `History` — a faithful re-creation of Turbo Vision `THistory` (RD-14, input-dropdowns/03-01): a
 * `▐↓▌` button linked to an `Input`, dropping a bounded MRU list of that field's past values into the
 * shared anchored popup. GATE-1 decode (verified + GATE-2 diffed against `source/tvision/thistory.cpp`,
 * `thistwin.cpp`, `thstview.cpp`, `histlist.cpp`):
 *
 *   • **Icon / draw** (`thistory.cpp:56-62`, `tvtext1.cpp:86`): `THistory::icon = "\xDE~\x19~\xDD"`
 *     → the 3 visible cells `▐↓▌` = U+2590 / **U+2193** (PA-3, narrow ↓, NOT ▼) / U+258C, drawn by
 *     `b.moveCStr(0, icon, getColor(0x0102))` — the `~` markers toggle the color: sides `▐`/`▌` low
 *     byte = `historyButtonSides` (green-on-lightGray `0x72`), arrow `↓` high byte =
 *     `historyButtonArrow` (black-on-green `0x20`) (`cpHistory "\x16\x17"`, `thistory.cpp:37`).
 *   • **Post-process + open triggers** (`thistory.cpp:44-83`): `options |= ofPostProcess`. Opens on
 *     **any `evMouseDown`** (unconditional), OR `evKeyDown` with `ctrlToArrow(keyCode)==kbDown` **while
 *     the link is focused** (`link->state & sfFocused`); **Alt+Down** is the modern extension (AR-135).
 *     On open: `if (!link->focus()) return;` (focus the link first), then `recordHistory(link->data)`
 *     records the current field text BEFORE the popup shows.
 *   • **Geometry** (`thistory.cpp:90-98`): the shared popup does the `±1`/`+7`/`intersect`/`-1` math
 *     (see `popup.ts` `placePopup`).
 *   • **List** (`thstview.cpp:33-45`): a single-column viewer over `historyStr(id, i)` — oldest at
 *     the top (index 0 = oldest, PA-6) — focusing item **index 1 when count > 1**.
 *   • **Pick** (`thistory.cpp:101-108`): the focused entry → `strnzcpy(link->data, rslt, link->maxLen+1)`
 *     (clamp to the field's max length) + `link->selectAll(True)`, via the public Input seam (PA-8).
 *   • **Cancel** (`thstview.cpp:76-82`, `thistwin.cpp:46-51`): Esc / outside mouse-down → the field
 *     is left unchanged (handled by the shared popup dismissal).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { Input } from '../controls/index.js';
import { ListView } from '../list/index.js';
import { openAnchoredPopup, DEFAULT_MAX_ROWS, drawDropdownIcon, absoluteRect } from './popup.js';
import { historyAdd, historyEntries, addEntry } from './history-store.js';

/** Options for a {@link History} control. */
export interface HistoryOptions {
  /** The `Input` this history is linked to (drawn adjacent; its text is read/replaced). */
  link: Input;
  /** Numeric id keying the shared global MRU store; two Histories with the same id share a list. */
  historyId?: number;
  /** Escape hatch (AR-130): bind an app-owned list instead of the global store. */
  history?: Signal<string[]>;
  /** Max visible popup rows (default 6; window height = maxRows + 2). PA-4. */
  maxRows?: number;
}

/** The `▐↓▌` History button: draws the icon, opens the anchored popup on the AR-135 triggers. */
export class History extends View {
  /** TV `ofPostProcess` (`thistory.cpp:46`): the button sees keys AFTER the focused link. */
  override postProcess = true;
  protected readonly link: Input;
  protected readonly historyId: number;
  protected readonly history?: Signal<string[]>;
  protected readonly maxRows: number;

  /**
   * @param opts The linked `Input` + optional `historyId` / injectable `history` signal / `maxRows`.
   */
  constructor(opts: HistoryOptions) {
    super();
    this.link = opts.link;
    this.historyId = opts.historyId ?? 0;
    this.history = opts.history;
    this.maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  }

  /** Draw the 3-cell `▐↓▌` icon (TV `b.moveCStr(0, icon, getColor(0x0102))`, decode §1). */
  override draw(ctx: DrawContext): void {
    drawDropdownIcon(ctx, 0);
  }

  /**
   * Open on a mouse-down (unconditional), Down (while the link is focused), or Alt+Down (decode §2).
   *
   * @param ev The dispatch envelope (carries the popup host + focus seam during real dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    const isDown = inner.type === 'key' && inner.key === 'down';
    const openByMouse = inner.type === 'mouse' && inner.kind === 'down';
    const openByKey = isDown && (this.link.state.focused || inner.alt);
    if (!openByMouse && !openByKey) return;
    // TV `if (!link->focus()) { clearEvent; return; }` — a disabled link cannot take focus, so the
    // history cannot open (decode §2). Consume the trigger either way (TV `clearEvent`).
    if (!this.link.state.disabled) this.open(ev);
    ev.handled = true;
  }

  /**
   * Focus the link, record its current text, then open the anchored popup over the id's entries
   * (oldest→newest, focus index 1 when count > 1). A no-op when no overlay host is available.
   *
   * @param ev The dispatch envelope (source of the popup host + focus seam).
   */
  protected open(ev: DispatchEvent): void {
    const host = ev.popupHost;
    if (host === undefined) return; // no overlay host (headless / no shell) → decline to open
    ev.focusView?.(this.link); // TV `if (!link->focus()) return;` — focus the link first
    const entries = this.recordAndSnapshot();
    const focused = signal(entries.length > 1 ? 1 : 0); // focus index 1 when count > 1 (thstview.cpp:42-43)
    const list = new ListView<string>({
      items: signal(entries),
      getText: (s) => s,
      focused,
      // TV `cpHistoryViewer` (decode §4): normal/selected = white-on-blue (blends into the blue popup),
      // focused = white-on-green. Overrides the RD-11 cyan `list*` roles so the rows are faithful.
      roles: { normal: 'historyViewer', focused: 'historyViewerFocused', selected: 'historyViewer' },
    });
    openAnchoredPopup({
      host,
      anchor: absoluteRect(this.link),
      list,
      maxRows: this.maxRows,
      onPick: (index) => this.pick(entries[index]),
    });
  }

  /**
   * Record the current field text (skip-empty/dedup/append/evict) into the store or the injectable
   * signal, and return the resulting oldest→newest snapshot.
   *
   * @returns The entry snapshot the popup lists.
   */
  protected recordAndSnapshot(): string[] {
    const text = this.link.getValueSignal()();
    if (this.history !== undefined) {
      const arr = [...this.history()];
      addEntry(arr, text);
      this.history.set(arr);
      return arr;
    }
    historyAdd(this.historyId, text);
    return historyEntries(this.historyId);
  }

  /**
   * Replace the linked field's text with the picked value (clamped to the field's max length) and
   * select all of it — TV `strnzcpy(link->data, rslt, link->maxLen+1); link->selectAll(True)` via the
   * public Input seam (PA-8).
   *
   * @param value The picked entry text (undefined when the index is out of range — a no-op).
   */
  protected pick(value: string | undefined): void {
    if (value === undefined) return;
    this.link.getValueSignal().set(value.slice(0, this.link.getMaxLength()));
    this.link.selectAll();
  }
}
