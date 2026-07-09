/**
 * A clickable command button with a raised, drop-shadowed face. Activate it by clicking, by pressing
 * `Space` while it is focused, by its `Alt`+hotkey, or — when it is the dialog's `default` button —
 * by pressing `Enter` anywhere the key is not already consumed.
 *
 * Activation does two things (either or both may be configured): it emits a typed command that a
 * menu/status/app handler can react to, and it calls the optional `onClick` callback. Mark the
 * hotkey letter by wrapping it in tildes, e.g. `'~O~K'`.
 *
 * A disabled button is greyed out and completely inert (and drops out of the Tab order). Pass a
 * getter for `disabled` to make it re-evaluate reactively as your signals change.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { parseTilde, tildeSegments, accentStyle } from '../menu/index.js';
import type { ParsedLabel } from '../menu/index.js';
import { stringWidth } from './measure.js';

/** Options for {@link Button}. */
export interface ButtonOptions {
  /** A command name emitted when the button is activated. Handle it from a menu/status/app handler. */
  command?: string;
  /** A callback fired when the button is activated, in addition to (or instead of) {@link command}. */
  onClick?: () => void;
  /** Marks this as the dialog's default button: it also activates on `Enter` when the key is unconsumed. */
  default?: boolean;
  /** Greyed out and inert. Pass a getter to re-evaluate reactively when the signals it reads change. */
  disabled?: boolean | (() => boolean);
}

/**
 * A focusable command button.
 *
 * @example
 * import { Group, Button, signal } from '@jsvision/ui';
 *
 * const buttons = new Group();
 *
 * // A default button that emits a command (handled elsewhere, e.g. by a Dialog or the app).
 * const ok = new Button('~O~K', { command: 'ok', default: true });
 * ok.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 10, height: 2 } };
 * buttons.add(ok);
 *
 * // A plain button that runs a callback directly.
 * const count = signal(0);
 * const add = new Button('~A~dd', { onClick: () => count.set(count() + 1) });
 * add.layout = { position: 'absolute', rect: { x: 12, y: 0, width: 11, height: 2 } };
 * buttons.add(add);
 */
export class Button extends View {
  /** `Space` activates the button while it is focused. */
  override focusable = true;
  /** Caught after the focused chain so `Alt`+hotkey and a default button's `Enter` are seen dialog-wide. */
  override postProcess = true;

  /** The original tilde-marked label. */
  protected readonly raw: string;
  /** Parsed hotkey (letter + column) for `Alt`+hotkey matching. */
  protected readonly parsed: ParsedLabel;
  /** Command emitted on activation, if any. */
  protected readonly command?: string;
  /** Click callback fired on activation, if any. */
  protected readonly clickHandler?: () => void;
  /** Whether this is the dialog default (also activates on unconsumed `Enter`). */
  protected readonly isDefault: boolean;
  /** The disabled flag or reactive getter. */
  protected readonly disabledOpt: boolean | (() => boolean);
  /** Visual pressed state (mouse-down inside the face, before release). */
  protected pressed = false;

  /**
   * @param text The label, optionally marking its hotkey with `~X~` (e.g. `'~O~K'`).
   * @param opts `command` / `onClick` / `default` / `disabled` (see {@link ButtonOptions}).
   */
  constructor(text: string, opts: ButtonOptions = {}) {
    super();
    this.raw = text;
    this.parsed = parseTilde(text);
    this.command = opts.command;
    this.clickHandler = opts.onClick;
    this.isDefault = opts.default ?? false;
    this.disabledOpt = opts.disabled ?? false;
    this.state.disabled = this.resolveDisabled(); // initial value also controls focusability
    if (typeof this.disabledOpt === 'function') {
      // For a reactive `disabled`, keep the flag (and thus focusability + greying) in sync with the
      // getter's signals. Bind on mount, when this view's reactive scope exists.
      this.onMount(() =>
        this.bind(
          () => this.resolveDisabled(),
          (v) => {
            this.state.disabled = v;
          },
        ),
      );
    }
  }

  /** The button's `~X~` Alt-hotkey char (lowercase), for duplicate-accelerator detection; none if unmarked. */
  override accelerators(): readonly string[] {
    return this.parsed.hotkey !== null ? [this.parsed.hotkey] : [];
  }

  /** Resolve the disabled flag (evaluating the getter if it is reactive). */
  protected resolveDisabled(): boolean {
    return typeof this.disabledOpt === 'function' ? this.disabledOpt() : this.disabledOpt;
  }

  /**
   * Paint the centered label on a raised face with a block-glyph drop shadow down the right column
   * and across the bottom row. A pressed button shifts its face right one cell and hides the shadow.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const disabled = this.state.disabled;
    const faceRole = disabled
      ? 'buttonDisabled'
      : this.state.focused
        ? 'buttonFocused'
        : this.isDefault
          ? 'buttonDefault'
          : 'button';
    const face = ctx.color(faceRole);
    // A disabled button draws its hotkey run in the plain face colour — a greyed hotkey never lights up.
    const accent = disabled ? face : accentStyle(ctx.color('buttonShortcut'), ctx.revealAccelerators);
    const shadow = ctx.color('buttonShadow');
    const down = this.pressed;
    const { width: w, height: h } = ctx.size;
    if (w < 2 || h < 2) return; // needs at least a content row plus the bottom shadow row
    const s = w - 1; // last column index
    const titleRow = Math.floor(h / 2) - 1; // vertically centre the label
    const bottomFill = down ? ' ' : '\u2580'; // shadow along the bottom; blank when pressed

    // Every content row (all but the bottom shadow row).
    for (let y = 0; y <= h - 2; y += 1) {
      ctx.fillRect(0, y, w, 1, ' ', face);
      ctx.text(0, y, ' ', shadow); // left edge sits on the shadow colour
      let titleIndent: number;
      if (down) {
        ctx.text(1, y, ' ', shadow); // pressed: the face shifts one cell to the right
        titleIndent = 2;
      } else {
        ctx.text(s, y, y === 0 ? '\u2584' : '\u2588', shadow); // shadow glyphs down the right column
        titleIndent = 1;
      }
      if (y === titleRow) this.drawTitle(ctx, y, s, titleIndent, face, accent);
    }
    // Bottom shadow row: two leading spaces, then the shadow fill across the remaining columns.
    const by = h - 1;
    ctx.fillRect(0, by, Math.min(2, w), 1, ' ', shadow);
    if (s - 1 > 0) ctx.fillRect(2, by, s - 1, 1, bottomFill, shadow);
  }

  /**
   * Draw the label centered on `row`, with the hotkey run accented. There are no `[ ]` brackets in
   * this rendering.
   *
   * @param ctx    The clipped, view-local paint context.
   * @param row    The title row (view-local y).
   * @param s      The last column index (`width - 1`).
   * @param indent Left indent — 1 normally, 2 when pressed (the face shifts right).
   * @param face   The resolved face style for non-hotkey glyphs.
   * @param accent The resolved accent style for the hotkey glyph.
   */
  protected drawTitle(
    ctx: DrawContext,
    row: number,
    s: number,
    indent: number,
    face: ReturnType<DrawContext['color']>,
    accent: ReturnType<DrawContext['color']>,
  ): void {
    const textW = stringWidth(this.parsed.text);
    const l = Math.max(1, Math.floor((s - textW - 1) / 2));
    for (const seg of tildeSegments(this.raw)) {
      ctx.text(indent + l + seg.col, row, seg.text, seg.hot ? accent : face);
    }
  }

  /**
   * Handle activation: a click (press then release inside the face), `Space` while focused, this
   * button's `Alt`+hotkey, and (for a default button) an unconsumed `Enter`. A disabled button is
   * completely inert.
   *
   * @param ev The dispatch envelope (carries `emit`/`local` during real dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    if (this.state.disabled) return; // greyed and inert (and also non-focusable)
    const inner = ev.event;

    if (inner.type === 'mouse') {
      if (inner.kind === 'down' && this.inFace(ev.local)) {
        this.pressed = true;
        this.invalidate();
        ev.handled = true;
      } else if (inner.kind === 'up' && this.pressed) {
        this.pressed = false;
        this.invalidate();
        if (this.inFace(ev.local)) this.activate(ev); // release inside ⇒ activate; outside ⇒ cancel
        ev.handled = true;
      }
      return;
    }

    if (inner.type === 'key') {
      const isHotkey =
        inner.alt &&
        this.parsed.hotkey !== null &&
        inner.key.length === 1 &&
        inner.key.toLowerCase() === this.parsed.hotkey;
      if ((inner.key === 'space' && this.state.focused) || isHotkey || (inner.key === 'enter' && this.isDefault)) {
        this.activate(ev);
        ev.handled = true;
      }
    }
  }

  /**
   * Whether a view-local point lies in the clickable face. Column 0 (the shadow-adjacent edge) is
   * inert, and the last column and last row (the drop shadow) are excluded too.
   */
  protected inFace(local: DispatchEvent['local']): boolean {
    if (local === undefined) return false;
    return local.x >= 1 && local.y >= 0 && local.x < this.bounds.width - 1 && local.y < this.bounds.height - 1;
  }

  /** Emit the command (if any) and fire `onClick`. Only ever called for an enabled button. */
  protected activate(ev: DispatchEvent): void {
    if (this.command !== undefined) ev.emit?.(this.command);
    this.clickHandler?.();
  }
}
