import { describe, expect, test } from 'vitest';
import { I18nError } from '../src/errors.js';
import { compileMessage, compileTemplate, evaluateMessage, isSafeText, plural, select } from '../src/messages.js';

function evaluate(
  message: Parameters<typeof evaluateMessage>[0],
  params?: unknown,
): { readonly output: string; readonly codes: readonly string[] } {
  const codes: string[] = [];
  const output = evaluateMessage(message, {
    locale: 'en',
    params,
    pluralRules: new Intl.PluralRules('en'),
    formatNumber: (value) => new Intl.NumberFormat('en').format(value),
    report: (code) => codes.push(code),
  });
  return { output, codes };
}

describe('message text safety', () => {
  test.each([
    ['NUL', '\u0000'],
    ['carriage return', '\r'],
    ['tab', '\t'],
    ['escape', '\u001B'],
    ['delete', '\u007F'],
    ['C1 control', '\u009B'],
    ['bidi override', '\u202E'],
    ['bidi isolate', '\u2066'],
    ['lone high surrogate', '\uD800'],
    ['lone low surrogate', '\uDC00'],
  ])('should reject %s', (_label, value) => {
    expect(isSafeText(value)).toBe(false);
  });

  test('should allow line feeds and well-formed supplementary Unicode', () => {
    expect(isSafeText('first\nsecond 😀')).toBe(true);
  });
});

describe('placeholder compilation', () => {
  test('should compile substitutions and escaped placeholders once', () => {
    const compiled = compileTemplate('Hi ${name}; $${name}');

    expect(compiled.tokens).toEqual([
      { kind: 'literal', value: 'Hi ' },
      { kind: 'parameter', name: 'name' },
      { kind: 'literal', value: '; ${name}' },
    ]);
    expect(Object.isFrozen(compiled.tokens)).toBe(true);
  });

  test.each(['${}', '${bad-name}', '${missing'])('should reject malformed placeholder %s', (value) => {
    expect(() => compileTemplate(value)).toThrow(I18nError);
  });
});

describe('safe message evaluation', () => {
  test('should not invoke inherited properties or accessor parameters', () => {
    let reads = 0;
    const params = Object.create({ inherited: 'secret' });
    Object.defineProperty(params, 'name', {
      enumerable: true,
      get() {
        reads += 1;
        return 'secret';
      },
    });

    expect(evaluate(compileMessage('${name} ${inherited}'), params)).toEqual({
      output: '${name} ${inherited}',
      codes: ['MISSING_PARAMETER', 'MISSING_PARAMETER'],
    });
    expect(reads).toBe(0);
  });

  test('should keep an invalid plural controller unresolved with one diagnostic', () => {
    const message = compileMessage(plural('count', { one: '${count}:one', other: '${count}:other' }));

    expect(evaluate(message, { count: '1' })).toEqual({
      output: '${count}:other',
      codes: ['INVALID_CONTROLLER'],
    });
  });

  test.each([
    ['alpha', 'alpha'],
    [42, '42'],
    [true, 'true'],
    [9007199254740993n, '9007199254740993'],
  ])('should match select controller %s exactly', (controller, expectedCase) => {
    const message = compileMessage(
      select('choice', {
        alpha: 'alpha',
        '42': '42',
        true: 'true',
        '9007199254740993': '9007199254740993',
        other: 'other',
      }),
    );

    expect(evaluate(message, { choice: controller }).output).toBe(expectedCase);
  });
});

describe('authoring helpers', () => {
  test('should copy and freeze structured message cases', () => {
    const cases = { one: 'one', other: 'other' };
    const message = plural('count', cases);
    cases.one = 'changed';

    expect(message).toEqual({
      kind: 'plural',
      parameter: 'count',
      cases: { one: 'one', other: 'other' },
    });
    expect(Object.isFrozen(message.cases)).toBe(true);
  });
});
