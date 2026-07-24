import type { CodeEditorController } from '../controller.js';
import type { DocumentEditInput, DocumentSelectionInput } from '../document/types.js';
import { builtInCommentMetadata } from '../languages/metadata.js';
import {
  advanceCharacterRun,
  lineSeparator,
  removableIndentationLength,
  retreatCharacterRun,
  sourceCharacterAt,
  sourceCharacterBefore,
  transformOffset,
} from './editing-operations.js';
import { codeEditorVisibleRows } from './folding.js';
import type { CodeEditorKey } from './input.js';

/** Editor-owned route returned after a modified key is recognized. */
export type CodeEditorEditingOwner = 'editor' | 'text';

/** Mutation and synchronization seams supplied by the editor facade. */
export interface CodeEditorEditingActionsOptions {
  /** Controller that owns the document, folds, and viewport reveal requests. */
  readonly controller: CodeEditorController;
  /** Replaces the current selection and runs the editor's mutation bookkeeping. */
  readonly insertText: (text: string) => boolean;
  /** Applies one atomic edit set and runs the editor's mutation bookkeeping. */
  readonly applyEdits: (edits: readonly DocumentEditInput[], selection: DocumentSelectionInput) => boolean;
  /** Updates editor state after history operations mutate the document. */
  readonly finishMutation: (accepted: boolean) => void;
  /** Updates viewport and assistance state after a selection-only operation. */
  readonly finishSelectionChange: () => void;
}

/**
 * Implements source-editing keyboard behavior independently from terminal event orchestration.
 *
 * Keeping these document algorithms outside the view facade makes key behavior testable without
 * coupling it to drawing, modal assistance, or host lifecycle concerns.
 */
export class CodeEditorEditingActions {
  readonly #controller: CodeEditorController;
  readonly #insertText: (text: string) => boolean;
  readonly #applyEdits: (edits: readonly DocumentEditInput[], selection: DocumentSelectionInput) => boolean;
  readonly #finishMutation: (accepted: boolean) => void;
  readonly #finishSelectionChange: () => void;

  public constructor(options: CodeEditorEditingActionsOptions) {
    this.#controller = options.controller;
    this.#insertText = options.insertText;
    this.#applyEdits = options.applyEdits;
    this.#finishMutation = options.finishMutation;
    this.#finishSelectionChange = options.finishSelectionChange;
  }

  /** Routes an unmodified editing key, returning whether the key was recognized. */
  public routeEditingKey(key: string, shift: boolean): boolean {
    if (key === ' ') return this.#insertText(' ');
    if (key === 'Enter') return this.#insertNewline();
    if (key === 'Tab') {
      if (this.#hasSelection()) return this.#changeSelectedLineIndent(shift ? 'dedent' : 'indent');
      if (shift) return this.#dedentAtCaret();
      const document = this.#controller.document;
      const column = document.visualColumnAt(Number(document.selection.head));
      const width = document.tabSize - (column % document.tabSize);
      return this.#insertText(' '.repeat(width));
    }
    if (key === 'Backspace') return this.#deleteAdjacent(-1);
    if (key === 'Delete') return this.#deleteAdjacent(1);
    if (key === 'ArrowLeft') return this.#moveCaret(-1, shift);
    if (key === 'ArrowRight') return this.#moveCaret(1, shift);
    if (key === 'Home') return this.#moveToLineEdge('start', shift);
    if (key === 'End') return this.#moveToLineEdge('end', shift);
    if (key === 'ArrowUp') return this.#moveVertically(-1, shift);
    if (key === 'ArrowDown') return this.#moveVertically(1, shift);
    return false;
  }

  /** Routes source-editor modifier chords that are not registered public commands. */
  public routeModifiedKey(key: CodeEditorKey): CodeEditorEditingOwner | undefined {
    if (key.alt === true && key.ctrl !== true && key.key === 'ArrowLeft') {
      if (this.#controller.navigateBack()) this.#finishSelectionChange();
      return 'editor';
    }
    if (key.ctrl !== true || key.alt === true) return undefined;
    const lower = key.key.toLowerCase();
    if (lower === 'a') {
      this.#controller.unfoldAll();
      this.#controller.document.setSelection({ anchor: 0, head: this.#controller.document.text.length });
      this.#finishSelectionChange();
      return 'editor';
    }
    if (lower === 'z' || lower === 'y') {
      const redo = lower === 'y' || key.shift === true;
      this.#controller.unfoldAll();
      const mutation = redo ? this.#controller.document.redo() : this.#controller.document.undo();
      this.#finishMutation(mutation.accepted);
      return 'editor';
    }
    if (key.key === 'ArrowLeft' || key.key === 'ArrowRight') {
      this.#moveByWord(key.key === 'ArrowLeft' ? -1 : 1, key.shift === true);
      return 'editor';
    }
    if (key.key === 'Home' || key.key === 'End') {
      this.#moveToDocumentEdge(key.key === 'Home' ? 'start' : 'end', key.shift === true);
      return 'editor';
    }
    if (key.key === '/') return this.#toggleLineComments();
    return undefined;
  }

  #hasSelection(): boolean {
    const selection = this.#controller.document.selection;
    return selection.anchor !== selection.head;
  }

  #insertNewline(): boolean {
    const document = this.#controller.document;
    const line = document.snapshot.lineAt(Number(document.selection.head));
    const indentation = line.text.match(/^[\t ]*/u)?.[0] ?? '';
    return this.#insertText(lineSeparator(document.lineEnding) + indentation);
  }

  #changeSelectedLineIndent(direction: 'indent' | 'dedent'): boolean {
    const document = this.#controller.document;
    const selection = document.selection;
    const { firstLine, lastLine } = this.#selectedLineRange();
    const edits: DocumentEditInput[] = [];
    for (let number = firstLine; number <= lastLine; number += 1) {
      const line = document.snapshot.line(number);
      if (direction === 'indent') {
        edits.push({ range: { from: line.from, to: line.from }, text: ' '.repeat(document.tabSize) });
        continue;
      }
      const removable = removableIndentationLength(line.text, document.tabSize);
      if (removable > 0) edits.push({ range: { from: line.from, to: line.from + removable }, text: '' });
    }
    if (edits.length === 0) return true;
    return this.#applyEdits(edits, {
      anchor: transformOffset(Number(selection.anchor), edits),
      head: transformOffset(Number(selection.head), edits),
    });
  }

  #toggleLineComments(): CodeEditorEditingOwner {
    const document = this.#controller.document;
    const comments = builtInCommentMetadata(document.languageId);
    if (comments?.line === undefined) return 'editor';
    const { firstLine, lastLine } = this.#selectedLineRange();
    const lines = [];
    for (let number = firstLine; number <= lastLine; number += 1) lines.push(document.snapshot.line(number));
    const nonblank = lines.filter((line) => line.text.trim().length > 0);
    if (nonblank.length === 0) return 'editor';
    const minimumIndent = Math.min(...nonblank.map((line) => line.text.length - line.text.trimStart().length));
    const delimiter = comments.line;
    const uncomment = nonblank.every((line) => line.text.slice(minimumIndent).startsWith(delimiter));
    const edits: DocumentEditInput[] = nonblank.map((line) => {
      const from = line.from + minimumIndent;
      if (!uncomment) return { range: { from, to: from }, text: `${delimiter} ` };
      const following = line.text.slice(minimumIndent + delimiter.length);
      const removeSpace = following.startsWith(' ') ? 1 : 0;
      return { range: { from, to: from + delimiter.length + removeSpace }, text: '' };
    });
    const selection = document.selection;
    const accepted = this.#applyEdits(edits, {
      anchor: transformOffset(Number(selection.anchor), edits),
      head: transformOffset(Number(selection.head), edits),
    });
    return accepted ? 'text' : 'editor';
  }

  #selectedLineRange(): { readonly firstLine: number; readonly lastLine: number } {
    const document = this.#controller.document;
    const selection = document.selection;
    const start = Math.min(Number(selection.anchor), Number(selection.head));
    const end = Math.max(Number(selection.anchor), Number(selection.head));
    const firstLine = Number(document.snapshot.lineAt(start).number);
    const lastOffset = end > start && document.snapshot.lineAt(end).from === end ? end - 1 : end;
    const lastLine = Number(document.snapshot.lineAt(Math.max(start, lastOffset)).number);
    return { firstLine, lastLine };
  }

  #deleteAdjacent(direction: -1 | 1): boolean {
    const selection = this.#controller.document.selection;
    const anchor = Number(selection.anchor);
    const head = Number(selection.head);
    if (anchor === head) {
      const target = Math.max(0, Math.min(this.#controller.document.text.length, head + direction));
      if (target === head) return true;
      this.#controller.revealOffset(target);
      this.#controller.document.setSelection({ anchor: Math.min(head, target), head: Math.max(head, target) });
    }
    this.#insertText('');
    return true;
  }

  #moveCaret(delta: -1 | 1, extend: boolean): boolean {
    const selection = this.#controller.document.selection;
    const head = Math.max(0, Math.min(this.#controller.document.text.length, Number(selection.head) + delta));
    this.#controller.revealOffset(head);
    this.#controller.document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.#finishSelectionChange();
    return true;
  }

  #moveByWord(direction: -1 | 1, extend: boolean): void {
    const document = this.#controller.document;
    const selection = document.selection;
    const text = document.text;
    let head = Number(selection.head);
    if (direction === 1) {
      const initial = sourceCharacterAt(text, head);
      if (initial !== undefined) {
        head = advanceCharacterRun(text, head, initial.kind);
        if (initial.kind !== 'whitespace') head = advanceCharacterRun(text, head, 'whitespace');
      }
    } else {
      head = retreatCharacterRun(text, head, 'whitespace');
      const prior = sourceCharacterBefore(text, head);
      if (prior !== undefined) head = retreatCharacterRun(text, head, prior.kind);
    }
    this.#controller.revealOffset(head);
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.#finishSelectionChange();
  }

  #moveToDocumentEdge(edge: 'start' | 'end', extend: boolean): void {
    const document = this.#controller.document;
    const selection = document.selection;
    const head = edge === 'start' ? 0 : document.text.length;
    this.#controller.revealOffset(head);
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.#finishSelectionChange();
  }

  #moveToLineEdge(edge: 'start' | 'end', extend: boolean): boolean {
    const document = this.#controller.document;
    const selection = document.selection;
    const line = document.snapshot.lineAt(Number(selection.head));
    const head = edge === 'start' ? line.from : line.to;
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.#finishSelectionChange();
    return true;
  }

  #moveVertically(delta: -1 | 1, extend: boolean): boolean {
    const document = this.#controller.document;
    const selection = document.selection;
    const current = document.snapshot.lineAt(Number(selection.head));
    const targetNumber = codeEditorVisibleRows(this.#controller).adjacentLogicalLine(Number(current.number), delta);
    const target = document.snapshot.line(targetNumber);
    const head = target.from + Math.min(Number(selection.head) - current.from, target.length);
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.#finishSelectionChange();
    return true;
  }

  #dedentAtCaret(): boolean {
    const document = this.#controller.document;
    const head = Number(document.selection.head);
    const line = document.snapshot.lineAt(head);
    const removable = removableIndentationLength(line.text, document.tabSize);
    if (removable === 0) return true;
    document.setSelection({ anchor: line.from, head: line.from + removable });
    this.#insertText('');
    return true;
  }
}
