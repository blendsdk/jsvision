/**
 * The editor's event handling: keys, mouse/wheel, bracketed paste, and command events.
 *
 * Keys are resolved through the editor's keymap when the editor (or a focused descendant) owns
 * focus. A bracketed paste is inserted as one edit / one undo step. Command events — Cut, Copy,
 * Paste, Undo, Redo, and the find/replace/clear editor commands — are handled while the editor is
 * focused, so menus and the status line can drive it.
 *
 * A note for app authors: the editor claims the WordStar prefixes (Ctrl-Q, Ctrl-K) before the rest
 * of the app sees them, so do not also bind Ctrl-Q or Ctrl-K in your app keymap — the focused
 * editor needs them.
 */
import type { DispatchEvent } from '../view/index.js';
import { Commands } from '../status/index.js';
import { resolveKey, resolveModernKey } from './keymap.js';
import type { KeyResolution } from './keymap.js';
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
    // The modern Ctrl+X/C/V/A + Ctrl+Z/Y overlay (default binding set) wins over the WordStar table,
    // but ONLY when idle — an armed Ctrl-K/Ctrl-Q prefix keeps its WordStar sequence intact.
    const modern = ed.keyBindings === 'modern' && ed.keyState === 0 ? resolveModernKey(inner) : undefined;
    const res: KeyResolution =
      modern !== undefined ? { action: modern, nextState: 0, consumed: true } : resolveKey(ed.keyState, inner);
    ed.keyState = res.nextState;
    if (res.action !== undefined) {
      applyAction(ed, res.action, selectMode, centerCursor);
      ev.handled = true;
    } else if (res.consumed) {
      ev.handled = true; // a prefix arm, or an unknown follow-up clearing it (no edit)
    } else if (!inner.ctrl && !inner.alt) {
      // The Space key arrives named 'space' — map it back to a literal space. The spread-length
      // check also admits astral-plane printables (e.g. 👍 is one code point but string length 2).
      const ch = inner.key === 'space' ? ' ' : [...inner.key].length === 1 ? inner.key : null;
      if (ch !== null) {
        ed.typeText(ch, centerCursor);
        ev.handled = true;
      }
    }
    return;
  }
  if (inner.type === 'paste') {
    if (ed.state.focused) {
      ed.insertText(inner.text); // one insertion, one undo step
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
