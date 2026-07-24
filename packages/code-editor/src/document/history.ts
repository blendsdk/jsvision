import type { ChangeSet } from '@codemirror/state';

import type { DocumentSelection } from './types.js';

/**
 * Stores reversible changes rather than complete document roots, so retained history scales with
 * changed content instead of multiplying the active document size.
 */
export interface DocumentHistoryEntry {
  readonly forward: ChangeSet;
  readonly inverse: ChangeSet;
  readonly beforeSelection: DocumentSelection;
  readonly afterSelection: DocumentSelection;
  readonly beforeByteLength: number;
  readonly afterByteLength: number;
  readonly retainedBytes: number;
  readonly beforeHasCarriageReturn: boolean;
  readonly afterHasCarriageReturn: boolean;
}

/**
 * Maintains complete undo and redo entries within count and retained-byte ceilings.
 */
export class DocumentHistory {
  readonly #entryLimit: number;
  readonly #byteLimit: number;
  readonly #undo: DocumentHistoryEntry[] = [];
  readonly #redo: DocumentHistoryEntry[] = [];
  #retainedBytes = 0;

  public constructor(entryLimit: number, byteLimit: number) {
    this.#entryLimit = entryLimit;
    this.#byteLimit = byteLimit;
  }

  public get undoDepth(): number {
    return this.#undo.length;
  }

  public get redoDepth(): number {
    return this.#redo.length;
  }

  public get retainedBytes(): number {
    return this.#retainedBytes;
  }

  public record(entry: DocumentHistoryEntry): boolean {
    if (entry.retainedBytes > this.#byteLimit) {
      return false;
    }
    this.#retainedBytes -= sumRetainedBytes(this.#redo);
    this.#redo.length = 0;
    this.#undo.push(entry);
    this.#retainedBytes += entry.retainedBytes;
    while (this.#undo.length > this.#entryLimit || (this.#retainedBytes > this.#byteLimit && this.#undo.length > 1)) {
      const removed = this.#undo.shift();
      if (removed !== undefined) {
        this.#retainedBytes -= removed.retainedBytes;
      }
    }
    return true;
  }

  public takeUndo(): DocumentHistoryEntry | undefined {
    const entry = this.#undo.pop();
    if (entry !== undefined) {
      this.#redo.push(entry);
    }
    return entry;
  }

  public takeRedo(): DocumentHistoryEntry | undefined {
    const entry = this.#redo.pop();
    if (entry !== undefined) {
      this.#undo.push(entry);
    }
    return entry;
  }

  public clear(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
    this.#retainedBytes = 0;
  }
}

function sumRetainedBytes(entries: readonly DocumentHistoryEntry[]): number {
  return entries.reduce((total, entry) => total + entry.retainedBytes, 0);
}
