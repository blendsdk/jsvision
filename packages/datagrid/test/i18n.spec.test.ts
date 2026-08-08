/**
 * Immutable consumer oracles for Datagrid localization and explicit locale-aware filtering.
 * Framework labels may translate; column/data/variant identifiers and caller text remain data.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { Commands, Group, createEventLoop, signal } from '@jsvision/ui';
import type { I18n, View } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { computeDistinct, filterRows } from '../src/filter.js';
import type { ColumnFilter } from '../src/filter.js';
import { FilterPopup } from '../src/filter-popup.js';
import { fmt } from '../src/format.js';
import { EditableDataGrid } from '../src/grid.js';
import { personalizeGrid } from '../src/personalize.js';
import { createMemoryVariantStore } from '../src/variant-store.js';
import {
  datagridDe,
  datagridEn,
  datagridEs,
  datagridFr,
  datagridIt,
  datagridNl,
  datagridPl,
  datagridPtPT,
  datagridRo,
  datagridSv,
} from '../src/i18n/locales.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const datagridDutch = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'datagrid.boolean.yes': 'JA-NL',
    'datagrid.boolean.no': 'NEE-NL',
    'datagrid.empty': 'GEEN-RIJEN-NL',
    'datagrid.filter.action.apply': 'TOEPASSEN-NL',
    'datagrid.filter.action.clear': 'WISSEN-NL',
    'datagrid.personalize.action.save': 'BEWAREN-NL',
    'datagrid.personalize.action.reset': 'HERSTELLEN-NL',
  },
});

function fixtureI18n() {
  return createI18n({ locale: 'nl', catalogs: [datagridDutch] });
}

function render(view: View, width: number, height: number): string {
  view.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height } });
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

interface Row {
  id: string;
  value: string;
}

const valueColumn = () =>
  column<Row, string>({
    id: 'caller.id/Ω',
    title: 'CALLER TITLE Ω',
    value: (row) => row.value,
    width: 24,
  });

test('grid empty and boolean defaults localize while explicit boolean labels win', () => {
  const i18n = fixtureI18n();
  const empty = new EditableDataGrid<Row>({
    columns: [valueColumn()],
    source: fromRows(signal<Row[]>([]), { rowKey: (row) => row.id }),
    status: () => 'ready',
    i18n,
  });
  expect(render(empty, 38, 7)).toContain('GEEN-RIJEN-NL');

  const localized = fmt.boolean(undefined, i18n);
  expect(localized.format(true, {})).toBe('JA-NL');
  expect(localized.format(false, {})).toBe('NEE-NL');

  const caller = fmt.boolean({ true: 'CALLER-TRUE', false: 'CALLER-FALSE' }, i18n);
  expect(caller.format(true, {})).toBe('CALLER-TRUE');
  expect(caller.format(false, {})).toBe('CALLER-FALSE');
});

test('grid preserves caller titles, values, ids, and serialized variants with i18n configured', () => {
  const row: Row = { id: 'row/id/Ω', value: 'Cafe\u0301 VALUE Ω' };
  const grid = new EditableDataGrid<Row>({
    columns: [valueColumn()],
    source: fromRows(signal([row]), { rowKey: (item) => item.id }),
    i18n: fixtureI18n(),
  });
  const screen = render(grid, 38, 6);
  expect(screen).toContain('CALLER TITLE Ω');
  expect(screen).toContain(row.value);

  grid.setFilter('caller.id/Ω', { kind: 'text', op: 'contains', value: 'CALLER needle Ω' });
  const variant = grid.saveVariant('CALLER variant/Ω');
  expect(variant.name).toBe('CALLER variant/Ω');
  expect(variant.columns.map((item) => item.id)).toEqual(['caller.id/Ω']);
  expect(variant.filter).toEqual([
    {
      columnId: 'caller.id/Ω',
      filter: { kind: 'text', op: 'contains', value: 'CALLER needle Ω' },
    },
  ]);
});

test('FilterPopup localizes framework actions and preserves its column id', () => {
  const applied: Array<{ id: string; filter: ColumnFilter }> = [];
  const id = 'caller.filter/id';
  const popup = new FilterPopup<Row>({
    column: valueColumn(),
    columnId: id,
    filterType: 'text',
    i18n: fixtureI18n(),
    onApply: (columnId, filter) => applied.push({ id: columnId, filter }),
    onClear: () => undefined,
    onClose: () => undefined,
  });
  const screen = render(popup, 32, 11);
  expect(screen).toContain('TOEPASSEN-NL');
  expect(screen).toContain('WISSEN-NL');

  popup.operandA.set('needle');
  popup.apply();
  expect(applied[0]?.id).toBe(id);
  expect(applied[0]?.filter).toEqual({ kind: 'text', op: 'contains', value: 'needle' });
});

test('personalization uses host.i18n while caller dialog and column titles remain exact', async () => {
  const grid = new EditableDataGrid<Row>({
    columns: [valueColumn()],
    source: fromRows(signal([{ id: '1', value: 'v' }]), { rowKey: (row) => row.id }),
  });
  const root = new Group();
  const loop = createEventLoop({ width: 70, height: 24 }, { caps });
  loop.mount(root);
  const host = {
    i18n: fixtureI18n(),
    loop,
    desktop: {
      bounds: { x: 0, y: 0, width: 70, height: 24 },
      addWindow: (view: View) => root.add(view),
      removeWindow: (view: View) => root.remove(view),
    },
  };
  const title = 'CALLER PERSONALIZE Ω';
  const result = personalizeGrid(grid, { store: createMemoryVariantStore(), host, title });
  const screen = (() => {
    loop.renderRoot.flush();
    return loop.renderRoot
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''))
      .join('\n');
  })();
  expect(screen).toContain('BEWAREN-NL');
  expect(screen).toContain('HERSTELLEN-NL');
  expect(screen).toContain(title);
  expect(screen).toContain('CALLER TITLE Ω');

  loop.emitCommand(Commands.cancel);
  await expect(result).resolves.toEqual({ ok: false });
});

function textModel(value: string): ReadonlyMap<string, ColumnFilter> {
  return new Map([['caller.id/Ω', { kind: 'text', op: 'contains', value }]]);
}

test('explicit i18n applies NFC and locale casing while omission preserves ambient matching', () => {
  const col = valueColumn();
  const columns = new Map([[col.id, col]]);
  const rows: Row[] = [
    { id: 'nfc', value: 'Cafe\u0301' },
    { id: 'tr', value: 'IĞDIR' },
  ];
  const turkish = createI18n({ locale: 'tr' });

  expect(filterRows(rows, textModel('CAFÉ'), columns, turkish).map((row) => row.id)).toEqual(['nfc']);
  expect(filterRows(rows, textModel('ığ'), columns, turkish).map((row) => row.id)).toEqual(['tr']);
  expect(filterRows(rows, textModel('CAFÉ'), columns).map((row) => row.id)).toEqual([]);
  expect(filterRows(rows, textModel('ığ'), columns).map((row) => row.id)).toEqual([]);

  const grid = new EditableDataGrid<Row>({
    columns: [col],
    source: fromRows(signal(rows), { rowKey: (row) => row.id }),
    i18n: turkish,
  });
  grid.setFilter(col.id, { kind: 'text', op: 'contains', value: 'ığ' });
  expect(grid.displayedRows().map((row) => row.id)).toEqual(['tr']);
});

test('explicit distinct collation uses I18n.compare and omission keeps ambient ordering', () => {
  const col = valueColumn();
  const rows: Row[] = ['z', 'ä', 'a'].map((value) => ({ id: value, value }));
  const swedish: I18n = createI18n({ locale: 'sv' });

  expect(computeDistinct(rows, col, swedish)).toEqual(['a', 'z', 'ä']);
  const ambient = [...rows.map((row) => row.value)].sort(
    new Intl.Collator(undefined, { sensitivity: 'accent', numeric: false }).compare,
  );
  expect(computeDistinct(rows, col)).toEqual(ambient);
});

test('should construct every official locale with the complete row-revert message contract', () => {
  const catalogs = [
    datagridEn,
    datagridNl,
    datagridDe,
    datagridFr,
    datagridEs,
    datagridIt,
    datagridPtPT,
    datagridPl,
    datagridRo,
    datagridSv,
  ] as const;
  const keys = [
    'datagrid.validation.row-trapped',
    'datagrid.revert.pending',
    'datagrid.revert.failed',
    'datagrid.revert.unavailable',
  ] as const;

  for (const catalog of catalogs) {
    expect(() => createI18n({ locale: catalog.locale, catalogs: [catalog] })).not.toThrow();
    for (const messageKey of keys) expect(catalog.messages).toHaveProperty(messageKey);
    const trapped = String(catalog.messages['datagrid.validation.row-trapped']);
    const placeholders = [...trapped.matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1]);
    expect(placeholders).toEqual(['message']);
  }

  expect(datagridEn.messages['datagrid.validation.row-trapped']).toBe('${message} · Esc reverts row changes');
  expect(datagridEn.messages['datagrid.revert.pending']).toBe('Reverting row…');
  expect(datagridEn.messages['datagrid.revert.failed']).toBe('Could not revert row changes');
  expect(datagridEn.messages['datagrid.revert.unavailable']).toBe('Row changes cannot be reverted');
});
