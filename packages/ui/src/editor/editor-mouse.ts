/**
 * The editor's mouse and wheel handling.
 *
 * Mouse-down places the caret and captures the pointer; each captured drag re-places it and extends
 * the selection; crossing an edge scrolls one step per event; mouse-up releases the capture. A
 * double-click selects the word under the caret and a triple-click selects the line, using the
 * consecutive-click count the event loop provides. The wheel scrolls three cells at a time.
 *
 * Note: Shift-click to extend a selection is not currently available (the mouse event carries no
 * modifier flags); the persistent select mode still extends normally.
 */
import type { DispatchEvent } from '../view/index.js';
import { Editor, SM_EXTEND, SM_DOUBLE, SM_TRIPLE } from './editor.js';

/** Rows/columns scrolled per wheel notch. */
const WHEEL_STEP = 3;

/**
 * Handle one mouse/wheel envelope for the editor. Mouse arrives only via hit-test or capture
 * (dispatch routes them before the phases), so no focus gating is needed here.
 */
export function handleEditorMouse(ed: Editor, ev: DispatchEvent): void {
  const inner = ev.event;

  if (inner.type === 'wheel') {
    const dx = ed.delta.x();
    const dy = ed.delta.y();
    if (inner.dir === 'up') ed.scrollTo(dx, dy - WHEEL_STEP);
    else if (inner.dir === 'down') ed.scrollTo(dx, dy + WHEEL_STEP);
    else if (inner.dir === 'left') ed.scrollTo(dx - WHEEL_STEP, dy);
    else ed.scrollTo(dx + WHEEL_STEP, dy);
    ev.handled = true;
    return;
  }

  if (inner.type !== 'mouse' || ev.local === undefined) return;
  const local = ev.local;

  if (inner.kind === 'down') {
    // The event loop reports an unbounded consecutive-click count (1, 2, 3, 4…); cycle it every
    // three so a click selects the caret, then the word, then the line, then back to the caret.
    // No count (a bare event, or an editor with no loop) means a single click.
    const count = ev.clickCount === undefined ? 1 : ((ev.clickCount - 1) % 3) + 1;

    let selectMode = ed.selecting ? SM_EXTEND : 0;
    if (count === 2) selectMode |= SM_DOUBLE;
    else if (count === 3) selectMode |= SM_TRIPLE;

    ev.setCapture?.(ed); // capture the pointer so the whole drag routes to this editor
    ed.setCurPtr(ed.getMousePtr(local), selectMode);
    ed.dragSelectMode = selectMode | SM_EXTEND; // every subsequent drag extends the selection
    ev.handled = true;
    return;
  }

  if (inner.kind === 'drag' || inner.kind === 'move') {
    if (ev.hasCapture !== undefined && !ev.hasCapture(ed)) return; // not our capture — ignore
    if (ed.dragSelectMode === 0) return; // no drag in progress
    // Scroll one step per event when the pointer is dragged past an edge.
    let dx = ed.delta.x();
    let dy = ed.delta.y();
    if (local.x < 0) dx--;
    if (local.x >= ed.viewW()) dx++;
    if (local.y < 0) dy--;
    if (local.y >= ed.viewH()) dy++;
    ed.scrollTo(dx, dy);
    ed.setCurPtr(ed.getMousePtr(local), ed.dragSelectMode);
    ev.handled = true;
    return;
  }

  if (inner.kind === 'up') {
    ed.dragSelectMode = 0;
    ev.releaseCapture?.();
    ev.handled = true;
  }
}
