/**
 * Columns & layout · Frozen rows — pin the first data rows as a non-scrolling band below the header (the
 * horizontal mirror of frozen columns). The scrolling body's window starts after the pinned rows, so a
 * pinned row never scrolls off or duplicates. The `.js` extension is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildLayoutStory } from './layout-demo.js';

interface Metric {
  id: number;
  label: string;
  q1: number;
  q2: number;
  q3: number;
}

// A pinned "Total" row on top, then per-region rows to scroll past it.
const ROWS: Metric[] = [
  { id: 0, label: 'TOTAL', q1: 1800, q2: 2100, q3: 2500 },
  { id: 1, label: 'East', q1: 500, q2: 600, q3: 700 },
  { id: 2, label: 'West', q1: 400, q2: 550, q3: 650 },
  { id: 3, label: 'North', q1: 300, q2: 450, q3: 600 },
  { id: 4, label: 'South', q1: 600, q2: 500, q3: 550 },
  { id: 5, label: 'Central', q1: 200, q2: 350, q3: 400 },
];

export const layoutFrozenRowsStory = buildLayoutStory<Metric>({
  slug: 'frozen-rows',
  title: 'Frozen rows',
  blurb: 'Pin the first rows as a non-scrolling band below the header; the body scrolls beneath them.',
  hint: "Scroll ↓ (↓ / PgDn) — the pinned 'TOTAL' row stays put below the header while the rest scroll",
  rows: ROWS,
  columns: [
    column<Metric, string>({ id: 'label', title: 'Region', value: (r) => r.label, width: 10 }),
    column<Metric, number>({ id: 'q1', title: 'Q1', value: (r) => r.q1, align: 'right', width: 7 }),
    column<Metric, number>({ id: 'q2', title: 'Q2', value: (r) => r.q2, align: 'right', width: 7 }),
    column<Metric, number>({ id: 'q3', title: 'Q3', value: (r) => r.q3, align: 'right', width: 7 }),
  ],
  options: { freezeRows: 1 },
  echo: () => () => 'freezeRows: 1 — the first row is pinned; the body window starts at row 2',
});
