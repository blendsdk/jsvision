/**
 * A single-line text editor bound two-way to a `Signal<string>`. Reading the signal renders the
 * field; editing it writes back — so the signal is always the source of truth for the field's text.
 *
 * Supports the usual line-editor gestures: typing, `Backspace`/`Delete` (and `Ctrl`+those to delete
 * a whole word), `Home`/`End`, `Left`/`Right` (and `Ctrl`+arrows to move by word), `Shift`+any of
 * those to extend a selection, `Ctrl+A` to select all, mouse click/drag to position and select, and
 * clipboard cut/copy/paste. When the value is longer than the field, it scrolls horizontally and
 * shows `◄`/`►` edge arrows.
 *
 * Pass an optional `validator` to constrain input: it filters each keystroke live and, when the
 * field loses focus, checks the completed value and sets {@link Input.invalid} if it fails.
 * Validation never traps focus — Tab still moves on — so you decide how to surface an invalid field.
 *
 * A `maxLength` caps the stored length. A visible caret is drawn even on terminals that hide the
 * hardware cursor.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent, Point } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { KeyEvent, MouseEvent, Style } from '@jsvision/core';
import type { Validator } from './validators/index.js';
import { Commands } from '../status/index.js';
import { selectionBlock, mousePos, motionOf, caretAfterMotion } from './input-selection.js';
import { clipboardChord, clipboardCommand, applyPaste, insertFilled } from './input-clipboard.js';
import type { ClipboardAction } from './input-clipboard.js';
import { computeDelete } from './input-editing.js';
import type { EditState, DeleteKind } from './input-editing.js';
import { LEFT_ARROW, RIGHT_ARROW, canScrollRight, displayedPos, glyphAt } from './input-render.js';

/** Options for {@link Input}. */
export interface InputOptions {
  /** The two-way bound text. Reading it renders the field; editing writes back. Required. */
  value: Signal<string>;
  /** Maximum stored length. Default: unbounded. */
  maxLength?: number;
  /** A rule that filters keystrokes live and validates the completed value on focus-leave. */
  validator?: Validator;
}

/**
 * A focusable single-line text editor.
 *
 * @example
 * import { Group, Input, signal } from '@jsvision/ui';
 *
 * // Plain field: `name` mirrors what the user types, and setting it updates the field.
 * const name = signal('');
 * const input = new Input({ value: name });
 * input.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 24, height: 1 } };
 *
 * const form = new Group();
 * form.add(input);
 *
 * @example
 * import { Input, range, signal } from '@jsvision/ui';
 *
 * // Constrained field: only integers, flagged invalid on focus-leave if out of 0..120.
 * const age = signal('');
 * const ageInput = new Input({ value: age, validator: range(0, 120), maxLength: 3 });
 */
export class Input extends View {
  override focusable = true;
  /** The two-way bound value signal (source of truth). */
  protected readonly value: Signal<string>;
  /** Length cap on the stored value (`Infinity` when unbounded). */
  protected readonly maxLength: number;
  /** Optional live + blocking validator. */
  protected readonly validator?: Validator;
  /** The caret index into the value. */
  protected curPos = 0;
  /** First visible character index (the horizontal-scroll offset). */
  protected firstPos = 0;
  /** Selection start (inclusive) as a string index; `selStart === selEnd` means no selection. */
  protected selStart = 0;
  /** Selection end (exclusive) as a string index. Invariant: `selStart ≤ selEnd`. */
  protected selEnd = 0;
  /** The fixed end of the selection while extending it with Shift. */
  protected anchor = 0;
  /** Last mouse-down column, used to detect a double-click; `null` after any non-click action. */
  protected lastDownX: number | null = null;
  /** True between this field's own mouse-down and its release, so it only extends drags it started. */
  protected dragging = false;
  /** Set by {@link valid} / focus-leave; drives the invalid styling. Read it to react to validity. */
  invalid = false;
  /** Tracks the focus edge so the blocking validator runs only when focus actually leaves the field. */
  protected wasFocused = false;

  /**
   * The current selection range as JS string indices (`start ≤ end`; empty when `start === end`).
   *
   * @returns The `{ start, end }` selection bounds.
   */
  get selection(): { start: number; end: number } {
    return { start: this.selStart, end: this.selEnd };
  }

  /** The caret index into the value. @returns The current caret position. */
  get caretPos(): number {
    return this.curPos;
  }

  // These accessors let a companion widget (such as a dropdown/history control) read and replace the
  // field's text and length cap without exposing the underlying protected fields.
  /** The two-way bound text signal, so a companion control can replace the field's text. */
  getValueSignal(): Signal<string> {
    return this.value;
  }

  /** The field's maximum length (`Infinity` when unbounded), so a companion control can clamp a value to it. */
  getMaxLength(): number {
    return this.maxLength;
  }

  /**
   * @param opts `value` (two-way signal) + optional `maxLength` / `validator` (see {@link InputOptions}).
   */
  constructor(opts: InputOptions) {
    super();
    this.value = opts.value;
    this.maxLength = opts.maxLength ?? Number.POSITIVE_INFINITY;
    this.validator = opts.validator;
    // Bind on mount, when this view's reactive scope exists (it does not in the constructor).
    this.onMount(() => {
      // Repaint on any external change to the value, and clamp our cursor/selection back into range.
      this.bind(
        () => this.value(),
        (v) => {
          // A shorter external value must clamp the WHOLE selection tuple, not just the caret —
          // otherwise selStart/selEnd/anchor dangle past the end and mis-highlight or mis-delete.
          const len = v.length;
          if (this.curPos > len) this.curPos = len;
          if (this.selStart > len) this.selStart = len;
          if (this.selEnd > len) this.selEnd = len;
          if (this.anchor > len) this.anchor = len;
          this.adjustScroll();
        },
      );
      // There is no blur event, so watch the focus signal and run the blocking validator exactly
      // once, on the transition from focused to unfocused.
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
   * Run the blocking validator over the current value, update {@link invalid}, and return the
   * result. Call it to validate on demand. With no validator, always valid.
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
    if (w > 1) ctx.text(1, 0, v.slice(this.firstPos, this.firstPos + (w - 1)), style); // text starts at column 1
    if (canScrollRight(v, w, this.firstPos)) ctx.text(w - 1, 0, RIGHT_ARROW, arrows);
    if (this.firstPos > 0) ctx.text(0, 0, LEFT_ARROW, arrows);
    // Highlight the visible part of the selection, only when focused with a non-empty selection.
    if (this.state.focused && this.selStart < this.selEnd) {
      const l = Math.max(0, displayedPos(this.selStart) - this.firstPos);
      const r = Math.min(w - 2, displayedPos(this.selEnd) - this.firstPos);
      if (l < r) {
        const seg = v.slice(this.firstPos + l, this.firstPos + r); // the characters inside the band
        ctx.text(l + 1, 0, seg, ctx.color('inputSelection'));
      }
    }
    // Draw a visible caret LAST by repainting the edit cell with the field colours reversed, so the
    // caret shows even on terminals that hide the hardware cursor (and in headless/test rendering).
    // Reuse whatever glyph already sits there (a character or an edge arrow) so the caret overlays
    // it rather than erasing it.
    if (this.state.focused) {
      const caretCol = displayedPos(this.curPos) - this.firstPos + 1;
      if (caretCol >= 0 && caretCol < w) {
        const reversed: Style = { fg: style.bg, bg: style.fg }; // field fg/bg swapped
        ctx.text(caretCol, 0, glyphAt(caretCol, v, w, this.firstPos), reversed);
      }
    }
  }

  /**
   * The view-local caret cell for the hardware cursor: the focused edit cell, or `null` when
   * unfocused or scrolled out of view. The event loop translates it to an absolute screen cell.
   *
   * @returns The view-local caret `{ x, y }`, or `null`.
   */
  override desiredCaret(): Point | null {
    if (!this.state.focused) return null;
    const caretCol = displayedPos(this.curPos) - this.firstPos + 1;
    if (caretCol < 0 || caretCol >= this.bounds.width) return null;
    return { x: caretCol, y: 0 };
  }

  /** Keep the caret on screen by clamping the horizontal-scroll offset. */
  protected adjustScroll(): void {
    const w = this.bounds.width;
    if (this.firstPos > this.curPos) this.firstPos = this.curPos;
    const i = this.curPos - w + 2;
    if (this.firstPos < i) this.firstPos = i;
    if (this.firstPos < 0) this.firstPos = 0;
  }

  /**
   * Route a key (edit / move / select) or a mouse gesture (position / drag-select / scroll).
   * `Tab` and `Enter` are deliberately not consumed — they pass through to focus traversal and the
   * dialog's default button.
   *
   * @param ev The dispatch envelope (carries `local` during real mouse dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'command') {
      // Select-all arrives as a command (the framework keymap swallows raw Ctrl+A), so it must be
      // handled here or select-all regresses. Kept separate from the copy/cut/paste classifier.
      if (inner.command === Commands.selectAll) {
        this.selectAll(true);
        ev.handled = true;
        return;
      }
      const action = clipboardCommand(inner.command); // cut/copy/paste raised from a menu/status/keymap
      if (action !== null) {
        this.runClipboard(action, ev);
        ev.handled = true;
      }
      return;
    }
    if (inner.type === 'paste') {
      this.pasteText(inner.text); // a bracketed-paste event is the real paste path
      ev.handled = true;
      return;
    }
    if (inner.type === 'mouse') {
      this.handleMouse(inner, ev);
      return;
    }
    if (inner.type !== 'key') return;
    if (inner.key === 'enter' || inner.key === 'tab') return; // let these pass through
    const chord = clipboardChord(inner); // Ctrl+Ins / Shift+Ins / Shift+Del, before normal editing
    if (chord !== null) {
      this.runClipboard(chord, ev);
      ev.handled = true;
      return;
    }
    if (this.handleKey(inner)) ev.handled = true;
  }

  /**
   * Run a clipboard action. Copy and cut write the current selection to the clipboard; an empty
   * selection is a no-op. Cut then deletes the selection. Paste here is a no-op — a real paste
   * arrives as a paste event handled by {@link pasteText}, since there is no synchronous system
   * clipboard read.
   *
   * @param action The clipboard action.
   * @param ev     The dispatch envelope (carries `setClipboard`).
   */
  protected runClipboard(action: ClipboardAction, ev: DispatchEvent): void {
    if (action === 'paste') return; // handled via the paste event, not here
    const text = this.value().slice(this.selStart, this.selEnd);
    if (text === '') return; // nothing selected
    ev.setClipboard?.(text); // the event loop sanitizes and gates this by capability
    if (action === 'cut') {
      this.applyDelete('selection'); // deletes through the validator, reverting if the result is invalid
      this.adjustScroll();
      this.invalidate();
    }
  }

  /**
   * Insert pasted text: replace any current selection, then insert each code point through the
   * validator and the length cap (invalid or over-cap characters are dropped individually).
   *
   * @param text The pasted text (untrusted; its size is already bounded upstream).
   */
  protected pasteText(text: string): void {
    this.lastDownX = null; // a paste cancels any pending double-click
    this.deleteSelect(); // replace the selection first
    const r = applyPaste(text, this.value(), this.curPos, this.maxLength, this.validator);
    this.setValue(r.value);
    this.curPos = r.curPos;
    this.collapseSelection();
    this.adjustScroll();
    this.invalidate();
  }

  /**
   * Apply an editing/motion key. `Shift` + a motion key extends the selection; a plain motion
   * collapses it; an edit (`Backspace`/`Delete`/a printable character) deletes any selection first.
   *
   * @param inner The decoded key event.
   * @returns Whether the key was consumed (halts propagation).
   */
  protected handleKey(inner: KeyEvent): boolean {
    const v = this.value();
    this.lastDownX = null; // any key edit or motion cancels a pending double-click

    // Ctrl+A selects all — it is neither a motion nor an edit, so handle it before the rest.
    if (inner.ctrl && !inner.shift && inner.key === 'a') {
      this.selectAll(true);
      return true;
    }

    const motion = motionOf(inner);
    // Shift + a motion begins/continues a selection: anchor the fixed end before the caret moves.
    let extend = false;
    if (motion !== null && inner.shift) {
      this.anchor =
        this.curPos === this.selEnd ? this.selStart : this.selStart === this.selEnd ? this.curPos : this.selEnd;
      extend = true;
    }

    if (motion !== null) {
      this.curPos = caretAfterMotion(motion, this.curPos, v);
    } else if (inner.key === 'backspace') {
      // Ctrl/Alt+Backspace deletes the previous word; plain Backspace deletes one character.
      this.applyDelete(inner.ctrl || inner.alt ? 'wordLeft' : 'backspace');
    } else if (inner.key === 'delete') {
      // Ctrl+Delete deletes the next word; plain Delete deletes one character.
      this.applyDelete(inner.ctrl ? 'wordRight' : 'forward');
    } else {
      return this.insertPrintable(inner); // a printable character handles its own selection-delete
    }

    // After a motion, either extend the selection to the new caret or collapse it, then keep the
    // caret on screen.
    if (extend) this.adjustSelectBlock();
    else this.collapseSelection();
    this.adjustScroll();
    this.invalidate();
    return true;
  }

  /** Snapshot the editable state (value + caret + selection) for the pure delete helpers. */
  protected editState(): EditState {
    return { value: this.value(), curPos: this.curPos, selStart: this.selStart, selEnd: this.selEnd };
  }

  /** Commit an {@link EditState}: write value + caret + selection back onto this field. */
  protected writeEditState(s: EditState): void {
    this.setValue(s.value);
    this.curPos = s.curPos;
    this.selStart = s.selStart;
    this.selEnd = s.selEnd;
  }

  /**
   * Apply a delete gesture, but reject it if the result would fail the live validator. This keeps a
   * masked field from being corrupted — e.g. a delete that would break a picture mask is refused
   * rather than left in an invalid state.
   *
   * @param kind The delete gesture (backspace / forward / word / selection).
   */
  protected applyDelete(kind: DeleteKind): void {
    const after = computeDelete(this.editState(), kind);
    if (this.validator && !this.validator.isValidInput(after.value)) return; // reject an invalid result
    this.writeEditState(after);
  }

  /**
   * Insert a printable character: delete any selection first, then insert at the caret, respecting
   * the length cap and the validator. Always collapses the selection afterwards.
   *
   * @param inner The decoded key event.
   * @returns Whether the key was consumed.
   */
  protected insertPrintable(inner: KeyEvent): boolean {
    if (inner.ctrl || inner.alt) return false;
    const ch = inner.key === 'space' ? ' ' : [...inner.key].length === 1 ? inner.key : null;
    if (ch === null) return false; // a named non-printable key passes through
    this.deleteSelect(); // typing over a selection replaces it
    const r = insertFilled(ch, this.value(), this.curPos, this.maxLength, this.validator);
    if (r !== null) {
      // A masked validator may auto-fill trailing punctuation, but the caret advances only past the
      // character the user actually typed, not past that fill.
      this.setValue(r.value);
      this.curPos = r.curPos;
    }
    this.collapseSelection();
    this.adjustScroll();
    this.invalidate();
    return true;
  }

  /** Remove the selected range and move the caret to its start. */
  protected deleteSelect(): void {
    this.writeEditState(computeDelete(this.editState(), 'selection'));
  }

  /** Order the selection range from the current caret and anchor. */
  protected adjustSelectBlock(): void {
    const { start, end } = selectionBlock(this.curPos, this.anchor);
    this.selStart = start;
    this.selEnd = end;
  }

  /** Clear the selection. */
  protected collapseSelection(): void {
    this.selStart = this.selEnd = 0;
  }

  /**
   * Select the entire value (or, with `enable === false`, clear the selection) and move the caret to
   * the end. Public so a companion control can select-all before replacing the text. Defaults to
   * select-all.
   */
  selectAll(enable = true): void {
    this.selStart = 0;
    this.curPos = this.selEnd = enable ? this.value().length : 0;
    this.adjustScroll();
    this.invalidate();
  }

  /** Write the bound value (two-way). */
  protected setValue(next: string): void {
    this.value.set(next);
  }

  /**
   * Handle a mouse gesture: clicking an edge arrow scrolls; a plain press positions the caret and
   * begins a drag-selection (capturing the pointer so the drag continues past the field edge); a
   * drag extends the selection; a second press on the same cell is a double-click that selects all;
   * releasing ends the drag.
   *
   * @param inner The decoded mouse event.
   * @param ev    The dispatch envelope (`local` cell + the pointer-capture seam).
   */
  protected handleMouse(inner: MouseEvent, ev: DispatchEvent): void {
    const local = ev.local;
    if (local === undefined) return;
    const w = this.bounds.width;
    const v = this.value();
    if (inner.kind === 'down') {
      if (local.x === 0 && this.firstPos > 0) {
        this.firstPos -= 1; // clicked the left arrow: scroll left
        this.lastDownX = null;
      } else if (local.x === w - 1 && canScrollRight(v, w, this.firstPos)) {
        this.firstPos += 1; // clicked the right arrow: scroll right
        this.lastDownX = null;
      } else if (this.lastDownX === local.x) {
        this.selectAll(true); // a second press on the same cell is a double-click
        this.lastDownX = null;
      } else {
        this.curPos = this.posFromMouse(local.x);
        this.anchor = this.curPos;
        this.collapseSelection();
        this.adjustScroll();
        this.lastDownX = local.x;
        this.dragging = true; // only a drag this field started may change the selection
        ev.setCapture?.(this); // capture the pointer so the drag continues past the field edge
      }
      this.invalidate();
      ev.handled = true;
    } else if (inner.kind === 'drag' || inner.kind === 'move') {
      if (!this.dragging) return; // ignore a drag this field never initiated
      this.curPos = this.posFromMouse(local.x);
      this.adjustSelectBlock();
      this.adjustScroll();
      this.lastDownX = null; // a drag cancels double-click candidacy
      this.invalidate();
      ev.handled = true;
    } else if (inner.kind === 'up') {
      this.dragging = false; // drag finished; release the pointer capture
      ev.releaseCapture?.();
      ev.handled = true;
    }
  }

  /** Map a view-local mouse column to a value index. */
  protected posFromMouse(localX: number): number {
    return mousePos(localX, this.firstPos, this.value().length);
  }
}
