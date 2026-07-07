/**
 * The multiline text editor view — a focusable, scrollable code/text editor with a WordStar-style
 * keymap, multi-level undo/redo, cut/copy/paste through a shared clipboard, and find/replace.
 *
 * `Editor` is the engine class. The behaviour is spread across a handful of sibling modules
 * (painting, events, mouse, the action switch, search, clipboard/undo) that all drive this view's
 * state, but as a caller you interact only with the public methods and reactive signals here.
 */
import { View, type DrawContext, type DispatchEvent, type Point, type ThemeRoleName } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import {
  GapBuffer,
  detectEol,
  eolOf,
  convertNewEdit,
  lineStart,
  lineEnd,
  nextChar,
  charPos,
  nextWord as nextWordB,
  prevWord as prevWordB,
  nextLine as nextLineB,
  prevLine as prevLineB,
} from './buffer/index.js';
import type { LineEnding } from './buffer/index.js';
import type { EditorAction, EditorKeyBindings, KeyState } from './keymap.js';
import { applyAction } from './editor-actions.js';
import { handleEditorEvent } from './editor-events.js';
import { defaultEditorDialog, type EditorDialogHandler, type SearchOptions } from './editor-dialog.js';
import { editorFind, editorReplace, editorSearchOnce, editorDoSearchReplace } from './editor-search.js';
import {
  drawEditor,
  editorUpdate,
  editorUpdateCommands,
  editorScrollTo,
  editorTrackCursor,
  editorMousePtr,
} from './editor-draw.js';
import { countBreaks, type EditorOptions, type IndicatorTarget, type GadgetBar } from './editor-types.js';
export { countBreaks } from './editor-types.js';
export type { EditorOptions, IndicatorTarget, EditorCommandSeam } from './editor-types.js';
import { editorCopy, editorCut, editorPaste, editorUndo, editorRedo } from './editor-clipboard.js';
import { UndoStack } from './undo.js';

// Selection-mode bits combined into the `selectMode` passed around internally: extend the current
// selection, snap to whole words (double-click), snap to whole lines (triple-click).
export const SM_EXTEND = 0x01;
export const SM_DOUBLE = 0x02;
export const SM_TRIPLE = 0x04;

/**
 * A focusable, scrollable multiline text editor.
 *
 * Add it to any `Group` and give it a size, then drive it with the keyboard/mouse via the event
 * loop, or programmatically through {@link setText}/{@link getText}/{@link insertText} and
 * {@link execute}. The reactive signals ({@link curPos}, {@link modified}, {@link hasSelection},
 * {@link canUndo}, …) let you wire up a status line or indicator that updates as the user edits.
 *
 * Cut/copy/paste between editors requires a shared clipboard editor — pass the same `Editor`
 * instance as `clipboard` to each editor that should share one (see {@link EditorOptions}). For a
 * complete window with scroll bars and a line/column indicator, use `EditWindow` instead of wiring
 * one up by hand.
 *
 * @example
 * import { resolveCapabilities } from '@jsvision/core';
 * import { Group, Editor, createEventLoop, effect } from '@jsvision/ui';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 *
 * // A shared clipboard editor lets Cut/Copy/Paste work across editors.
 * const clipboard = new Editor();
 * const editor = new Editor({ clipboard });
 * editor.layout = { size: { kind: 'fr', weight: 1 } };
 *
 * const root = new Group();
 * root.layout = { direction: 'col' };
 * root.add(editor);
 *
 * const loop = createEventLoop({ width: 60, height: 20 }, { caps });
 * loop.mount(root);
 * loop.focusView(editor);
 *
 * editor.setText('The quick brown fox\nSecond line.');
 * // Read the caret signal inside an effect to react whenever it changes.
 * effect(() => {
 *   const { line, col } = editor.curPos();
 *   console.log(`caret at ${line}:${col}`);
 * });
 */
export class Editor extends View {
  override focusable = true;
  /** Sees keys before app chrome so the focused editor can claim the WordStar Ctrl-Q/Ctrl-K prefixes. */
  override preProcess = true;

  // --- Reactive state — subscribe or bind these to reflect the editor in your UI ----------------
  /** Whether the buffer has unsaved changes since it was last loaded or saved. */
  readonly modified: Signal<boolean>;
  /** The caret as 1-based `{line, col}` (col is the visual column). */
  readonly curPos: Signal<{ line: number; col: number }>;
  /** Whether any text is currently selected. */
  readonly hasSelection: Signal<boolean>;
  /** `true` = insert mode, `false` = overwrite mode; the Insert key toggles it. */
  readonly insertMode: Signal<boolean>;
  /** The number of lines in the buffer. */
  readonly lineCount: Signal<number>;
  /** Whether an undo step is available. */
  readonly canUndo: Signal<boolean>;
  /** Whether a redo step is available. */
  readonly canRedo: Signal<boolean>;
  /**
   * The scroll offset, as a pair of signals. These double as the value channel for scroll bars:
   * construct a scroll bar bound to `delta.x`/`delta.y` and any write scrolls the editor (clamped
   * to the content). `EditWindow` wires this up for you.
   */
  readonly delta: { readonly x: Signal<number>; readonly y: Signal<number> };

  // --- Internal editing state (public for the sibling modules, not part of the API) -------------
  /** @internal The text buffer. */
  buf = new GapBuffer();
  /** @internal The buffer's line-ending kind. */
  eolKind: LineEnding = 'lf';
  /** @internal The caret position, as a buffer offset. */
  curPtr = 0;
  /** @internal Selection start (inclusive). */
  selStartP = 0;
  /** @internal Selection end (exclusive). */
  selEndP = 0;
  /** @internal Persistent-select mode; Ctrl-K B arms it so motions extend the selection. */
  selecting = false;
  /** @internal Overwrite mode. */
  overwrite: boolean;
  /** @internal Auto-indent mode. */
  autoIndentOn: boolean;
  /** @internal The caret's visual column. */
  curX = 0;
  /** @internal The caret's line index, 0-based. */
  curY = 0;
  /** @internal The paint anchor's line index. */
  drawLine = 0;
  /** @internal The paint anchor position — a line start. */
  drawPtrP = 0;
  /** @internal The line count. */
  limitY = 1;
  /** @internal The WordStar prefix state (idle, or armed after Ctrl-Q / Ctrl-K). */
  keyState: KeyState = 0;
  /** @internal The active key set — `'modern'` (default) or `'wordstar'`. */
  readonly keyBindings: EditorKeyBindings;
  /** @internal Marks this as the shared clipboard editor; its edits never set `modified`. */
  isClipboardRole = false;
  /** @internal The select mode carried through a live drag (mouse-down sets it, drag extends). */
  dragSelectMode = 0;
  /** @internal The construction options. */
  readonly options: EditorOptions;
  /** @internal The dialog handler for find/replace/save prompts. */
  readonly dialog: EditorDialogHandler;
  /** @internal The undo/redo stack. */
  readonly undoStack: UndoStack;
  /** @internal Set by single-character typing/deleting so the next edit merges into one undo step. */
  coalesceNextEdit = false;
  /** @internal Sink that mirrors copied/cut text to the OS clipboard, captured per event. */
  mirrorSink: ((text: string) => void) | undefined;

  /** @internal Attached scroll bars + indicator (see {@link attachGadgets}). */
  hBar: GadgetBar | null = null;
  vBar: GadgetBar | null = null;
  indicator: IndicatorTarget | null = null;

  /** The normal/selected theme roles; `Memo` overrides them to the gray-dialog palette. */
  protected normalRole: ThemeRoleName = 'editorNormal';
  protected selectedRole: ThemeRoleName = 'editorSelected';

  constructor(options: EditorOptions = {}) {
    super();
    this.options = options;
    this.dialog = options.editorDialog ?? defaultEditorDialog;
    this.overwrite = options.overwrite ?? false;
    this.autoIndentOn = options.autoIndent ?? false;
    this.keyBindings = options.keyBindings ?? 'modern';
    this.modified = signal(false);
    this.curPos = signal({ line: 1, col: 1 });
    this.hasSelection = signal(false);
    this.insertMode = signal(!this.overwrite);
    this.lineCount = signal(1);
    this.canUndo = signal(false);
    this.canRedo = signal(false);
    this.undoStack = new UndoStack(options.undoDepth ?? 1000);
    this.delta = { x: signal(0), y: signal(0) };
    // Any write to the scroll signals — from a bound scroll bar, or an external set — routes
    // through scrollTo, which clamps to the content and repaints. Internal scrolls re-enter here
    // harmlessly, since scrollTo only acts when the offset actually changes.
    this.onMount(() => {
      this.bind(
        () => [this.delta.x(), this.delta.y()] as const,
        ([x, y]) => this.scrollTo(x, y),
      );
    });
  }

  // --- Text access -------------------------------------------------------------------------------

  /**
   * Replace the entire content. Text is stored verbatim (mixed line endings are preserved), the
   * line-ending kind is re-detected, and the cursor, selection, scroll, and undo history are reset.
   *
   * @param text The new buffer content.
   */
  setText(text: string): void {
    this.buf = new GapBuffer(text);
    this.eolKind = detectEol(text);
    // Reset all cursor/selection/scroll state to the top of the fresh document.
    this.curPtr = 0;
    this.selStartP = 0;
    this.selEndP = 0;
    this.selecting = false;
    this.keyState = 0;
    this.curX = 0;
    this.curY = 0;
    this.drawLine = 0;
    this.drawPtrP = 0;
    this.limitY = countBreaks(text) + 1;
    this.delta.x.set(0);
    this.delta.y.set(0);
    this.modified.set(false);
    this.undoStack.clear(); // undo never crosses a document swap
    this.update();
  }

  /**
   * The full buffer content, or the text in a `[from, to)` range. Returned verbatim, with any mixed
   * line endings intact.
   *
   * @param range Optional half-open buffer-offset range; omit for the whole buffer.
   * @returns The requested text.
   */
  getText(range?: { from: number; to: number }): string {
    return range === undefined ? this.buf.text() : this.buf.slice(range.from, range.to);
  }

  /**
   * Insert text at the caret, replacing any selection. Line endings are normalized to the buffer's
   * kind, exactly as if the text had been typed.
   *
   * @param text The text to insert.
   */
  insertText(text: string): void {
    this.insertRaw(convertNewEdit(text, this.eolKind), false);
    this.trackCursor(false);
  }

  /** The currently selected text, or `''` when there is no selection. */
  selectionText(): string {
    return this.buf.slice(this.selStartP, this.selEndP);
  }

  /**
   * Run one editor action programmatically — the same operations the keymap triggers.
   *
   * @param action The action to run (e.g. `'lineDown'`, `'undo'`, `'textEnd'`, `'selectAll'`).
   * @example
   * editor.setText('hello world');
   * editor.execute('textEnd');   // caret to end of buffer
   * editor.execute('wordLeft');  // back one word
   */
  execute(action: EditorAction): void {
    applyAction(this, action, this.selecting ? SM_EXTEND : 0, false);
  }

  /** Wire up the scroll bars and line/column indicator that display and drive this editor. */
  attachGadgets(h?: GadgetBar, v?: GadgetBar, ind?: IndicatorTarget): void {
    this.hBar = h ?? null;
    this.vBar = v ?? null;
    this.indicator = ind ?? null;
    this.update();
  }

  /** The hardware-caret cell (view-local) while focused and in view, else `null`. */
  override desiredCaret(): Point | null {
    if (!this.state.focused) return null;
    const x = this.curX - this.delta.x();
    const y = this.curY - this.delta.y();
    if (x < 0 || y < 0 || x >= this.viewW() || y >= this.viewH()) return null;
    return { x, y };
  }

  // --- Search + clipboard + undo (thin wrappers over the sibling modules) ------------------------

  /** @internal Persisted search state (last find/replace strings, options, and flags). */
  findStr = '';
  replaceStr = '';
  searchOpts: SearchOptions = { caseSensitive: false, wholeWords: false };
  promptOnReplace = true;
  replaceAllFlag = false;
  doReplace = false;

  /** Open the Find dialog and search for the first match. Resolves when the interaction is done. */
  find(): Promise<void> {
    return editorFind(this);
  }

  /** Open the Replace dialog and run the replace loop; resolves with the number of replacements made. */
  replace(): Promise<number> {
    return editorReplace(this);
  }

  /** Repeat the last search/replace with the stored parameters; resolves with the replacement count. */
  searchAgain(): Promise<number> {
    return editorDoSearchReplace(this);
  }

  /** @internal Perform one search step against the stored search state. */
  searchOnce(): boolean {
    return editorSearchOnce(this);
  }

  /** @internal Run the search/replace loop with the stored state. */
  doSearchReplace(): Promise<number> {
    return editorDoSearchReplace(this);
  }

  /** Copy the selection to the shared clipboard editor (and the OS clipboard when supported). */
  copy(): void {
    editorCopy(this);
  }

  /** Cut the selection to the shared clipboard editor, as one undo step. */
  cut(): void {
    editorCut(this);
  }

  /** Paste the shared clipboard editor's selection at the caret, as one undo step. */
  paste(): void {
    editorPaste(this);
  }

  /** Undo the most recent edit. */
  undo(): void {
    editorUndo(this);
  }

  /** Redo the most recently undone edit. */
  redo(): void {
    editorRedo(this);
  }

  // --- Editing core (@internal; driven by the sibling modules) -----------------------------------

  /** @internal View width in cells (0 before the first layout). */
  viewW(): number {
    return this.bounds.width;
  }
  /** @internal View height in cells (0 before the first layout). */
  viewH(): number {
    return this.bounds.height;
  }

  /** @internal Whether the caret is inside the scrolled viewport. */
  isCursorVisible(): boolean {
    const dx = this.delta.x();
    const dy = this.delta.y();
    return this.curX >= dx && this.curX < dx + this.viewW() && this.curY >= dy && this.curY < dy + this.viewH();
  }

  /**
   * @internal Move the caret to buffer position `p`. When `selectMode` has the extend bit, the
   * selection grows from its far end; the double/triple bits snap the range to whole words/lines.
   */
  setCurPtr(p: number, selectMode: number): void {
    let anchor: number;
    if ((selectMode & SM_EXTEND) === 0) anchor = p;
    else if (this.curPtr === this.selStartP) anchor = this.selEndP;
    else anchor = this.selStartP;

    if (p < anchor) {
      if ((selectMode & SM_DOUBLE) !== 0) {
        p = prevWordB(this.buf, nextWordB(this.buf, p));
        anchor = nextWordB(this.buf, prevWordB(this.buf, anchor));
      } else if ((selectMode & SM_TRIPLE) !== 0) {
        p = prevLineB(this.buf, nextLineB(this.buf, p));
        anchor = nextLineB(this.buf, prevLineB(this.buf, anchor));
      }
      this.setSelect(p, anchor, true);
    } else {
      if ((selectMode & SM_DOUBLE) !== 0) {
        p = nextWordB(this.buf, p);
        anchor = prevWordB(this.buf, nextWordB(this.buf, anchor));
      } else if ((selectMode & SM_TRIPLE) !== 0) {
        p = nextLineB(this.buf, p);
        anchor = prevLineB(this.buf, nextLineB(this.buf, anchor));
      }
      this.setSelect(anchor, p, false);
    }
  }

  /**
   * @internal Set the selection to `[newStart, newEnd)` and place the caret at one end
   * (`curStart ? newStart : newEnd`). Keeps the line index and paint anchor in sync with the caret.
   */
  setSelect(newStart: number, newEnd: number, curStart: boolean): void {
    const p = curStart ? newStart : newEnd;
    if (p !== this.curPtr) {
      // Adjust the caret's line index by the number of line breaks between the old and new caret.
      const lo = Math.min(p, this.curPtr);
      const hi = Math.max(p, this.curPtr);
      const crossed = countBreaks(this.buf.slice(lo, hi));
      this.curY += p > this.curPtr ? crossed : -crossed;
      this.curPtr = p;
      this.undoStack.seal(); // a cursor move ends the current run of coalescing edits
    }
    this.drawLine = this.curY;
    this.drawPtrP = lineStart(this.buf, p);
    this.curX = charPos(this.buf, this.drawPtrP, p);
    this.selStartP = newStart;
    this.selEndP = newEnd;
    this.update();
  }

  /**
   * @internal The edit primitive: replace the current selection `[selStart, selEnd)` with `text`
   * (already line-ending-converted) and land the caret after it. When `selectText` is `true` the
   * inserted range stays selected (used by paste and undo to leave the affected range highlighted).
   *
   * @param text The already-converted text to insert.
   * @param selectText Keep the inserted range selected.
   * @param markModified Mark the buffer modified (skip for internal, non-user edits).
   * @param recordUndo Push this edit onto the undo stack (skip when applying an undo/redo step).
   */
  insertRaw(text: string, selectText: boolean, markModified = true, recordUndo = true): void {
    this.selecting = false;
    const selLen = this.selEndP - this.selStartP;
    if (selLen === 0 && text.length === 0) return;

    // Record the inverse-applicable step. Consecutive single-character edits coalesce into one
    // undo step (the flag is armed by typing and by the backspace/delete actions); applying an
    // undo/redo step passes recordUndo=false so it is not re-recorded.
    if (recordUndo) {
      const step = { at: this.selStartP, removed: this.buf.slice(this.selStartP, this.selEndP), inserted: text };
      if (this.coalesceNextEdit) this.undoStack.coalesce(step);
      else this.undoStack.record(step);
    }
    this.coalesceNextEdit = false;

    const selLines = countBreaks(this.buf.slice(this.selStartP, this.selEndP));
    if (this.curPtr === this.selEndP) this.curY -= selLines; // caret was at the selection end
    // Keep the vertical scroll stable when the removed selection was above the viewport.
    let dy = this.delta.y();
    if (dy > this.curY) {
      dy -= selLines;
      if (dy < this.curY) dy = this.curY;
    }

    this.buf.remove(this.selStartP, this.selEndP);
    this.curPtr = this.selStartP;
    this.buf.insert(this.curPtr, text);
    const lines = countBreaks(text);
    this.curPtr += text.length;
    this.curY += lines;
    this.drawLine = this.curY;
    this.drawPtrP = lineStart(this.buf, this.curPtr);
    this.curX = charPos(this.buf, this.drawPtrP, this.curPtr);
    if (!selectText) this.selStartP = this.curPtr;
    this.selEndP = this.curPtr;
    this.limitY += lines - selLines;
    dy = Math.max(0, Math.min(dy, this.limitY - this.viewH()));
    this.delta.y.set(dy);
    if (markModified && !this.isClipboardRole) this.modified.set(true);
    this.update();
  }

  /** @internal Delete the current selection (replace it with nothing). */
  deleteSelect(): void {
    this.insertRaw('', false);
  }

  /**
   * @internal Delete the range `[startPtr, endPtr)`. When a selection exists and `delSelect` is
   * `true`, the selection is deleted instead.
   */
  deleteRange(startPtr: number, endPtr: number, delSelect: boolean): void {
    if (this.selStartP !== this.selEndP && delSelect) {
      this.deleteSelect();
    } else {
      this.setSelect(this.curPtr, endPtr, true);
      this.deleteSelect();
      this.setSelect(startPtr, this.curPtr, false);
      this.deleteSelect();
    }
  }

  /** @internal Insert a line break; with auto-indent on, copy the current line's leading whitespace. */
  newLine(): void {
    const p = lineStart(this.buf, this.curPtr);
    let i = p;
    let c: string;
    while (i < this.curPtr && ((c = this.buf.charAt(i)) === ' ' || c === '\t')) i++;
    this.insertRaw(eolOf(this.eolKind), false);
    if (this.autoIndentOn && i > p) this.insertRaw(this.buf.slice(p, i), false);
  }

  /** @internal Insert typed text at the caret; in overwrite mode it replaces the character under the caret. */
  typeText(text: string, centerCursor: boolean): void {
    if (this.overwrite && this.selStartP === this.selEndP) {
      if (this.curPtr !== lineEnd(this.buf, this.curPtr)) {
        this.selEndP = nextChar(this.buf, this.curPtr); // replace the character under the caret
      }
    }
    this.coalesceNextEdit = true; // consecutive single-character typing merges into one undo step
    this.insertRaw(convertNewEdit(text, this.eolKind), false);
    this.trackCursor(centerCursor);
  }

  /** @internal Toggle insert/overwrite mode. */
  toggleInsMode(): void {
    this.overwrite = !this.overwrite;
    this.insertMode.set(!this.overwrite);
    this.update();
  }

  /** @internal Scroll to `(x, y)`, clamped to the content. */
  scrollTo(x: number, y: number): void {
    editorScrollTo(this, x, y);
  }

  /** @internal Scroll the caret into view (or center it when `center` is `true`). */
  trackCursor(center: boolean): void {
    editorTrackCursor(this, center);
  }

  /** @internal Map a view-local cell to the buffer position under it. */
  getMousePtr(local: Point): number {
    return editorMousePtr(this, local);
  }

  /** @internal Repaint and refresh the reactive state, scroll ranges, indicator, and command greying. */
  update(): void {
    editorUpdate(this);
  }

  /** @internal Refresh only the command-greying seam. */
  updateCommands(): void {
    editorUpdateCommands(this);
  }

  // --- Draw + events ------------------------------------------------------------------------------

  /** Paint the visible rows. */
  override draw(ctx: DrawContext): void {
    drawEditor(this, ctx, this.normalRole, this.selectedRole);
  }

  /** Handle a dispatched event (keys, mouse/wheel, paste, and editing commands). */
  override onEvent(ev: DispatchEvent): void {
    handleEditorEvent(this, ev);
  }
}
