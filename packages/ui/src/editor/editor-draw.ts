/**
 * The editor draw + `doUpdate` pushes as free functions (RD-08 03-02 — the PF-011 split keeping
 * `editor.ts` ≤ 500).
 *
 * Decode (re-verified 2026-07-07 @ 57b6f56): `TEditor::draw` (`teditor1.cpp:453-461`) shifts the
 * `drawPtr` anchor by `lineMove(delta.y − drawLine)` then formats exactly `size.y` rows via
 * `formatLine` (`drawLines` `:463-474`; PA-9 whole-view repaint — core's damage diff keeps
 * emitted bytes ∝ change). `doUpdate` (`:431-451`) pushes the gadget ranges (`setParams` at
 * `:442,444`), the indicator value, and the `updateCommands` greying (`teditor2.cpp:623-637`;
 * TV enables paste when `clipboard==0` — the OS-clipboard fallback — ours greys it, the
 * recorded PA-2 deviation).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { DrawContext, ThemeRoleName } from '../view/index.js';
import { Commands } from '../status/index.js';
import { nextLine } from './buffer/index.js';
import { formatLine } from './format.js';
import { lineMove } from './buffer/index.js';
import { EditorCommands } from './editor-actions.js';
import type { Point } from '../view/index.js';
import { charPtr } from './buffer/index.js';
import type { Editor } from './editor.js';

/** TV `maxLineLength` — the fixed horizontal scroll extent (`editors.h:108`, `teditor2.cpp:433`). */
export const MAX_LINE_LENGTH = 256;

/** Paint `size.y` rows from the `drawPtr` anchor (the `TEditor::draw` decode). */
export function drawEditor(ed: Editor, ctx: DrawContext, normalRole: ThemeRoleName, selectedRole: ThemeRoleName): void {
  const dy = ed.delta.y();
  if (ed.drawLine !== dy) {
    ed.drawPtrP = lineMove(ed.buf, ed.drawPtrP, dy - ed.drawLine);
    ed.drawLine = dy;
  }
  const sel = ed.selStartP !== ed.selEndP ? { start: ed.selStartP, end: ed.selEndP } : null;
  const normal = ctx.color(normalRole);
  const selected = ctx.color(selectedRole);
  let linePtr = ed.drawPtrP;
  for (let y = 0; y < ctx.size.height; y++) {
    const cells = formatLine(ed.buf, linePtr, ed.delta.x(), ctx.size.width, sel);
    let x = 0;
    let run = '';
    let runStart = 0;
    let runSelected = false;
    for (const cell of cells) {
      if (run !== '' && cell.selected !== runSelected) {
        ctx.text(runStart, y, run, runSelected ? selected : normal);
        run = '';
      }
      if (run === '') {
        runStart = x;
        runSelected = cell.selected;
      }
      run += cell.ch;
      x += cell.width;
    }
    if (run !== '') ctx.text(runStart, y, run, runSelected ? selected : normal);
    linePtr = nextLine(ed.buf, linePtr);
  }
}

/** The `doUpdate` push: repaint + signals + gadget ranges + the indicator + command greying. */
export function editorUpdate(ed: Editor): void {
  ed.invalidate();
  ed.curPos.set({ line: ed.curY + 1, col: ed.curX + 1 });
  ed.hasSelection.set(ed.selStartP !== ed.selEndP);
  ed.lineCount.set(ed.limitY);
  ed.canUndo.set(ed.undoStack.canUndo);
  ed.canRedo.set(ed.undoStack.canRedo);
  const w = ed.viewW();
  const h = ed.viewH();
  ed.hBar?.setRange(0, MAX_LINE_LENGTH - w, Math.trunc(w / 2), 1); // setParams (:442)
  ed.vBar?.setRange(0, ed.limitY - h, h - 1, 1); // setParams (:444)
  ed.indicator?.setValue({ line: ed.curY + 1, col: ed.curX + 1 }, ed.modified());
  editorUpdateCommands(ed);
}

/** The `updateCommands` greying decode (`teditor2.cpp:623-637`) through the optional seam. */
export function editorUpdateCommands(ed: Editor): void {
  const seam = ed.options.commands;
  if (seam === undefined) return;
  const hasSel = ed.selStartP !== ed.selEndP;
  if (!ed.isClipboardRole) {
    seam.enable(Commands.cut, hasSel);
    seam.enable(Commands.copy, hasSel);
    // TV enables paste when clipboard==0 (OS fallback); ours greys it — the PA-2 deviation.
    seam.enable(Commands.paste, ed.options.clipboard !== undefined && ed.options.clipboard.hasSelection());
  }
  seam.enable(Commands.undo, ed.canUndo());
  seam.enable(Commands.redo, ed.canRedo());
  seam.enable(EditorCommands.clear, hasSel);
  seam.enable(EditorCommands.find, true);
  seam.enable(EditorCommands.replace, true);
  seam.enable(EditorCommands.searchAgain, true);
}

/** `TEditor::scrollTo` (`teditor2.cpp:377-388`) — clamped scroll + repaint on change. */
export function editorScrollTo(ed: Editor, x: number, y: number): void {
  const cx = Math.max(0, Math.min(Math.trunc(x) || 0, MAX_LINE_LENGTH - ed.viewW()));
  const cy = Math.max(0, Math.min(Math.trunc(y) || 0, ed.limitY - ed.viewH()));
  if (cx !== ed.delta.x() || cy !== ed.delta.y()) {
    ed.delta.x.set(cx);
    ed.delta.y.set(cy);
    editorUpdate(ed);
  }
}

/** `TEditor::trackCursor` (`teditor2.cpp:584-591`) — keep (or center) the caret in view. */
export function editorTrackCursor(ed: Editor, center: boolean): void {
  if (center) {
    editorScrollTo(ed, ed.curX - ed.viewW() + 1, ed.curY - Math.trunc(ed.viewH() / 2));
  } else {
    editorScrollTo(
      ed,
      Math.max(ed.curX - ed.viewW() + 1, Math.min(ed.delta.x(), ed.curX)),
      Math.max(ed.curY - ed.viewH() + 1, Math.min(ed.delta.y(), ed.curY)),
    );
  }
}

/**
 * Re-fit the scroll after the editor's viewport size changed (a WM drag-resize / cascade / tile /
 * zoom / desktop resize). TV `TEditor::changeBounds` (`teditor1.cpp:219-225`) re-clamps `delta`
 * against the new size; we additionally `trackCursor(false)` so the hardware caret is never parked
 * off-view after a resize (the reported "caret vanishes on resize" defect) — a behavioral extension
 * that keeps the caret visible while `scrollTo`'s clamp still subsumes TV's `delta` clamp.
 *
 * Called at event time (outside compose) with the new interior size, since the reflow that writes
 * `bounds` runs on the next flush — so `viewW()`/`viewH()` are fed explicitly here. A pre-layout /
 * collapsed size (0×0) is a no-op (nothing to track, and it would otherwise clamp `delta` to junk).
 *
 * @param ed   The editor to re-fit.
 * @param size The new content size in cells (the framed interior, `getExtent().grow(−1,−1)`).
 */
export function editorViewResized(ed: Editor, size: { width: number; height: number }): void {
  ed.bounds = { ...ed.bounds, width: size.width, height: size.height };
  if (ed.viewW() > 0 && ed.viewH() > 0) ed.trackCursor(false);
}

/** Map a view-local cell to a buffer position (`TEditor::getMousePtr`, `teditor1.cpp:487-494`). */
export function editorMousePtr(ed: Editor, local: Point): number {
  const mx = Math.max(0, Math.min(local.x, ed.viewW() - 1));
  const my = Math.max(0, Math.min(local.y, ed.viewH() - 1));
  const linePtr = lineMove(ed.buf, ed.drawPtrP, my + ed.delta.y() - ed.drawLine);
  return charPtr(ed.buf, linePtr, mx + ed.delta.x());
}
