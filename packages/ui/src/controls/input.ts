/**
 * `Input` — a lean single-line text editor bound to a two-way signal (Turbo Vision `TInputLine`,
 * RD-06 AC-4/AC-5/PA-2/PA-11).
 *
 * Faithful to `TInputLine::draw` (`tinputli.cpp:134-160`): the value is drawn from `firstPos` at
 * column 1 (width `size.x-1`), with `◄`(0x11)/`►`(0x10) edge arrows (`tvtext1.cpp:106-107`) in the
 * `inputArrows` role when scrolled, and the field in `inputSelected` (focused) / `inputNormal`. The
 * cursor-keep-visible `firstPos` adjust mirrors `tinputli.cpp:460-465`, and the edit/scroll behavior
 * `:341-468`. A `validator` gates each keystroke live (`isValidInput`) and, on the focused→unfocused
 * transition (observed via the PF-009 focus-change signal — there is no blur event), runs the blocking
 * `isValid` to set `invalid` (no focus-trap — Tab proceeds, PA-2). Selection/clipboard (DEF-01) and the
 * hardware caret (DEF-19) are deferred. The `.js` extension is required by NodeNext resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { KeyEvent } from '@jsvision/core';
import type { Validator } from './validators/index.js';

/** Left/right scroll arrows (TV `tvtext1.cpp:106-107`, `0x11`/`0x10`), unambiguous-narrow code points. */
const LEFT_ARROW = '\u25C4'; // ◄
const RIGHT_ARROW = '\u25BA'; // ►

/** Construction options for {@link Input}. */
export interface InputOptions {
  /** Two-way value binding: reading renders, edits write back (PA-3/AR-100). */
  value: Signal<string>;
  /** Cap on the stored value length (default: unbounded). */
  maxLength?: number;
  /** Filters keystrokes live (`isValidInput`) + blocks on focus-leave (`isValid`) — 03-04. */
  validator?: Validator;
}

/** A focusable single-line text editor with horizontal scroll + edge arrows. */
export class Input extends View {
  override focusable = true;
  /** The two-way bound value signal (source of truth). */
  protected readonly value: Signal<string>;
  /** Length cap on the stored value (`Infinity` when unbounded). */
  protected readonly maxLength: number;
  /** Optional live + blocking validator. */
  protected readonly validator?: Validator;
  /** Cursor index into the value. */
  protected curPos = 0;
  /** First visible character index (horizontal scroll). */
  protected firstPos = 0;
  /** Set by {@link valid}/focus-leave; drives the invalid theming (exposed for the app, PA-2). */
  invalid = false;
  /** Tracks the focus edge so blocking validation runs only on the focused→unfocused transition. */
  protected wasFocused = false;

  /**
   * @param opts `value` (two-way signal) + optional `maxLength` / `validator` (see {@link InputOptions}).
   */
  constructor(opts: InputOptions) {
    super();
    this.value = opts.value;
    this.maxLength = opts.maxLength ?? Number.POSITIVE_INFINITY;
    this.validator = opts.validator;
    this.onMount(() => {
      // Two-way: repaint + clamp the cursor when the value changes externally.
      this.bind(
        () => this.value(),
        (v) => {
          if (this.curPos > v.length) this.curPos = v.length;
          this.adjustScroll();
        },
      );
      // Blocking validation on the focused→unfocused transition (PF-009; no blur event exists).
      this.bind(
        () => this.focusSignal()(),
        () => {
          const now = this.state.focused;
          if (this.wasFocused && !now) this.valid();
          this.wasFocused = now;
        },
      );
    });
  }

  /**
   * Run the blocking validator over the current value, set {@link invalid}, and return the result.
   * Also the explicit ST-09 entry point. With no validator, always valid.
   *
   * @returns Whether the current value passes the blocking validator.
   */
  valid(): boolean {
    const ok = this.validator ? this.validator.isValid(this.value()) : true;
    this.invalid = !ok;
    this.invalidate();
    return ok;
  }

  /**
   * Paint the field: the value from `firstPos` at column 1, the edge arrows when scrolled, in the
   * focused/normal role.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const v = this.value();
    const style = ctx.color(this.state.focused ? 'inputSelected' : 'inputNormal');
    const arrows = ctx.color('inputArrows');
    const { width: w, height: h } = ctx.size;
    ctx.fillRect(0, 0, w, h, ' ', style);
    if (w > 1) ctx.text(1, 0, v.slice(this.firstPos, this.firstPos + (w - 1)), style); // cols 1..w-1
    if (this.canScrollRight(v, w)) ctx.text(w - 1, 0, RIGHT_ARROW, arrows);
    if (this.firstPos > 0) ctx.text(0, 0, LEFT_ARROW, arrows);
  }

  /** Whether text extends past the right edge of the field (TV `canScroll(1)`, `tinputli.cpp:118`). */
  protected canScrollRight(v: string, w: number): boolean {
    return v.length - this.firstPos + 2 > w;
  }

  /** Keep the cursor visible by clamping `firstPos` (TV `tinputli.cpp:460-465`). */
  protected adjustScroll(): void {
    const w = this.bounds.width;
    if (this.firstPos > this.curPos) this.firstPos = this.curPos;
    const i = this.curPos - w + 2;
    if (this.firstPos < i) this.firstPos = i;
    if (this.firstPos < 0) this.firstPos = 0;
  }

  /**
   * Route a key (edit/move) or a mouse-down (cursor position / arrow scroll). Tab/Enter are not
   * consumed — they pass through to focus traversal / the default button.
   *
   * @param ev The dispatch envelope (carries `local` during real mouse dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      this.handleClick(ev);
      return;
    }
    if (inner.type !== 'key') return;
    if (inner.key === 'enter' || inner.key === 'tab') return; // pass through (PA-2)
    if (this.handleKey(inner)) ev.handled = true;
  }

  /** Apply an edit/move key; returns whether it was consumed. */
  protected handleKey(inner: KeyEvent): boolean {
    const v = this.value();
    switch (inner.key) {
      case 'left':
        this.curPos = Math.max(0, this.curPos - 1);
        break;
      case 'right':
        this.curPos = Math.min(v.length, this.curPos + 1);
        break;
      case 'home':
        this.curPos = 0;
        break;
      case 'end':
        this.curPos = v.length;
        break;
      case 'backspace':
        if (this.curPos > 0) {
          this.setValue(v.slice(0, this.curPos - 1) + v.slice(this.curPos));
          this.curPos -= 1;
        }
        break;
      case 'delete':
        if (this.curPos < v.length) this.setValue(v.slice(0, this.curPos) + v.slice(this.curPos + 1));
        break;
      default:
        return this.insertPrintable(inner, v);
    }
    this.adjustScroll();
    this.invalidate();
    return true;
  }

  /** Insert a printable character at the cursor, respecting `maxLength` + `validator.isValidInput`. */
  protected insertPrintable(inner: KeyEvent, v: string): boolean {
    if (inner.ctrl || inner.alt) return false;
    const ch = inner.key === 'space' ? ' ' : [...inner.key].length === 1 ? inner.key : null;
    if (ch === null) return false; // a non-printable named key passes through
    if (v.length >= this.maxLength) return true; // capped: consume the key but insert nothing
    const candidate = v.slice(0, this.curPos) + ch + v.slice(this.curPos);
    if (this.validator && !this.validator.isValidInput(candidate)) return true; // rejected live
    this.setValue(candidate);
    this.curPos += 1;
    this.adjustScroll();
    this.invalidate();
    return true;
  }

  /** Write the bound value (two-way). */
  protected setValue(next: string): void {
    this.value.set(next);
  }

  /** Position the cursor at the clicked column, or scroll when an edge arrow is clicked. */
  protected handleClick(ev: DispatchEvent): void {
    const local = ev.local;
    if (local === undefined) return;
    const w = this.bounds.width;
    const v = this.value();
    if (local.x === 0 && this.firstPos > 0) {
      this.firstPos -= 1; // ◄ click → scroll left
    } else if (local.x === w - 1 && this.canScrollRight(v, w)) {
      this.firstPos += 1; // ► click → scroll right
    } else {
      this.curPos = Math.max(0, Math.min(v.length, local.x + this.firstPos - 1)); // TV mousePos
      this.adjustScroll();
    }
    this.invalidate();
    ev.handled = true;
  }
}
