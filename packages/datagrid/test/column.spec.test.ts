/**
 * Specification tests (immutable oracles) — the typed column model and the adapter that bridges it to
 * the `@jsvision/ui` grid engine. A `GridColumn<T, V>` carries a typed `value`; the engine renders and
 * sorts a string accessor. `toEngineColumn` builds the display string from `format(value)` (or
 * `String(value)`) and synthesizes a value-aware comparator, so a numeric column orders by its number,
 * never by the formatted text.
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import { sortRows } from '@jsvision/ui';
import { toEngineColumn } from '../src/column.js';

interface Person {
  name: string;
  balance: number;
}

// Currency formatting is locale-dependent; the spec asserts the formatted-vs-value distinction (a
// thousands separator appears, and ordering follows the number), not an exact glyph set.
const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

// ST-3 — no formatter => the accessor is String(value); with a formatter => it is format(value, row).
test('should build the display accessor from String(value) without a formatter and format() with one', () => {
  const bare = toEngineColumn<Person, number>({ id: 'b', title: 'B', value: (r) => r.balance });
  expect(bare.accessor({ name: 'x', balance: 1000 })).toBe('1000');

  const formatted = toEngineColumn<Person, number>({
    id: 'b',
    title: 'B',
    value: (r) => r.balance,
    format: (v) => eur.format(v),
  });
  const shown = formatted.accessor({ name: 'x', balance: 1000 });
  expect(shown).not.toBe('1000'); // it is formatted, not the raw number
  expect(shown).toContain('1.000'); // the nl-NL thousands separator proves formatting ran
});

// ST-4 — the synthesized comparator orders a numeric column by its VALUE, not the formatted string
// ("€ 1.000,00" < "€ 9,00" lexically would wrongly place 1000 first; the number wins).
test('should order a numeric column by value, not by the formatted display string', () => {
  const col = toEngineColumn<Person, number>({
    id: 'b',
    title: 'B',
    value: (r) => r.balance,
    format: (v) => eur.format(v),
  });
  const sorted = sortRows(
    [
      { name: 'a', balance: 1000 },
      { name: 'b', balance: 9 },
    ],
    [col],
    { col: 0, dir: 'asc' },
  );
  expect(sorted.map((r) => r.balance)).toEqual([9, 1000]);
});
