import { alt, dataGridContract, gridCase, key } from './_shared.js';

/** Selection/navigation contract: modes, cursor, gutter, and Tab traversal remain visible. */
export const SELECTION_NAVIGATION_CONTRACT = dataGridContract(
  'data-grid/selection-navigation',
  ['selection-modes', 'checkbox-gutter', 'cursor-navigation', 'tab-traversal'],
  [
    gridCase(
      'select-with-gutter',
      ['selection-modes', 'checkbox-gutter'],
      [{ probe: 'selected-row-keys', operator: 'equals', value: '' }],
      [key('space'), key('arrowdown'), key('space')],
      [{ probe: 'selected-row-keys', operator: 'equals', value: 'r1,r2' }],
    ),
    gridCase(
      'navigate-cells',
      ['cursor-navigation', 'tab-traversal'],
      [{ probe: 'cursor-cell', operator: 'equals', value: 'r1:name' }],
      [key('arrowright'), key('tab')],
      [{ probe: 'cursor-cell', operator: 'equals', value: 'r1:amount' }],
    ),
  ],
);

/** Row-mutation contract: stable keys survive insert, duplicate, and delete. */
export const ROW_MUTATIONS_CONTRACT = dataGridContract(
  'data-grid/row-mutations',
  ['insert-row', 'duplicate-row', 'delete-row', 'stable-row-keys'],
  [
    gridCase(
      'insert-and-duplicate',
      ['insert-row', 'duplicate-row', 'stable-row-keys'],
      [{ probe: 'visible-row-keys', operator: 'equals', value: 'r1,r2,r3' }],
      [alt('i'), alt('d')],
      [{ probe: 'visible-row-keys', operator: 'equals', value: 'r1,new-1,new-2,r2,r3' }],
    ),
    gridCase(
      'delete-focused-row',
      ['delete-row'],
      [{ probe: 'row-count', operator: 'equals', value: 3 }],
      [alt('x')],
      [{ probe: 'row-count', operator: 'equals', value: 2 }],
    ),
  ],
);

/** Editing contract: enter, commit, and cancel expose the editor overlay lifecycle. */
export const EDITING_LIFECYCLE_CONTRACT = dataGridContract(
  'data-grid/editing-lifecycle',
  ['enter-edit', 'commit-edit', 'cancel-edit', 'overlay-lifecycle'],
  [
    gridCase(
      'commit-edit',
      ['enter-edit', 'commit-edit', 'overlay-lifecycle'],
      [{ probe: 'editing-state', operator: 'equals', value: 'idle' }],
      [key('enter'), { kind: 'paste', text: 'Ada' }, key('enter')],
      [
        { probe: 'editing-state', operator: 'equals', value: 'idle' },
        { probe: 'cell-text', operator: 'contains', value: 'Ada' },
      ],
    ),
    gridCase(
      'cancel-edit',
      ['cancel-edit'],
      [{ probe: 'cell-text', operator: 'contains', value: 'Alice' }],
      [key('enter'), { kind: 'paste', text: 'Discarded' }, key('escape')],
      [{ probe: 'cell-text', operator: 'contains', value: 'Alice' }],
    ),
  ],
);

/** Built-in editor contract: each editor kind is reachable without unrelated state. */
export const EDITOR_TYPES_CONTRACT = dataGridContract(
  'data-grid/editor-types',
  ['text-editor', 'number-editor', 'boolean-editor', 'date-editor', 'enum-editor', 'lookup-editor'],
  [
    gridCase(
      'cycle-editor-kinds',
      ['text-editor', 'number-editor', 'boolean-editor'],
      [{ probe: 'editor-kind', operator: 'equals', value: 'text' }],
      [alt('e'), alt('e'), key('enter')],
      [
        { probe: 'editor-kind', operator: 'equals', value: 'boolean' },
        { probe: 'editing-state', operator: 'equals', value: 'editing' },
      ],
    ),
    gridCase(
      'cycle-structured-editors',
      ['date-editor', 'enum-editor', 'lookup-editor'],
      [{ probe: 'editor-kind', operator: 'equals', value: 'text' }],
      [alt('s'), alt('s'), alt('s'), key('enter')],
      [
        { probe: 'editor-kind', operator: 'equals', value: 'lookup' },
        { probe: 'editing-state', operator: 'equals', value: 'editing' },
      ],
    ),
  ],
);

/** Custom-editor contract: the public seam owns edit, commit, and cleanup. */
export const CUSTOM_EDITOR_CONTRACT = dataGridContract(
  'data-grid/custom-editor',
  ['custom-editor-seam', 'custom-commit', 'custom-cleanup'],
  [
    gridCase(
      'commit-custom-editor',
      ['custom-editor-seam', 'custom-commit', 'custom-cleanup'],
      [{ probe: 'editor-kind', operator: 'equals', value: 'rating' }],
      [key('enter'), key('arrowright'), key('enter')],
      [
        { probe: 'cell-text', operator: 'contains', value: '★★★' },
        { probe: 'editing-state', operator: 'equals', value: 'idle' },
      ],
    ),
  ],
);

/** Dirty-commit contract: dirty markers, veto, async commit, and feedback are observable. */
export const DIRTY_COMMIT_CONTRACT = dataGridContract(
  'data-grid/dirty-commit',
  ['dirty-marker', 'commit-veto', 'async-commit', 'commit-feedback'],
  [
    gridCase(
      'veto-dirty-value',
      ['dirty-marker', 'commit-veto'],
      [{ probe: 'dirty-cell-count', operator: 'equals', value: 0 }],
      [
        key('right'),
        key('right'),
        key('enter'),
        { kind: 'key', key: 'a', modifiers: ['Ctrl'] },
        { kind: 'paste', text: '-1' },
        key('enter'),
      ],
      [
        { probe: 'cell-text', operator: 'equals', value: '240' },
        { probe: 'status-text', operator: 'contains', value: 'vetoed' },
      ],
    ),
    gridCase(
      'commit-dirty-value',
      ['async-commit', 'commit-feedback'],
      [{ probe: 'dirty-cell-count', operator: 'equals', value: 0 }],
      [
        key('right'),
        key('right'),
        key('enter'),
        { kind: 'key', key: 'a', modifiers: ['Ctrl'] },
        { kind: 'paste', text: '12' },
        key('enter'),
      ],
      [
        { probe: 'dirty-cell-count', operator: 'equals', value: 0 },
        { probe: 'status-text', operator: 'contains', value: 'committed' },
      ],
    ),
  ],
);

/** Validation contract: cell, row, and before-save gates remain distinguishable. */
export const VALIDATION_CONTRACT = dataGridContract(
  'data-grid/validation',
  [
    'cell-validation',
    'row-validation',
    'before-save',
    'row-revert-trap',
    'row-revert-pending-settled',
    'row-revert-success',
    'row-revert-release',
    'row-revert-veto-retry',
  ],
  [
    gridCase(
      'reject-cell',
      ['cell-validation'],
      [{ probe: 'validation-status', operator: 'equals', value: 'valid' }],
      [
        key('right'),
        key('right'),
        key('enter'),
        { kind: 'key', key: 'a', modifiers: ['Ctrl'] },
        { kind: 'paste', text: '-3' },
        key('enter'),
      ],
      [{ probe: 'validation-status', operator: 'contains', value: 'Amount cannot be negative' }],
    ),
    gridCase(
      'run-save-gates',
      ['row-validation', 'before-save'],
      [{ probe: 'validation-status', operator: 'equals', value: 'valid' }],
      [
        key('enter'),
        { kind: 'key', key: 'a', modifiers: ['Ctrl'] },
        { kind: 'paste', text: 'Ada Lovelace' },
        key('enter'),
      ],
      [{ probe: 'validation-status', operator: 'contains', value: 'row accepted · save accepted' }],
    ),
    gridCase(
      'restore-trapped-row-and-release-navigation',
      ['row-validation', 'row-revert-trap', 'row-revert-pending-settled', 'row-revert-success', 'row-revert-release'],
      [
        { probe: 'validation-status', operator: 'equals', value: 'valid' },
        { probe: 'cell-text', operator: 'contains', value: 'Start 1 · End 9' },
        { probe: 'cursor-cell', operator: 'equals', value: 'r1:start' },
      ],
      [key('9'), key('tab'), key('arrowdown'), key('escape'), key('arrowdown')],
      [
        { probe: 'cell-text', operator: 'contains', value: 'Start 1 · End 9' },
        { probe: 'validation-status', operator: 'equals', value: 'valid' },
        { probe: 'cursor-cell', operator: 'equals', value: 'r2:end' },
        { probe: 'status-text', operator: 'contains', value: 'trapped → pending → restored · row released' },
      ],
    ),
    gridCase(
      'retain-trapped-row-after-veto-for-retry',
      ['row-revert-trap', 'row-revert-pending-settled', 'row-revert-veto-retry'],
      [
        { probe: 'validation-status', operator: 'equals', value: 'valid' },
        { probe: 'cursor-cell', operator: 'equals', value: 'r1:start' },
      ],
      [alt('v'), key('9'), key('tab'), key('arrowdown'), key('escape')],
      [
        { probe: 'cell-text', operator: 'contains', value: 'Start 9 · End 9' },
        { probe: 'cursor-cell', operator: 'equals', value: 'r1:end' },
        { probe: 'validation-status', operator: 'equals', value: 'Could not revert row changes' },
        { probe: 'status-text', operator: 'contains', value: 'trapped → pending → vetoed · Escape retries' },
      ],
    ),
  ],
);

/** Lifecycle contract: loading, ready, empty variants, and error are real grid states. */
export const LIFECYCLE_STATES_CONTRACT = dataGridContract(
  'data-grid/lifecycle-states',
  ['loading-state', 'ready-state', 'empty-state', 'filter-empty-state', 'error-state'],
  [
    gridCase(
      'cycle-data-states',
      ['loading-state', 'ready-state', 'empty-state'],
      [{ probe: 'lifecycle-state', operator: 'equals', value: 'ready' }],
      [alt('l'), alt('e')],
      [{ probe: 'lifecycle-state', operator: 'equals', value: 'empty' }],
    ),
    gridCase(
      'cycle-failure-states',
      ['filter-empty-state', 'error-state'],
      [{ probe: 'lifecycle-state', operator: 'equals', value: 'ready' }],
      [alt('f'), alt('x')],
      [{ probe: 'lifecycle-state', operator: 'equals', value: 'error' }],
    ),
  ],
);

/** Everyday interaction and lifecycle contracts in teaching order. */
export const INTERACTION_DATA_GRID_CONTRACTS = [
  SELECTION_NAVIGATION_CONTRACT,
  ROW_MUTATIONS_CONTRACT,
  EDITING_LIFECYCLE_CONTRACT,
  EDITOR_TYPES_CONTRACT,
  CUSTOM_EDITOR_CONTRACT,
  DIRTY_COMMIT_CONTRACT,
  VALIDATION_CONTRACT,
  LIFECYCLE_STATES_CONTRACT,
] as const;
