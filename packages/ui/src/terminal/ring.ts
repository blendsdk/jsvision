/**
 * A fixed-capacity ring of text lines that keeps only the most recent output.
 *
 * The capacity is measured in UTF-16 code units, not lines: a completed line
 * costs `length + 1` (it counts its trailing `\n`), and an unterminated tail
 * costs `length`. When a write would overflow the cap, the oldest **whole** lines
 * are dropped until it fits — the head is never left as a partial line. A single
 * write longer than the whole buffer keeps only its last `capacity − 1` code
 * units. `\n` completes a line.
 *
 * This is the storage behind {@link Terminal}; most callers use `Terminal`
 * directly rather than a `LineRing`.
 */

/** Default capacity in UTF-16 code units. */
const DEFAULT_CAPACITY = 32000;

/** A capacity-capped ring of text lines that evicts the oldest whole lines to stay under its cap. */
export class LineRing {
  private readonly capacity: number;
  private lines: string[] = [];
  /** Whether the LAST entry is an unterminated tail (no `\n` yet). */
  private open = false;
  /** Stored code units (completed lines count their `\n`). */
  private total = 0;

  /**
   * @param capacity Code-unit cap (default 32000; values < 1 clamp to 1 — degenerate but defined).
   */
  constructor(capacity?: number) {
    this.capacity = Math.max(1, Math.trunc(capacity ?? DEFAULT_CAPACITY) || 1);
  }

  /** Append `text`; evict whole oldest lines to fit; tail-trim an oversized single write. */
  write(text: string): void {
    let t = text;
    if (t === '') return;
    // A single write bigger than the whole buffer can't fit — keep only its most recent tail.
    if (t.length > this.capacity) t = t.slice(-(this.capacity - 1));
    while (this.lines.length > 0 && this.total + t.length > this.capacity) this.evictFirst();

    const segs = t.split('\n');
    for (let i = 0; i < segs.length; i++) {
      if (i > 0) {
        this.open = false; // the \n completed the previous entry
        this.total += 1;
      }
      const seg = segs[i];
      if (seg === '' && i > 0 && i === segs.length - 1) continue; // a trailing \n opens no tail
      if (this.open) {
        this.lines[this.lines.length - 1] += seg;
      } else {
        this.lines.push(seg);
        this.open = true;
      }
      this.total += seg.length;
    }
    if (t.endsWith('\n')) this.open = false;
  }

  /** `write(text + '\n')`. */
  writeLine(text: string): void {
    this.write(`${text}\n`);
  }

  /** The stored line count. */
  lineCount(): number {
    return this.lines.length;
  }

  /** The 0-based line `i`, or `''` out of range. */
  line(i: number): string {
    return this.lines[i] ?? '';
  }

  /** Drop everything. */
  clear(): void {
    this.lines = [];
    this.open = false;
    this.total = 0;
  }

  /** Evict the OLDEST line whole. */
  private evictFirst(): void {
    const first = this.lines.shift();
    if (first === undefined) return;
    const wasOpenTail = this.lines.length === 0 && this.open;
    this.total -= first.length + (wasOpenTail ? 0 : 1);
    if (this.lines.length === 0) {
      this.open = false;
      this.total = 0;
    }
  }
}
