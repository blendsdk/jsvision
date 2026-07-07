/**
 * `Editor` — the focusable multiline text view: a faithful `TEditor` port over the Phase-2 gap
 * buffer (RD-08 03-02; GATE-1 decodes re-verified 2026-07-07 @ 57b6f56).
 *
 * The TV core lives HERE: cursor/selection (`setCurPtr`/`setSelect`, `teditor2.cpp:459-539`),
 * mutation (`insertBuffer`, `teditor2.cpp:156-247` — TV's single-level undo counters superseded
 * by the AR-253 stack), deletion (`deleteRange`, `teditor1.cpp:374-388`), scrolling
 * (`scrollTo`/`trackCursor`, `teditor2.cpp:377-388,584-591`) and typing/`newLine`
 * (`teditor1.cpp:586-616`, `teditor2.cpp:288-301`). The PF-011 ≤500-line splits carry the rest,
 * each with its own decode JSDoc: draw + `doUpdate` pushes (`editor-draw.ts`), events/PF-001
 * prefix claim (`editor-events.ts`), mouse (`editor-mouse.ts`), the action switch
 * (`editor-actions.ts`), search (`editor-search.ts`), clipboard/undo (`editor-clipboard.ts`),
 * option/seam types (`editor-types.ts`).
 * GATE-2 AFTER-diff (2026-07-07): rendered headlessly and diffed cell-by-cell against the decode
 * — no draw mismatch; recorded deviations: PA-2 paste-greying, the shift-click decoder gap.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
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
import type { EditorAction, KeyState } from './keymap.js';
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

export const SM_EXTEND = 0x01; // TV selection-mode bits (`editors.h:44-47`)
export const SM_DOUBLE = 0x02;
export const SM_TRIPLE = 0x04;

/** The focusable multiline editor view (TV `TEditor` — colours `editorNormal`/`editorSelected`, PA-8). */
export class Editor extends View {
  override focusable = true;
  /** PF-001 — claim the WordStar prefixes before app chrome, scoped to the focused editor. */
  override preProcess = true;

  // --- Reactive state (03-02; external observers bind these) ------------------------------------
  /** Whether the buffer changed since load/save (TV `modified`). */
  readonly modified: Signal<boolean>;
  /** The caret as 1-based `{line, col}` (visual column) — the Indicator's format (AC-11). */
  readonly curPos: Signal<{ line: number; col: number }>;
  /** Whether a selection exists (`selStart != selEnd`). */
  readonly hasSelection: Signal<boolean>;
  /** `true` = insert, `false` = overwrite (TV `!overwrite`; Ins toggles). */
  readonly insertMode: Signal<boolean>;
  /** The buffer's line count (TV `limit.y`). */
  readonly lineCount: Signal<number>;
  /** Whether an undo step exists (the AR-253 stack). */
  readonly canUndo: Signal<boolean>;
  /** Whether a redo step exists. */
  readonly canRedo: Signal<boolean>;
  /** The scroll offset — the SHARED gadget value channel (ST-13): construct the EditWindow bars
   * with these signals; any write scrolls the editor (clamped, the `checkScrollBar` decode). */
  readonly delta: { readonly x: Signal<number>; readonly y: Signal<number> };

  // --- Internal TV state (public-but-@internal: editor-actions/-mouse drive these) --------------
  /** @internal The gap buffer. */
  buf = new GapBuffer();
  /** @internal The buffer's line-ending kind (AR-252). */
  eolKind: LineEnding = 'lf';
  /** @internal The caret position (TV `curPtr`). */
  curPtr = 0;
  /** @internal Selection `[selStartP, selEndP)`. */
  selStartP = 0;
  /** @internal Selection end (exclusive). */
  selEndP = 0;
  /** @internal Persistent-select mode (TV `selecting`; Ctrl-K B arms it). */
  selecting = false;
  /** @internal Overwrite mode (TV `overwrite`). */
  overwrite: boolean;
  /** @internal AutoIndent mode (TV `autoIndent`). */
  autoIndentOn: boolean;
  /** @internal The caret's visual column (TV `curPos.x`). */
  curX = 0;
  /** @internal The caret's line index, 0-based (TV `curPos.y`). */
  curY = 0;
  /** @internal The draw anchor's line index (TV `drawLine`). */
  drawLine = 0;
  /** @internal The draw anchor position — a line start (TV `drawPtr`). */
  drawPtrP = 0;
  /** @internal The line count (TV `limit.y`). */
  limitY = 1;
  /** @internal The WordStar prefix state (TV's `0xFF01`/`0xFF02` escapes). */
  keyState: KeyState = 0;
  /** @internal Marks the app's clipboard editor (TV `isClipboard()`); its edits never set `modified`. */
  isClipboardRole = false;
  /** @internal The PA-18 multi-click clock. */
  readonly clock: () => number;
  /** @internal Multi-click state (PA-18): last down time/cell + the consecutive same-cell count. */
  lastClickTime = Number.NEGATIVE_INFINITY;
  lastClickCell: Point = { x: -1, y: -1 };
  clickCount = 0;
  /** @internal The selectMode carried through the live drag (down sets it, drag extends). */
  dragSelectMode = 0;
  /** @internal The injected options (clipboard/dialog/undo depth read by later phases). */
  readonly options: EditorOptions;
  /** @internal The dialog seam. */
  readonly dialog: EditorDialogHandler;
  /** @internal The AR-253 undo/redo stack (Phase 5). */
  readonly undoStack: UndoStack;
  /** @internal Set by single-cluster typing/deleting so the NEXT insertRaw coalesces (AR-253). */
  coalesceNextEdit = false;
  /** @internal The envelope's OSC-52 mirror, captured per dispatch (copy/cut write through it). */
  mirrorSink: ((text: string) => void) | undefined;

  /** @internal Attached gadgets (03-04 `attachGadgets`). */
  hBar: GadgetBar | null = null;
  vBar: GadgetBar | null = null;
  indicator: IndicatorTarget | null = null;

  /** Theme roles — `Memo` overrides to the gray-dialog pair (03-04). */
  protected normalRole: ThemeRoleName = 'editorNormal';
  protected selectedRole: ThemeRoleName = 'editorSelected';

  constructor(options: EditorOptions = {}) {
    super();
    this.options = options;
    this.dialog = options.editorDialog ?? defaultEditorDialog;
    this.overwrite = options.overwrite ?? false;
    this.autoIndentOn = options.autoIndent ?? false;
    this.clock = options.now ?? Date.now;
    this.modified = signal(false);
    this.curPos = signal({ line: 1, col: 1 });
    this.hasSelection = signal(false);
    this.insertMode = signal(!this.overwrite);
    this.lineCount = signal(1);
    this.canUndo = signal(false);
    this.canRedo = signal(false);
    this.undoStack = new UndoStack(options.undoDepth ?? 1000);
    this.delta = { x: signal(0), y: signal(0) };
    // The checkScrollBar write-back (decode): any delta write — a shared-signal bar drag, or an
    // external set — routes through scrollTo, which clamps and repaints. Internal scrolls re-enter
    // here as no-ops (scrollTo only acts on change).
    this.onMount(() => {
      this.bind(
        () => [this.delta.x(), this.delta.y()] as const,
        ([x, y]) => this.scrollTo(x, y),
      );
    });
  }

  // --- Text surface (03-02; PA-4 Should-Haves) ---------------------------------------------------

  /** Replace the whole content VERBATIM + re-detect the EOL kind (AR-252); resets cursor/scroll state. */
  setText(text: string): void {
    this.buf = new GapBuffer(text);
    this.eolKind = detectEol(text);
    // The setBufLen reset (teditor2.cpp:423-442).
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

  /** The buffer content (or a `[from, to)` slice) — verbatim, mixed EOLs intact (PF-008). */
  getText(range?: { from: number; to: number }): string {
    return range === undefined ? this.buf.text() : this.buf.slice(range.from, range.to);
  }

  /** Insert at the caret (replacing any selection), converted like typed input (AR-252). */
  insertText(text: string): void {
    this.insertRaw(convertNewEdit(text, this.eolKind), false);
    this.trackCursor(false);
  }

  /** The selected text (`[selStart, selEnd)`), or `''` (03-03 — the clipboard channel reads this). */
  selectionText(): string {
    return this.buf.slice(this.selStartP, this.selEndP);
  }

  /** Execute an internal editor action (PA-15 — the public action entry). */
  execute(action: EditorAction): void {
    applyAction(this, action, this.selecting ? SM_EXTEND : 0, false);
  }

  /** Attach the EditWindow gadgets (03-04): setRange pushes + the indicator; values ride {@link delta}. */
  attachGadgets(h?: GadgetBar, v?: GadgetBar, ind?: IndicatorTarget): void {
    this.hBar = h ?? null;
    this.vBar = v ?? null;
    this.indicator = ind ?? null;
    this.update();
  }

  /** The view-local caret cell while focused (PF-004 — position only; shape = DEF-36), else `null`. */
  override desiredCaret(): Point | null {
    if (!this.state.focused) return null;
    const x = this.curX - this.delta.x();
    const y = this.curY - this.delta.y();
    if (x < 0 || y < 0 || x >= this.viewW() || y >= this.viewH()) return null;
    return { x, y };
  }

  // --- Search + clipboard + undo (delegates — the bodies live in editor-search.ts /
  // editor-clipboard.ts, the PF-011 split pattern keeping this file ≤ 500 lines) ------------------

  /** @internal Persistent search state (TV `findStr`/`replaceStr`/`editorFlags`). */
  findStr = '';
  replaceStr = '';
  searchOpts: SearchOptions = { caseSensitive: false, wholeWords: false };
  promptOnReplace = true; // TV default efPromptOnReplace ON (editstat.cpp:24)
  replaceAllFlag = false;
  doReplace = false;

  /** @internal `TEditor::find` — see editor-search.ts. */
  find(): Promise<void> {
    return editorFind(this);
  }

  /** @internal `TEditor::replace` — returns the replacement count (PF-009). */
  replace(): Promise<number> {
    return editorReplace(this);
  }

  /** @internal `cmSearchAgain` — rerun with the stored state. */
  searchAgain(): Promise<number> {
    return editorDoSearchReplace(this);
  }

  /** @internal One search step — see editor-search.ts. */
  searchOnce(): boolean {
    return editorSearchOnce(this);
  }

  /** @internal The `doSearchReplace` loop — see editor-search.ts. */
  doSearchReplace(): Promise<number> {
    return editorDoSearchReplace(this);
  }

  /** @internal `clipCopy` — see editor-clipboard.ts. */
  copy(): void {
    editorCopy(this);
  }

  /** @internal `clipCut` — see editor-clipboard.ts. */
  cut(): void {
    editorCut(this);
  }

  /** @internal `clipPaste` — see editor-clipboard.ts (PA-2/PA-16). */
  paste(): void {
    editorPaste(this);
  }

  /** @internal Undo the newest step — see editor-clipboard.ts. */
  undo(): void {
    editorUndo(this);
  }

  /** @internal Redo the newest undone step — see editor-clipboard.ts. */
  redo(): void {
    editorRedo(this);
  }

  // --- The TV core (@internal; editor-actions/-mouse call these) ---------------------------------

  /** @internal View width/height in cells (0 pre-reflow). */
  viewW(): number {
    return this.bounds.width;
  }
  viewH(): number {
    return this.bounds.height;
  }

  /** @internal TV `cursorVisible()` — is the caret inside the scrolled viewport? */
  isCursorVisible(): boolean {
    const dx = this.delta.x();
    const dy = this.delta.y();
    return this.curX >= dx && this.curX < dx + this.viewW() && this.curY >= dy && this.curY < dy + this.viewH();
  }

  /**
   * @internal Move the caret with selection semantics (`TEditor::setCurPtr`,
   * `teditor2.cpp:459-497`): compute the anchor (the selection's far end under `smExtend`), apply
   * the word/line snap under `smDouble`/`smTriple`, and hand both to {@link setSelect}.
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
   * @internal Set the selection + caret (`TEditor::setSelect`, `teditor2.cpp:499-539`): the caret
   * lands on `curStart ? newStart : newEnd`; `curPos.y` adjusts by the breaks crossed (TV's
   * incremental `countLines` bookkeeping); the draw anchor re-homes to the caret's line.
   */
  setSelect(newStart: number, newEnd: number, curStart: boolean): void {
    const p = curStart ? newStart : newEnd;
    if (p !== this.curPtr) {
      const lo = Math.min(p, this.curPtr);
      const hi = Math.max(p, this.curPtr);
      const crossed = countBreaks(this.buf.slice(lo, hi));
      this.curY += p > this.curPtr ? crossed : -crossed;
      this.curPtr = p;
      this.undoStack.seal(); // a cursor move seals the open coalescing step (AR-253)
    }
    this.drawLine = this.curY;
    this.drawPtrP = lineStart(this.buf, p);
    this.curX = charPos(this.buf, this.drawPtrP, p);
    this.selStartP = newStart;
    this.selEndP = newEnd;
    this.update();
  }

  /**
   * @internal The mutation core (`TEditor::insertBuffer`, `teditor2.cpp:156-247`, minus the TV
   * undo counters — Phase 5's stack supersedes them): replace `[selStart, selEnd)` with `text`
   * (already EOL-converted), land the caret after it; `selectText` keeps the inserted range
   * selected (the clipboard `insertFrom` semantics, PA-16).
   */
  insertRaw(text: string, selectText: boolean, markModified = true, recordUndo = true): void {
    this.selecting = false;
    const selLen = this.selEndP - this.selStartP;
    if (selLen === 0 && text.length === 0) return;

    // The AR-253 step (supersedes TV's delCount/insCount): the buffer will hold `text` at
    // selStart where `removed` was. Single-cluster typing/deleting coalesces (the flag is armed
    // by typeText and the backSpace/delChar actions); undo/redo application skips recording.
    if (recordUndo) {
      const step = { at: this.selStartP, removed: this.buf.slice(this.selStartP, this.selEndP), inserted: text };
      if (this.coalesceNextEdit) this.undoStack.coalesce(step);
      else this.undoStack.record(step);
    }
    this.coalesceNextEdit = false;

    const selLines = countBreaks(this.buf.slice(this.selStartP, this.selEndP));
    if (this.curPtr === this.selEndP) this.curY -= selLines; // caret was at the selection end
    // The delta.y visual-stability adjust (decode).
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

  /** @internal Delete the selection (TV `deleteSelect` = insert-nothing, `teditor1.cpp:390-393`). */
  deleteSelect(): void {
    this.insertRaw('', false);
  }

  /**
   * @internal Delete `[startPtr, endPtr)` — or the selection when one exists and `delSelect`
   * (`TEditor::deleteRange`, `teditor1.cpp:374-388`).
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

  /** @internal `TEditor::newLine` (`teditor2.cpp:288-301`) — Enter + the autoIndent prefix copy. */
  newLine(): void {
    const p = lineStart(this.buf, this.curPtr);
    let i = p;
    let c: string;
    while (i < this.curPtr && ((c = this.buf.charAt(i)) === ' ' || c === '\t')) i++;
    this.insertRaw(eolOf(this.eolKind), false);
    if (this.autoIndentOn && i > p) this.insertRaw(this.buf.slice(p, i), false);
  }

  /** @internal Typed input (the `evKeyDown` branch, `teditor1.cpp:596-616`) incl. the overwrite pre-step. */
  typeText(text: string, centerCursor: boolean): void {
    if (this.overwrite && this.selStartP === this.selEndP) {
      if (this.curPtr !== lineEnd(this.buf, this.curPtr)) {
        this.selEndP = nextChar(this.buf, this.curPtr); // replace the cluster under the caret
      }
    }
    this.coalesceNextEdit = true; // single-cluster typing coalesces (AR-253)
    this.insertRaw(convertNewEdit(text, this.eolKind), false);
    this.trackCursor(centerCursor);
  }

  /** @internal Toggle insert/overwrite (TV `toggleInsMode`; cursor SHAPE is DEF-36). */
  toggleInsMode(): void {
    this.overwrite = !this.overwrite;
    this.insertMode.set(!this.overwrite);
    this.update();
  }

  /** @internal `TEditor::scrollTo` — see editor-draw.ts. */
  scrollTo(x: number, y: number): void {
    editorScrollTo(this, x, y);
  }

  /** @internal `TEditor::trackCursor` — see editor-draw.ts. */
  trackCursor(center: boolean): void {
    editorTrackCursor(this, center);
  }

  /** @internal `TEditor::getMousePtr` — see editor-draw.ts. */
  getMousePtr(local: Point): number {
    return editorMousePtr(this, local);
  }

  /** @internal The `doUpdate` push — see editor-draw.ts. */
  update(): void {
    editorUpdate(this);
  }

  /** @internal The `updateCommands` greying — see editor-draw.ts. */
  updateCommands(): void {
    editorUpdateCommands(this);
  }

  // --- Draw + events ------------------------------------------------------------------------------

  /** Paint `size.y` rows from the `drawPtr` anchor (`TEditor::draw` — see editor-draw.ts; PA-9). */
  override draw(ctx: DrawContext): void {
    drawEditor(this, ctx, this.normalRole, this.selectedRole);
  }

  /** 3-phase handling — see editor-events.ts (PF-001 prefix claim, typing, paste, commands). */
  override onEvent(ev: DispatchEvent): void {
    handleEditorEvent(this, ev);
  }
}
