/** Edge-case and diagnostic coverage for the component catalog parser. */
import { describe, expect, test } from 'vitest';
import {
  createComponentCatalogIndexes,
  parseComponentCatalog,
  projectComponentNavigation,
  validateComponentCatalog,
} from '../src/components/component-catalog.mjs';

function component(id: string, symbol: string, order: number): Record<string, unknown> {
  return {
    kind: 'component',
    id,
    title: id,
    family: 'Controls',
    page: `/components/${id}`,
    related: [],
    sidebarOrder: order,
    package: 'ui',
    symbols: [symbol],
    complexity: 'standard',
    examples: [id],
    apiSymbols: [{ package: 'ui', symbol }],
    primary: true,
  };
}

function catalog(...entries: readonly Record<string, unknown>[]): Record<string, unknown> {
  return { schemaVersion: 1, entries };
}

describe('component catalog diagnostics', () => {
  test('reports malformed JSON before schema validation', () => {
    expect(() => parseComponentCatalog('{', 'fixtures/broken-components.json')).toThrow(
      /fixtures\/broken-components\.json: invalid JSON at \$/,
    );
  });

  test.each([
    ['unknown field', { ...component('button', 'Button', 1), status: 'stable' }, 'status'],
    ['unknown enum', { ...component('button', 'Button', 1), complexity: 'large' }, 'complexity'],
    ['bad anchor', { ...component('button', 'Button', 1), page: '/components/button#Bad Anchor' }, 'page'],
    ['mixed union', { ...component('button', 'Button', 1), hub: 'data-grid' }, 'hub'],
  ])('reports the path for %s', (_label, entry, expectedPath) => {
    expect(() => validateComponentCatalog(catalog(entry))).toThrow(expectedPath);
  });

  test('rejects duplicate IDs, symbol ownership, and sidebar order keys', () => {
    expect(() =>
      validateComponentCatalog(catalog(component('same', 'Button', 1), component('same', 'Input', 2))),
    ).toThrow('id');
    expect(() =>
      validateComponentCatalog(catalog(component('button', 'Button', 1), component('other', 'Button', 2))),
    ).toThrow('symbol ownership');
    expect(() =>
      validateComponentCatalog(catalog(component('button', 'Button', 1), component('input', 'Input', 1))),
    ).toThrow('sidebar ordering');
    expect(() =>
      validateComponentCatalog(
        catalog(component('button', 'Button', 1), { ...component('input', 'Input', 2), page: '/components/button' }),
      ),
    ).toThrow('projected routes');
    expect(() =>
      validateComponentCatalog(
        catalog(component('button', 'Button', 1), {
          kind: 'topic',
          id: 'data-grid/overview',
          title: 'Overview',
          family: 'Data Grid',
          page: '/components/button',
          related: [],
          sidebarOrder: 1,
          hub: 'data-grid',
          profile: 'landing',
          examples: ['data-grid/quick-start'],
        }),
      ),
    ).toThrow('projected routes');
  });

  test('rejects duplicate labels inside one projected navigation group', () => {
    expect(() =>
      validateComponentCatalog(
        catalog(component('button', 'Button', 1), { ...component('input', 'Input', 2), title: 'button' }),
      ),
    ).toThrow('navigation labels');
  });

  test('returns immutable entries, projections, and stable lookup indexes', () => {
    const parsed = validateComponentCatalog(catalog(component('input', 'Input', 2), component('button', 'Button', 1)));
    const navigation = projectComponentNavigation(parsed.entries);
    const indexes = createComponentCatalogIndexes(parsed.entries);

    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.entries)).toBe(true);
    expect(Object.isFrozen(navigation)).toBe(true);
    expect(navigation.components[0].items.map((item: { readonly id: string }) => item.id)).toEqual(['button', 'input']);
    expect(indexes.byId.get('button')).toBe(parsed.entries[1]);
    expect(indexes.symbolOwner.get('ui:Input')).toBe(parsed.entries[0]);
    expect('set' in indexes.byId).toBe(false);
    expect('delete' in indexes.symbolOwner).toBe(false);
  });

  test('keeps projection output stable across fixed adversarial entry orders', () => {
    const entries = [
      component('button', 'Button', 1),
      component('input', 'Input', 2),
      { ...component('text', 'Text', 3), family: 'Output' },
    ];
    const permutations = [entries, [...entries].reverse(), [entries[2]!, entries[0]!, entries[1]!]];
    const projections = permutations.map((items) =>
      projectComponentNavigation(validateComponentCatalog(catalog(...items)).entries),
    );
    expect(projections[1]).toEqual(projections[0]);
    expect(projections[2]).toEqual(projections[0]);
  });
});
