import type { CardKey } from '../contract/identity.js';

/** One decoded Unicode scalar or lone surrogate and its UTF-16 width. */
interface StringOrderUnit {
  readonly value: number;
  readonly width: 1 | 2;
}

/** Reads one Unicode code point while retaining lone surrogates as numeric code units. */
function stringOrderUnit(value: string, index: number): StringOrderUnit {
  const first = value.charCodeAt(index);
  if (first >= 0xd800 && first <= 0xdbff && index + 1 < value.length) {
    const second = value.charCodeAt(index + 1);
    if (second >= 0xdc00 && second <= 0xdfff) {
      return { value: (first - 0xd800) * 0x400 + second - 0xdc00 + 0x10000, width: 2 };
    }
  }
  return { value: first, width: 1 };
}

/** Compares strings lexicographically by Unicode code point, including deterministic lone surrogates. */
function compareCodePointStrings(left: string, right: string): -1 | 0 | 1 {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftUnit = stringOrderUnit(left, leftIndex);
    const rightUnit = stringOrderUnit(right, rightIndex);
    if (leftUnit.value < rightUnit.value) return -1;
    if (leftUnit.value > rightUnit.value) return 1;
    leftIndex += leftUnit.width;
    rightIndex += rightUnit.width;
  }
  if (leftIndex < left.length) return 1;
  if (rightIndex < right.length) return -1;
  return 0;
}

/**
 * Compares validated card keys using Kanban's cross-source deterministic total order.
 *
 * Safe integers sort numerically before every string. Strings sort by Unicode code point, while an
 * unpaired surrogate retains its numeric UTF-16 code-unit value. Number `1` and string `'1'` therefore
 * remain distinct and consistently ordered in eager, remote, and windowed adapters.
 *
 * @example
 * ```ts
 * ["2", 10, 2, "1"].sort(compareKanbanCardKeys); // [2, 10, "1", "2"]
 * ```
 */
export function compareKanbanCardKeys(left: CardKey, right: CardKey): -1 | 0 | 1 {
  if (typeof left === 'number') {
    if (typeof right === 'string') return -1;
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
  if (typeof right === 'number') return 1;
  return compareCodePointStrings(left, right);
}
