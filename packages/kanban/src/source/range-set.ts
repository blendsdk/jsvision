import { KanbanInvalidRangeError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';

/** One validated half-open logical card range. */
export interface KanbanRange {
  /** First included logical index. */
  readonly start: number;
  /** First excluded logical index. */
  readonly end: number;
}

/** Validates one maximum range span against the package hard ceiling. */
function validateMaximumSpan(maximumSpan: number): number {
  if (!Number.isSafeInteger(maximumSpan) || maximumSpan < 0 || maximumSpan > KANBAN_LIMITS.ensureRangeCards.absolute) {
    throw new KanbanInvalidRangeError();
  }
  return maximumSpan;
}

/**
 * Validates and freezes one half-open range before application source code is called.
 *
 * Empty ranges are valid no-ops. Arithmetic stays within non-negative safe integers.
 */
export function snapshotKanbanRange(
  start: number,
  end: number,
  maximumSpan = KANBAN_LIMITS.ensureRangeCards.safe,
): KanbanRange {
  const boundedMaximum = validateMaximumSpan(maximumSpan);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    end - start > boundedMaximum
  ) {
    throw new KanbanInvalidRangeError();
  }
  return Object.freeze({ start, end });
}

/**
 * Maintains sorted, disjoint half-open ranges while coalescing overlaps and adjacency.
 *
 * The set is intentionally finite and stores intervals rather than one entry per logical card.
 */
export class KanbanRangeSet {
  readonly #ranges: KanbanRange[] = [];

  /** Adds one already-bounded range and merges every overlap or adjacent interval. */
  add(range: KanbanRange): void {
    if (range.start === range.end) return;
    let start = range.start;
    let end = range.end;
    let insertion = 0;
    while (insertion < this.#ranges.length && this.#ranges[insertion]!.end < start) insertion += 1;
    let removalEnd = insertion;
    while (removalEnd < this.#ranges.length && this.#ranges[removalEnd]!.start <= end) {
      const current = this.#ranges[removalEnd]!;
      start = Math.min(start, current.start);
      end = Math.max(end, current.end);
      removalEnd += 1;
    }
    this.#ranges.splice(insertion, removalEnd - insertion, Object.freeze({ start, end }));
  }

  /** Adds every range then returns the normalized detached snapshot. */
  addAll(ranges: readonly KanbanRange[]): readonly KanbanRange[] {
    for (const range of ranges) this.add(range);
    return this.values();
  }

  /** Returns true when the set fully covers one range. */
  covers(range: KanbanRange): boolean {
    if (range.start === range.end) return true;
    return this.#ranges.some((candidate) => candidate.start <= range.start && candidate.end >= range.end);
  }

  /** Returns uncovered pieces of one range without expanding it into individual indices. */
  subtract(range: KanbanRange): readonly KanbanRange[] {
    if (range.start === range.end) return Object.freeze([]);
    const result: KanbanRange[] = [];
    let cursor = range.start;
    for (const covered of this.#ranges) {
      if (covered.end <= cursor) continue;
      if (covered.start >= range.end) break;
      if (covered.start > cursor)
        result.push(Object.freeze({ start: cursor, end: Math.min(covered.start, range.end) }));
      cursor = Math.max(cursor, covered.end);
      if (cursor >= range.end) break;
    }
    if (cursor < range.end) result.push(Object.freeze({ start: cursor, end: range.end }));
    return Object.freeze(result);
  }

  /** Returns a frozen detached snapshot in ascending order. */
  values(): readonly KanbanRange[] {
    return Object.freeze(this.#ranges.map((range) => Object.freeze({ ...range })));
  }

  /** Releases every retained interval. */
  clear(): void {
    this.#ranges.length = 0;
  }
}
