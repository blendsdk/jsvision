/**
 * A bounded, multi-level undo/redo stack, pure and view-free.
 *
 * How steps coalesce (this is what a user perceives as "one undo"): consecutive single-character
 * typing — or deleting — at the caret merges into the currently open step; any cursor move seals
 * that step; any fresh edit clears the redo branch. Past `depth`, the oldest whole steps are
 * evicted (never a partial step). Each step is inverse-applicable — after the edit the buffer holds
 * `inserted` at `at`; before it, `removed`.
 */

/** One inverse-applicable edit: `[at, at+removed.length)` became `inserted`. */
export interface EditStep {
  at: number;
  removed: string;
  inserted: string;
}

/** The bounded undo/redo stack (whole-step eviction once `depth` is exceeded). */
export class UndoStack {
  private steps: EditStep[] = [];
  private redoSteps: EditStep[] = [];
  private open = false;

  /**
   * @param depth Maximum retained steps; values below 1 clamp to 1.
   */
  constructor(private readonly depth: number) {
    this.depth = Math.max(1, Math.trunc(depth) || 1);
  }

  /** Whether an undo step exists. */
  get canUndo(): boolean {
    return this.steps.length > 0;
  }

  /** Whether a redo step exists. */
  get canRedo(): boolean {
    return this.redoSteps.length > 0;
  }

  /** Record a fresh step: clears the redo branch, becomes the open step, evicts past `depth`. */
  record(step: EditStep): void {
    this.redoSteps = [];
    this.steps.push({ ...step });
    this.open = true;
    while (this.steps.length > this.depth) this.steps.shift(); // oldest WHOLE steps evict
  }

  /**
   * Extend the open step when contiguous (single-cluster typing/deleting at the caret), else
   * record a fresh one. Merge shapes: a pure insert appended right after the open step's insert;
   * a backspace directly before a pure-delete step; a forward-delete at the same position.
   * Clears the redo branch either way (any fresh edit does).
   */
  coalesce(step: EditStep): void {
    const last = this.steps[this.steps.length - 1];
    if (this.open && last !== undefined) {
      const lastIsPureDelete = last.inserted === '' && last.removed !== '';
      if (step.removed === '' && step.at === last.at + last.inserted.length && !lastIsPureDelete) {
        this.redoSteps = [];
        last.inserted += step.inserted; // typing run (also extends a replace step's insert);
        return; //                         a DIRECTION change off a delete starts a new step
      }
      if (last.inserted === '' && step.inserted === '') {
        if (step.at + step.removed.length === last.at) {
          this.redoSteps = [];
          last.at = step.at; // backspace run grows leftward
          last.removed = step.removed + last.removed;
          return;
        }
        if (step.at === last.at) {
          this.redoSteps = [];
          last.removed += step.removed; // forward-delete run grows rightward
          return;
        }
      }
    }
    this.record(step);
  }

  /** Seal the open step (a cursor move); history is kept, only coalescing stops. */
  seal(): void {
    this.open = false;
  }

  /** Drop ALL history (a document swap — `setText`/load); undo never crosses documents. */
  clear(): void {
    this.steps = [];
    this.redoSteps = [];
    this.open = false;
  }

  /** Pop the newest step onto the redo branch (the caller applies its inverse), or `null`. */
  undo(): EditStep | null {
    const step = this.steps.pop();
    if (step === undefined) return null;
    this.redoSteps.push(step);
    this.open = false;
    return step;
  }

  /** Pop the newest redo step back onto the undo branch (the caller replays it), or `null`. */
  redo(): EditStep | null {
    const step = this.redoSteps.pop();
    if (step === undefined) return null;
    this.steps.push(step);
    this.open = false;
    return step;
  }
}
