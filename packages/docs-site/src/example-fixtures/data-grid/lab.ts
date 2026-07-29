import { Button, DataGrid, Dialog, Group, Input, Text, at, signal } from '@jsvision/ui';
import type { Application, Column, DispatchEvent, Signal, SortState } from '@jsvision/ui';
import {
  EditableDataGrid,
  column,
  createMemoryVariantStore,
  fromReactiveRows,
  fromRows,
  personalizeGrid,
} from '@jsvision/datagrid';
import type { GridColumn, GridDataSource, GridStatus } from '@jsvision/datagrid';
import type { ExampleContext } from '../../../examples/_contract.js';
import { demoApp } from '../../demo-shell.js';
import { DATA_GRID_LAB_ROWS, createDataGridLabRows } from './data.js';
import type { DataGridLabRow } from './data.js';
import { HOSTILE_EXPORT_VALUES } from './export-fixtures.js';
import { createDataGridScenarioController } from './scenario-controller.js';
import { WINDOWED_TOTAL_ROWS, createWindowedDataGridLabSource } from './windowed-source.js';

/** Stable identifiers accepted by the shared Data Grid laboratory builder. */
export type DataGridLabScenario =
  | 'quick-start'
  | 'data-sources'
  | 'typed-columns'
  | 'layout-freezing'
  | 'rendering'
  | 'sorting'
  | 'quick-filter'
  | 'advanced-filter'
  | 'selection-navigation'
  | 'row-mutations'
  | 'editing-lifecycle'
  | 'editor-types'
  | 'custom-editor'
  | 'dirty-commit'
  | 'validation'
  | 'lifecycle-states'
  | 'aggregates'
  | 'master-detail'
  | 'windowed'
  | 'large-memory'
  | 'export'
  | 'variants-personalization'
  | 'theming-accessibility'
  | 'performance-boundaries';

/** Descriptive metadata for one focused lab. */
export interface DataGridLabDefinition {
  /** Scenario controlling real grid options and actions. */
  readonly scenario: DataGridLabScenario;
  /** Dialog title. */
  readonly title: string;
  /** One-line learning objective above the grid. */
  readonly objective: string;
}

interface LabAction {
  readonly label: string;
  readonly run: () => void;
}

const DIALOG_WIDTH = 74;
const DIALOG_HEIGHT = 20;
const CONTENT_WIDTH = 70;
const CONTENT_HEIGHT = 16;
const GRID_WIDTH = 50;
const GRID_HEIGHT = 10;

/** Small public-seam custom editor used by the rating laboratory. */
class RatingEditor extends Input {
  private readonly ratingField: Signal<string>;

  /** @param field Editor text shared with the Data Grid commit lifecycle. */
  constructor(field: Signal<string>) {
    super({ value: field, maxLength: 5 });
    this.ratingField = field;
  }

  /** Left/right adjusts stars; Enter and Escape remain owned by the grid lifecycle. */
  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key' && (event.event.key === 'right' || event.event.key === 'arrowright')) {
      this.ratingField.set('★'.repeat(Math.min(5, this.ratingField().length + 1)));
      event.handled = true;
      return;
    }
    super.onEvent(event);
  }
}

/** Create editable columns shared by most scenarios, with scenario-specific public capabilities. */
function createColumns(scenario: DataGridLabScenario): GridColumn<DataGridLabRow>[] {
  const name = column<DataGridLabRow, string>({
    id: 'name',
    title: 'Name',
    value: (row) => row.name,
    format:
      scenario === 'export'
        ? (value) => value.replaceAll('\r', '\\r').replaceAll('\n', '\\n').replaceAll('\t', '\\t')
        : undefined,
    parse: (text) => text,
    set: (row, value) => {
      row.name = value;
    },
    validate: scenario === 'validation' ? (value) => (value.trim() === '' ? 'Name is required' : null) : undefined,
    width: 14,
    editor: { kind: 'text' },
    showFunnel: scenario === 'advanced-filter',
  });
  const region = column<DataGridLabRow, string>({
    id: 'region',
    title: 'Region',
    value: (row) => row.region,
    parse: (text) => text,
    set: (row, value) => {
      if (value === 'North' || value === 'South' || value === 'East' || value === 'West') row.region = value;
    },
    editor:
      scenario === 'editor-types' ? { kind: 'enum', values: ['North', 'South', 'East', 'West'] } : { kind: 'text' },
    width: 10,
    showFunnel: scenario === 'advanced-filter',
  });
  const amount = column<DataGridLabRow, number>({
    id: 'amount',
    title: 'Amount',
    value: (row) => row.amount,
    format:
      scenario === 'typed-columns'
        ? (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(value)
        : (value) => value.toLocaleString('en-US'),
    parse: (text) => Number(text.replaceAll(',', '')),
    set: (row, value) => {
      row.amount = value;
    },
    validate: scenario === 'validation' ? (value) => (value < 0 ? 'Amount cannot be negative' : null) : undefined,
    editor: { kind: scenario === 'editor-types' ? 'decimal' : 'integer' },
    align: 'right',
    width: 11,
    cellStyle: scenario === 'rendering' ? (value) => (value >= 300 ? 'gridInvalid' : 'listNormal') : undefined,
    showFunnel: scenario === 'advanced-filter',
  });
  const active = column<DataGridLabRow, boolean>({
    id: 'active',
    title: 'Active',
    value: (row) => row.active,
    format: (value) => (value ? '✓ yes' : '· no'),
    parse: (text) => ['true', 'yes', '1', '✓ yes'].includes(text.toLowerCase()),
    set: (row, value) => {
      row.active = value;
    },
    editor: { kind: 'boolean' },
    width: 8,
    render:
      scenario === 'rendering'
        ? (context, cell) =>
            context.text(0, 0, cell.value ? '● ACTIVE' : '○ PAUSED', {
              fg: cell.value ? 'brightGreen' : 'brightBlack',
              bg: 'cyan',
            })
        : undefined,
  });
  if (scenario === 'typed-columns') {
    const ratio = column<DataGridLabRow, number | null>({
      id: 'ratio',
      title: 'Ratio',
      value: (row) => row.ratio ?? null,
      format: (value) => (value === null ? '—' : `${(value * 100).toFixed(1)}%`),
      parse: (text) => (text.trim() === '' ? null : Number(text.replace('%', '')) / 100),
      set: (row, value) => {
        row.ratio = value;
      },
      nullable: true,
      nullDisplay: '—',
      align: 'right',
      width: 9,
    });
    return [name, amount, ratio, active];
  }
  if (scenario === 'editor-types') {
    const due = column<DataGridLabRow, string>({
      id: 'due',
      title: 'Due',
      value: (row) => row.due ?? '',
      parse: (text) => text,
      set: (row, value) => {
        row.due = value;
      },
      editor: { kind: 'date' },
      width: 12,
    });
    const owner = column<DataGridLabRow, string>({
      id: 'owner',
      title: 'Owner',
      value: (row) => row.ownerId ?? '',
      parse: (text) => text,
      set: (row, value) => {
        row.ownerId = value;
      },
      editor: {
        kind: 'lookup',
        items: [
          { key: 'ada', label: 'Ada' },
          { key: 'bo', label: 'Bo' },
          { key: 'cy', label: 'Cy' },
        ],
      },
      width: 9,
    });
    return [name, amount, active, due, region, owner];
  }
  if (scenario === 'custom-editor') {
    const rating = column<DataGridLabRow, number>({
      id: 'rating',
      title: 'Rating',
      value: (row) => row.rating ?? 0,
      format: (value) => '★'.repeat(value),
      parse: (text) => Math.max(0, Math.min(5, text.length)),
      set: (row, value) => {
        row.rating = value;
      },
      editor: {
        kind: 'custom',
        create: (field) => new RatingEditor(field),
      },
      width: 9,
    });
    return [rating, name, region, amount];
  }
  return [name, region, amount, active];
}

/** Create a bounded large collection without sharing mutable records between tiers. */
function createLargeRows(count: number): DataGridLabRow[] {
  const regions: readonly DataGridLabRow['region'][] = ['North', 'South', 'East', 'West'];
  return Array.from({ length: count }, (_, index) => ({
    id: `large-${index + 1}`,
    name: `Record ${index + 1}`,
    region: regions[index % regions.length],
    amount: (index * 17) % 5000,
    active: index % 2 === 0,
  }));
}

/** Convert every hostile export value into a real grid row without weakening the row type. */
function createExportRows(): DataGridLabRow[] {
  return HOSTILE_EXPORT_VALUES.map((name, index) => ({
    id: `hazard-${index + 1}`,
    name,
    region: index % 2 === 0 ? 'East' : 'West',
    amount: index + 1,
    active: true,
  }));
}

/** Select a deterministic row set whose real order/count matches the focused lesson. */
function createScenarioRows(scenario: DataGridLabScenario): DataGridLabRow[] {
  if (scenario === 'large-memory') return createLargeRows(1_000);
  if (scenario === 'export') return createExportRows();
  const base = createDataGridLabRows();
  if (scenario === 'sorting') {
    return [
      { ...base[0]!, amount: 400 },
      { ...base[1]!, amount: 100 },
      { ...base[2]!, amount: 300 },
      { ...base[3]!, amount: 200 },
    ];
  }
  if (scenario === 'row-mutations') return base.slice(0, 3);
  if (scenario === 'aggregates') {
    return base.slice(0, 3).map((row, index) => ({ ...row, amount: (index + 1) * 100 }));
  }
  if (scenario === 'master-detail') {
    return base.slice(0, 3).map((row, index) => ({ ...row, id: `customer-${index + 1}` }));
  }
  if (scenario === 'typed-columns' || scenario === 'rendering') base[0]!.amount = 1_250.5;
  return base;
}

/** Create the public source best suited to the selected scenario. */
function createSource(
  scenario: DataGridLabScenario,
  rows: Signal<DataGridLabRow[]>,
): {
  readonly source: GridDataSource<DataGridLabRow>;
  readonly windowed?: ReturnType<typeof createWindowedDataGridLabSource>;
  readonly setComplete?: (complete: boolean) => void;
} {
  if (scenario === 'windowed' || scenario === 'performance-boundaries') {
    const windowed = createWindowedDataGridLabSource(8);
    return { source: windowed, windowed };
  }
  if (scenario === 'data-sources') {
    return {
      source: fromReactiveRows(() => rows(), {
        rowKey: (row) => row.id,
        insert: (row, index) => {
          const next = rows().slice();
          next.splice(index ?? next.length, 0, row);
          rows.set(next);
        },
        remove: (keys) => {
          const removed = new Set(keys);
          rows.set(rows().filter((row) => !removed.has(row.id)));
        },
      }),
    };
  }
  if (scenario === 'aggregates') {
    let complete = true;
    return {
      source: fromReactiveRows(() => rows(), {
        rowKey: (row) => row.id,
        complete: () => complete,
      }),
      setComplete: (next) => {
        complete = next;
        rows.set(rows().slice());
      },
    };
  }
  return { source: fromRows(rows, { rowKey: (row) => row.id }) };
}

/** Build scenario actions that operate on the real public grid surface. */
function createActions(
  scenario: DataGridLabScenario,
  grid: EditableDataGrid<DataGridLabRow>,
  rows: Signal<DataGridLabRow[]>,
  status: Signal<string>,
  lifecycle: Signal<GridStatus>,
  windowed: ReturnType<typeof createWindowedDataGridLabSource> | undefined,
  setSourceComplete?: (complete: boolean) => void,
): readonly LabAction[] {
  const resetRows = (): void => rows.set(createDataGridLabRows());
  switch (scenario) {
    case 'data-sources':
      return [
        {
          label: '~R~eactive +1',
          run: () => {
            rows.set([...rows(), { id: 'r7', name: 'Fatima', region: 'North', amount: 275, active: true }]);
            status.set(`reactive source · ${grid.totalCount()} rows`);
          },
        },
        {
          label: 'Rese~t~ source',
          run: () => {
            resetRows();
            status.set('in-memory source · 6 rows');
          },
        },
      ];
    case 'typed-columns':
      return [
        { label: '~N~ull policy', run: () => status.set('null → — · model remains typed') },
        { label: '~P~arse 20%', run: () => status.set('parsed 0.2 · display 20.0%') },
      ];
    case 'layout-freezing':
      return [
        {
          label: 'Re~o~rder/freeze',
          run: () => {
            grid.setColumnOrder(['region', 'name', 'amount', 'active']);
            grid.setFrozen(['region'], []);
            status.set(`order ${grid.columnOrder().join(' › ')} · frozen region`);
          },
        },
        {
          label: '~H~ide amount',
          run: () => {
            grid.setColumnWidth('name', 18);
            grid.setColumnVisible('amount', false);
            status.set('name width 18 · amount hidden');
          },
        },
      ];
    case 'rendering':
      return [
        { label: '~R~ender cues', run: () => status.set('HIGH values use gridError · ● is a clipped custom renderer') },
        { label: '~A~lignment', run: () => status.set('text left · typed numbers right · booleans glyph-rendered') },
      ];
    case 'sorting':
      return [
        {
          label: '~S~ort amount',
          run: () => {
            grid.sortBy('amount', 'asc');
            status.set(
              `single sort · ${grid
                .displayedRows()
                .map((row) => row.id)
                .join(',')}`,
            );
          },
        },
        {
          label: '~M~ulti sort',
          run: () => {
            grid.sortBy('region', 'asc');
            grid.addSort('amount', 'desc');
            status.set(
              `priorities · ${grid
                .sort()
                .map((item) => `${item.columnId}:${item.dir}`)
                .join(' › ')}`,
            );
          },
        },
      ];
    case 'quick-filter':
      return [
        {
          label: '~F~ilter “al”',
          run: () => {
            grid.setFilter('name', { kind: 'text', op: 'contains', value: 'al' });
            status.set(`${grid.filteredCount()} of ${grid.totalCount()} · name contains “al”`);
          },
        },
        {
          label: '~C~lear filter',
          run: () => {
            grid.clearFilter();
            status.set('6 of 6 · quick filters ready');
          },
        },
      ];
    case 'advanced-filter':
      return [
        {
          label: '~C~ondition >100',
          run: () => {
            grid.setFilter('amount', { kind: 'number', op: 'gt', a: 100 });
            status.set(`${grid.filteredCount()} of ${grid.totalCount()} · amount > 100`);
          },
        },
        {
          label: 'Value ~l~ist East',
          run: () => {
            grid.setFilter('region', { kind: 'set', selected: new Set(['East']) });
            status.set(`${grid.filteredCount()} of ${grid.totalCount()} · region is East`);
          },
        },
      ];
    case 'selection-navigation':
      return [
        {
          label: '~S~elect r1/r2',
          run: () => {
            grid.toggleRow('r1');
            grid.toggleRow('r2');
            status.set(`selected ${[...grid.selectedKeys()].join(',')} · cursor remains independent`);
          },
        },
        {
          label: 'C~l~ear selection',
          run: () => {
            grid.clearSelection();
            status.set('selection cleared · arrows move cursor');
          },
        },
      ];
    case 'row-mutations':
      return [
        {
          label: '~I~nsert/duplicate',
          run: () => {
            grid.insertRow({ id: 'new-1', name: 'New row', region: 'North', amount: 0, active: true }, 1);
            grid.duplicateRow('r1');
            status.set(
              `stable keys · ${grid
                .displayedRows()
                .map((row) => row.id)
                .join(',')}`,
            );
          },
        },
        {
          label: 'Delete r~2~',
          run: () => {
            grid.deleteRows(['r2']);
            status.set(`${grid.totalCount()} rows · nearest survivor keeps focus`);
          },
        },
      ];
    case 'editing-lifecycle':
      return [
        {
          label: '~E~dit with Enter',
          run: () => status.set('focus a cell · Enter edits · Enter commits · Esc cancels'),
        },
        {
          label: '~C~ancel reminder',
          run: () => status.set(`overlay ${grid.isEditing() ? 'open' : 'idle'} · Esc restores focus`),
        },
      ];
    case 'editor-types':
      return [
        { label: '~E~ditor map', run: () => status.set('Name text · Region enum · Amount decimal · Active boolean') },
        { label: '~S~tructured', run: () => status.set('Date and lookup follow the same typed editor seam') },
      ];
    case 'custom-editor':
      return [
        {
          label: '~E~dit rating',
          run: () => status.set('Name uses public custom factory · Enter commits · Esc cancels'),
        },
        { label: 'Clea~n~up', run: () => status.set(`custom overlay ${grid.isEditing() ? 'active' : 'disposed'}`) },
      ];
    case 'dirty-commit':
      return [
        { label: '~V~eto -1', run: () => status.set('vetoed · dirty value retained for correction') },
        { label: '~C~ommit 12', run: () => status.set('committed · dirty marker cleared asynchronously') },
      ];
    case 'validation':
      return [
        { label: '~C~ell gate', run: () => status.set('cell error · Amount cannot be negative') },
        { label: '~S~ave gates', run: () => status.set('row accepted · save accepted') },
      ];
    case 'lifecycle-states':
      return [
        {
          label: '~L~oading/ready',
          run: () => {
            lifecycle.set(lifecycle() === 'loading' ? 'ready' : 'loading');
            const state = lifecycle();
            status.set(`lifecycle · ${typeof state === 'string' ? state : state.kind}`);
          },
        },
        {
          label: '~E~mpty/error',
          run: () => {
            rows.set([]);
            lifecycle.set({
              kind: 'error',
              message: 'Source unavailable',
              retry: () => {
                resetRows();
                lifecycle.set('ready');
              },
            });
            status.set('error · retry owns recovery; empty remains distinct');
          },
        },
      ];
    case 'aggregates':
      return [
        {
          label: '~F~ooter scope',
          run: () => status.set(`Total ${grid.displayedRows().reduce((sum, row) => sum + row.amount, 0)} · sticky`),
        },
        {
          label: '~P~artial honesty',
          run: () => {
            setSourceComplete?.(false);
            status.set('visible window · partial · never a grand total');
          },
        },
      ];
    case 'master-detail':
      return [
        {
          label: '~N~ext master',
          run: () => {
            grid.selectRow('customer-2');
            status.set('detail key customer-2 · Bram · West');
          },
        },
        {
          label: '~R~eset detail',
          run: () => {
            grid.selectRow('customer-1');
            status.set('detail key customer-1 · Alice · North');
          },
        },
      ];
    case 'windowed':
      return [
        {
          label: '~W~indow 50k',
          run: () => {
            windowed?.ensureRange?.(50_000, 50_040);
            status.set(`${windowed?.readCount() ?? 0} bounded reads · ${WINDOWED_TOTAL_ROWS.toLocaleString()} total`);
          },
        },
        {
          label: '~P~rove boundary',
          run: () => status.set(`full-array read: ${String(windowed?.fullArrayRead() ?? false)}`),
        },
      ];
    case 'large-memory':
      return [
        {
          label: '~L~oad 10,000',
          run: () => {
            rows.set(createLargeRows(10_000));
            status.set('10,000 bounded in-memory rows · use windowed above this tier');
          },
        },
        {
          label: '~R~eset 1,000',
          run: () => {
            rows.set(createLargeRows(1_000));
            status.set('1,000 bounded in-memory rows');
          },
        },
      ];
    case 'export':
      return [
        { label: 'Export ~C~SV', run: () => status.set(grid.exportView('csv').slice(0, 66).replaceAll('\r\n', ' ↵ ')) },
        { label: 'Export ~T~SV', run: () => status.set(grid.exportView('tsv').slice(0, 66).replaceAll('\r\n', ' ↵ ')) },
        { label: 'Export ~H~TML', run: () => status.set(grid.exportView('html').slice(0, 66).replaceAll('\n', ' ')) },
        { label: 'Export ~J~SON', run: () => status.set(grid.exportView('json').slice(0, 66).replaceAll('\n', ' ')) },
      ];
    case 'variants-personalization': {
      let compact = grid.saveVariant('Default');
      return [
        {
          label: '~S~ave compact',
          run: () => {
            grid.setColumnVisible('active', false);
            grid.setColumnWidth('name', 18);
            compact = grid.saveVariant('Compact');
            status.set('variant Compact saved as an application-owned snapshot');
          },
        },
        {
          label: '~A~pply variant',
          run: () => {
            grid.applyVariant(compact);
            status.set('Compact applied · Cancel would preserve the live layout');
          },
        },
      ];
    }
    case 'theming-accessibility':
      return [
        {
          label: '~S~election cue',
          run: () => {
            grid.selectRow('r3');
            status.set('gridSelected · focus and text remain visible');
          },
        },
        { label: '~K~eyboard help', run: () => status.set('Arrow keys · Space · Enter · Tab · Alt+Down filter') },
      ];
    case 'performance-boundaries':
      return [
        {
          label: '~I~nspect work',
          run: () => {
            windowed?.ensureRange?.(400, 480);
            status.set(`${windowed?.readCount() ?? 0} bounded reads · measure in your workload`);
          },
        },
        { label: '~G~uidance', run: () => status.set('lazy construction · visible rows only · no timing guarantee') },
      ];
    case 'quick-start':
    default:
      return [
        { label: 'Read-~o~nly', run: () => status.set('DataGrid · display and application-owned transformations') },
        { label: '~E~ditable', run: () => status.set('EditableDataGrid · typed editing, filters, footer, variants') },
      ];
  }
}

/** Add uniformly measured action buttons to the right side of a lab. */
function addActions(content: Group, actions: readonly LabAction[]): void {
  actions.slice(0, 4).forEach((action, index) => {
    content.add(at(new Button(action.label, { onClick: action.run }), 52, 2 + index * 3, 18, 2));
  });
}

/**
 * Build one centered Classic-theme Data Grid laboratory.
 *
 * The scenario changes real public grid configuration and commands while preserving one predictable
 * teaching shell: objective, grid, focused actions, observable state, and keyboard help.
 */
export function buildDataGridLab(ctx: ExampleContext, definition: DataGridLabDefinition): Application {
  const app = demoApp(ctx, { themeMenu: true });
  const initialRows = createScenarioRows(definition.scenario);
  const rows = signal(initialRows);
  const status = signal(definition.objective);
  const lifecycle = signal<GridStatus>('ready');
  const columns = createColumns(definition.scenario);
  const sourceState = createSource(definition.scenario, rows);
  const personalizationState = signal('closed');
  const personalizationStore = createMemoryVariantStore();
  let nextKey = 100;
  const grid = new EditableDataGrid<DataGridLabRow>({
    columns,
    source: sourceState.source,
    zebra: true,
    quickFilter: definition.scenario === 'quick-filter',
    checkboxColumn: definition.scenario === 'selection-navigation',
    rowNumbers: definition.scenario === 'selection-navigation',
    freeze: definition.scenario === 'layout-freezing' ? 1 : undefined,
    status: definition.scenario === 'lifecycle-states' ? () => lifecycle() : undefined,
    emptyText: definition.scenario === 'lifecycle-states' ? 'No source rows' : undefined,
    assignKey: (clone) => ({ ...clone, id: `new-${nextKey++}` }),
    onCommit:
      definition.scenario === 'dirty-commit'
        ? async (commit) => {
            await Promise.resolve();
            const accepted = typeof commit.value !== 'number' || commit.value >= 0;
            status.set(accepted ? 'committed · dirty marker cleared' : 'vetoed · dirty value retained');
            return accepted;
          }
        : undefined,
    beforeSave:
      definition.scenario === 'validation'
        ? (commit) => {
            const accepted = commit.row.name.trim() !== '';
            status.set(accepted ? 'row accepted · save accepted' : 'row rejected · name required');
            return accepted;
          }
        : undefined,
    validateRow:
      definition.scenario === 'validation'
        ? (row) =>
            row.amount >= 0 ? { ok: true } : { ok: false, message: 'Row total cannot be negative', field: 'amount' }
        : undefined,
    footer:
      definition.scenario === 'aggregates'
        ? {
            sticky: true,
            aggregates: { amount: { fn: 'sum', label: 'Total' } },
            widgets: [new Text(() => status())],
          }
        : undefined,
  });
  const openPersonalization = (): void => {
    personalizationState.set('open');
    status.set('personalization open · Escape cancels · Enter accepts');
    void personalizeGrid(grid, { store: personalizationStore, host: app }).then(({ ok }) => {
      personalizationState.set(ok ? 'applied' : 'closed');
      status.set(ok ? 'personalization applied' : 'personalization canceled · layout unchanged');
    });
  };
  const probe = createDataGridScenarioController({
    scenario: definition.scenario,
    grid,
    rows,
    status,
    lifecycle,
    windowed: sourceState.windowed,
    openPersonalization,
    personalizationState,
  });

  const dialog = new Dialog({ title: ` ${definition.title} `, width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
  dialog.closable = false;
  const content = new Group();
  content.add(at(new Text(definition.objective), 0, 0, CONTENT_WIDTH, 2));
  content.add(at(probe, 0, 0, 0, 0));

  if (definition.scenario === 'quick-start') {
    const readOnlyRows = signal([...DATA_GRID_LAB_ROWS]);
    const focused = signal(0);
    const selected = signal(-1);
    const sort = signal<SortState>(null);
    const readOnlyColumns: Column<DataGridLabRow>[] = [
      { title: 'Name', accessor: (row) => row.name, width: 12 },
      { title: 'Amount', accessor: (row) => String(row.amount), width: 8, align: 'right' },
    ];
    const readOnly = new DataGrid({
      rows: readOnlyRows,
      columns: readOnlyColumns,
      focused,
      selected,
      sort,
      zebra: true,
    });
    content.add(at(new Text('DataGrid'), 0, 2, 24, 1));
    content.add(at(readOnly, 0, 3, 24, 9));
    content.add(at(new Text('EditableDataGrid'), 26, 2, 24, 1));
    content.add(at(grid, 26, 3, 24, 9));
  } else {
    content.add(at(grid, 0, 2, GRID_WIDTH, GRID_HEIGHT));
  }

  const actions = [
    ...createActions(definition.scenario, grid, rows, status, lifecycle, sourceState.windowed, sourceState.setComplete),
  ];
  if (definition.scenario === 'variants-personalization') {
    actions.push({
      label: '~P~ersonalize',
      run: openPersonalization,
    });
  }
  addActions(content, actions);
  if (definition.scenario === 'master-detail') {
    content.add(at(new Text(() => `Detail\n${status()}`), 52, 8, 18, 4));
  }
  content.add(at(new Text(() => `State: ${status()}`), 0, 13, CONTENT_WIDTH, 2));
  content.add(at(new Text('Arrows move · Enter edits · Space selects · Alt+hotkeys act'), 0, 15, CONTENT_WIDTH, 1));
  dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
  app.desktop.addWindow(dialog);
  app.loop.focusView(grid.rows);
  return app;
}
