import type { DocumentSelection } from './types.js';
import { DocumentStorage } from './storage.js';

/**
 * Captures both sides of one accepted logical edit for exact undo and redo.
 */
export interface DocumentHistoryEntry {
  readonly beforeStorage: DocumentStorage;
  readonly beforeSelection: DocumentSelection;
  readonly afterStorage: DocumentStorage;
  readonly afterSelection: DocumentSelection;
}

/**
 * Maintains bounded, complete undo and redo entries.
 */
export class DocumentHistory {
  readonly #limit: number;
  readonly #undo: DocumentHistoryEntry[] = [];
  readonly #redo: DocumentHistoryEntry[] = [];

  public constructor(limit: number) {
    this.#limit = limit;
  }

  public get undoDepth(): number {
    return this.#undo.length;
  }

  public get redoDepth(): number {
    return this.#redo.length;
  }

  public record(entry: DocumentHistoryEntry): void {
    this.#undo.push(entry);
    this.#redo.length = 0;
    if (this.#undo.length > this.#limit) {
      this.#undo.splice(0, this.#undo.length - this.#limit);
    }
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
  }
}
