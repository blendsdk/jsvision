/**
 * The `Validator` shape (RD-06 PA-12, mirroring TV `validate.h`). A composable, typed unit attachable
 * to an `Input`: `isValidInput` is the transient per-keystroke gate (allows partial values mid-edit),
 * `isValid` the blocking on-completion gate (run on focus-leave / `valid()`). The `.js` extension in
 * import specifiers is required by NodeNext ESM resolution.
 */

/** A composable input validator (TV `TValidator` reframed as a plain object — PA-12). */
export interface Validator {
  /** Transient, per-keystroke: may this candidate string exist mid-edit? (TV `isValidInput`). */
  isValidInput(s: string): boolean;
  /** Blocking, on completion/focus-leave: is the complete value acceptable? (TV `isValid`). */
  isValid(s: string): boolean;
  /** Optional message for the invalid state, consumed by `Input`'s invalid feedback (PA-2). */
  readonly error?: string;
}
