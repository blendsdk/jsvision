/**
 * `UndoStack` — the bounded multi-level undo/redo stack (RD-08 AR-253, PA-1), pure.
 *
 * A documented BEHAVIOR EXTENSION superseding TV's single-level `delCount`/`insCount` counters
 * (`teditor2.cpp:169-237,593-604`) — kept only as the semantic reference for what counts as one
 * coalesced step: consecutive single-cluster typing (or deleting) at the caret merges into the
 * OPEN step; any cursor move seals it; any fresh edit clears the redo branch; past `depth` the
 * OLDEST WHOLE steps evict (never partial). Each step is inverse-applicable: the buffer holds
 * `inserted` at `at` after the edit, `removed` before it.
 */

/** One inverse-applicable edit: `[at, at+removed.length)` became `inserted`. */
export interface EditStep {
  at: number;
  removed: string;
  inserted: string;
}

/** The bounded undo/redo stack (PA-1 default depth 1000; whole-step eviction). */
export class UndoStack {
  private steps: EditStep[] = [];
  private redoSteps: EditStep[] = [];
  private open = false;

  /**
   * @param depth Maximum retained steps (PA-1; values < 1 clamp to 1).
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
