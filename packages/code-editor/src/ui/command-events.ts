import { Commands, type DispatchEvent } from '@jsvision/ui';
import type { CodeEditorController } from '../controller.js';

/**
 * Routes application-level selection, history, and clipboard commands into editor transactions.
 *
 * Clipboard access remains on the dispatch envelope, so this helper never reaches outside the
 * application's existing terminal event boundary.
 */
export function routeCodeEditorCommand(
  controller: CodeEditorController,
  event: DispatchEvent,
  insertText: (text: string) => boolean,
  finishMutation: (accepted: boolean) => void,
  finishSelectionChange: () => void,
): boolean {
  if (event.event.type !== 'command') return false;
  const command = event.event.command;
  if (command === Commands.selectAll) {
    controller.document.setSelection({ anchor: 0, head: controller.document.text.length });
    finishSelectionChange();
    return true;
  }
  if (command === Commands.undo || command === Commands.redo) {
    const result = command === Commands.undo ? controller.document.undo() : controller.document.redo();
    finishMutation(result.accepted);
    return true;
  }
  if (command !== Commands.copy && command !== Commands.cut && command !== Commands.paste) return false;
  if (command === Commands.paste) {
    const text = event.readClipboard?.() ?? '';
    if (text.length > 0) insertText(text);
    return true;
  }
  const selection = controller.document.selection;
  const from = Math.min(Number(selection.anchor), Number(selection.head));
  const to = Math.max(Number(selection.anchor), Number(selection.head));
  if (from === to) return true;
  event.setClipboard?.(controller.document.snapshot.slice(from, to));
  if (command === Commands.cut) insertText('');
  return true;
}
