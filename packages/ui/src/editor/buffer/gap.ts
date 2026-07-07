/**
 * `GapBuffer` — the RD-08 editor text store, a faithful port of TV's gap buffer cost model over
 * UTF-16 code units (AR-250).
 *
 * TV keeps one raw byte array with a movable gap at the cursor: `bufPtr(P) = P < curPtr ? P :
 * P + gapLen` (`edits.cpp:26-29`), moves the gap by `memmove` in `setCurPtr`/`setSelect`
 * (`teditor2.cpp:459-539`), and loads file text at the buffer END so the gap starts at the front
 * (`teditor2.cpp:423-442`, `tfiledtr.cpp:126-132`). The idiomatic JS equivalent is a string PAIR
 * split at the gap — `before` (text left of the gap) + `after` (text right of it) — where
 * `bufPtr` becomes the half-selection rule and `moveGap` a substring shuffle. Same complexity
 * class as TV: O(1)-amortized edits at the gap, O(distance) gap moves. (A `Uint16Array` backing
 * is the deferred DEF-3 future.)
 *
 * All positions are LOGICAL UTF-16 code-unit offsets in `[0, length]`; every accessor is
 * bounds-checked and never throws (RD §Security / RD-13 HR-01).
 */

/**
 * The minimal read surface the pure navigation functions need (03-01; `slice` per PF-007 so
 * cluster segmentation gets line-bounded text). Plain strings satisfy it natively, so spec
 * oracles can run on either.
 */
export interface BufText {
  /** Logical length in UTF-16 code units. */
  readonly length: number;
  /** The single code unit at `p`, or `''` out of range (bounds-checked, never throws). */
  charAt(p: number): string;
  /** The text in `[from, to)`, clamped into range (gap-invisible two-half copy). */
  slice(from: number, to: number): string;
}

/** A movable-gap text buffer over UTF-16 code units (the TV `bufPtr` model made two strings). */
export class GapBuffer implements BufText {
  /** Text left of the gap (TV: `buffer[0..curPtr)`). */
  private before = '';
  /** Text right of the gap (TV: `buffer[curPtr+gapLen..bufSize)`). */
  private after: string;

  /**
   * @param text Initial content — loaded "at the buffer end" (gap at the front), the TV
   *   `loadFile` shape (`tfiledtr.cpp:126-132`); stored VERBATIM (mixed EOLs preserved, PF-008).
   */
  constructor(text?: string) {
    this.after = text ?? '';
  }

  /** Logical length in UTF-16 code units (`bufLen`). */
  get length(): number {
    return this.before.length + this.after.length;
  }

  /** The code unit at logical `p`, or `''` out of range — the bounds-checked `bufChar` (`edits.cpp:21-24`). */
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

  /** Move the gap to logical `p` (the `memmove` analogue, `teditor2.cpp:459-539`); O(distance). */
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
