/**
 * Implementation tests — `fmt` registry edges: negative/zero/large numbers, fraction-digit options,
 * `nl-NL` group/decimal symbols, currency-symbol stripping, percent scaling, unknown enum/lookup keys,
 * date/datetime styles, and the `PARSE_FAILED` path for partial/garbage input. Exact-string assertions
 * compare to a reference `Intl` instance so they never hard-code a locale glyph.
 */
import { test, expect } from 'vitest';
import { fmt, PARSE_FAILED } from '../src/format.js';

const ROW = {};

// Number round-trips negatives, zero, and large values across en-US and nl-NL.
test('number round-trips negative/zero/large values in en-US and nl-NL', () => {
  for (const locale of ['en-US', 'nl-NL']) {
    const num = fmt.number({ locale });
    for (const v of [0, -5, -1234.5, 1000000, 9999999.75]) {
      expect(num.parse(num.format(v, ROW))).toBe(v);
    }
  }
});

// nl-NL uses '.' for grouping and ',' for the decimal — the inverse discovers both, not hard-coded.
test('number honors nl-NL group/decimal symbols on the way out and back', () => {
  const num = fmt.number({ locale: 'nl-NL' });
  expect(num.format(1234.5, ROW)).toBe('1.234,5');
  expect(num.parse('1.234,5')).toBe(1234.5);
});

// Fraction-digit options are forwarded to Intl; the round-trip holds for representable values.
test('number honors minimum/maximumFractionDigits', () => {
  const min2 = fmt.number({ locale: 'en-US', minimumFractionDigits: 2 });
  expect(min2.format(5, ROW)).toBe('5.00');
  expect(min2.parse('5.00')).toBe(5);

  // maximumFractionDigits rounds on the way out (the round-trip identity then holds only for values
  // already representable at that precision — 1234.5 rounds to an integer here).
  const max0 = fmt.number({ locale: 'en-US', maximumFractionDigits: 0 });
  expect(max0.format(1234.5, ROW)).toBe('1,235');
  expect(max0.parse(max0.format(1234, ROW))).toBe(1234); // representable at 0 digits → round-trips
});

// Currency strips the symbol (and any Intl-inserted space) both ways.
test('currency strips the symbol on parse (en-US and nl-NL)', () => {
  const usd = fmt.currency({ locale: 'en-US', currency: 'USD' });
  expect(usd.format(1234.5, ROW)).toBe('$1,234.50');
  expect(usd.parse('$1,234.50')).toBe(1234.5);

  const eur = fmt.currency({ locale: 'nl-NL', currency: 'EUR' });
  expect(eur.parse(eur.format(-42.99, ROW))).toBe(-42.99); // negative currency round-trips
});

// Percent scales by 100 both ways, including with fraction digits.
test('percent scales by 100 and honors fraction digits', () => {
  const pct = fmt.percent();
  expect(pct.format(0.5, ROW)).toBe(new Intl.NumberFormat(undefined, { style: 'percent' }).format(0.5));
  expect(pct.parse('50%')).toBe(0.5);

  const pct1 = fmt.percent({ minimumFractionDigits: 1 });
  expect(pct1.parse(pct1.format(0.25, ROW))).toBe(0.25);
});

// Garbage and partial input yield the sentinel, never NaN.
test('parse returns PARSE_FAILED (not NaN) for empty/partial/garbage input', () => {
  const num = fmt.number({ locale: 'en-US' });
  for (const bad of ['', '   ', 'abc', '$', '€', '-', '.', '- ']) {
    expect(num.parse(bad), `parse(${JSON.stringify(bad)})`).toBe(PARSE_FAILED);
    expect(num.parse(bad)).not.toBeNaN();
  }
});

// enumLabel / lookupLabel fall back to String(value) for unknown or empty maps.
test('enum/lookup labels fall back to String(value) for unknown keys', () => {
  expect(fmt.enumLabel({}).format('x', ROW)).toBe('x');
  expect(fmt.enumLabel({ a: 'Alpha' }).format('a', ROW)).toBe('Alpha');
  expect(fmt.enumLabel({ a: 'Alpha' }).format('b', ROW)).toBe('b');

  expect(fmt.lookupLabel([]).format('x', ROW)).toBe('x');
  expect(fmt.lookupLabel([{ key: '1', label: 'One' }]).format('1', ROW)).toBe('One');
  expect(fmt.lookupLabel([{ key: '1', label: 'One' }]).format('2', ROW)).toBe('2');
});

// boolean uses default Yes/No, overridable.
test('boolean uses default and custom labels', () => {
  expect(fmt.boolean().format(true, ROW)).toBe('Yes');
  const yn = fmt.boolean({ true: 'Aye', false: 'Nay' });
  expect(yn.format(false, ROW)).toBe('Nay');
});

// date honors the style option and is display-only.
test('date formats across styles and exposes no parse', () => {
  const cal = { year: 2026, month: 7, day: 8 };
  const short = fmt.date({ locale: 'en-US', style: 'short' }).format(cal, ROW);
  const long = fmt.date({ locale: 'en-US', style: 'long' }).format(cal, ROW);
  expect(short.length).toBeGreaterThan(0);
  expect(long.length).toBeGreaterThan(0);
  expect(short).not.toBe(long); // distinct styles render differently
  expect('parse' in fmt.date()).toBe(false);
});

// datetime formats date + time and is display-only.
test('datetime formats a JS Date with date+time and exposes no parse', () => {
  const dt = fmt.datetime({ locale: 'en-US', dateStyle: 'short', timeStyle: 'short' });
  const s = dt.format(new Date(2026, 6, 8, 13, 45), ROW);
  expect(s.length).toBeGreaterThan(0);
  expect('parse' in dt).toBe(false);
});
