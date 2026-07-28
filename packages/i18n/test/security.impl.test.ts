import { describe, expect, test } from 'vitest';
import { I18nError } from '../src/errors.js';
import { plural, select } from '../src/messages.js';
import { createI18n } from '../src/service.js';
import { defineCatalog } from '../src/validation.js';

describe('public object boundaries', () => {
  test('should reject a catalog proxy failure as a typed error', () => {
    const input = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('hostile trap');
        },
      },
    );

    expect(() => defineCatalog(input)).toThrow(I18nError);
  });

  test('should reject construction accessors without invoking them', () => {
    let reads = 0;
    const options = Object.defineProperty({}, 'locale', {
      enumerable: true,
      get() {
        reads += 1;
        return 'en';
      },
    });

    expect(() => Reflect.apply(createI18n, undefined, [options])).toThrow(I18nError);
    expect(reads).toBe(0);
  });

  test('should reject translation-option accessors without invoking them', () => {
    let reads = 0;
    const options = Object.defineProperty({}, 'params', {
      enumerable: true,
      get() {
        reads += 1;
        return { name: 'secret' };
      },
    });
    const i18n = createI18n();

    expect(() => Reflect.apply(i18n.t, i18n, ['app.missing', options])).toThrow(I18nError);
    expect(reads).toBe(0);
  });

  test('should never coerce an object interpolation parameter', () => {
    let coercions = 0;
    const hostile = {
      [Symbol.toPrimitive]() {
        coercions += 1;
        return 'secret';
      },
      toString() {
        coercions += 1;
        return 'secret';
      },
      valueOf() {
        coercions += 1;
        return 1;
      },
    };
    const i18n = createI18n({
      catalogs: [
        {
          schema: 1,
          locale: 'en',
          messages: { 'app.greeting': 'Hello ${name}' },
        },
      ],
    });

    expect(Reflect.apply(i18n.t, i18n, ['app.greeting', { params: { name: hostile } }])).toBe('Hello ${name}');
    expect(coercions).toBe(0);
  });
});

describe('structured authoring boundaries', () => {
  test.each([plural, select])('should reject accessor cases without invoking them', (helper) => {
    let reads = 0;
    const cases = Object.defineProperty({ other: 'other' }, 'one', {
      enumerable: true,
      get() {
        reads += 1;
        return 'one';
      },
    });

    expect(() => Reflect.apply(helper, undefined, ['count', cases])).toThrow(I18nError);
    expect(reads).toBe(0);
  });

  test.each([plural, select])('should reject missing other and invalid controller names', (helper) => {
    expect(() => Reflect.apply(helper, undefined, ['bad-name', { other: 'other' }])).toThrow(I18nError);
    expect(() => Reflect.apply(helper, undefined, ['count', { one: 'one' }])).toThrow(I18nError);
  });
});
