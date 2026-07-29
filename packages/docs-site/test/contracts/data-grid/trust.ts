import { alt, dataGridContract, gridCase, key } from './_shared.js';

/** Footer contract: aggregates, sticky state, and partial-data honesty stay visible. */
export const AGGREGATES_CONTRACT = dataGridContract(
  'data-grid/aggregates',
  ['aggregate-values', 'footer-widgets', 'sticky-footer', 'partial-data-honesty'],
  [
    gridCase(
      'toggle-footer-mode',
      ['aggregate-values', 'footer-widgets', 'sticky-footer'],
      [{ probe: 'footer-text', operator: 'contains', value: 'Total 600' }],
      [alt('f')],
      [{ probe: 'footer-text', operator: 'contains', value: 'Average 200 · sticky' }],
    ),
    gridCase(
      'disclose-partial-data',
      ['partial-data-honesty'],
      [{ probe: 'footer-text', operator: 'excludes', value: 'partial' }],
      [alt('p')],
      [{ probe: 'footer-text', operator: 'contains', value: 'visible window · partial' }],
    ),
  ],
);

/** Master-detail contract: detail state follows the master's stable focused key. */
export const MASTER_DETAIL_CONTRACT = dataGridContract(
  'data-grid/master-detail',
  ['master-focus', 'detail-binding', 'stable-detail-key'],
  [
    gridCase(
      'move-master-focus',
      ['master-focus', 'detail-binding', 'stable-detail-key'],
      [{ probe: 'detail-key', operator: 'equals', value: 'customer-1' }],
      [key('arrowdown')],
      [{ probe: 'detail-key', operator: 'equals', value: 'customer-2' }],
    ),
  ],
);

/** Windowed contract: a 100k-row source serves bounded slices without full-array reads. */
export const WINDOWED_CONTRACT = dataGridContract(
  'data-grid/windowed',
  ['virtual-scroll', 'bounded-window-read', 'no-full-array-access'],
  [
    gridCase(
      'scroll-windowed-source',
      ['virtual-scroll', 'bounded-window-read', 'no-full-array-access'],
      [
        { probe: 'row-count', operator: 'equals', value: 100000 },
        { probe: 'source-full-array-read', operator: 'equals', value: false },
      ],
      [{ kind: 'mouse', gesture: 'wheel', at: { x: 30, y: 12 }, delta: 8 }],
      [
        { probe: 'source-read-count', operator: 'greater-than', value: 1 },
        { probe: 'source-full-array-read', operator: 'equals', value: false },
      ],
    ),
  ],
);

/** Large-memory contract: the bounded in-memory tier states its supported limit. */
export const LARGE_MEMORY_CONTRACT = dataGridContract(
  'data-grid/large-memory',
  ['large-in-memory', 'bounded-fixture', 'tier-boundary'],
  [
    gridCase(
      'switch-large-tier',
      ['large-in-memory', 'bounded-fixture', 'tier-boundary'],
      [{ probe: 'row-count', operator: 'equals', value: 1000 }],
      [alt('l')],
      [
        { probe: 'row-count', operator: 'equals', value: 10000 },
        { probe: 'performance-note', operator: 'contains', value: 'use windowed above this tier' },
      ],
    ),
  ],
);

/** Export contract: every format visibly escapes formula, markup, quote, and delimiter input. */
export const EXPORT_CONTRACT = dataGridContract(
  'data-grid/export',
  ['csv-export', 'tsv-export', 'html-export', 'json-export', 'safe-escaping'],
  [
    gridCase(
      'export-delimited',
      ['csv-export', 'tsv-export', 'safe-escaping'],
      [{ probe: 'export-text', operator: 'equals', value: '' }],
      [alt('c'), alt('t')],
      [
        { probe: 'export-text', operator: 'contains', value: "'=SUM(A1:A2)" },
        { probe: 'export-text', operator: 'contains', value: '\"comma,value\"' },
      ],
    ),
    gridCase(
      'export-structured',
      ['html-export', 'json-export'],
      [{ probe: 'export-text', operator: 'equals', value: '' }],
      [alt('h'), alt('j')],
      [
        { probe: 'export-text', operator: 'contains', value: '&lt;script&gt;' },
        { probe: 'export-text', operator: 'contains', value: '\\\"quoted\\\"' },
      ],
    ),
  ],
);

/** Personalization contract: saved variants and Cancel/OK modal semantics are distinct. */
export const VARIANTS_PERSONALIZATION_CONTRACT = dataGridContract(
  'data-grid/variants-personalization',
  ['save-variant', 'apply-variant', 'personalize-cancel', 'personalize-ok'],
  [
    gridCase(
      'save-and-apply-variant',
      ['save-variant', 'apply-variant'],
      [{ probe: 'variant-name', operator: 'equals', value: 'Default' }],
      [alt('s'), alt('a')],
      [{ probe: 'variant-name', operator: 'equals', value: 'Compact' }],
    ),
    gridCase(
      'cancel-and-accept-personalization',
      ['personalize-cancel', 'personalize-ok'],
      [{ probe: 'personalize-state', operator: 'equals', value: 'closed' }],
      [alt('p'), key('escape'), alt('p'), key('enter')],
      [{ probe: 'personalize-state', operator: 'equals', value: 'applied' }],
    ),
  ],
);

/** Cross-cutting contract: roles, contrast, focus, and keyboard guidance remain inspectable. */
export const THEMING_ACCESSIBILITY_CONTRACT = dataGridContract(
  'data-grid/theming-accessibility',
  ['theme-roles', 'focus-contrast', 'selection-contrast', 'error-contrast', 'keyboard-discoverability'],
  [
    gridCase(
      'cycle-accessible-state',
      ['theme-roles', 'focus-contrast', 'selection-contrast', 'error-contrast'],
      [{ probe: 'theme-role', operator: 'contains', value: 'gridCell' }],
      [alt('s'), alt('e')],
      [{ probe: 'theme-role', operator: 'contains', value: 'gridError' }],
    ),
    gridCase(
      'show-keyboard-help',
      ['keyboard-discoverability'],
      [{ probe: 'status-text', operator: 'excludes', value: 'Arrow keys' }],
      [alt('k')],
      [{ probe: 'status-text', operator: 'contains', value: 'Arrow keys · Space · Enter · Tab' }],
    ),
  ],
);

/** Performance contract: lazy/windowed behavior and honest boundaries are visible without timing claims. */
export const PERFORMANCE_BOUNDARIES_CONTRACT = dataGridContract(
  'data-grid/performance-boundaries',
  ['lazy-construction', 'bounded-rendering', 'windowed-guidance', 'no-benchmark-theater'],
  [
    gridCase(
      'inspect-bounded-work',
      ['lazy-construction', 'bounded-rendering', 'windowed-guidance', 'no-benchmark-theater'],
      [{ probe: 'source-read-count', operator: 'greater-than', value: 0 }],
      [{ kind: 'mouse', gesture: 'wheel', at: { x: 28, y: 12 }, delta: 4 }],
      [
        { probe: 'source-read-count', operator: 'less-than', value: 20 },
        { probe: 'performance-note', operator: 'contains', value: 'measure in your workload' },
      ],
    ),
  ],
);

/** Aggregation, scale, export, and cross-cutting trust contracts in teaching order. */
export const TRUST_DATA_GRID_CONTRACTS = [
  AGGREGATES_CONTRACT,
  MASTER_DETAIL_CONTRACT,
  WINDOWED_CONTRACT,
  LARGE_MEMORY_CONTRACT,
  EXPORT_CONTRACT,
  VARIANTS_PERSONALIZATION_CONTRACT,
  THEMING_ACCESSIBILITY_CONTRACT,
  PERFORMANCE_BOUNDARIES_CONTRACT,
] as const;
