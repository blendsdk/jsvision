/**
 * The editor's painting and its post-edit "update" pushes.
 *
 * `drawEditor` repaints the visible rows from the scroll anchor. `editorUpdate` runs after any edit
 * or cursor move: it refreshes the reactive state signals, pushes the scroll-bar ranges and the
 * line/column indicator, and greys out editing commands that don't apply. The remaining helpers
 * handle clamped scrolling, keeping the caret in view, mapping a mouse cell to a buffer position,
 * and re-fitting after a resize.
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

/** The fixed horizontal scroll extent, in columns — how far right a line can scroll. */
export const MAX_LINE_LENGTH = 256;

/** Paint the visible rows from the current scroll anchor, colouring selected runs. */
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

/** After an edit or cursor move: refresh the state signals, scroll-bar ranges, indicator, and command greying. */
export function editorUpdate(ed: Editor): void {
  ed.invalidate();
  ed.curPos.set({ line: ed.curY + 1, col: ed.curX + 1 });
  ed.hasSelection.set(ed.selStartP !== ed.selEndP);
  ed.lineCount.set(ed.limitY);
  ed.canUndo.set(ed.undoStack.canUndo);
  ed.canRedo.set(ed.undoStack.canRedo);
  const w = ed.viewW();
  const h = ed.viewH();
  ed.hBar?.setRange(0, MAX_LINE_LENGTH - w, Math.trunc(w / 2), 1);
  ed.vBar?.setRange(0, ed.limitY - h, h - 1, 1);
  ed.indicator?.setValue({ line: ed.curY + 1, col: ed.curX + 1 }, ed.modified());
  editorUpdateCommands(ed);
}

/** Grey out editing commands that don't currently apply, through the optional command seam. */
export function editorUpdateCommands(ed: Editor): void {
  const seam = ed.options.commands;
  if (seam === undefined) return;
  const hasSel = ed.selStartP !== ed.selEndP;
  if (!ed.isClipboardRole) {
    seam.enable(Commands.cut, hasSel);
    seam.enable(Commands.copy, hasSel);
    // Paste is enabled only when a shared clipboard editor exists and holds a selection.
    seam.enable(Commands.paste, ed.options.clipboard !== undefined && ed.options.clipboard.hasSelection());
  }
  seam.enable(Commands.undo, ed.canUndo());
  seam.enable(Commands.redo, ed.canRedo());
  seam.enable(EditorCommands.clear, hasSel);
  seam.enable(EditorCommands.find, true);
  seam.enable(EditorCommands.replace, true);
  seam.enable(EditorCommands.searchAgain, true);
}

/** Scroll to `(x, y)`, clamped to the content extent; repaints only when the offset changes. */
export function editorScrollTo(ed: Editor, x: number, y: number): void {
  const cx = Math.max(0, Math.min(Math.trunc(x) || 0, MAX_LINE_LENGTH - ed.viewW()));
  const cy = Math.max(0, Math.min(Math.trunc(y) || 0, ed.limitY - ed.viewH()));
  if (cx !== ed.delta.x() || cy !== ed.delta.y()) {
    ed.delta.x.set(cx);
    ed.delta.y.set(cy);
    editorUpdate(ed);
  }
}

/** Scroll so the caret is in view — nudged to the nearest edge, or centered when `center` is `true`. */
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
 * Re-fit the scroll after the editor's viewport size changed (a window resize, cascade, tile, zoom,
 * or desktop resize). Re-clamps the scroll offset to the new size and keeps the caret in view, so
 * it is never parked off-screen after a resize.
 *
 * Called at event time with the new interior size, because the layout pass that writes the view's
 * real bounds only runs on the next frame — so the new size is passed in explicitly here. A
 * pre-layout or collapsed (0×0) size is a no-op.
 *
 * @param ed   The editor to re-fit.
 * @param size The new content size in cells (the framed interior of the window).
 */
export function editorViewResized(ed: Editor, size: { width: number; height: number }): void {
  ed.bounds = { ...ed.bounds, width: size.width, height: size.height };
  if (ed.viewW() > 0 && ed.viewH() > 0) ed.trackCursor(false);
}

/** Map a view-local cell (row/column) to the buffer position under it. */
export function editorMousePtr(ed: Editor, local: Point): number {
  const mx = Math.max(0, Math.min(local.x, ed.viewW() - 1));
  const my = Math.max(0, Math.min(local.y, ed.viewH() - 1));
  const linePtr = lineMove(ed.buf, ed.drawPtrP, my + ed.delta.y() - ed.drawLine);
  return charPtr(ed.buf, linePtr, mx + ed.delta.x());
}
