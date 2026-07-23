/**
 * A history dropdown: a small `▐↓▌` button you place next to an {@link Input}. Opening it drops a
 * bounded most-recently-used list of that field's past values in an anchored popup; picking one
 * replaces the field's text.
 *
 * Behavior:
 *   • Opens on a click of the button, or on Down / Alt+Down while the linked field is focused. On
 *     open it focuses the field and records its current text into the store before showing the list.
 *   • The list shows the id's entries oldest-first; when there is more than one entry it starts with
 *     the second-oldest focused (so the newest-but-one is a single step away).
 *   • Picking an entry copies it into the field (clamped to the field's max length) and selects all of
 *     the text. Esc or a click outside dismisses the popup and leaves the field unchanged.
 *   • Values are stored either in the process-global store keyed by `historyId`, or in an app-owned
 *     `Signal<string[]>` you pass as `history`.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { signal, effect } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { Input } from '../controls/index.js';
import { ListView } from '../list/index.js';
import { openAnchoredPopup, DEFAULT_MAX_ROWS, drawDropdownIcon, absoluteRect } from './popup.js';
import { historyAdd, historyEntries, addEntry } from './history-store.js';

/** Options for a {@link History} control. */
export interface HistoryOptions {
  /** The `Input` this history is linked to (drawn adjacent; its text is read and replaced on pick). */
  link: Input;
  /** Numeric id keying the process-global MRU store; two Histories with the same id share a list. */
  historyId?: number;
  /** Bind an app-owned list instead of the global store. */
  history?: Signal<string[]>;
  /** Max visible popup rows (default 6). */
  maxRows?: number;
}

/**
 * The `▐↓▌` history dropdown button linked to an `Input` (see the module docs).
 *
 * @example
 * import { History, Input, Group, historyAdd, createEventLoop, signal, at } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const value = signal('/etc/hosts');
 * const input = new Input({ value });
 * for (const past of ['/usr/bin', '/etc/hosts', '~/dev']) historyAdd(1, past);
 * const history = new History({ link: input, historyId: 1 });
 *
 * const controls = new Group();
 * controls.add(at(input, 1, 1, 20, 1));
 * controls.add(at(history, 22, 1, 3, 1));
 * // The popup needs an overlay host: build the app with a full-viewport overlay set as loop.popupHost.
 * // Then Alt+↓ (or a click on the button) drops the field's past values; Enter fills the field.
 */
export class History extends View {
  /** Caught after the focused chain so Down/Alt+Down are seen while the linked field holds focus. */
  override postProcess = true;
  protected readonly link: Input;
  protected readonly historyId: number;
  protected readonly history?: Signal<string[]>;
  protected readonly maxRows: number;

  /**
   * @param opts The linked `Input` + optional `historyId` / app-owned `history` signal / `maxRows`.
   */
  constructor(opts: HistoryOptions) {
    super();
    this.link = opts.link;
    this.historyId = opts.historyId ?? 0;
    this.history = opts.history;
    this.maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  }

  /** Draw the 3-cell `▐↓▌` dropdown icon. */
  override draw(ctx: DrawContext): void {
    drawDropdownIcon(ctx, 0);
  }

  /**
   * Open on a mouse-down, on Down while the linked field is focused, or on Alt+Down from anywhere.
   *
   * @param ev The dispatch envelope (carries the popup host + focus seam during real dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    const isDown = inner.type === 'key' && inner.key === 'down';
    const openByMouse = inner.type === 'mouse' && inner.kind === 'down';
    const openByKey = isDown && (this.link.state.focused || inner.alt);
    if (!openByMouse && !openByKey) return;
    // A disabled field cannot take focus, so the dropdown cannot open — but the trigger is still
    // consumed either way so it does not fall through to another handler.
    if (!this.link.state.disabled) this.open(ev);
    ev.handled = true;
  }

  /**
   * Focus the field, record its current text, then open the anchored popup over the id's entries
   * (oldest→newest, starting focus on the second-oldest when there is more than one). A no-op when no
   * overlay host is available.
   *
   * @param ev The dispatch envelope (source of the popup host + focus seam).
   */
  protected open(ev: DispatchEvent): void {
    const host = ev.popupHost;
    if (host === undefined) return; // no overlay host (headless / no shell) → decline to open
    ev.focusView?.(this.link); // focus the field first
    const entries = this.recordAndSnapshot();
    const focused = signal(entries.length > 1 ? 1 : 0); // start on the second-oldest when count > 1
    openAnchoredPopup({
      host,
      anchor: absoluteRect(this.link),
      // The content is built inside the popup's reactive owner (never here in the handler) so the
      // list's computeds and the selection-watch effect are owned by, and disposed with, the popup.
      buildContent: (commit) => {
        const selected = signal(-1);
        const list = new ListView<string>({
          items: signal(entries),
          getText: (s) => s,
          focused,
          selected,
          // Use the history-viewer roles (white-on-blue / white-on-green) so the rows blend into the
          // blue popup window instead of the default list colours.
          roles: { normal: 'historyViewer', focused: 'historyViewerFocused', selected: 'historyViewer' },
        });
        // Pick on choice — Enter/Space and a single row click both set `selected`. Skip the initial
        // −1 so a pre-existing selection never auto-picks on open.
        let first = true;
        effect(() => {
          const index = selected();
          if (first) {
            first = false;
            return;
          }
          if (index >= 0) {
            this.pick(entries[index]);
            commit();
          }
        });
        return list;
      },
      contentSize: { height: this.maxRows + 1 }, // popup interior = maxRows visible list rows
      focusTarget: (c) => (c as ListView<string>).rows,
    });
  }

  /**
   * Record the current field text (skip-empty/dedup/append/evict) into the store or the app-owned
   * signal, and return the resulting oldest→newest snapshot the popup lists.
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
   * select all of it.
   *
   * @param value The picked entry text (undefined when the index is out of range — a no-op).
   */
  protected pick(value: string | undefined): void {
    if (value === undefined) return;
    this.link.getValueSignal().set(value.slice(0, this.link.getMaxLength()));
    this.link.selectAll();
  }
}
