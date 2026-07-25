import { describe, expect, test } from 'vitest';
import { parseStrictJson } from '../src/node/strict-json.js';

describe('strict JSON grammar', () => {
  test('returns null-prototype records and inert special member names', () => {
    const parsed = parseStrictJson('{"__proto__":{"polluted":true},"constructor":"data"}');

    if (typeof parsed !== 'object' || parsed === null) {
      throw new TypeError('The object fixture did not produce an object.');
    }
    expect(Object.getPrototypeOf(parsed)).toBeNull();
    expect(Reflect.get(parsed, '__proto__')).toEqual({ polluted: true });
    expect(Reflect.get(parsed, 'constructor')).toBe('data');
    expect(Reflect.get({}, 'polluted')).toBeUndefined();
  });

  test.each(['{"value":1,"value":2}', '{"nested":{"value":1,"value":2}}', '{"array":[{"value":1,"value":2}]}'])(
    'rejects duplicate members at every object depth',
    (input) => {
      expect(() => parseStrictJson(input)).toThrowError(expect.objectContaining({ code: 'INVALID_JSON' }));
    },
  );

  test.each([
    '',
    ' ',
    'true false',
    '{"value":1,}',
    '[1,]',
    '{"value":01}',
    '{"value":1.}',
    '{"value":.1}',
    '{"value":1e}',
    '{"value":1e9999}',
    '{"value":NaN}',
    '{"value":"\\x"}',
    '{"value":"line\nbreak"}',
    '\uFEFF{}',
    '{}\u00A0',
  ])('rejects malformed or extended JSON grammar', (input) => {
    expect(() => parseStrictJson(input)).toThrowError(expect.objectContaining({ code: 'INVALID_JSON' }));
  });

  test('accepts every JSON primitive and the four JSON whitespace characters', () => {
    expect(parseStrictJson(' \t\r\n[null,true,false,-12.5e+2,"text"] \n')).toEqual([null, true, false, -1250, 'text']);
  });
});

describe('strict JSON Unicode handling', () => {
  test('joins valid escaped and literal surrogate pairs', () => {
    expect(parseStrictJson('["\\uD83D\\uDE00","😀"]')).toEqual(['😀', '😀']);
  });

  test.each(['"\\uD800"', '"\\uDC00"', '"\\uD800\\u0041"', '"\uD800"', '"\uDC00"'])(
    'rejects an unpaired surrogate',
    (input) => {
      expect(() => parseStrictJson(input)).toThrowError(expect.objectContaining({ code: 'INVALID_JSON' }));
    },
  );
});

describe('strict JSON parser resource bounds', () => {
  test('enforces nesting, token, and decoded-string limits', () => {
    expect(() => parseStrictJson('[[[]]]', { maxDepth: 2 })).toThrowError(
      expect.objectContaining({ code: 'INVALID_JSON' }),
    );
    expect(() => parseStrictJson('[1,2,3]', { maxTokens: 3 })).toThrowError(
      expect.objectContaining({ code: 'INVALID_JSON' }),
    );
    expect(() => parseStrictJson('["ab","cd"]', { maxStringScalars: 3 })).toThrowError(
      expect.objectContaining({ code: 'INVALID_JSON' }),
    );
  });

  test('rejects invalid or attempted-raised parser limits', () => {
    expect(() => parseStrictJson('{}', { maxDepth: 0 })).toThrowError(
      expect.objectContaining({ code: 'INVALID_JSON' }),
    );
    expect(() => parseStrictJson('{}', { maxDepth: 65 })).toThrowError(
      expect.objectContaining({ code: 'INVALID_JSON' }),
    );
    expect(() => parseStrictJson('{}', { maxTokens: Number.NaN })).toThrowError(
      expect.objectContaining({ code: 'INVALID_JSON' }),
    );
  });
});
