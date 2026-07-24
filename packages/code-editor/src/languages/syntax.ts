import type { SyntaxCategory, SyntaxSpan } from './contracts.js';
import { syntaxCategories } from './contracts.js';

/** Returns whether a parser-produced syntax span is safe for one document. */
export function isSyntaxSpan(value: SyntaxSpan, documentLength: number): boolean {
  return (
    Number.isSafeInteger(value.from) &&
    Number.isSafeInteger(value.to) &&
    value.from >= 0 &&
    value.from < value.to &&
    value.to <= documentLength &&
    syntaxCategories.includes(value.category)
  );
}

/**
 * Selects syntax intersecting a bounded viewport plus optional look-around.
 * @example `querySyntaxViewport(spans, 0, 80)`
 */
export function querySyntaxViewport(
  spans: readonly SyntaxSpan[],
  from: number,
  to: number,
  lookAround = 256,
): readonly SyntaxSpan[] {
  if (![from, to, lookAround].every(Number.isSafeInteger) || from < 0 || to < from || lookAround < 0) {
    throw new RangeError('Syntax viewport must contain ordered non-negative integer bounds.');
  }
  const lower = Math.max(0, from - lookAround);
  const upper = Math.min(Number.MAX_SAFE_INTEGER, to + lookAround);
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((spans[middle]?.to ?? 0) <= lower) low = middle + 1;
    else high = middle;
  }
  const visible: SyntaxSpan[] = [];
  for (let index = low; index < spans.length; index += 1) {
    const span = spans[index];
    if (span === undefined || span.from >= upper) break;
    visible.push(span);
  }
  return visible;
}

/** Narrows an untrusted category string to the stable public vocabulary. */
export function isSyntaxCategory(value: string): value is SyntaxCategory {
  return syntaxCategories.includes(value as SyntaxCategory);
}
