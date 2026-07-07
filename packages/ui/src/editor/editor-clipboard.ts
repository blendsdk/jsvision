/**
 * Clipboard + undo/redo operations over the `Editor` (RD-08 03-03 §Clipboard wiring — the PF-011
 * split pattern: free functions driving the editor's @internal core, keeping `editor.ts` ≤ 500).
 *
 * Decode (`teditor1.cpp:297-331`, re-verified 2026-07-07 @ 57b6f56): `clipCopy` fills the
 * clipboard editor which then holds EXACTLY the copied text, selected (the PA-16 `insertFrom`
 * selection semantics); `clipCut` = copy + delete-as-one-step (`:316-320`); `clipPaste` inserts
 * the clipboard's SELECTION. With no clipboard injected, paste is a no-op — the recorded PA-2
 * deviation (magiblot falls back to the OS clipboard `:322-331`; system paste reaches us as a
 * bracketed `PasteEvent`). Copy/cut also mirror ONE OSC-52 write through the envelope sink
 * (AC-5). Undo/redo apply the AR-253 stack's inverse-applicable steps.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { convertNewEdit } from './buffer/index.js';
import type { Editor } from './editor.js';

/** `clipCopy`: fill the clipboard editor (selected, PA-16) + ONE OSC-52 mirror. No selection ⇒ no-op. */
export function editorCopy(ed: Editor): void {
  if (ed.selStartP === ed.selEndP) return;
  const text = ed.selectionText();
  const clip = ed.options.clipboard;
  if (clip !== undefined && clip !== ed) {
    clip.isClipboardRole = true; // TV isClipboard(): the clipboard's own edits never set modified
    clip.setText(text);
    clip.setSelect(0, text.length, false); // holds the copied range selected (PA-16)
  }
  ed.mirrorSink?.(text); // the OSC-52 mirror (event-loop.ts sinks it caps-gated)
}

/** `clipCut` = copy + delete-as-ONE-step (`teditor1.cpp:316-320`). */
export function editorCut(ed: Editor): void {
  if (ed.selStartP === ed.selEndP) return;
  editorCopy(ed);
  ed.deleteSelect();
  ed.trackCursor(false);
}

/** `clipPaste`: insert the clipboard's SELECTION (PA-16), replacing any selection, as ONE step. */
export function editorPaste(ed: Editor): void {
  const clip = ed.options.clipboard;
  if (clip === undefined || clip === ed) return; // PA-2 — no clipboard ⇒ internal no-op
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
