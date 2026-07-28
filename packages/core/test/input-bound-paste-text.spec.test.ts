/**
 * Specification tests for the public UTF-8 paste-text boundary.
 *
 * The boundary preserves exact text while it fits and otherwise returns the longest safe prefix
 * that fits the byte cap. These tests exercise only valid custom caps; cap validation is a separate
 * contract.
 */
import { expect, test } from 'vitest';

import type { BoundedPasteText as CoreBoundedPasteText } from '../src/engine/index.js';
import type { BoundedPasteText as InputBoundedPasteText } from '../src/engine/input/index.js';

interface PlannedBoundedPasteText {
  readonly text: string;
  readonly truncated: boolean;
}

type BoundPasteTextFunction = (text: string, capBytes?: number) => PlannedBoundedPasteText;

interface PlannedInputApi {
  readonly PASTE_CAP_BYTES: number;
  readonly boundPasteText: BoundPasteTextFunction;
}

interface PlannedCoreApi {
  readonly PASTE_CAP_BYTES: number;
  readonly boundPasteText: BoundPasteTextFunction;
}

const utf8 = new TextEncoder();

function isBoundPasteTextFunction(value: unknown): value is BoundPasteTextFunction {
  return typeof value === 'function';
}

async function loadPublicApis(): Promise<{
  readonly input: PlannedInputApi;
  readonly core: PlannedCoreApi;
}> {
  const [inputModule, coreModule] = await Promise.all([
    import('../src/engine/input/index.js'),
    import('../src/engine/index.js'),
  ]);
  const inputBound: unknown = Reflect.get(inputModule, 'boundPasteText');
  const coreBound: unknown = Reflect.get(coreModule, 'boundPasteText');
  if (!isBoundPasteTextFunction(inputBound)) {
    throw new TypeError('the public input barrel must export boundPasteText');
  }
  if (!isBoundPasteTextFunction(coreBound)) {
    throw new TypeError('the public core barrel must export boundPasteText');
  }
  return {
    input: {
      PASTE_CAP_BYTES: inputModule.PASTE_CAP_BYTES,
      boundPasteText: inputBound,
    },
    core: {
      PASTE_CAP_BYTES: coreModule.PASTE_CAP_BYTES,
      boundPasteText: coreBound,
    },
  };
}

function byteLength(text: string): number {
  return utf8.encode(text).byteLength;
}

function expectSafeOverflow(
  result: PlannedBoundedPasteText,
  source: string,
  capBytes: number,
  expectedText: string,
): void {
  expect(result).toEqual({ text: expectedText, truncated: true });
  expect(source.startsWith(result.text)).toBe(true);
  expect(byteLength(result.text)).toBeLessThanOrEqual(capBytes);
  expect(result.text).not.toContain('\uFFFD');
}

// Both public core barrels expose the same paste bound, result shape, and one-megabyte default.
test('the input and core barrels expose the paste-text boundary as public API', async () => {
  const { input, core } = await loadPublicApis();

  expect(input.PASTE_CAP_BYTES).toBe(1_048_576);
  expect(core.PASTE_CAP_BYTES).toBe(1_048_576);
  expect(input.boundPasteText).toBeTypeOf('function');
  expect(core.boundPasteText).toBe(input.boundPasteText);

  const plannedResult = input.boundPasteText('public', 6);
  const inputResult: InputBoundedPasteText = plannedResult;
  const coreResult: CoreBoundedPasteText = inputResult;
  expect(coreResult).toEqual({ text: 'public', truncated: false });
});

// Empty text fits every non-negative boundary exactly and is never reported as truncated.
test('empty text is returned exactly with an accurate non-truncated flag', async () => {
  const { input } = await loadPublicApis();

  expect(input.boundPasteText('', 0)).toEqual({ text: '', truncated: false });
  expect(input.boundPasteText('', 8)).toEqual({ text: '', truncated: false });
});

// ASCII at the byte cap is unchanged, while the first byte beyond it is removed as a prefix cut.
test('ASCII exact-fit and overflow preserve the exact safe prefix', async () => {
  const { input } = await loadPublicApis();

  expect(input.boundPasteText('abcd', 4)).toEqual({ text: 'abcd', truncated: false });
  expectSafeOverflow(input.boundPasteText('abcde', 4), 'abcde', 4, 'abcd');
});

// A two-byte scalar is either retained whole or omitted whole when it crosses the byte boundary.
test('a two-byte Unicode scalar is never split at the cap', async () => {
  const { input } = await loadPublicApis();

  expect(input.boundPasteText('éé', 4)).toEqual({ text: 'éé', truncated: false });
  expectSafeOverflow(input.boundPasteText('éé', 3), 'éé', 3, 'é');
  expectSafeOverflow(input.boundPasteText('é', 1), 'é', 1, '');
});

// A three-byte scalar is either retained whole or omitted whole when it crosses the byte boundary.
test('a three-byte Unicode scalar is never split at the cap', async () => {
  const { input } = await loadPublicApis();

  expect(input.boundPasteText('€€', 6)).toEqual({ text: '€€', truncated: false });
  expectSafeOverflow(input.boundPasteText('€€', 5), '€€', 5, '€');
  expectSafeOverflow(input.boundPasteText('€', 2), '€', 2, '');
});

// A four-byte supplementary scalar is never split into surrogate halves or replacement text.
test('a four-byte Unicode scalar is never split at the cap', async () => {
  const { input } = await loadPublicApis();

  expect(input.boundPasteText('😀😀', 8)).toEqual({ text: '😀😀', truncated: false });
  expectSafeOverflow(input.boundPasteText('😀😀', 7), '😀😀', 7, '😀');
  expectSafeOverflow(input.boundPasteText('😀', 3), '😀', 3, '');
});

// Combining marks and wide glyphs remain an exact source prefix across successive byte boundaries.
test('combining and wide Unicode text returns only valid source prefixes', async () => {
  const { input } = await loadPublicApis();
  const source = 'A\u0301界😀Z';

  expect(input.boundPasteText(source, 3)).toEqual({ text: 'A\u0301', truncated: true });
  expect(input.boundPasteText(source, 6)).toEqual({ text: 'A\u0301界', truncated: true });
  expectSafeOverflow(input.boundPasteText(source, 9), source, 9, 'A\u0301界');
  expect(input.boundPasteText(source, 11)).toEqual({ text: source, truncated: false });
});

// Omitting the custom cap applies the one-megabyte default and reports actual overflow accurately.
test('the default cap bounds an oversized paste to one megabyte', async () => {
  const { input } = await loadPublicApis();
  const source = `${'a'.repeat(input.PASTE_CAP_BYTES)}😀`;
  const result = input.boundPasteText(source);

  expect(result.truncated).toBe(true);
  expect(result.text).toBe('a'.repeat(input.PASTE_CAP_BYTES));
  expect(byteLength(result.text)).toBe(input.PASTE_CAP_BYTES);
  expect(source.startsWith(result.text)).toBe(true);
  expect(result.text).not.toContain('\uFFFD');
});
