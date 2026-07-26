import { describe, expect, test, vi } from 'vitest';
import { I18nError } from '../src/errors.js';
import { createI18n } from '../src/service.js';

describe('service construction and lookup', () => {
  test('should expose immutable defaults for an empty service', () => {
    const i18n = createI18n();

    expect(i18n.locale).toBe('en');
    expect(i18n.fallbackLocales).toEqual(['en']);
    expect(i18n.availableLocales).toEqual([]);
    expect(Object.isFrozen(i18n.fallbackLocales)).toBe(true);
    expect(Object.isFrozen(i18n.availableLocales)).toBe(true);
  });

  test('should resolve locale before layer and newest layer within the locale', () => {
    const i18n = createI18n({
      locale: 'nl-BE',
      catalogs: [
        { schema: 1, locale: 'nl', messages: { 'app.title': 'oud' } },
        { schema: 1, locale: 'en', messages: { 'app.title': 'English override' } },
        { schema: 1, locale: 'nl', messages: { 'app.title': 'nieuw' } },
      ],
    });

    expect(i18n.t('app.title')).toBe('nieuw');
    expect(i18n.has('app.title')).toBe(true);
    expect(i18n.has('app.title', 'de')).toBe(true);
  });

  test('should leave inherited parameters unresolved', () => {
    const params = Object.create({ name: 'Inherited' });
    const i18n = createI18n({
      catalogs: [
        {
          schema: 1,
          locale: 'en',
          messages: { 'app.greeting': 'Hello ${name}' },
        },
      ],
    });

    expect(i18n.t('app.greeting', { params })).toBe('Hello ${name}');
  });
});

describe('formatting boundaries', () => {
  test('should use intrinsic Date state without invoking an override', () => {
    let calls = 0;
    const date = new Date(Date.UTC(2025, 0, 2));
    date.getTime = () => {
      calls += 1;
      return Number.NaN;
    };
    const i18n = createI18n({ locale: 'en' });

    expect(i18n.date(date, { timeZone: 'UTC' })).toBe(
      new Intl.DateTimeFormat('en', { timeZone: 'UTC' }).format(Date.UTC(2025, 0, 2)),
    );
    expect(calls).toBe(0);
  });

  test.each([
    ['invalid number', () => createI18n().number(Number.NaN), 'INVALID_NUMBER'],
    ['invalid date', () => createI18n().date(new Date(Number.NaN)), 'INVALID_DATE'],
    ['unsafe comparison', () => createI18n().compare('safe', '\u001Bunsafe'), 'UNSAFE_TEXT'],
  ])('should reject %s with a stable code', (_label, action, code) => {
    expect(action).toThrowError(expect.objectContaining({ code }));
  });
});

describe('runtime publication and diagnostics', () => {
  test('should replace the runtime layer and keep base layers available', () => {
    const i18n = createI18n({
      catalogs: [
        {
          schema: 1,
          locale: 'en',
          messages: { 'app.base': 'base', 'app.runtime': 'base runtime' },
        },
      ],
    });

    i18n.setCatalog({
      schema: 1,
      locale: 'en',
      messages: { 'app.runtime': 'first', 'app.removed': 'removed' },
    });
    i18n.setCatalog({
      schema: 1,
      locale: 'en',
      messages: { 'app.runtime': 'second' },
    });

    expect(i18n.t('app.runtime')).toBe('second');
    expect(i18n.t('app.base')).toBe('base');
    expect(i18n.t('app.removed')).toBe('app.removed');
  });

  test('should leave the active snapshot unchanged when replacement validation fails', () => {
    const i18n = createI18n();
    i18n.setCatalog({
      schema: 1,
      locale: 'en',
      messages: { 'app.runtime': 'active' },
    });

    expect(() =>
      i18n.setCatalog({
        schema: 1,
        locale: 'en',
        messages: { Invalid: 'bad' },
      }),
    ).toThrow(I18nError);
    expect(i18n.t('app.runtime')).toBe('active');
  });

  test('should isolate a throwing diagnostic sink', () => {
    const sink = vi.fn(() => {
      throw new Error('observer');
    });
    const i18n = createI18n({ diagnosticSink: sink });

    expect(i18n.t('app.missing')).toBe('app.missing');
    expect(sink).toHaveBeenCalledTimes(1);
    expect(i18n.diagnostics).toHaveLength(1);
  });
});
