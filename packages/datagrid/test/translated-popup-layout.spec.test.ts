/**
 * Immutable translated-layout oracles for Datagrid-owned popup and personalization surfaces.
 *
 * These cases deliberately use labels whose terminal display widths exceed the English defaults.
 * A roomy host must preserve complete framework text, while a constrained host may reflow or clip
 * content only after keeping the owning surface inside the available viewport. Equal-action groups
 * retain one shared button width even when they wrap onto multiple rows.
 */
import { expect, test } from 'vitest';
import { defineCatalog, createI18n } from '@jsvision/i18n';
import { Button, Commands, Group, View, createEventLoop, resolveCapabilities, signal, stringWidth } from '@jsvision/ui';
import type { I18n } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { DistinctResult } from '../src/filter.js';
import { FilterPopup } from '../src/filter-popup.js';
import { EditableDataGrid } from '../src/grid.js';
import { absoluteRect, mountCellOverlay } from '../src/overlay.js';
import { personalizeGrid } from '../src/personalize.js';
import { createMemoryVariantStore } from '../src/variant-store.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface RecordRow {
  id: number;
  value: string;
}

const rows: RecordRow[] = [
  { id: 1, value: 'alpha' },
  { id: 2, value: 'beta' },
];

/** Return every view in a subtree in source-independent depth-first order. */
function descendants(view: View): View[] {
  const result: View[] = [];
  const pending: View[] = [view];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    result.push(current);
    if (current instanceof Group) pending.push(...current.children);
  }
  return result;
}

/** Render a mounted loop into plain text for complete-label assertions. */
function screen(loop: ReturnType<typeof createEventLoop>): string {
  loop.renderRoot.flush();
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

/** Build a partial translation catalog; canonical English remains the fallback for omitted keys. */
function translatedI18n(messages: Record<string, string>): I18n {
  return createI18n({
    locale: 'zz',
    catalogs: [
      defineCatalog({
        schema: 1,
        locale: 'zz',
        messages,
      }),
    ],
  });
}

/** Mount a one-column grid and open its filter popup through the public keyboard entry point. */
function openFilter(
  width: number,
  height: number,
  i18n: I18n,
): { grid: EditableDataGrid<RecordRow>; loop: ReturnType<typeof createEventLoop>; popup: FilterPopup<RecordRow> } {
  const grid = new EditableDataGrid<RecordRow>({
    columns: [
      column<RecordRow, string>({
        id: 'value',
        title: 'Value',
        value: (row) => row.value,
        width: Math.max(6, width - 2),
      }),
    ],
    source: fromRows(signal(rows), { rowKey: (row) => row.id }),
    i18n,
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(grid.rows);
  loop.dispatch({ type: 'key', key: 'down', ctrl: false, alt: true, shift: false });
  loop.renderRoot.flush();
  const popup = descendants(grid).find((view): view is FilterPopup<RecordRow> => view instanceof FilterPopup);
  if (popup === undefined) throw new Error('Expected the keyboard filter command to open a popup.');
  return { grid, loop, popup };
}

test('a roomy filter popup expands to preserve translated operators and action labels', () => {
  const apply = '選択内容をすべて適用する';
  const clear = '条件を完全に消去する';
  const i18n = translatedI18n({
    'datagrid.filter.operator.contains': '指定された文字列を含んでいる',
    'datagrid.filter.operator.starts-with': '指定された文字列から始まっている',
    'datagrid.filter.operator.ends-with': '指定された文字列で終わっている',
    'datagrid.filter.operator.equals': '指定された文字列と完全に等しい',
    'datagrid.filter.action.apply': apply,
    'datagrid.filter.action.clear': clear,
  });
  const { loop, popup } = openFilter(92, 28, i18n);
  const rendered = screen(loop);

  expect(rendered).toContain(apply);
  expect(rendered).toContain(clear);
  expect(popup.bounds.width).toBeGreaterThanOrEqual(2 * (Math.max(stringWidth(apply), stringWidth(clear)) + 4) + 3);
});

test('a translated filter popup is clamped on both axes at the right and bottom viewport edges', () => {
  const i18n = translatedI18n({
    'datagrid.filter.operator.contains': 'contiene una cadena de búsqueda extraordinariamente larga',
    'datagrid.filter.action.apply': 'aplicar todos los criterios seleccionados',
    'datagrid.filter.action.clear': 'borrar todos los criterios seleccionados',
  });
  const { grid, popup } = openFilter(24, 10, i18n);

  expect(popup.bounds.x).toBeGreaterThanOrEqual(0);
  expect(popup.bounds.y).toBeGreaterThanOrEqual(0);
  expect(popup.bounds.x + popup.bounds.width).toBeLessThanOrEqual(grid.bounds.width);
  expect(popup.bounds.y + popup.bounds.height).toBeLessThanOrEqual(grid.bounds.height);
});

test('a feasible narrow popup stacks complete equal-width translated action pairs', () => {
  const i18n = translatedI18n({
    'datagrid.filter.action.apply': 'Alle Kriterien anwenden',
    'datagrid.filter.action.clear': 'Alle Kriterien löschen',
    'datagrid.filter.action.select-all': 'Alle Werte auswählen',
  });
  const { popup } = openFilter(38, 28, i18n);
  const popupOrigin = absoluteRect(popup);
  const buttons = descendants(popup).filter((view): view is Button => view instanceof Button);

  expect(buttons.length).toBe(4);
  expect(new Set(buttons.map((button) => button.bounds.width)).size).toBe(1);
  for (const button of buttons) {
    const origin = absoluteRect(button);
    expect(button.bounds.width).toBeGreaterThanOrEqual(button.measure().width);
    expect(origin.x).toBeGreaterThanOrEqual(popupOrigin.x);
    expect(origin.x + button.bounds.width).toBeLessThanOrEqual(popupOrigin.x + popup.bounds.width);
  }
  expect(new Set(buttons.map((button) => absoluteRect(button).y)).size).toBe(4);
});

test('changing a numeric filter to between reflows and re-clamps the popup inside its viewport', () => {
  const popup = new FilterPopup<RecordRow>({
    column: column<RecordRow, number>({ id: 'id', title: 'ID', value: (row) => row.id }),
    columnId: 'id',
    filterType: 'number',
    i18n: translatedI18n({
      'datagrid.filter.operator.between': 'liegt vollständig zwischen zwei Grenzwerten',
      'datagrid.filter.field.from': 'Unterer Grenzwert',
      'datagrid.filter.field.to': 'Oberer Grenzwert',
    }),
    onApply: () => undefined,
    onClear: () => undefined,
    onClose: () => undefined,
  });
  popup.setLayout({ position: 'absolute', rect: { x: 7, y: 5, width: 34, height: 8 } });
  const root = new Group();
  const loop = createEventLoop({ width: 38, height: 12 }, { caps });
  loop.mount(root);
  mountCellOverlay({
    host: root,
    loop,
    rect: { x: 7, y: 5, width: 34, height: 8 },
    origin: { x: 0, y: 0 },
    view: popup,
    clamp: { width: 38, height: 12 },
  });
  loop.renderRoot.flush();

  popup.selectOperator('between');
  loop.renderRoot.flush();

  expect(popup.bounds.x + popup.bounds.width).toBeLessThanOrEqual(38);
  expect(popup.bounds.y + popup.bounds.height).toBeLessThanOrEqual(12);
  expect(screen(loop)).toContain('Oberer Grenzwert');
});

test('async distinct values resize and re-clamp the mounted popup on both axes', async () => {
  let resolveDistinct: ((result: DistinctResult) => void) | undefined;
  const distinct = new Promise<DistinctResult>((resolve) => {
    resolveDistinct = resolve;
  });
  const popup = new FilterPopup<RecordRow>({
    column: column<RecordRow, string>({ id: 'value', title: 'Value', value: (row) => row.value }),
    columnId: 'value',
    filterType: 'text',
    distinct: () => distinct,
    availableWidth: 48,
    onApply: () => undefined,
    onClear: () => undefined,
    onClose: () => undefined,
  });
  const root = new Group();
  const loop = createEventLoop({ width: 48, height: 24 }, { caps });
  loop.mount(root);
  mountCellOverlay({
    host: root,
    loop,
    rect: { x: 31, y: 12, width: 34, height: 8 },
    origin: { x: 0, y: 0 },
    view: popup,
    clamp: { width: 48, height: 24 },
  });
  loop.renderRoot.flush();
  const initial = { ...popup.bounds };

  if (resolveDistinct === undefined) throw new Error('Expected the distinct promise resolver to be initialized.');
  resolveDistinct({
    values: ['ein außergewöhnlich ausführlicher und vollständig sichtbarer Auswahlwert'],
  });
  await Promise.resolve();
  loop.renderRoot.flush();

  expect(popup.bounds.width).toBeGreaterThan(initial.width);
  expect(popup.bounds.x).toBeLessThan(initial.x);
  expect(popup.bounds.x + popup.bounds.width).toBeLessThanOrEqual(48);
  expect(popup.bounds.y + popup.bounds.height).toBeLessThanOrEqual(24);
});

test('wrapped personalization actions use the widest of all five translated labels', async () => {
  const actionMessages = {
    'datagrid.personalize.action.save': 'Speichern',
    'datagrid.personalize.action.apply': 'Auswahl anwenden',
    'datagrid.personalize.action.delete': 'Ausgewählte Variante löschen',
    'datagrid.personalize.action.default': 'Als systemweiten Standard festlegen',
    'datagrid.personalize.action.reset': 'Ursprüngliche Anordnung wiederherstellen',
  };
  const i18n = translatedI18n(actionMessages);
  const grid = new EditableDataGrid<RecordRow>({
    columns: [column<RecordRow, string>({ id: 'value', title: 'Value', value: (row) => row.value, width: 10 })],
    source: fromRows(signal(rows), { rowKey: (row) => row.id }),
  });
  const root = new Group();
  const loop = createEventLoop({ width: 72, height: 24 }, { caps });
  loop.mount(root);
  let dialog: View | undefined;
  const result = personalizeGrid(grid, {
    store: createMemoryVariantStore(),
    host: {
      i18n,
      loop,
      desktop: {
        bounds: { x: 0, y: 0, width: 72, height: 24 },
        addWindow: (view) => {
          dialog = view;
          root.add(view);
        },
        removeWindow: (view) => root.remove(view),
      },
    },
  });
  if (dialog === undefined) throw new Error('Expected personalization to mount a dialog.');
  loop.renderRoot.flush();

  const variantButtons = descendants(dialog)
    .filter((view): view is Button => view instanceof Button)
    .filter((button) => button.measure().width > 10);
  expect(variantButtons).toHaveLength(5);
  expect(new Set(variantButtons.map((button) => button.bounds.width))).toEqual(
    new Set([Math.max(...variantButtons.map((button) => button.measure().width))]),
  );

  loop.emitCommand(Commands.cancel);
  await expect(result).resolves.toEqual({ ok: false });
});

test('personalization renders translated column headers without collisions', async () => {
  const headers = {
    'datagrid.personalize.header.show': '表示する',
    'datagrid.personalize.header.column': '列の完全な名前',
    'datagrid.personalize.header.freeze': '固定する位置',
    'datagrid.personalize.header.width': '表示幅',
  };
  const i18n = translatedI18n(headers);
  const grid = new EditableDataGrid<RecordRow>({
    columns: [column<RecordRow, string>({ id: 'value', title: 'Value', value: (row) => row.value, width: 10 })],
    source: fromRows(signal(rows), { rowKey: (row) => row.id }),
  });
  const root = new Group();
  const loop = createEventLoop({ width: 96, height: 24 }, { caps });
  loop.mount(root);
  const result = personalizeGrid(grid, {
    store: createMemoryVariantStore(),
    host: {
      i18n,
      loop,
      desktop: {
        bounds: { x: 0, y: 0, width: 96, height: 24 },
        addWindow: (view) => root.add(view),
        removeWindow: (view) => root.remove(view),
      },
    },
  });
  const rendered = screen(loop);
  for (const label of Object.values(headers)) expect(rendered).toContain(label);

  loop.emitCommand(Commands.cancel);
  await expect(result).resolves.toEqual({ ok: false });
});
