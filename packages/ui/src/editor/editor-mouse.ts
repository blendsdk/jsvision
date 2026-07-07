/**
 * The editor mouse model — the `evMouseDown` drag loop of `TEditor::handleEvent`
 * (`teditor1.cpp:521-584`, re-verified 2026-07-07 @ 57b6f56) mapped onto the house
 * capture-per-event dispatch. Multi-click reads the loop-owned `DispatchEvent.clickCount` — the
 * framework's single multi-click source of truth (converged 2026-07-07, discharging AR-6's editor
 * half; the former editor-local detector + injectable clock is gone).
 *
 * TV's modal `do…while(mouseEvent(...))` loop becomes: DOWN captures the pointer + places the
 * caret; each captured DRAG re-places it with `smExtend`; edge crossings scroll one step per
 * event (the `evMouseAuto` decode `:560-573`); UP releases. Multi-click: the loop stamps a
 * consecutive same-cell count on each `down` (`DispatchEvent.clickCount`, unbounded 1,2,3,4…); the
 * editor re-wraps it to its caret→word→line cycle `((clickCount-1)%3)+1` — count 2 → `smDouble`
 * word snap, 3 → `smTriple` line snap (`:553-556`). Wheel: TV routes the wheel to the attached
 * scrollbars (`:574-579`, arrow
 * step 1, wheel = 3·arrowStep) — ours scrolls the same 3 cells directly. Shift-click extension
 * is unavailable (core's `MouseEvent` carries no modifier flags — a decoder limitation; the
 * armed `selecting` mode still extends).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { DispatchEvent } from '../view/index.js';
import { Editor, SM_EXTEND, SM_DOUBLE, SM_TRIPLE } from './editor.js';

/** Wheel scroll step — TV's `3 · arrowStep(1)` through the editor bars (`teditor1.cpp:574-579`). */
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
    // Read the loop-owned multi-click count and re-wrap it to the editor's caret→word→line cycle
    // (D2): the loop's `clickCount` is unbounded (1,2,3,4…), the editor cycles every 3. `undefined`
    // (a bare envelope / loop-less editor) ⇒ 1 (single caret), the AR-14 contract.
    const count = ev.clickCount === undefined ? 1 : ((ev.clickCount - 1) % 3) + 1;

    let selectMode = ed.selecting ? SM_EXTEND : 0;
    if (count === 2) selectMode |= SM_DOUBLE;
    else if (count === 3) selectMode |= SM_TRIPLE;

    ev.setCapture?.(ed); // the TV modal drag loop becomes a pointer capture
    ed.setCurPtr(ed.getMousePtr(local), selectMode);
    ed.dragSelectMode = selectMode | SM_EXTEND; // every subsequent drag extends (decode :580)
    ev.handled = true;
    return;
  }

  if (inner.kind === 'drag' || inner.kind === 'move') {
    if (ev.hasCapture !== undefined && !ev.hasCapture(ed)) return; // stale capture — no gesture
    if (ed.dragSelectMode === 0) return; // no live drag
    // The evMouseAuto edge scroll (one step per event, decode :560-573).
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
