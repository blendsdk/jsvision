/**
 * Internal base class for the check/radio groups. A `Cluster` is a vertical column of selectable
 * items: each row shows a 5-cell marker box (`" [ ] "` / `" ( ) "`, with the state glyph in the
 * middle) followed by the item's label. Subclasses ({@link CheckGroup}, {@link RadioGroup},
 * `MultiCheckGroup`) supply the marker box, decide each item's state glyph, and define what pressing
 * an item does. Not exported — construct one of the concrete groups instead.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { parseTilde, tildeSegments, accentStyle } from '../menu/index.js';
import type { ParsedLabel } from '../menu/index.js';

/**
 * Describes how a cluster row's marker box is drawn: a 5-cell bracket icon plus an ordered string of
 * state glyphs. The glyph at `markers[markIndex(i)]` overwrites the icon's middle cell. Two-state
 * groups pass a 2-char `markers` (off/on); a multi-state group passes one glyph per state.
 */
export interface ClusterBox {
  /** The 5-char icon (e.g. `' [ ] '` / `' ( ) '`); the state glyph overwrites its middle cell. */
  readonly icon: string;
  /** Ordered state glyphs, indexed by {@link Cluster.markIndex} (e.g. `' X'` / `' •'` / a multi-state string). */
  readonly markers: string;
}

/** A single-column group of selectable items. Internal — the concrete check/radio groups extend it. */
export abstract class Cluster extends View {
  override focusable = true;
  /** Post-process so an `Alt`+hotkey is seen dialog-wide, even when this group isn't focused. */
  override postProcess = true;
  /** The focused item index. */
  protected sel = 0;
  /** The original tilde-marked labels. */
  protected readonly rawLabels: readonly string[];
  /** Parsed hotkeys (letter + column) for `Alt`+hotkey matching. */
  protected readonly parsed: readonly ParsedLabel[];
  /** Per-item enabled flags (all enabled by default). */
  protected readonly enabled: boolean[];

  /**
   * @param labels One label per item; each may mark its hotkey with `~X~`.
   */
  constructor(labels: readonly string[]) {
    super();
    this.rawLabels = labels;
    this.parsed = labels.map(parseTilde);
    this.enabled = labels.map(() => true);
  }

  /**
   * The state index of item `i` into `box().markers`. Two-state groups return 0 (off) / 1 (on); a
   * multi-state group returns `0..states-1`.
   */
  protected abstract markIndex(i: number): number;
  /** Toggle / select / cycle item `i`, writing the bound signal. */
  protected abstract press(i: number): void;
  /** The marker box for this group kind. */
  protected abstract box(): ClusterBox;
  /** Fired when `↑`/`↓` moves the selection. A radio group selects on move; a check group does nothing. */
  protected movedTo(_i: number): void {
    // Default: moving focus does not change the value. RadioGroup overrides this to select on move.
  }

  /**
   * Enable or disable an item. A disabled item is skipped by `↑`/`↓`, is inert to `Space`/click, and
   * is drawn greyed.
   *
   * @param i  The item index.
   * @param on Whether the item is enabled.
   */
  setItemEnabled(i: number, on: boolean): void {
    if (i >= 0 && i < this.enabled.length) {
      this.enabled[i] = on;
      this.invalidate();
    }
  }

  /**
   * Paint one item per row: the 5-cell marker box + the `~hotkey~` label, in the per-item role.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const { icon, markers } = this.box();
    const { width: w, height: h } = ctx.size;
    // Only an enabled item's accent takes the accelerator-overlay underline (FR-6); `hotColor` below
    // already collapses a disabled row's hot run to its base color.
    const accent = accentStyle(ctx.color('clusterShortcut'), ctx.revealAccelerators);
    for (let i = 0; i < this.rawLabels.length && i < h; i += 1) {
      const role = !this.enabled[i]
        ? 'clusterDisabled'
        : i === this.sel && this.state.focused
          ? 'clusterSelected'
          : 'clusterNormal';
      const base = ctx.color(role);
      // A disabled row draws its hotkey run in the greyed colour too — only an enabled hotkey accents.
      const hotColor = this.enabled[i] ? accent : base;
      ctx.fillRect(0, i, w, 1, ' ', base);
      ctx.text(0, i, icon, base); // the bracket box at columns 0..4
      ctx.text(2, i, markers[this.markIndex(i)] ?? ' ', base); // state glyph overwrites the middle cell
      for (const seg of tildeSegments(this.rawLabels[i] ?? '')) {
        ctx.text(5 + seg.col, i, seg.text, seg.hot ? hotColor : base); // label starts at column 5
      }
    }
  }

  /**
   * Keyboard (`↑`/`↓` move, `Space` press, `Alt`+hotkey select) and mouse (click a row to focus and press).
   *
   * @param ev The dispatch envelope (carries `local` during real mouse dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down' && ev.local !== undefined) {
      const i = ev.local.y;
      if (i >= 0 && i < this.rawLabels.length && this.enabled[i]) {
        this.sel = i;
        this.press(i);
        this.invalidate();
        ev.handled = true;
      }
      return;
    }
    if (inner.type !== 'key') return;
    // An Alt+hotkey is handled dialog-wide (this view is post-process): it selects and presses the
    // item AND takes focus, whether or not this group is currently focused.
    if (inner.alt && inner.key.length === 1) {
      const i = this.parsed.findIndex((p) => p.hotkey === inner.key.toLowerCase());
      if (i >= 0 && this.enabled[i]) {
        this.sel = i;
        this.press(i);
        ev.focusView?.(this); // a dialog-wide hotkey also moves focus here
        this.invalidate();
        ev.handled = true;
      }
      return;
    }
    // Navigation keys are handled only while focused — a post-process view must not steal another view's keys.
    if (!this.state.focused) return;
    if (inner.key === 'up') {
      this.moveSel(-1);
      ev.handled = true;
    } else if (inner.key === 'down') {
      this.moveSel(1);
      ev.handled = true;
    } else if (inner.key === 'space') {
      if (this.enabled[this.sel]) {
        this.press(this.sel);
        this.invalidate();
      }
      ev.handled = true;
    }
  }

  /** Move the selection by `dir`, skipping disabled items and wrapping; a no-op if none are enabled. */
  protected moveSel(dir: 1 | -1): void {
    const n = this.rawLabels.length;
    if (n === 0) return;
    let i = this.sel;
    for (let step = 0; step < n; step += 1) {
      i = (i + dir + n) % n;
      if (this.enabled[i]) {
        this.sel = i;
        this.movedTo(i);
        this.invalidate();
        return;
      }
    }
  }
}
