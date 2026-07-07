/**
 * `ComboBox<T>` — a dropdown selector combining an `Input` field with a trailing `▐↓▌` button that
 * opens the shared anchored popup over a `ListView<T>` (RD-14, input-dropdowns/03-03-combobox.md).
 *
 * ComboBox has **no** Turbo Vision counterpart (TV predates the combo box) — it is designed fresh, but
 * **draws like its siblings**: the button reuses the History glyph/colors (`drawDropdownIcon`, PA-11)
 * and the popup rows use the RD-11 `list*` roles (like `TListBox`, decode in the fidelity spec). Two
 * modes over a two-signal binding (`value: Signal<T | null>` ⟂ `text: Signal<string>`):
 *
 *   • **editable** (default): the field accepts free text into `text`; the candidate list is `items`
 *     narrowed by `filter(item, text)` (default case-insensitive substring, PA-13). `value` tracks the
 *     item whose `getText` exactly equals `text`, else `null` (PA-14) — so free text matching nothing
 *     leaves `value` null. Picking a row sets `text = getText(item)` (⇒ `value = item` via the bind).
 *   • **select-only** (`editable: false`): the field is read-only (a reject-all validator blocks
 *     keystrokes) and mirrors `getText(value)`; the open list has `typeAhead` so typing jumps the
 *     focused row. Picking a row sets `value` directly (⇒ `text = getText(value)` via the bind).
 *
 * Opens on the trailing button's mouse-down, or **Down / Alt+Down** while the field is focused (the
 * ComboBox catches the key as the focused Input's ancestor in the bubble; PA-12 of the event loop).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { LayoutProps } from '../layout/index.js';
import { signal, effect } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { Input } from '../controls/index.js';
import type { Validator } from '../controls/index.js';
import { ListView } from '../list/index.js';
import { openAnchoredPopup, DEFAULT_MAX_ROWS, drawDropdownIcon, absoluteRect } from './popup.js';

/** A reject-all validator — makes a select-only ComboBox field read-only (blocks every keystroke). */
const REJECT_ALL: Validator = { isValidInput: () => false, isValid: () => true };

/** The default candidate filter: case-insensitive substring of the item's display text (PA-13). */
function defaultFilter<T>(getText: (item: T) => string): (item: T, text: string) => boolean {
  return (item, text) => getText(item).toLowerCase().includes(text.toLowerCase());
}

/** Options for a {@link ComboBox}. */
export interface ComboBoxOptions<T> {
  /** The source items (reactive — the open popup re-renders on change in select-only mode). */
  items: Signal<T[]>;
  /** Render an item to its display string (list rows + the editable value ⟷ text match). */
  getText: (item: T) => string;
  /** The selected value (two-way; `null` = none / no match). */
  value: Signal<T | null>;
  /** The field text (two-way). Defaults to an internal signal seeded `''` (or `getText(value)`). */
  text?: Signal<string>;
  /** Editable free-text + filter (default `true`); `false` = read-only picker + type-ahead. */
  editable?: boolean;
  /** Candidate predicate for editable mode (default case-insensitive substring). */
  filter?: (item: T, text: string) => boolean;
  /** App callback on pick, with the list's display index + the item (TV `onSelect`). */
  onSelect?: (index: number, item: T) => void;
  /** Typed command emitted on pick (via the list's activation). */
  command?: string;
  /** Max visible popup rows (default 6; window height = maxRows + 2). PA-4. */
  maxRows?: number;
}

/**
 * The trailing `▐↓▌` ComboBox button: draws the shared dropdown icon and opens the popup on a
 * mouse-down. Not focusable — the field is the focus target; the button is click-only.
 */
class ComboButton extends View {
  /** Fixed 3-cell width (the icon), stretched to the field height by the row layout. */
  override layout: LayoutProps = { size: { kind: 'fixed', cells: 3 } };

  constructor(private readonly onOpen: (ev: DispatchEvent) => void) {
    super();
  }

  /** Draw the `▐↓▌` icon (shared with History, so the glyph/colors never drift; PA-11). */
  override draw(ctx: DrawContext): void {
    drawDropdownIcon(ctx, 0);
  }

  /** A mouse-down on the button opens the popup. */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      this.onOpen(ev);
      ev.handled = true;
    }
  }
}

/**
 * A dropdown selector: an `Input` field + a trailing `▐↓▌` button opening a `ListView<T>` popup.
 * Editable (free text + filter) or select-only (read-only picker + type-ahead). See the module doc.
 */
export class ComboBox<T> extends Group {
  /** The source items. */
  readonly items: Signal<T[]>;
  /** The selected value (`null` = none / no exact match in editable mode). */
  readonly value: Signal<T | null>;
  /** The field text. */
  readonly text: Signal<string>;
  /** The composed text field (the focus target; exposed for focusing + testing). */
  readonly input: Input;
  /** The current candidate list — `items` in select-only mode, filtered by `text` when editable. */
  readonly filtered: () => T[];

  protected readonly getText: (item: T) => string;
  protected readonly editable: boolean;
  protected readonly filterFn: (item: T, text: string) => boolean;
  protected readonly onSelect?: (index: number, item: T) => void;
  protected readonly command?: string;
  protected readonly maxRows: number;
  protected readonly button: ComboButton;

  /**
   * @param opts The `items` + `getText` + two-way `value` (and optional `text`), the `editable` flag,
   *   an optional `filter`/`onSelect`/`command`/`maxRows`.
   */
  constructor(opts: ComboBoxOptions<T>) {
    super();
    this.items = opts.items;
    this.value = opts.value;
    this.getText = opts.getText;
    this.editable = opts.editable ?? true;
    this.filterFn = opts.filter ?? defaultFilter(this.getText);
    this.onSelect = opts.onSelect;
    this.command = opts.command;
    this.maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
    this.text = opts.text ?? signal('');

    // Candidates: all items (select-only) or the substring-filtered set (editable). Empty text ⇒ all.
    this.filtered = this.derived(() => {
      if (!this.editable) return this.items();
      const t = this.text();
      return this.items().filter((item) => this.filterFn(item, t));
    });

    // The field: editable is a free two-way text; select-only is read-only (reject-all validator).
    this.input = new Input(this.editable ? { value: this.text } : { value: this.text, validator: REJECT_ALL });
    this.input.layout = { size: { kind: 'fr', weight: 1 } };
    this.button = new ComboButton((ev) => this.open(ev));
    this.add(this.input);
    this.add(this.button);

    this.onMount(() => this.bindValueText());
  }

  /**
   * Wire the mode-specific one-way binding between `value` and `text` (PA-14). Editable: `value` tracks
   * the exact `getText`-match of `text` among `items` (else `null`). Select-only: `text` mirrors
   * `getText(value)`. Each direction reads only the OTHER signal, so there is no feedback loop.
   */
  protected bindValueText(): void {
    if (this.editable) {
      this.bind(
        () => {
          const t = this.text();
          return this.items().find((item) => this.getText(item) === t) ?? null;
        },
        (v) => this.value.set(v),
      );
    } else {
      this.bind(
        () => this.value(),
        (v) => this.text.set(v !== null ? this.getText(v) : ''),
      );
    }
  }

  /**
   * Open on Down / Alt+Down while the field is focused (the ComboBox sees the key as the Input's
   * ancestor in the focus-chain bubble). A mouse-down on the trailing button opens via {@link ComboButton}.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key' && inner.key === 'down' && (this.input.state.focused || inner.alt)) {
      this.open(ev);
      ev.handled = true;
    }
  }

  /**
   * Focus the field, then open the anchored popup over the current candidates. Select-only lists get
   * `typeAhead`; editable lists show the filtered snapshot at open time. A no-op with no overlay host.
   *
   * @param ev The dispatch envelope (source of the popup host + focus seam).
   */
  protected open(ev: DispatchEvent): void {
    const host = ev.popupHost;
    if (host === undefined) return; // no overlay host (headless / no shell) → decline to open
    ev.focusView?.(this.input); // focus the field first (parallel to History focusing its link)
    // Editable lists snapshot the filtered set at open (the list is focused, so the field can't be
    // re-filtered while open); select-only lists bind the live `items` so a source change re-renders.
    const listItems: Signal<T[]> = this.editable ? signal(this.filtered()) : this.items;
    openAnchoredPopup({
      host,
      anchor: absoluteRect(this),
      // Built inside the popup's reactive owner (never here in the handler) so the list's computeds +
      // the selected()-watch effect are owned + disposed with the popup — see `openAnchoredPopup`.
      buildContent: (commit) => {
        const selected = signal(-1);
        const list = new ListView<T>({
          items: listItems,
          getText: this.getText,
          focused: signal(0),
          selected,
          typeAhead: !this.editable,
          onSelect: this.onSelect, // the app callback + command still fire on keyboard activate (unchanged)
          command: this.command,
        });
        // Pick on choice — Enter/Space (activate) AND a single row click both set `selected` (PA-16
        // runtime: the popup no longer watches selected(), so the watch lives here). Skip the initial
        // −1 so a pre-existing selection never auto-picks on open.
        let first = true;
        effect(() => {
          const index = selected();
          if (first) {
            first = false;
            return;
          }
          if (index >= 0) {
            this.pick(listItems()[index]);
            commit();
          }
        });
        return list;
      },
      contentSize: { height: this.maxRows + 1 }, // reproduces the old maxRows+2 frame exactly (PA-5)
      focusTarget: (c) => (c as ListView<T>).rows,
    });
  }

  /**
   * Commit a picked item. Editable sets `text = getText(item)` (⇒ `value` via the bind); select-only
   * sets `value = item` (⇒ `text` via the bind). Out-of-range index (`undefined`) is a no-op.
   *
   * @param item The picked item, or `undefined` when the display index is out of range.
   */
  protected pick(item: T | undefined): void {
    if (item === undefined) return;
    if (this.editable) this.text.set(this.getText(item));
    else this.value.set(item);
  }
}
