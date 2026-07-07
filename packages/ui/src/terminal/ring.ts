/**
 * `LineRing` — the TV terminal ring buffer's observable behavior over UTF-16 code units
 * (RD-08 03-05, AR-257/PF-007).
 *
 * Decode (`textview.cpp`, re-verified 2026-07-07 @ 57b6f56): `bufSize = min(32000, aBufSize)`
 * (`:66`); insertion evicts whole OLDEST lines until the write fits (`while(!canInsert(count))
 * queBack = nextLine(queBack)` `:212-217` — never a partial line at the head); a single write
 * longer than the buffer keeps only its LAST `bufSize − 1` units (the `do_sputn` tail-trim,
 * `:202-206` — PF-009 anchor); `\n` completes a line (`:208-210`). The raw byte queue +
 * `bufDec`/`bufInc` pointer arithmetic (`:79-100`) becomes an array of line strings + a running
 * code-unit total — the same observable semantics without byte math. Units are UTF-16 code units
 * (PF-007): each completed line costs `length + 1` (its `\n`), an open tail costs `length`.
 */

/** TV `bufSize` default (`textview.cpp:66`). */
const DEFAULT_CAPACITY = 32000;

/** A capacity-capped line ring with TV's whole-line eviction. */
export class LineRing {
  private readonly capacity: number;
  private lines: string[] = [];
  /** Whether the LAST entry is an unterminated tail (no `\n` yet). */
  private open = false;
  /** Stored code units (completed lines count their `\n`). */
  private total = 0;

  /**
   * @param capacity Code-unit cap (default 32000, AR-257; values < 1 clamp to 1 — degenerate but defined).
   */
  constructor(capacity?: number) {
    this.capacity = Math.max(1, Math.trunc(capacity ?? DEFAULT_CAPACITY) || 1);
  }

  /** Append `text`; evict whole oldest lines to fit; tail-trim an oversized single write. */
  write(text: string): void {
    let t = text;
    if (t === '') return;
    if (t.length > this.capacity) t = t.slice(-(this.capacity - 1)); // the do_sputn tail-trim
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

  /** Evict the OLDEST line whole (the `nextLine(queBack)` step). */
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
