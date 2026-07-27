/**
 * Clipboard (cut/copy/paste) and undo/redo operations over an {@link Editor}.
 *
 * The event loop's raw-text value is the canonical clipboard. An optional clipboard `Editor` is a
 * visible projection of that value, never a competing paste source. Copy and Cut commit through the
 * loop and refresh the projection; Paste reads the loop and refreshes the projection before
 * inserting. Undo/redo apply the undo stack's inverse steps.
 */
import { convertNewEdit } from './buffer/index.js';
import type { Editor } from './editor.js';

/**
 * Refresh the optional visible clipboard editor from canonical raw text.
 *
 * The projection keeps the full value selected so it remains easy to inspect or explicitly copy.
 * Updating it never writes back to the event loop; users can make edited projection text canonical
 * by copying it normally.
 */
export function syncEditorClipboardProjection(ed: Editor, text: string): void {
  const clip = ed.options.clipboard;
  if (clip === undefined || clip === ed) return;
  clip.isClipboardRole = true;
  clip.setText(text);
  clip.setSelect(0, text.length, false);
}

/** Copy the selection to the canonical clipboard and refresh its visible projection. No selection is a no-op. */
export function editorCopy(ed: Editor): void {
  if (ed.selStartP === ed.selEndP) return;
  const text = ed.selectionText();
  syncEditorClipboardProjection(ed, text);
  ed.mirrorSink?.(text);
}

/** Cut = copy the selection, then delete it, recorded as a single undo step. No selection is a no-op. */
export function editorCut(ed: Editor): void {
  if (ed.selStartP === ed.selEndP) return;
  editorCopy(ed);
  ed.deleteSelect();
  ed.trackCursor(false);
}

/** Paste the canonical event-loop clipboard at the caret as one undo step. An empty value is a no-op. */
export function editorPaste(ed: Editor): void {
  const text = ed.clipboardRead?.() ?? '';
  syncEditorClipboardProjection(ed, text);
  if (text === '') return;
  ed.insertRaw(convertNewEdit(text, ed.eolKind), false);
  ed.trackCursor(false);
}

/** Apply the newest step's inverse (restore `removed` over `inserted`). */
export function editorUndo(ed: Editor): void {
  const step = ed.undoStack.undo();
  if (step === null) return;
  ed.setSelect(step.at, step.at + step.inserted.length, false);
  ed.insertRaw(step.removed, true, true, false);
  ed.trackCursor(false);
}

/** Replay the newest undone step (restore `inserted` over `removed`). */
export function editorRedo(ed: Editor): void {
  const step = ed.undoStack.redo();
  if (step === null) return;
  ed.setSelect(step.at, step.at + step.removed.length, false);
  ed.insertRaw(step.inserted, true, true, false);
  ed.trackCursor(false);
}
