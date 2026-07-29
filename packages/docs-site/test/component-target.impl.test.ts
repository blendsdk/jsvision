/**
 * Edge and rejection coverage for the shared component-target parser.
 */
import { describe, expect, test } from 'vitest';
import { parseComponentTarget } from '../src/api/component-target.mjs';

describe('parseComponentTarget', () => {
  test.each([
    '',
    '/guide/button',
    '/components/../guide',
    '/components/button?mode=raw',
    '/components/button#Bad Fragment',
    '/components/button#one#two',
    '/components/%2e%2e/guide',
    String.raw`/components\button`,
  ])('rejects malformed or non-canonical target %j', (target) => {
    expect(() => parseComponentTarget(target)).toThrow(TypeError);
  });

  test('returns a frozen result that cannot drift between consumers', () => {
    expect(Object.isFrozen(parseComponentTarget('/components/controls/button'))).toBe(true);
  });
});
