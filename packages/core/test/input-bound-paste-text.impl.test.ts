/**
 * Implementation hardening for direct-string paste bounds.
 *
 * These cases exercise validation and allocation edges behind the public contract. The immutable
 * Unicode and default-limit behavior lives in the corresponding specification suite.
 */
import { boundPasteText, PASTE_CAP_BYTES } from '../src/engine/input/index.js';
import { expect, test } from 'vitest';

test.each([-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN, PASTE_CAP_BYTES + 1, Number.MAX_SAFE_INTEGER])(
  'rejects invalid byte cap %s before allocating a buffer',
  (capBytes) => {
    expect(() => boundPasteText('clipboard', capBytes)).toThrow(RangeError);
  },
);

test('a zero-byte cap accepts empty text and truncates non-empty text', () => {
  expect(boundPasteText('', 0)).toEqual({ text: '', truncated: false });
  expect(boundPasteText('a', 0)).toEqual({ text: '', truncated: true });
  expect(boundPasteText('😀', 0)).toEqual({ text: '', truncated: true });
});

test('a small cap bounds a very large source without retaining an oversized result', () => {
  const source = `${'x'.repeat(4_000_000)}😀`;
  const result = boundPasteText(source, 7);

  expect(result).toEqual({ text: 'xxxxxxx', truncated: true });
  expect(new TextEncoder().encode(result.text)).toHaveLength(7);
});

test('a short value fits the default cap without changing its string identity', () => {
  const source = 'clipboard';

  expect(boundPasteText(source)).toEqual({ text: source, truncated: false });
});

test.each([
  { source: '\uD800a', capBytes: 3, expected: '\uD800' },
  { source: '\uDC00a', capBytes: 3, expected: '\uDC00' },
  { source: 'a\uD800b', capBytes: 4, expected: 'a\uD800' },
])('preserves an isolated surrogate at a truncation boundary', ({ source, capBytes, expected }) => {
  const result = boundPasteText(source, capBytes);

  expect(result).toEqual({ text: expected, truncated: true });
  expect(source.startsWith(result.text)).toBe(true);
  expect(new TextEncoder().encode(result.text).byteLength).toBeLessThanOrEqual(capBytes);
});

test('the result object is immutable by TypeScript contract and has no hidden payload fields', () => {
  const result = boundPasteText('abcdef', 3);

  expect(Object.keys(result).sort()).toEqual(['text', 'truncated']);
  expect(result).toEqual({ text: 'abc', truncated: true });
});
