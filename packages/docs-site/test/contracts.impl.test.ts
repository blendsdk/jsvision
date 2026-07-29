/** Runtime hardening tests for behavior contracts loaded from plain JavaScript modules. */
import { describe, expect, test } from 'vitest';
import { validateBehaviorContract } from './contracts/_contract.js';

/** Invoke the public validator with an untrusted runtime shape without weakening static test types. */
function validateUnknownContract(contract: unknown): void {
  Reflect.apply(validateBehaviorContract, undefined, [contract]);
}

/** Create the smallest valid contract and replace one action or expectation for a negative case. */
function contractFixture(overrides: {
  readonly action?: unknown;
  readonly expectation?: unknown;
}): Record<string, unknown> {
  return {
    exampleId: 'fixture/example',
    capabilities: ['interaction'],
    cases: [
      {
        id: 'interaction',
        covers: ['interaction'],
        initial: [overrides.expectation ?? { probe: 'rendered-text', operator: 'contains', value: 'Ready' }],
        actions: [overrides.action ?? { kind: 'key', key: 'enter', modifiers: [] }],
        expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Done' }],
        reset: 'rebuild-example',
        dispose: 'after-case',
      },
    ],
  };
}

describe('behavior expectation validation', () => {
  test.each([
    [{ probe: '', operator: 'equals', value: true }, /probe must be non-empty/],
    [{ probe: 'state', operator: 'equals', value: { invalid: true } }, /observable primitive/],
    [{ probe: 'text', operator: 'contains', value: 1 }, /requires a string value/],
    [{ probe: 'count', operator: 'greater-than', value: '1' }, /requires a finite number value/],
    [{ probe: 'count', operator: 'unknown', value: 1 }, /unknown probe operator/],
  ])('rejects an incompatible probe expectation', (expectation, message) => {
    expect(() => validateUnknownContract(contractFixture({ expectation }))).toThrow(message);
  });
});

describe('behavior action validation', () => {
  test.each([
    [{ kind: 'key', key: 'enter', modifiers: ['Meta'] }, /unknown modifier/],
    [{ kind: 'mouse', gesture: 'drag', at: { x: 1, y: 1 }, button: 'left', to: { x: -1, y: 2 } }, /destination/],
    [{ kind: 'mouse', gesture: 'click', at: { x: 1, y: 1 }, delta: 1 }, /inapplicable field/],
    [{ kind: 'mouse', gesture: 'wheel', at: { x: 1, y: 1 }, delta: 0 }, /non-zero integer/],
    [{ kind: 'mouse', gesture: 'hover', at: { x: 1, y: 1 } }, /unknown mouse gesture/],
  ])('rejects an invalid action variant', (action, message) => {
    expect(() => validateUnknownContract(contractFixture({ action }))).toThrow(message);
  });
});
