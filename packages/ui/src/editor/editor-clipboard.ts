/**
 * Clipboard (cut/copy/paste) and undo/redo operations over an {@link Editor}.
 *
 * The clipboard is itself an `Editor` — Copy fills it with exactly the copied text (left selected),
 * Cut is a copy plus a delete recorded as one undo step, and Paste inserts whatever is selected in
 * the clipboard editor. With no clipboard editor injected, in-app Paste is a no-op; system paste
 * still arrives separately as a bracketed paste event. Copy/Cut also mirror one write to the host's
 * OS clipboard when the terminal supports it. Undo/redo apply the undo stack's inverse steps.
 */
import { convertNewEdit } from './buffer/index.js';
import type { Editor } from './editor.js';

/** Copy the selection into the clipboard editor (left selected) and mirror it to the OS clipboard. No selection is a no-op. */
export function editorCopy(ed: Editor): void {
  if (ed.selStartP === ed.selEndP) return;
  const text = ed.selectionText();
  const clip = ed.options.clipboard;
  if (clip !== undefined && clip !== ed) {
    clip.isClipboardRole = true; // the clipboard editor's own edits never mark it modified
    clip.setText(text);
    clip.setSelect(0, text.length, false); // hold the copied range selected so Paste can read it
  }
  ed.mirrorSink?.(text); // mirror to the OS clipboard when the host/terminal supports it
}

/** Cut = copy the selection, then delete it, recorded as a single undo step. No selection is a no-op. */
export function editorCut(ed: Editor): void {
  if (ed.selStartP === ed.selEndP) return;
  editorCopy(ed);
  ed.deleteSelect();
  ed.trackCursor(false);
}

/** Paste the clipboard editor's selection at the caret, replacing any selection, as one undo step. */
export function editorPaste(ed: Editor): void {
  const clip = ed.options.clipboard;
  if (clip === undefined || clip === ed) return; // no clipboard editor ⇒ in-app paste is a no-op
  const text = clip.selectionText();
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
