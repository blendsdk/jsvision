/** Shared typed row used by the focused Data Grid documentation laboratories. */
export interface DataGridLabRow {
  /** Stable identity retained through transformations and mutations. */
  id: string;
  /** Human-readable record label. */
  name: string;
  /** Group used by filtering, rendering, and detail examples. */
  region: 'North' | 'South' | 'East' | 'West';
  /** Typed numeric value used by editing, sorting, validation, and aggregation examples. */
  amount: number;
  /** Boolean lifecycle value used by editor and conditional-rendering examples. */
  active: boolean;
  /** Nullable ratio used to demonstrate typed percentage and null presentation. */
  ratio?: number | null;
  /** Rating used by the custom-editor demonstration. */
  rating?: number;
  /** Civil date text edited by the built-in date editor. */
  due?: string;
  /** Stable lookup key edited by the built-in lookup editor. */
  ownerId?: string;
}

/** Deterministic small data set copied for each independently resettable laboratory. */
export const DATA_GRID_LAB_ROWS: readonly DataGridLabRow[] = Object.freeze([
  {
    id: 'r1',
    name: 'Alice',
    region: 'North',
    amount: 240,
    active: true,
    ratio: 0.125,
    rating: 2,
    due: '2026-08-01',
    ownerId: 'ada',
  },
  {
    id: 'r2',
    name: 'Bram',
    region: 'West',
    amount: 80,
    active: false,
    ratio: null,
    rating: 3,
    due: '2026-08-02',
    ownerId: 'bo',
  },
  {
    id: 'r3',
    name: 'Chandra',
    region: 'East',
    amount: 460,
    active: true,
    ratio: 0.2,
    rating: 1,
    due: '2026-08-03',
    ownerId: 'cy',
  },
  {
    id: 'r4',
    name: 'Alina',
    region: 'South',
    amount: 125,
    active: true,
    ratio: 0.15,
    rating: 2,
    due: '2026-08-04',
    ownerId: 'ada',
  },
  {
    id: 'r5',
    name: 'Diego',
    region: 'West',
    amount: 310,
    active: false,
    ratio: null,
    rating: 3,
    due: '2026-08-05',
    ownerId: 'bo',
  },
  {
    id: 'r6',
    name: 'Esi',
    region: 'East',
    amount: 195,
    active: true,
    ratio: 0.1,
    rating: 1,
    due: '2026-08-06',
    ownerId: 'cy',
  },
]);

/** Return mutable row copies so one live lab can never leak edits into another. */
export function createDataGridLabRows(): DataGridLabRow[] {
  return DATA_GRID_LAB_ROWS.map((row) => ({ ...row }));
}
