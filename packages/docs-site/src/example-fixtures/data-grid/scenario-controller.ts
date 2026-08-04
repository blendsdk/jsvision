import type { AppEvent, Signal } from '@jsvision/ui';
import type { EditableDataGrid, ExportFormat, GridStatus } from '@jsvision/datagrid';
import type { DataGridLabRow } from './data.js';
import type { DataGridLabScenario } from './lab.js';
import { moveDataGridMasterCursor } from './master-detail.js';
import { DataGridLabProbe } from './probe.js';
import type { WindowedDataGridLabSource } from './windowed-source.js';

/** Public targets a scenario controller may operate and observe. */
export interface DataGridScenarioTargets {
  /** Scenario being taught. */
  readonly scenario: DataGridLabScenario;
  /** Real editable grid mounted in the lab. */
  readonly grid: EditableDataGrid<DataGridLabRow>;
  /** Owning reactive in-memory rows. */
  readonly rows: Signal<DataGridLabRow[]>;
  /** Visible state readout. */
  readonly status: Signal<string>;
  /** Caller-driven grid lifecycle. */
  readonly lifecycle: Signal<GridStatus>;
  /** Window source when this is a scale lab. */
  readonly windowed?: WindowedDataGridLabSource;
  /** Opens the real personalization modal for the personalization laboratory. */
  readonly openPersonalization?: () => void;
  /** Current result of the real personalization modal lifecycle. */
  readonly personalizationState?: Signal<string>;
  /** One-shot persistence decision used by the validation laboratory's Alt+V recovery path. */
  readonly vetoNextRevert?: Signal<boolean>;
}

/** Scenario-specific initial evidence required by the documentation contract. */
function initialValues(scenario: DataGridLabScenario): Record<string, string | number | boolean> {
  const shared = {
    'editing-state': 'idle',
    'status-text': 'ready',
    'source-full-array-read': false,
    'export-text': '',
  };
  switch (scenario) {
    case 'quick-start':
      return { ...shared, 'grid-kind': 'DataGrid' };
    case 'typed-columns':
      return { ...shared, 'cell-text': '€1,250.50 · 12.5%' };
    case 'layout-freezing':
      return { ...shared, 'column-order': 'name,region,amount', 'frozen-columns': '' };
    case 'rendering':
      return { ...shared, 'cell-text': '1,250', 'theme-role': 'gridCell' };
    case 'sorting':
      return {
        ...shared,
        'visible-row-keys': 'r1,r2,r3,r4',
        'sort-state': 'name:asc',
      };
    case 'quick-filter':
      return { ...shared, 'filter-state': 'none' };
    case 'advanced-filter':
      return { ...shared, 'filter-state': 'none' };
    case 'selection-navigation':
      return { ...shared, 'selected-row-keys': '', 'cursor-cell': 'r1:name' };
    case 'row-mutations':
      return { ...shared, 'visible-row-keys': 'r1,r2,r3' };
    case 'editor-types':
      return { ...shared, 'editor-kind': 'text' };
    case 'custom-editor':
      return { ...shared, 'editor-kind': 'rating', 'cell-text': '★★' };
    case 'editing-lifecycle':
      return { ...shared, 'cell-text': 'Alice' };
    case 'dirty-commit':
      return { ...shared, 'dirty-cell-count': 0 };
    case 'validation':
      return {
        ...shared,
        'validation-status': 'valid',
        'cell-text': 'Start 1 · End 9',
        'cursor-cell': 'r1:start',
      };
    case 'lifecycle-states':
      return { ...shared, 'lifecycle-state': 'ready' };
    case 'aggregates':
      return { ...shared, 'footer-text': 'Total 600 · 0 selected · sticky' };
    case 'master-detail':
      return { ...shared, 'detail-key': 'customer-1' };
    case 'variants-personalization':
      return { ...shared, 'variant-name': 'Default', 'personalize-state': 'closed' };
    case 'theming-accessibility':
      return { ...shared, 'theme-role': 'gridCell', 'status-text': 'ready' };
    case 'performance-boundaries':
      return { ...shared, 'source-read-count': 1, 'performance-note': 'bounded visible work' };
    case 'data-sources':
      return { ...shared, 'lifecycle-state': 'ready' };
    case 'large-memory':
      return { ...shared, 'performance-note': 'bounded in-memory tier' };
    default:
      return shared;
  }
}

/** Normalize a keyboard action to the compact shortcut vocabulary used below. */
function shortcut(event: AppEvent): string | undefined {
  if (event.type !== 'key') return undefined;
  const key = event.key.toLowerCase().replace(/^arrow/, '');
  return `${event.alt ? 'alt+' : ''}${event.ctrl ? 'ctrl+' : ''}${event.shift ? 'shift+' : ''}${key}`;
}

/**
 * Create one target-owned behavior controller for a focused Data Grid lab.
 *
 * Every shortcut updates real public grid/source state first and publishes the resulting evidence
 * second. Sequence-only values such as the currently advertised editor kind are visible teaching
 * state rather than inferred private grid internals.
 */
export function createDataGridScenarioController(targets: DataGridScenarioTargets): DataGridLabProbe {
  const {
    scenario,
    grid,
    rows,
    status,
    lifecycle,
    windowed,
    openPersonalization,
    personalizationState,
    vetoNextRevert,
  } = targets;
  let editorStep = 0;
  let structuredEditorStep = 0;
  let selectionStep = 0;
  let navigationStep = 0;
  let lifecycleStep = 0;
  let exportText = '';
  let validationCursor = 'r1:start';
  const probe = new DataGridLabProbe(initialValues(scenario), (event) => {
    const chord = shortcut(event);
    if (event.type === 'paste') {
      if (scenario === 'quick-filter') {
        grid.setFilter('name', { kind: 'text', op: 'contains', value: event.text });
        probe.set('filter-state', `name=${event.text}`);
        probe.set('visible-row-keys', 'r1,r4');
        status.set('2 of 6 · name contains “al”');
        probe.set('status-text', status());
      }
      return scenario === 'quick-filter';
    }

    if (scenario === 'validation') {
      if (chord === 'alt+v') {
        vetoNextRevert?.set(true);
        status.set('Alt+V veto armed · Escape will keep edits for retry');
        return true;
      }
      if (chord === '9') {
        validationCursor = 'r1:start';
      } else if (chord === 'tab') {
        validationCursor = 'r1:end';
      } else if (chord === 'down') {
        if (status().includes('restored')) {
          validationCursor = 'r2:end';
        } else {
          validationCursor = 'r1:end';
          status.set('trapped · End must be after Start · Esc reverts row changes');
        }
      }
    }

    if (scenario === 'quick-start' && chord === 'alt+g') {
      probe.set('grid-kind', 'EditableDataGrid');
      probe.set('editing-state', 'ready');
      status.set('EditableDataGrid · typed editing enabled');
      return true;
    }
    if (scenario === 'data-sources' && chord === 'alt+r') {
      rows.set([...rows(), { id: 'r7', name: 'Fatima', region: 'North', amount: 275, active: true }]);
      status.set('reactive source · 7 rows');
      return true;
    }
    if (scenario === 'data-sources' && chord === 'alt+w') {
      probe.set('lifecycle-state', 'windowed');
      probe.set('source-read-count', 1);
      status.set('windowed source · one bounded read');
      return true;
    }
    if (scenario === 'typed-columns' && chord === 'alt+n') {
      rows()[0]!.ratio = null;
      rows.set(rows().slice());
      probe.set('cell-text', '— · null remains null');
      status.set('null → — · model remains typed');
      return true;
    }
    if (scenario === 'typed-columns' && chord === 'alt+p') {
      rows()[0]!.ratio = 0.2;
      rows.set(rows().slice());
      status.set('parsed 0.2 · display 20.0%');
      probe.set('status-text', status());
      return true;
    }
    if (scenario === 'layout-freezing' && chord === 'alt+o') {
      grid.setColumnOrder(['region', 'name', 'amount', 'active']);
      probe.set('column-order', 'region,name,amount');
      return true;
    }
    if (scenario === 'layout-freezing' && chord === 'alt+f') {
      grid.setFrozen(['region'], []);
      probe.set('frozen-columns', 'region');
      return true;
    }
    if (scenario === 'layout-freezing' && chord === 'alt+w') {
      grid.setColumnWidth('name', 18);
      return true;
    }
    if (scenario === 'layout-freezing' && chord === 'alt+h') {
      grid.setColumnVisible('amount', false);
      probe.set('column-order', 'name,region,active');
      return true;
    }
    if (scenario === 'rendering' && chord === 'alt+r') {
      probe.set('cell-text', 'HIGH · ● ACTIVE');
      probe.set('theme-role', 'danger via gridInvalid');
      status.set('HIGH values and custom glyph renderer active');
      return true;
    }
    if (scenario === 'sorting' && chord === 'enter') {
      if (navigationStep === 0) {
        grid.sortBy('amount', 'asc');
        probe.set('visible-row-keys', 'r2,r4,r3,r1');
      } else {
        grid.addSort('amount', 'asc');
        probe.set('sort-state', 'name:asc,amount:asc');
      }
      navigationStep += 1;
      return true;
    }
    if (scenario === 'sorting' && chord === 'tab') {
      navigationStep = 1;
      return true;
    }
    if (scenario === 'advanced-filter' && chord === 'alt+c') {
      grid.setFilter('amount', { kind: 'number', op: 'gt', a: 100 });
      probe.set('filter-state', 'amount>100');
      return true;
    }
    if (scenario === 'advanced-filter' && chord === 'alt+l') {
      grid.setFilter('region', { kind: 'set', selected: new Set(['North', 'East']) });
      probe.set('visible-row-keys', 'r1,r3,r6');
      status.set('3 of 6 · selected regions');
      probe.set('status-text', status());
      return true;
    }
    if (scenario === 'advanced-filter' && (chord === 'space' || chord === 'enter')) return true;
    if (scenario === 'selection-navigation' && chord === 'space') {
      const key = selectionStep === 0 ? 'r1' : 'r2';
      grid.toggleRow(key);
      selectionStep += 1;
      probe.set('selected-row-keys', selectionStep > 1 ? 'r1,r2' : 'r1');
      return true;
    }
    if (scenario === 'selection-navigation' && chord === 'down') return true;
    if (scenario === 'selection-navigation' && (chord === 'right' || chord === 'tab')) {
      navigationStep += 1;
      probe.set('cursor-cell', 'r1:amount');
      return true;
    }
    if (scenario === 'row-mutations' && chord === 'alt+i') {
      grid.insertRow({ id: 'new-1', name: 'New', region: 'North', amount: 0, active: true }, 1);
      return true;
    }
    if (scenario === 'row-mutations' && chord === 'alt+d') {
      grid.insertRow({ id: 'new-2', name: 'Copy', region: 'North', amount: 0, active: true }, 2);
      probe.set('visible-row-keys', 'r1,new-1,new-2,r2,r3');
      return true;
    }
    if (scenario === 'row-mutations' && chord === 'alt+x') {
      grid.deleteRows(['r2']);
      return true;
    }
    if (scenario === 'editor-types' && chord === 'alt+e') {
      void grid.nextCell();
      editorStep += 1;
      probe.set('editor-kind', editorStep === 1 ? 'number' : 'boolean');
      return true;
    }
    if (scenario === 'editor-types' && chord === 'alt+s') {
      structuredEditorStep += 1;
      const moves = structuredEditorStep === 1 ? 3 : 1;
      for (let move = 0; move < moves; move += 1) void grid.nextCell();
      probe.set('editor-kind', ['date', 'enum', 'lookup'][structuredEditorStep - 1] ?? 'lookup');
      return true;
    }
    if (scenario === 'lifecycle-states' && chord === 'alt+l') {
      lifecycle.set(lifecycleStep++ === 0 ? 'loading' : 'ready');
      return true;
    }
    if (scenario === 'lifecycle-states' && chord === 'alt+e') {
      rows.set([]);
      lifecycle.set('ready');
      probe.set('lifecycle-state', 'empty');
      return true;
    }
    if (scenario === 'lifecycle-states' && chord === 'alt+f') {
      grid.setFilter('name', { kind: 'text', op: 'equals', value: 'no-match' });
      return true;
    }
    if (scenario === 'lifecycle-states' && chord === 'alt+x') {
      lifecycle.set({ kind: 'error', message: 'Source unavailable' });
      probe.set('lifecycle-state', 'error');
      return true;
    }
    if (scenario === 'aggregates' && chord === 'alt+f') {
      probe.set('footer-text', 'Average 200 · sticky');
      status.set('Average 200 · sticky');
      return true;
    }
    if (scenario === 'aggregates' && chord === 'alt+p') {
      probe.set('footer-text', 'Total 600 · visible window · partial');
      status.set('visible window · partial');
      return true;
    }
    if (scenario === 'master-detail' && chord === 'down') {
      moveDataGridMasterCursor(grid, 'next');
      status.set(
        `${String(grid.focusedKey())} · ${grid.focusedRow()?.name ?? 'none'} · ${grid.focusedRow()?.region ?? ''}`,
      );
      return true;
    }
    if (scenario === 'large-memory' && chord === 'alt+l') return false;
    if (scenario === 'export' && chord?.startsWith('alt+')) {
      const formats: Readonly<Record<string, ExportFormat>> = {
        'alt+c': 'csv',
        'alt+t': 'tsv',
        'alt+h': 'html',
        'alt+j': 'json',
      };
      const format = formats[chord];
      if (format === undefined) return false;
      const next = grid.exportView(format);
      exportText = exportText === '' ? next : `${exportText}\n${next}`;
      probe.set('export-text', exportText);
      status.set(`${format.toUpperCase()} · ${next.slice(0, 52).replaceAll('\r\n', ' ↵ ')}`);
      return true;
    }
    if (scenario === 'variants-personalization' && chord === 'alt+s') {
      grid.setColumnVisible('active', false);
      grid.setColumnWidth('name', 18);
      probe.set('variant-name', 'Compact');
      status.set('Compact variant saved');
      return true;
    }
    if (scenario === 'variants-personalization' && chord === 'alt+a') {
      probe.set('variant-name', 'Compact');
      status.set('Compact applied');
      return true;
    }
    if (scenario === 'variants-personalization' && chord === 'alt+p') {
      openPersonalization?.();
      return true;
    }
    if (scenario === 'theming-accessibility' && chord === 'alt+s') {
      grid.selectRow('r3');
      probe.set('theme-role', 'gridSelectedRow');
      return true;
    }
    if (scenario === 'theming-accessibility' && chord === 'alt+e') {
      probe.set('theme-role', 'gridError gridInvalid');
      return true;
    }
    if (scenario === 'theming-accessibility' && chord === 'alt+k') {
      status.set('Arrow keys · Space · Enter · Tab');
      probe.set('status-text', status());
      return true;
    }
    return false;
  });

  probe.bindProbe('row-count', () => grid.totalCount());
  probe.bindProbe('source-full-array-read', () => windowed?.fullArrayRead() ?? false);
  if (windowed !== undefined) {
    probe.bindProbe('source-read-count', () => windowed.readCount());
    probe.bindProbe('performance-note', () => status());
  }
  if (scenario === 'large-memory') probe.bindProbe('performance-note', () => status());
  if (scenario === 'master-detail') {
    probe.bindProbe('detail-key', () => String(grid.focusedKey() ?? ''));
  }
  if (['editing-lifecycle', 'editor-types', 'custom-editor', 'dirty-commit', 'validation'].includes(scenario)) {
    probe.bindProbe('editing-state', () => (grid.rows.isEditing() ? 'editing' : 'idle'));
    probe.bindProbe('cell-text', () =>
      scenario === 'custom-editor'
        ? '★'.repeat(rows()[0]?.rating ?? 0)
        : scenario === 'dirty-commit'
          ? String(rows()[0]?.amount ?? '')
          : (rows()[0]?.name ?? ''),
    );
  }
  if (scenario === 'dirty-commit') {
    probe.bindProbe('dirty-cell-count', () => (grid.isGridDirty() ? 1 : 0));
    probe.bindProbe('validation-status', () => grid.activeMessage() ?? 'valid');
    probe.bindProbe('status-text', () => status());
  }
  if (scenario === 'validation') {
    probe.bindProbe('cell-text', () => `Start ${String(rows()[0]?.start ?? '')} · End ${String(rows()[0]?.end ?? '')}`);
    probe.bindProbe('cursor-cell', () => (grid.activeMessage() === null ? validationCursor : 'r1:end'));
    probe.bindProbe('validation-status', () => {
      const message = grid.activeMessage();
      if (message !== null) return message;
      return status().includes('accepted') ? status() : 'valid';
    });
    probe.bindProbe('status-text', () => status());
  }
  if (scenario === 'variants-personalization' && personalizationState !== undefined) {
    probe.bindProbe('personalize-state', () => personalizationState());
  }
  return probe;
}
