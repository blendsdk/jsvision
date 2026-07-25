import { describe, expect, test } from 'vitest';
import { createCatalogSnapshot, mergeCatalogs, replaceCatalogOverlay } from '../src/catalog.js';

describe('catalog merging', () => {
  test('should merge later messages by locale while preserving first locale order', () => {
    const merged = mergeCatalogs([
      {
        schema: 1,
        locale: 'en',
        messages: { 'app.first': 'first', 'app.shared': 'old' },
      },
      {
        schema: 1,
        locale: 'nl',
        messages: { 'app.first': 'eerste' },
      },
      {
        schema: 1,
        locale: 'en',
        messages: { 'app.shared': 'new' },
      },
    ]);

    expect(merged.map((catalog) => catalog.locale)).toEqual(['en', 'nl']);
    expect(merged[0]?.messages).toEqual({
      'app.first': 'first',
      'app.shared': 'new',
    });
  });

  test('should return independent frozen copies', () => {
    const messages = { 'app.title': 'Original' };
    const merged = mergeCatalogs([{ schema: 1, locale: 'en', messages }]);
    messages['app.title'] = 'Changed';

    expect(merged[0]?.messages['app.title']).toBe('Original');
    expect(Object.isFrozen(merged)).toBe(true);
    expect(Object.isFrozen(merged[0]?.messages)).toBe(true);
  });

  test('should return an empty immutable collection for no catalogs', () => {
    const merged = mergeCatalogs([]);

    expect(merged).toEqual([]);
    expect(Object.isFrozen(merged)).toBe(true);
  });
});

describe('compiled catalog snapshots', () => {
  test('should preserve ordered layers and sort available locales', () => {
    const snapshot = createCatalogSnapshot([
      {
        catalog: {
          schema: 1,
          locale: 'nl',
          messages: { 'app.title': 'base' },
        },
        source: 'framework',
      },
      {
        catalog: {
          schema: 1,
          locale: 'en',
          messages: { 'app.title': 'English' },
        },
      },
      {
        catalog: {
          schema: 1,
          locale: 'nl',
          messages: { 'app.title': 'override' },
        },
        source: 'application',
      },
    ]);

    expect(snapshot.availableLocales).toEqual(['en', 'nl']);
    expect(snapshot.locales.get('nl')?.map((layer) => layer.source)).toEqual(['framework', 'application']);
  });

  test('should replace only the previous runtime layer and leave the old snapshot unchanged', () => {
    const initial = createCatalogSnapshot([
      {
        catalog: {
          schema: 1,
          locale: 'en',
          messages: { 'app.base': 'base' },
        },
      },
    ]);
    const first = replaceCatalogOverlay(initial, {
      schema: 1,
      locale: 'en',
      messages: { 'app.runtime': 'first' },
    });
    const second = replaceCatalogOverlay(first, {
      schema: 1,
      locale: 'en',
      messages: { 'app.runtime': 'second' },
    });

    expect(initial.locales.get('en')).toHaveLength(1);
    expect(first.locales.get('en')).toHaveLength(2);
    expect(second.locales.get('en')).toHaveLength(2);
    expect(second.locales.get('en')?.map((layer) => layer.kind)).toEqual(['base', 'runtime']);
  });

  test('should reject an invalid replacement without changing the active snapshot', () => {
    const initial = createCatalogSnapshot([]);

    expect(() =>
      replaceCatalogOverlay(initial, {
        schema: 1,
        locale: 'en',
        messages: { Invalid: 'bad' },
      }),
    ).toThrow();
    expect(initial.availableLocales).toEqual([]);
  });

  test('should omit unsafe source identifiers from compiled layers', () => {
    const snapshot = createCatalogSnapshot([
      {
        catalog: {
          schema: 1,
          locale: 'en',
          messages: { 'app.title': 'Title' },
        },
        source: 'unsafe\u001B',
      },
    ]);

    expect(snapshot.locales.get('en')?.[0]?.source).toBeUndefined();
  });
});
