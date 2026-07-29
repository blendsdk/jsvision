import { alt, dataGridContract, gridCase, key } from './_shared.js';

/** Overview contract: the flagship visibly distinguishes display and editing grids. */
export const QUICK_START_CONTRACT = dataGridContract(
  'data-grid/quick-start',
  ['read-only-grid', 'editable-grid', 'visible-choice'],
  [
    gridCase(
      'switch-grid-kind',
      ['read-only-grid', 'editable-grid', 'visible-choice'],
      [{ probe: 'grid-kind', operator: 'equals', value: 'DataGrid' }],
      [alt('g')],
      [
        { probe: 'grid-kind', operator: 'equals', value: 'EditableDataGrid' },
        { probe: 'editing-state', operator: 'equals', value: 'ready' },
      ],
    ),
  ],
);

/** Source contract: deterministic source modes expose loading/count/read behavior. */
export const DATA_SOURCES_CONTRACT = dataGridContract(
  'data-grid/data-sources',
  ['in-memory-source', 'reactive-source', 'windowed-source', 'loading-counts'],
  [
    gridCase(
      'switch-reactive-source',
      ['in-memory-source', 'reactive-source'],
      [{ probe: 'row-count', operator: 'equals', value: 6 }],
      [alt('r')],
      [{ probe: 'row-count', operator: 'equals', value: 7 }],
    ),
    gridCase(
      'switch-windowed-source',
      ['windowed-source', 'loading-counts'],
      [{ probe: 'lifecycle-state', operator: 'equals', value: 'ready' }],
      [alt('w')],
      [
        { probe: 'lifecycle-state', operator: 'equals', value: 'windowed' },
        { probe: 'source-read-count', operator: 'greater-than', value: 0 },
      ],
    ),
  ],
);

/** Typed-column contract: format, parse, and null behavior are independently visible. */
export const TYPED_COLUMNS_CONTRACT = dataGridContract(
  'data-grid/typed-columns',
  ['typed-values', 'formatting', 'parsing', 'null-policy'],
  [
    gridCase(
      'cycle-formatted-values',
      ['typed-values', 'formatting', 'null-policy'],
      [{ probe: 'cell-text', operator: 'contains', value: '€1,250.50' }],
      [alt('n')],
      [{ probe: 'cell-text', operator: 'contains', value: '—' }],
    ),
    gridCase(
      'parse-edited-value',
      ['parsing'],
      [{ probe: 'cell-text', operator: 'contains', value: '12.5%' }],
      [alt('p')],
      [{ probe: 'status-text', operator: 'contains', value: 'parsed 0.2' }],
    ),
  ],
);

/** Layout contract: reorder, resize, freeze, and visibility preserve stable geometry. */
export const LAYOUT_FREEZING_CONTRACT = dataGridContract(
  'data-grid/layout-freezing',
  ['resize-column', 'reorder-column', 'freeze-column', 'show-hide-column'],
  [
    gridCase(
      'reorder-and-freeze',
      ['reorder-column', 'freeze-column'],
      [{ probe: 'column-order', operator: 'equals', value: 'name,region,amount' }],
      [alt('o'), alt('f')],
      [
        { probe: 'column-order', operator: 'equals', value: 'region,name,amount' },
        { probe: 'frozen-columns', operator: 'contains', value: 'region' },
      ],
    ),
    gridCase(
      'resize-and-hide',
      ['resize-column', 'show-hide-column'],
      [{ probe: 'dialog-width', operator: 'greater-than', value: 40 }],
      [alt('w'), alt('h')],
      [{ probe: 'column-order', operator: 'excludes', value: 'amount' }],
    ),
  ],
);

/** Rendering contract: alignment, formatting, styles, and custom rendering affect real cells. */
export const RENDERING_CONTRACT = dataGridContract(
  'data-grid/rendering',
  ['alignment', 'formatter', 'conditional-style', 'custom-renderer'],
  [
    gridCase(
      'cycle-rendering-mode',
      ['alignment', 'formatter', 'conditional-style', 'custom-renderer'],
      [{ probe: 'cell-text', operator: 'contains', value: '1,250' }],
      [alt('r')],
      [
        { probe: 'cell-text', operator: 'contains', value: 'HIGH' },
        { probe: 'theme-role', operator: 'contains', value: 'danger' },
      ],
    ),
  ],
);

/** Sorting contract: single, multi, and value-aware priorities are observable. */
export const SORTING_CONTRACT = dataGridContract(
  'data-grid/sorting',
  ['single-sort', 'multi-sort', 'value-aware-sort', 'priority-feedback'],
  [
    gridCase(
      'single-sort',
      ['single-sort', 'value-aware-sort'],
      [{ probe: 'visible-row-keys', operator: 'equals', value: 'r1,r2,r3,r4' }],
      [key('enter')],
      [{ probe: 'visible-row-keys', operator: 'equals', value: 'r2,r4,r3,r1' }],
    ),
    gridCase(
      'add-sort-priority',
      ['multi-sort', 'priority-feedback'],
      [{ probe: 'sort-state', operator: 'contains', value: 'name:asc' }],
      [key('enter'), key('tab'), key('enter')],
      [{ probe: 'sort-state', operator: 'contains', value: 'name:asc,amount:asc' }],
    ),
  ],
);

/** Quick-filter contract: typed column queries update visible rows immediately. */
export const QUICK_FILTER_CONTRACT = dataGridContract(
  'data-grid/quick-filter',
  ['per-column-filter', 'live-filtering'],
  [
    gridCase(
      'filter-name-column',
      ['per-column-filter', 'live-filtering'],
      [{ probe: 'row-count', operator: 'equals', value: 6 }],
      [{ kind: 'paste', text: 'al' }],
      [
        { probe: 'filter-state', operator: 'contains', value: 'name=al' },
        { probe: 'visible-row-keys', operator: 'equals', value: 'r1,r4' },
      ],
    ),
  ],
);

/** Advanced-filter contract: condition/value-list filters disclose N-of-M results. */
export const ADVANCED_FILTER_CONTRACT = dataGridContract(
  'data-grid/advanced-filter',
  ['condition-filter', 'value-list-filter', 'n-of-m-disclosure'],
  [
    gridCase(
      'apply-condition',
      ['condition-filter'],
      [{ probe: 'filter-state', operator: 'equals', value: 'none' }],
      [alt('c')],
      [{ probe: 'filter-state', operator: 'contains', value: 'amount>100' }],
    ),
    gridCase(
      'apply-value-list',
      ['value-list-filter', 'n-of-m-disclosure'],
      [{ probe: 'row-count', operator: 'equals', value: 6 }],
      [alt('l'), key('space'), key('enter')],
      [
        { probe: 'visible-row-keys', operator: 'equals', value: 'r1,r3,r6' },
        { probe: 'status-text', operator: 'contains', value: '3 of 6' },
      ],
    ),
  ],
);

/** Foundation and transformation contracts in teaching order. */
export const FOUNDATION_DATA_GRID_CONTRACTS = [
  QUICK_START_CONTRACT,
  DATA_SOURCES_CONTRACT,
  TYPED_COLUMNS_CONTRACT,
  LAYOUT_FREEZING_CONTRACT,
  RENDERING_CONTRACT,
  SORTING_CONTRACT,
  QUICK_FILTER_CONTRACT,
  ADVANCED_FILTER_CONTRACT,
] as const;
