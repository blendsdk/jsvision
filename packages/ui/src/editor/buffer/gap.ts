/**
 * The editor's text store: a movable-gap buffer over UTF-16 code units. Edits cluster at a "gap"
 * that tracks the cursor, so repeated typing/deleting at one spot is cheap.
 *
 * Implemented as a string pair split at the gap — `before` (text left of the gap) + `after` (text
 * right of it). Editing at the gap is O(1)-amortized; moving the gap to a new position is
 * O(distance). Content loaded at construction sits entirely in `after`, so the gap starts at the
 * front of the buffer.
 *
 * All positions are logical UTF-16 code-unit offsets in `[0, length]`. Every accessor is
 * bounds-checked and never throws on out-of-range or hostile input.
 */

/**
 * The minimal read surface the navigation functions need. A plain `string` satisfies it natively,
 * so the pure navigation helpers can run against a raw string or a live {@link GapBuffer} alike.
 */
export interface BufText {
  /** Logical length in UTF-16 code units. */
  readonly length: number;
  /** The single code unit at `p`, or `''` out of range (bounds-checked, never throws). */
  charAt(p: number): string;
  /** The text in `[from, to)`, clamped into range (gap-invisible two-half copy). */
  slice(from: number, to: number): string;
}

/** A movable-gap text buffer over UTF-16 code units, backed by a pair of strings. */
export class GapBuffer implements BufText {
  /** Text left of the gap. */
  private before = '';
  /** Text right of the gap. */
  private after: string;

  /**
   * @param text Initial content. Stored verbatim — mixed line endings are preserved and round-trip
   *   byte-identical. Placed entirely after the gap, so the gap starts at the front of the buffer.
   */
  constructor(text?: string) {
    this.after = text ?? '';
  }

  /** Logical length in UTF-16 code units. */
  get length(): number {
    return this.before.length + this.after.length;
  }

  /** The code unit at logical `p`, or `''` when `p` is out of range (never throws). */
  charAt(p: number): string {
    if (!Number.isFinite(p) || p < 0 || p >= this.length) return '';
    return p < this.before.length ? this.before[p] : this.after[p - this.before.length];
  }

  /** The text in `[from, to)`, clamped and gap-aware (the two-half copy). */
  slice(from: number, to: number): string {
    const len = this.length;
    const f = Math.min(Math.max(clampInt(from), 0), len);
    const t = Math.min(Math.max(clampInt(to), 0), len);
    if (t <= f) return '';
    const bl = this.before.length;
    if (t <= bl) return this.before.slice(f, t);
    if (f >= bl) return this.after.slice(f - bl, t - bl);
    return this.before.slice(f) + this.after.slice(0, t - bl);
  }

  /** Move the gap to logical `p`; O(distance from the current gap). */
  moveGap(p: number): void {
    const len = this.length;
    const target = Math.min(Math.max(clampInt(p), 0), len);
    const bl = this.before.length;
    if (target < bl) {
      this.after = this.before.slice(target) + this.after;
      this.before = this.before.slice(0, target);
    } else if (target > bl) {
      this.before += this.after.slice(0, target - bl);
      this.after = this.after.slice(target - bl);
    }
  }

  /**
   * Insert `text` at logical `p` (clamped).
   *
   * @returns The inserted length in code units.
   */
  insert(p: number, text: string): number {
    this.moveGap(p);
    this.before += text;
    return text.length;
  }

  /** Remove the text in `[from, to)` (clamped; reversed bounds are normalized). */
  remove(from: number, to: number): void {
    const len = this.length;
    let f = Math.min(Math.max(clampInt(from), 0), len);
    let t = Math.min(Math.max(clampInt(to), 0), len);
    if (t < f) [f, t] = [t, f];
    if (t === f) return;
    this.moveGap(f);
    this.after = this.after.slice(t - f);
  }

  /** The full content, gap-invisible. */
  text(): string {
    return this.before + this.after;
  }
}

/** Truncate to an integer; non-finite input (NaN/±Infinity handled by callers' min/max) → 0 for NaN. */
function clampInt(n: number): number {
  const t = Math.trunc(n);
  return Number.isNaN(t) ? 0 : t;
}
