/**
 * `Button` — a focusable command button (Turbo Vision `TButton`, RD-06 AC-3/PA-1/PA-7/PA-8).
 *
 * Draws `[ text ]` with TV's block-glyph drop-shadow and activates on click / `Space` (focused) /
 * `Alt-<hotkey>`, and — when `default` — on `Enter` if unconsumed; activation emits a typed command
 * (`ev.emit`) and/or calls `onClick`. Faithful to `TButton::drawState` (`tbutton.cpp:102-164`): the
 * `▄`(0xDC)/`█`(0xDB)/`▀`(0xDF) shadow (`shadows = "\xDC\xDB\xDF"`, `tbutton.cpp:116/143-146`) drawn
 * down the right column and across the bottom row in the shadow role (TV `getColor(8)` ≈ darkGray/black,
 * 03-03), and the state→role mapping (`tbutton.cpp:107-118`). The 100 ms press animation
 * (`tbutton.cpp:231`) and the focus/default end-markers (`showMarkers`) are out of v1 (cosmetic, PA-8);
 * the hardware caret is deferred (DEF-19). The `.js` extension is required by NodeNext resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { parseTilde, tildeSegments } from '../menu/index.js';
import type { ParsedLabel } from '../menu/index.js';
import { stringWidth } from './measure.js';

/** Construction options for {@link Button}. */
export interface ButtonOptions {
  /** Command emitted via `ev.emit` on activation (PA-1). */
  command?: string;
  /** Called on activation, in addition to {@link command}. */
  onClick?: () => void;
  /** Also activate on `Enter` when the key is unconsumed by the focused chain (PA-7). */
  default?: boolean;
  /** Greyed + inert; a reactive getter re-greys/-enables when its signals change. */
  disabled?: boolean | (() => boolean);
}

/** A focusable command button with a TV block-glyph drop-shadow. */
export class Button extends View {
  /** `Space` activates when focused. */
  override focusable = true;
  /** Catch `Alt-<hotkey>` / (default) `Enter` after the focused chain (PA-7). */
  override postProcess = true;

  /** The original `~X~`-marked label. */
  protected readonly raw: string;
  /** Parsed hotkey (lowercase char + column) for `Alt-<hotkey>` matching. */
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
    this.state.disabled = this.resolveDisabled(); // initial value (drives focusability)
    if (typeof this.disabledOpt === 'function') {
      // Reflect a reactive disabled getter into `state.disabled` (focusability) + repaint (PA-1).
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

  /** Resolve the disabled flag (evaluating the getter if reactive). */
  protected resolveDisabled(): boolean {
    return typeof this.disabledOpt === 'function' ? this.disabledOpt() : this.disabledOpt;
  }

  /**
   * Paint `[ text ]` with the state face role + the TV block-glyph drop-shadow.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const disabled = this.state.disabled;
    const faceRole = disabled
      ? 'buttonDisabled'
      : this.state.focused
        ? 'buttonFocused' // TV "selected" (sfActive + sfSelected)
        : this.isDefault
          ? 'buttonDefault'
          : 'button'; // TV "normal"
    const face = ctx.color(faceRole);
    const accent = ctx.color('buttonShortcut');
    const shadow = ctx.color('shadow');
    const { width: w, height: h } = ctx.size;
    if (w < 2 || h < 1) return;
    const s = w - 1; // shadow column index
    const titleRow = Math.max(0, Math.floor(h / 2) - 1);

    // Content rows (all but the bottom shadow row): the button face + the right shadow column.
    for (let y = 0; y <= h - 2; y += 1) {
      ctx.fillRect(0, y, w, 1, ' ', face);
      ctx.text(s, y, y === 0 ? '▄' : '█', shadow); // shadows[0]/[1]
      if (y === titleRow) this.drawTitle(ctx, y, s, face, accent);
    }
    // Bottom shadow row: two leading spaces then `▀` across (tbutton.cpp:161-162).
    const by = h - 1;
    ctx.fillRect(0, by, Math.min(2, w), 1, ' ', shadow);
    if (s - 1 > 0) ctx.fillRect(2, by, s - 1, 1, '▀', shadow); // shadows[2], cols 2..s
  }

  /**
   * Draw the bracketed, centered title on `row`: `[` at col 1, `]` at col `s-1`, the label centered
   * in the inner region with its `~hotkey~` run accented.
   */
  protected drawTitle(
    ctx: DrawContext,
    row: number,
    s: number,
    face: ReturnType<DrawContext['color']>,
    accent: ReturnType<DrawContext['color']>,
  ): void {
    ctx.text(1, row, '[', face);
    ctx.text(s - 1, row, ']', face);
    const innerStart = 2;
    const innerWidth = s - 1 - innerStart; // cols 2..s-2
    const textW = stringWidth(this.parsed.text);
    const start = innerStart + Math.max(0, Math.floor((innerWidth - textW) / 2));
    for (const seg of tildeSegments(this.raw)) {
      ctx.text(start + seg.col, row, seg.text, seg.hot ? accent : face);
    }
  }

  /**
   * Handle activation: click (down-then-up inside the face), `Space` (focused), `Alt-<hotkey>`, and
   * (default) unconsumed `Enter`. A disabled button is fully inert. Mirrors `TButton::handleEvent`.
   *
   * @param ev The dispatch envelope (carries `emit`/`local` during real dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    if (this.state.disabled) return; // greyed + inert (PA-1; also non-focusable)
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

  /** Whether a view-local point lies in the clickable face (excludes the shadow column + row). */
  protected inFace(local: DispatchEvent['local']): boolean {
    if (local === undefined) return false;
    return local.x >= 0 && local.y >= 0 && local.x < this.bounds.width - 1 && local.y < this.bounds.height - 1;
  }

  /** Emit the command (if any) and fire `onClick` (PA-1). A no-op when disabled (guarded by caller). */
  protected activate(ev: DispatchEvent): void {
    if (this.command !== undefined) ev.emit?.(this.command);
    this.clickHandler?.();
  }
}
