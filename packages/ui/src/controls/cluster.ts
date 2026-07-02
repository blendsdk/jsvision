/**
 * `Cluster` — the internal base for `CheckGroup`/`RadioGroup` (Turbo Vision `TCluster`, RD-06 PA-3/PA-6).
 *
 * A vertical column of selectable items, faithful to `TCluster::drawMultiBox` (`tcluster.cpp:87-129`):
 * each row is a 5-cell box (the icon `" [ ] "`/`" ( ) "` at cols 0..4 with the mark glyph overwriting
 * col 2) then the `~hotkey~` label from col 5. Single-column only in v1 (multi-column flow deferred,
 * DEF-17). Subclasses supply the marker box, the `mark` predicate, and the `press` mutation — exactly
 * how TV's `TCheckBoxes`/`TRadioButtons` are thin overrides of `TCluster`. The `.js` extension in import
 * specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { parseTilde, tildeSegments } from '../menu/index.js';
import type { ParsedLabel } from '../menu/index.js';

/**
 * The box for a cluster item, Turbo Vision's marker-**string** model (`TCluster::drawMultiBox(icon,
 * marker)`, `tcluster.cpp:87-129`): a 5-cell bracket icon + an ordered string of state glyphs. The
 * glyph at `markers[markIndex(i)]` overwrites the icon's middle (col 2). Two-state clusters
 * (`CheckGroup`/`RadioGroup`) pass a 2-char `markers` (off/on); `MultiCheckGroup` passes `selRange`
 * glyphs (PF-001).
 */
export interface ClusterBox {
  /** The 5-char icon (e.g. `' [ ] '` / `' ( ) '`); the marker overwrites its middle (col 2). */
  readonly icon: string;
  /** Ordered state glyphs, indexed by {@link Cluster.markIndex} (e.g. `' X'` / `' •'` / a multi-state string). */
  readonly markers: string;
}

/** A single-column cluster of selectable items (internal — `CheckGroup`/`RadioGroup` extend it). */
export abstract class Cluster extends View {
  override focusable = true;
  /** The focused item index. */
  protected sel = 0;
  /** The original `~X~`-marked labels (re-split per paint). */
  protected readonly rawLabels: readonly string[];
  /** Parsed hotkeys (lowercase char + column) for `Alt-<hotkey>` matching. */
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
   * The state index of item `i` into `box().markers` (TV `multiMark`, `tcluster.cpp:87`). Two-state
   * clusters return 0 (off) / 1 (on); `MultiCheckGroup` returns `0..selRange-1`.
   */
  protected abstract markIndex(i: number): number;
  /** Toggle/select/cycle item `i` (writes the bound signal). */
  protected abstract press(i: number): void;
  /** The marker box for this cluster kind. */
  protected abstract box(): ClusterBox;
  /** Hook fired when `↑/↓` moves the selection — radio selects on move; check is a no-op (TV `movedTo`). */
  protected movedTo(_i: number): void {
    // default: moving focus does not change the value (TCheckBoxes); TRadioButtons overrides this.
  }

  /**
   * Enable/disable an item (TV `enableMask`). A disabled item is skipped by `↑/↓`, inert to
   * `Space`/click, and drawn in `clusterDisabled`.
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
    const accent = ctx.color('clusterShortcut');
    for (let i = 0; i < this.rawLabels.length && i < h; i += 1) {
      const role = !this.enabled[i]
        ? 'clusterDisabled'
        : i === this.sel && this.state.focused
          ? 'clusterSelected'
          : 'clusterNormal';
      const base = ctx.color(role);
      ctx.fillRect(0, i, w, 1, ' ', base);
      ctx.text(0, i, icon, base); // " [ ] " / " ( ) " at cols 0..4
      ctx.text(2, i, markers[this.markIndex(i)] ?? ' ', base); // marker glyph overwrites col 2 (TV putChar)
      for (const seg of tildeSegments(this.rawLabels[i] ?? '')) {
        ctx.text(5 + seg.col, i, seg.text, seg.hot ? accent : base); // label from col 5
      }
    }
  }

  /**
   * Keyboard (`↑`/`↓` move, `Space` press, `Alt-<hotkey>` select) + mouse (click a row to focus + press).
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
    } else if (inner.alt && inner.key.length === 1) {
      const i = this.parsed.findIndex((p) => p.hotkey === inner.key.toLowerCase());
      if (i >= 0 && this.enabled[i]) {
        this.sel = i;
        this.press(i);
        this.invalidate();
        ev.handled = true;
      }
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
