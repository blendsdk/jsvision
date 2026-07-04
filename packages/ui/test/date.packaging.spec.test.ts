/**
 * Specification test (immutable oracle) — jsvision-ui RD-20 date-family packaging (ST-15).
 *
 * Source: RD-20 AC-15 → ST-15 (plans/date-family/03-04-theme-packaging.md §Packaging, PA-6). The
 * `date/` subsystem lives under `src/` with explicit named re-exports from `src/index.ts` (imported
 * here BY NAME from `@jsvision/ui`, the published surface), every `date/` source file is ≤ 500 lines,
 * and the package declares zero native runtime dependencies (mirrors `feedback.packaging.spec`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { signal } from '@jsvision/ui';
import {
  Calendar,
  DatePicker,
  daysInMonth,
  dayOfWeek,
  addMonths,
  addDays,
  compare,
  toISO,
  parseISO,
  fromDate,
  toDate,
} from '@jsvision/ui';
import type { CalendarDate, CalendarOptions, DatePickerOptions, DateFormat } from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ST-15 / AC-15 — Calendar/DatePicker + the CalendarDate helpers re-export from @jsvision/ui.
test('ST-15: Calendar/DatePicker + the CalendarDate helpers re-export from @jsvision/ui', () => {
  expect(typeof Calendar).toBe('function');
  expect(typeof DatePicker).toBe('function');
  for (const fn of [daysInMonth, dayOfWeek, addMonths, addDays, compare, toISO, parseISO, fromDate, toDate]) {
    expect(typeof fn).toBe('function');
  }
  // The types resolve (the type-only imports compile ⇒ re-exported) and drive real construction.
  const d: CalendarDate = { year: 2026, month: 9, day: 3 };
  const value = signal<CalendarDate | null>(d);
  const calOpts: CalendarOptions = { value, today: d, showWeekNumbers: true };
  expect(new Calendar(calOpts)).toBeInstanceOf(Calendar);
  const fmt: DateFormat = 'DD/MM/YYYY';
  const dpOpts: DatePickerOptions = { value, format: fmt };
  expect(new DatePicker(dpOpts)).toBeInstanceOf(DatePicker);
  expect(toISO(d)).toBe('2026-09-03');
});

// ST-15 — every file in src/date/ is ≤ 500 lines (architecture boundary, PA-6).
test('ST-15: each src/date/ source file is ≤ 500 lines', () => {
  const dir = join(here, '..', 'src', 'date');
  for (const file of tsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});

// ST-15 / AC-15 — the package declares no third-party/native runtime dependency (check:deps clean).
test('ST-15: @jsvision/ui declares only the workspace @jsvision/core runtime dependency', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@jsvision/core']);
});
