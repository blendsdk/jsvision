/**
 * The editor's 3-phase event handling as a free function (RD-08 03-02 §Event routing — the
 * PF-011 split keeping `editor.ts` ≤ 500).
 *
 * Decode: the pre visit claims ONLY the WordStar chords, scoped by
 * `isWithin(ev.getFocused?.() ?? null, this)` (PF-001 — apps must NOT bind Ctrl-Q/Ctrl-K in the
 * app keymap; the pre sweep runs root→down so ancestor containers keep their priority); mouse
 * arrives only via hit-test/capture (`editor-mouse.ts`); typing per the `evKeyDown` branch
 * (`teditor1.cpp:586-616`); a bracketed paste is ONE insertion/one undo step (AC-5); command
 * events (`Commands.cut/copy/paste/undo/redo` + `EditorCommands.*`) handle when focused (PA-15).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { DispatchEvent } from '../view/index.js';
import { Commands } from '../status/index.js';
import { resolveKey } from './keymap.js';
import { applyAction, EditorCommands } from './editor-actions.js';
import { handleEditorMouse } from './editor-mouse.js';
import { isWithin } from './editor-types.js';
import { Editor, SM_EXTEND } from './editor.js';

/** Route one dispatch envelope (see the module JSDoc; called from `Editor.onEvent`). */
export function handleEditorEvent(ed: Editor, ev: DispatchEvent): void {
  const inner = ev.event;
  if (ev.setClipboard !== undefined) ed.mirrorSink = ev.setClipboard; // copy/cut mirror channel
  if (inner.type === 'mouse' || inner.type === 'wheel') {
    handleEditorMouse(ed, ev);
    return;
  }
  if (inner.type === 'key') {
    const focused = ev.getFocused?.();
    const active = focused === undefined ? ed.state.focused : isWithin(focused, ed);
    if (!active) return;
    const selectMode = ed.selecting || inner.shift ? SM_EXTEND : 0;
    const centerCursor = !ed.isCursorVisible();
    const res = resolveKey(ed.keyState, inner);
    ed.keyState = res.nextState;
    if (res.action !== undefined) {
      applyAction(ed, res.action, selectMode, centerCursor);
      ev.handled = true;
    } else if (res.consumed) {
      ev.handled = true; // a prefix arm, or an unknown follow-up clearing it (no edit)
    } else if (inner.key.length === 1 && !inner.ctrl && !inner.alt) {
      ed.typeText(inner.key, centerCursor);
      ev.handled = true;
    }
    return;
  }
  if (inner.type === 'paste') {
    if (ed.state.focused) {
      ed.insertText(inner.text); // ONE insertion, ONE undo step (AC-5)
      ev.handled = true;
    }
    return;
  }
  if (inner.type === 'command') {
    if (!ed.state.focused) return;
    const c = inner.command;
    if (c === Commands.cut) ed.cut();
    else if (c === Commands.copy) ed.copy();
    else if (c === Commands.paste) ed.paste();
    else if (c === Commands.undo) ed.undo();
    else if (c === Commands.redo) ed.redo();
    else if (c === EditorCommands.clear) ed.deleteSelect();
    else if (c === EditorCommands.find) void ed.find();
    else if (c === EditorCommands.replace) void ed.replace();
    else if (c === EditorCommands.searchAgain) void ed.searchAgain();
    else return;
    ev.handled = true;
  }
}
