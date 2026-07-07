/**
 * A rule that constrains what an {@link Input} accepts. Attach one via the `Input`'s `validator`
 * option.
 *
 * A validator has two gates that fire at different moments:
 * - `isValidInput` runs live on every keystroke and must accept *partial* values that are still
 *   being typed (e.g. `"12"` while typing an age). Rejecting here blocks the keystroke.
 * - `isValid` runs once the user leaves the field (or when you call `Input.valid()`) and checks the
 *   *complete* value. Failing here does not trap focus — it flags the field as invalid so you can
 *   show feedback.
 *
 * Use the built-in factories ({@link filter}, {@link range}, {@link lookup}, {@link picture}) or
 * implement this shape yourself for a custom rule.
 */
export interface Validator {
  /** Live per-keystroke gate: may this string exist mid-edit? Must accept partial input. */
  isValidInput(s: string): boolean;
  /** Blocking gate run on completion / focus-leave: is the finished value acceptable? */
  isValid(s: string): boolean;
  /**
   * Optional post-keystroke rewrite. After accepting a keystroke, `Input` calls this and stores the
   * returned string, letting a validator auto-insert formatting (e.g. `123` → `123-` for a
   * `###-##` mask) or apply case transforms (`abc` → `ABC`). Return `s` unchanged when nothing
   * applies. Only {@link picture} implements it; the other validators omit it. Never throws.
   */
  fill?(s: string): string;
  /** Optional message describing the invalid state, for you to surface to the user. */
  readonly error?: string;
}
