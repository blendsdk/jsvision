/**
 * Specification tests (immutable oracles) — the `fmt` formatter registry. Each factory produces a
 * locale-aware display string; the three numeric kinds (number/currency/percent) also ship a matched
 * inverse `parse` that round-trips a valid display string back to its value and returns the
 * `PARSE_FAILED` sentinel (never `NaN`) for garbage. Date/datetime/boolean/enum/lookup are display-only.
 *
 * Expectations derive from the requirements + the real `Intl` behavior they name — never from imagined
 * implementation output. The currency/number strings are compared to a reference `Intl.NumberFormat`
 * so the oracle stays faithful to the platform's exact glyphs (e.g. the `nl-NL` currency separator is a
 * non-breaking space, not an ASCII space).
 */
import { test, expect } from 'vitest';
import { column, toEngineColumn } from '../src/column.js';
import { fmt, PARSE_FAILED } from '../src/format.js';

interface Balance {
  balance: number;
}

// A locale currency value formats per Intl; a column with no `format` shows String(value).
test('should format a currency value per Intl and show String(value) with no formatter', () => {
  const money = fmt.currency({ locale: 'nl-NL', currency: 'EUR' });
  const ref = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(10000.25);
  expect(money.format(10000.25, {})).toBe(ref); // "€ 10.000,25" — the separator is U+00A0
  expect(ref).toContain('10.000'); // grouped thousands (nl-NL group is '.')
  expect(ref).toContain(',25'); // decimal comma

  const plain = toEngineColumn(column<Balance, number>({ id: 'b', title: 'B', value: (r) => r.balance }));
  expect(plain.accessor({ balance: 10000.25 })).toBe('10000.25'); // no format → String(value)
});

// The currency inverse round-trips a valid string and rejects garbage with the sentinel.
test('should parse a currency string back to its number and return PARSE_FAILED on garbage', () => {
  const money = fmt.currency({ locale: 'nl-NL', currency: 'EUR' });
  expect(money.parse(money.format(10000.25, {}))).toBe(10000.25);
  expect(money.parse('abc')).toBe(PARSE_FAILED); // a sentinel, NOT NaN
  expect(money.parse('abc')).not.toBeNaN();
});

// The number inverse round-trips every value representable at the configured fraction-digits.
test('should round-trip number format→parse for representable values', () => {
  const num = fmt.number({ locale: 'en-US' });
  for (const v of [0, -5, 1234.5, 1000000]) {
    expect(num.parse(num.format(v, {}))).toBe(v);
  }
});

// Percent scales by 100 both ways: 0.25 shows as "25%", and its inverse returns 0.25.
test('should format a percent and parse it back with 100x scaling', () => {
  const pct = fmt.percent();
  const s = pct.format(0.25, {});
  expect(s).toBe(new Intl.NumberFormat(undefined, { style: 'percent' }).format(0.25)); // "25%" (host locale)
  expect(pct.parse(s)).toBe(0.25);
});

// An enum map resolves known keys to labels; an unknown key falls back to String(value).
test('should map enum values to labels and fall back to String for unknown keys', () => {
  const status = fmt.enumLabel({ open: 'Open', paid: 'Paid' });
  expect(status.format('paid', {})).toBe('Paid');
  expect(status.format('void', {})).toBe('void'); // unknown → String(value)
});

// Booleans map to default Yes/No labels, overridable per column.
test('should format booleans with default and custom labels', () => {
  expect(fmt.boolean().format(true, {})).toBe('Yes');
  expect(fmt.boolean().format(false, {})).toBe('No');
  const onoff = fmt.boolean({ true: 'On', false: 'Off' });
  expect(onoff.format(true, {})).toBe('On');
  expect(onoff.format(false, {})).toBe('Off');
});

// A lookup item list resolves a stored key to its label; an unknown key falls back to String(value).
test('should map lookup keys to labels and fall back to String for unknown keys', () => {
  const look = fmt.lookupLabel([{ key: '7', label: 'Ada' }]);
  expect(look.format('7', {})).toBe('Ada');
  expect(look.format('9', {})).toBe('9'); // unknown → String(value)
});

// Date and datetime are display-only: they format a non-empty locale string and expose no `parse`.
test('should format date and datetime as display-only (no parse property)', () => {
  const d = fmt.date({ locale: 'nl-NL' });
  const cal = { year: 2026, month: 7, day: 8 };
  expect(d.format(cal, {}).length).toBeGreaterThan(0);
  expect('parse' in d).toBe(false);

  const dt = fmt.datetime();
  expect(dt.format(new Date(2026, 6, 8, 13, 45), {}).length).toBeGreaterThan(0);
  expect('parse' in dt).toBe(false);
});

// The engine adapter orders a currency column by its numeric value, independent of the formatted text.
test('should order a currency column by numeric value, not formatted text', () => {
  const bal = column<Balance, number>({
    id: 'balance',
    title: 'Balance',
    value: (r) => r.balance,
    format: fmt.currency({ locale: 'nl-NL', currency: 'EUR' }).format,
  });
  const eng = toEngineColumn(bal);
  // 9 orders before 1000 by value, even though "€ 9,00" sorts after "€ 1.000,00" as text.
  expect(eng.compare!({ balance: 9 }, { balance: 1000 })).toBeLessThan(0);
});
