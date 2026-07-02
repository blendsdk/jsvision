/**
 * `Input` — a lean single-line text editor bound to a two-way signal (Turbo Vision `TInputLine`,
 * RD-06 AC-4/AC-5/PA-2/PA-11).
 *
 * Faithful to `TInputLine::draw` (`tinputli.cpp:134-160`): the value is drawn from `firstPos` at
 * column 1 (width `size.x-1`), with `◄`(0x11)/`►`(0x10) edge arrows (`tvtext1.cpp:106-107`) in the
 * `inputArrows` role when scrolled, and the field in `inputSelected` (focused) / `inputNormal` — both
 * `0x1F` white-on-blue (TV `getColor(1)`==`getColor(2)`; PA-14). The cursor-keep-visible `firstPos`
 * adjust mirrors `tinputli.cpp:460-465`, and the edit/scroll behavior `:341-468`. A `validator` gates
 * each keystroke live (`isValidInput`) and, on the focused→unfocused transition (observed via the
 * PF-009 focus-change signal — there is no blur event), runs the blocking `isValid` to set `invalid`
 * (no focus-trap — Tab proceeds, PA-2).
 *
 * ## RD-07 selection + logical caret — GATE-1 decode (`tinputli.cpp`, code-point unit PA-1)
 * - **State** `selStart`/`selEnd`/`anchor` (JS string indices; `selStart ≤ selEnd`; empty when equal).
 * - **`adjustSelectBlock()`** (`:225-237`): `curPos < anchor ? [selStart,selEnd]=[curPos,anchor] :
 *   [anchor,curPos]`. **`deleteSelect()`** (`:203-211`): guarded by `selStart<selEnd`, removes
 *   `[selStart,selEnd)`, `curPos=selStart` (does not clear the selection).
 * - **Shift-extension** (`:339-359,456-459`): on a pad-key motion (Home/Left/Right/End/Ctrl-Left/
 *   Ctrl-Right) with Shift, set `anchor = (curPos==selEnd ? selStart : selStart==selEnd ? curPos :
 *   selEnd)`; move `curPos`; then `adjustSelectBlock()`. A motion **without** Shift → `selStart=selEnd=0`
 *   (collapse). **Ctrl+A** select-all is a jsvision addition mapped to `selectAll(true)` (AR-116).
 * - **Word nav** (`:64-82`, PA-12): space-delimited — `prevWord`/`nextWord` land on the first non-space
 *   after a space. **`selectAll(true)`** (`:496-508`): `selStart=0`, `curPos=selEnd=len`, scroll to caret.
 * - **Mouse** (`:312-338`): press → `anchor=curPos=mousePos`; drag → `curPos=mousePos`+`adjustSelectBlock`
 *   per move; double-click → `selectAll(true)`. `mousePos = max(0, max(mouse.x,1)+firstPos-1)` (`:186-196`).
 * - **Edit-over-selection**: printable (`:418-446`) → `deleteSelect()` first, then insert (validate +
 *   maxLength); Backspace (`:380-388`) → empty selection makes a 1-cp selection left then `deleteSelect`;
 *   Delete (`:399-405`) → `deleteSelect` if any, else delete the cp under the cursor.
 * - **Selection band draw** (`:152-157`): fill cols `[l+1, r+1)` in `getColor(3)` (`inputSelection`,
 *   `0x2F` white-on-green) where `l=max(0, displayedPos(selStart)-firstPos)`, `r=min(size.x-2,
 *   displayedPos(selEnd)-firstPos)`, only if `l<r`.
 * - **Logical caret** (`:160`): TV `setCursor(displayedPos(curPos)-firstPos+1, 0)`. We additionally
 *   paint that one buffer cell in a **reversed** field style (fg/bg swapped) so the caret shows headless
 *   / on cursor-hidden terminals (DEF-19a); `desiredCaret()` reports the same cell for the hardware
 *   cursor when focused. Clipboard (copy/cut/paste) lives in Phase 2. NodeNext requires the `.js`.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent, Point } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { KeyEvent, MouseEvent, Style } from '@jsvision/core';
import type { Validator } from './validators/index.js';
import { selectionBlock, mousePos, motionOf, caretAfterMotion } from './input-selection.js';
import { clipboardChord, clipboardCommand, applyPaste } from './input-clipboard.js';
import type { ClipboardAction } from './input-clipboard.js';

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
  /** Cursor index into the value (code-point unit, PA-1). */
  protected curPos = 0;
  /** First visible character index (horizontal scroll). */
  protected firstPos = 0;
  /** Selection start (inclusive) — a JS string index; `selStart === selEnd` ⇒ no selection. */
  protected selStart = 0;
  /** Selection end (exclusive) — a JS string index. Invariant `selStart ≤ selEnd`. */
  protected selEnd = 0;
  /** The fixed end of the selection during shift-extension (TV `anchor`, `tinputli.cpp:346-357`). */
  protected anchor = 0;
  /** Last mouse-down column, for double-click detection (PA-15); `null` after any non-click action. */
  protected lastDownX: number | null = null;
  /** Set by {@link valid}/focus-leave; drives the invalid theming (exposed for the app, PA-2). */
  invalid = false;
  /** Tracks the focus edge so blocking validation runs only on the focused→unfocused transition. */
  protected wasFocused = false;

  /**
   * The current selection range as JS string indices (`start ≤ end`; empty when `start === end`).
   *
   * @returns The `{ start, end }` selection bounds.
   */
  get selection(): { start: number; end: number } {
    return { start: this.selStart, end: this.selEnd };
  }

  /** The caret index into the value (code-point unit, PA-1). @returns The current cursor position. */
  get caretPos(): number {
    return this.curPos;
  }

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
    // Selection band: recolour the visible selected substring in `inputSelection` (TV `getColor(3)`
    // band `[l+1, r+1)`, `tinputli.cpp:152-157`). Only when focused with a non-empty selection.
    if (this.state.focused && this.selStart < this.selEnd) {
      const l = Math.max(0, this.displayedPos(this.selStart) - this.firstPos);
      const r = Math.min(w - 2, this.displayedPos(this.selEnd) - this.firstPos);
      if (l < r) {
        const seg = v.slice(this.firstPos + l, this.firstPos + r); // the chars under cols [l+1, r+1)
        ctx.text(l + 1, 0, seg, ctx.color('inputSelection'));
      }
    }
    // Logical caret: repaint the edit cell in a reversed field style, LAST, so the caret shows even
    // headless / on cursor-hidden terminals (DEF-19a; the hardware cursor is wired separately, P5.2).
    // Preserve the glyph already shown at that column (text char OR an edge arrow) and reverse only
    // its colours — mirroring TV's hardware cursor, which sits over a glyph without erasing it (PF-008).
    if (this.state.focused) {
      const caretCol = this.displayedPos(this.curPos) - this.firstPos + 1;
      if (caretCol >= 0 && caretCol < w) {
        const reversed: Style = { fg: style.bg, bg: style.fg }; // field fg/bg swapped
        ctx.text(caretCol, 0, this.glyphAt(caretCol, v, w), reversed);
      }
    }
  }

  /**
   * The glyph currently displayed at a field column — the edge arrow at col 0 / `w-1` when scrolled
   * (matching the draw order), otherwise the value code point under that column, or a space past the
   * end. Used to repaint the caret cell without erasing the arrow/char beneath it (PF-008).
   *
   * @param col The field column.
   * @param v   The current value.
   * @param w   The field width.
   * @returns The single-glyph string at that column.
   */
  protected glyphAt(col: number, v: string, w: number): string {
    if (col === 0 && this.firstPos > 0) return LEFT_ARROW;
    if (col === w - 1 && this.canScrollRight(v, w)) return RIGHT_ARROW;
    const idx = col - 1 + this.firstPos; // the value index shown at this column (col 1 → firstPos)
    return idx >= 0 && idx < v.length ? (v[idx] ?? ' ') : ' ';
  }

  /**
   * The display column of a value index (TV `displayedPos` = `strwidth(data[0..pos))`). Code-unit in
   * v1 (PA-1); grapheme/wide-aware stepping is DEF-21, so this is the identity in the current slice.
   *
   * @param pos A JS string index into the value.
   * @returns The display column offset from the value's start.
   */
  protected displayedPos(pos: number): number {
    return pos;
  }

  /**
   * The view-local caret cell for the hardware cursor (PA-5/PA-11): the focused edit cell, or `null`
   * when unfocused or scrolled out of view. The event loop translates it to an absolute cell (P5.2).
   *
   * @returns The view-local caret `{ x, y }`, or `null`.
   */
  override desiredCaret(): Point | null {
    if (!this.state.focused) return null;
    const caretCol = this.displayedPos(this.curPos) - this.firstPos + 1;
    if (caretCol < 0 || caretCol >= this.bounds.width) return null;
    return { x: caretCol, y: 0 };
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
   * Route a key (edit/move/select) or a mouse gesture (position / drag-select / scroll). Tab/Enter
   * are not consumed — they pass through to focus traversal / the default button.
   *
   * @param ev The dispatch envelope (carries `local` during real mouse dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'command') {
      const action = clipboardCommand(inner.command); // TV cmCut/cmCopy/cmPaste from menu/status/keymap
      if (action !== null) {
        this.runClipboard(action, ev);
        ev.handled = true;
      }
      return;
    }
    if (inner.type === 'paste') {
      this.pasteText(inner.text); // bracketed paste — the real paste path (PA-16)
      ev.handled = true;
      return;
    }
    if (inner.type === 'mouse') {
      this.handleMouse(inner, ev);
      return;
    }
    if (inner.type !== 'key') return;
    if (inner.key === 'enter' || inner.key === 'tab') return; // pass through (PA-2)
    const chord = clipboardChord(inner); // Ctrl+Ins / Shift+Ins / Shift+Del (PA-7), before the edit machine
    if (chord !== null) {
      this.runClipboard(chord, ev);
      ev.handled = true;
      return;
    }
    if (this.handleKey(inner)) ev.handled = true;
  }

  /**
   * Run a clipboard action (TV cmCut/cmCopy/cmPaste, `tinputli.cpp:469-489`; PA-7). Copy/cut write
   * the selection via `ev.setClipboard` (empty selection = no-op, PA-9); cut then deletes + collapses.
   * Paste is a no-op — there is no system clipboard read (PA-16); the real paste is a bracketed
   * `PasteEvent` handled by {@link pasteText}.
   *
   * @param action The clipboard action.
   * @param ev     The dispatch envelope (carries `setClipboard`).
   */
  protected runClipboard(action: ClipboardAction, ev: DispatchEvent): void {
    if (action === 'paste') return; // no system read (PA-16/DEF-25)
    const text = this.value().slice(this.selStart, this.selEnd);
    if (text === '') return; // empty selection → no-op (deleteSelect guards cut too)
    ev.setClipboard?.(text); // caps-gated in the loop; base64 + sanitize in core
    if (action === 'cut') {
      this.deleteSelect();
      this.collapseSelection();
      this.adjustScroll();
      this.invalidate();
    }
  }

  /**
   * Insert pasted text (TV paste path, `:418-446`; PA-8): replace any selection, then insert each
   * code point through `validator.isValidInput` + `maxLength` (invalid dropped individually).
   *
   * @param text The pasted text (untrusted; bounded upstream by core's `PASTE_CAP_BYTES`, AC-15).
   */
  protected pasteText(text: string): void {
    this.deleteSelect(); // replace the selection first
    const r = applyPaste(text, this.value(), this.curPos, this.maxLength, this.validator);
    this.setValue(r.value);
    this.curPos = r.curPos;
    this.collapseSelection();
    this.adjustScroll();
    this.invalidate();
  }

  /**
   * Apply a key through the TV selection machine (`tinputli.cpp:341-467`): a shift + pad-key motion
   * extends the selection (anchored per `:346-357`), a plain motion collapses it, and an edit
   * (Backspace/Delete/printable) deletes any selection first. Returns whether the key was consumed.
   *
   * @param inner The decoded key event.
   * @returns Whether the key was consumed (halts propagation).
   */
  protected handleKey(inner: KeyEvent): boolean {
    const v = this.value();

    // Ctrl+A → select all (jsvision addition AR-116; not a TV pad-key — outside the extend/collapse).
    if (inner.ctrl && !inner.shift && inner.key === 'a') {
      this.selectAll(true);
      return true;
    }

    const motion = motionOf(inner);
    // Shift + a pad-key motion arms the extension anchor (tinputli.cpp:346-357).
    let extend = false;
    if (motion !== null && inner.shift) {
      this.anchor =
        this.curPos === this.selEnd ? this.selStart : this.selStart === this.selEnd ? this.curPos : this.selEnd;
      extend = true;
    }

    if (motion !== null) {
      this.curPos = caretAfterMotion(motion, this.curPos, v);
    } else if (inner.key === 'backspace') {
      this.backspace();
    } else if (inner.key === 'delete') {
      this.deleteForward(v);
    } else {
      return this.insertPrintable(inner); // printable owns its own selection-delete + collapse
    }

    // Derive the selection from the moved caret (extend) or collapse it (plain motion / edit),
    // then keep the caret visible (tinputli.cpp:456-465).
    if (extend) this.adjustSelectBlock();
    else this.collapseSelection();
    this.adjustScroll();
    this.invalidate();
    return true;
  }

  /** Backspace (TV `:380-388`): delete the selection, or the code point left of the caret. */
  protected backspace(): void {
    if (this.selStart === this.selEnd) {
      this.selStart = Math.max(0, this.curPos - 1);
      this.selEnd = this.curPos;
    }
    this.deleteSelect();
  }

  /** Delete (TV `:399-405`): delete the selection, or the code point under the caret. */
  protected deleteForward(v: string): void {
    if (this.selStart === this.selEnd) {
      if (this.curPos < v.length) this.setValue(v.slice(0, this.curPos) + v.slice(this.curPos + 1));
    } else {
      this.deleteSelect();
    }
  }

  /**
   * Insert a printable character (TV default case `:418-446`): delete any selection first, then
   * insert at the caret, respecting `maxLength` + `validator.isValidInput`. Always collapses after.
   *
   * @param inner The decoded key event.
   * @returns Whether the key was consumed.
   */
  protected insertPrintable(inner: KeyEvent): boolean {
    if (inner.ctrl || inner.alt) return false;
    const ch = inner.key === 'space' ? ' ' : [...inner.key].length === 1 ? inner.key : null;
    if (ch === null) return false; // a non-printable named key passes through
    this.deleteSelect(); // edit over a selection replaces it (tinputli.cpp:424)
    const cur = this.value();
    if (cur.length < this.maxLength) {
      const candidate = cur.slice(0, this.curPos) + ch + cur.slice(this.curPos);
      if (!this.validator || this.validator.isValidInput(candidate)) {
        this.setValue(candidate);
        this.curPos += 1;
      }
    }
    this.collapseSelection();
    this.adjustScroll();
    this.invalidate();
    return true;
  }

  /** Remove the selected range `[selStart, selEnd)` and place the caret at `selStart` (TV `:203-211`). */
  protected deleteSelect(): void {
    if (this.selStart < this.selEnd) {
      const v = this.value();
      this.setValue(v.slice(0, this.selStart) + v.slice(this.selEnd));
      this.curPos = this.selStart;
    }
  }

  /** Derive `[selStart, selEnd]` from the caret + anchor (TV `adjustSelectBlock`, `:225-237`). */
  protected adjustSelectBlock(): void {
    const { start, end } = selectionBlock(this.curPos, this.anchor);
    this.selStart = start;
    this.selEnd = end;
  }

  /** Clear the selection (TV `selStart = selEnd = 0` on a non-extending action, `:459`). */
  protected collapseSelection(): void {
    this.selStart = this.selEnd = 0;
  }

  /** Select all / clear (TV `selectAll`, `:496-508`): `selStart=0`, `curPos=selEnd=len` (or all 0). */
  protected selectAll(enable: boolean): void {
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
   * Map a mouse gesture to selection/scroll (TV `:312-338`): edge-arrow click scrolls; a plain press
   * anchors + captures the drag; a drag extends; a second press on the same cell is a double-click →
   * select-all (PA-15, our double-click substitute); release drops the capture.
   *
   * @param inner The decoded mouse event.
   * @param ev    The dispatch envelope (`local` cell + the capture seam).
   */
  protected handleMouse(inner: MouseEvent, ev: DispatchEvent): void {
    const local = ev.local;
    if (local === undefined) return;
    const w = this.bounds.width;
    const v = this.value();
    if (inner.kind === 'down') {
      if (local.x === 0 && this.firstPos > 0) {
        this.firstPos -= 1; // ◄ click → scroll left
        this.lastDownX = null;
      } else if (local.x === w - 1 && this.canScrollRight(v, w)) {
        this.firstPos += 1; // ► click → scroll right
        this.lastDownX = null;
      } else if (this.lastDownX === local.x) {
        this.selectAll(true); // double-click (second down on the same cell, PA-15)
        this.lastDownX = null;
      } else {
        this.curPos = this.posFromMouse(local.x);
        this.anchor = this.curPos;
        this.collapseSelection();
        this.adjustScroll();
        this.lastDownX = local.x;
        ev.setCapture?.(this); // track the drag past the field edge (PA-5-adjacent)
      }
      this.invalidate();
      ev.handled = true;
    } else if (inner.kind === 'drag' || inner.kind === 'move') {
      this.curPos = this.posFromMouse(local.x);
      this.adjustSelectBlock();
      this.adjustScroll();
      this.lastDownX = null; // a drag ends double-click candidacy
      this.invalidate();
      ev.handled = true;
    } else if (inner.kind === 'up') {
      ev.releaseCapture?.();
      ev.handled = true;
    }
  }

  /** Map a local mouse column to a value index (TV `mousePos`, `:186-196`; code-unit v1). */
  protected posFromMouse(localX: number): number {
    return mousePos(localX, this.firstPos, this.value().length);
  }
}
