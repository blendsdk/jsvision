/**
 * Headless layout contracts for localized framework dialogs. Real application, modal, focus, and
 * render objects prove translated controls remain reachable inside an 80×24 terminal.
 */
import { expect, test } from 'vitest';
import { z } from 'zod';
import type { Cell } from '@jsvision/core';
import type { Catalog, I18n } from '@jsvision/i18n';
import { formDialog } from '@jsvision/forms';
import { FileDialog, nodeFileSystem } from '@jsvision/files';
import { column, createMemoryVariantStore, EditableDataGrid, fromRows, personalizeGrid } from '@jsvision/datagrid';
import {
  Button,
  Commands,
  createApplication,
  createI18n,
  defineCatalog,
  findDialog,
  Group,
  confirm,
  resolveCapabilities,
  signal,
} from '@jsvision/ui';
import type { View } from '@jsvision/ui';

const PACKAGE_NAMES = ['ui', 'forms', 'files', 'datagrid', 'code-editor'] as const;
const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt-PT', 'pl', 'ro', 'sv'] as const;
const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Load one catalog from each framework package and compose the requested service. */
async function frameworkI18n(locale: (typeof LOCALES)[number]): Promise<I18n> {
  const catalogs: Catalog[] = [];
  for (const packageName of PACKAGE_NAMES) {
    const module: Record<string, unknown> = await import(`@jsvision/${packageName}/locales/${locale}`);
    const values = Object.values(module);
    expect(values, `${packageName}/${locale} exports`).toHaveLength(1);
    catalogs.push(values[0] as Catalog);
  }
  return createI18n({ locale, catalogs });
}

/** Return every descendant of a composed real view. */
function descendants(view: View): readonly View[] {
  const children = view instanceof Group ? view.children : [];
  return children.flatMap((child) => [child, ...descendants(child)]);
}

/** Assert one mounted dialog and every required button fit the terminal and remain focus-reachable. */
function expectReachableDialog(app: ReturnType<typeof createApplication>): void {
  app.loop.renderRoot.flush();
  const dialog = app.desktop?.activeWindow();
  expect(dialog).not.toBeNull();
  if (dialog === null || dialog === undefined) return;
  const origin = app.loop.renderRoot.originOf(dialog);
  expect(origin).not.toBeNull();
  if (origin === null) return;
  expect(origin.x).toBeGreaterThanOrEqual(0);
  expect(origin.y).toBeGreaterThanOrEqual(0);
  expect(origin.x + dialog.bounds.width).toBeLessThanOrEqual(80);
  expect(origin.y + dialog.bounds.height).toBeLessThanOrEqual(24);

  const buttons = descendants(dialog).filter((view): view is Button => view instanceof Button);
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    const buttonOrigin = app.loop.renderRoot.originOf(button);
    expect(buttonOrigin).not.toBeNull();
    if (buttonOrigin === null) continue;
    expect(buttonOrigin.x).toBeGreaterThanOrEqual(origin.x);
    expect(buttonOrigin.y).toBeGreaterThanOrEqual(origin.y);
    expect(buttonOrigin.x + button.bounds.width).toBeLessThanOrEqual(origin.x + dialog.bounds.width);
    expect(buttonOrigin.y + button.bounds.height).toBeLessThanOrEqual(origin.y + dialog.bounds.height);
    expect(button.measure().width).toBeLessThanOrEqual(button.bounds.width);
  }

  const reachable = new Set<View>();
  const initial = app.loop.getFocused();
  if (initial !== null) reachable.add(initial);
  for (let index = 0; index < 32; index += 1) {
    app.loop.focusNext();
    const focused = app.loop.getFocused();
    if (focused === initial) break;
    if (focused !== null) reachable.add(focused);
  }
  for (const button of buttons) expect(reachable.has(button)).toBe(true);
}

/** Render the current terminal buffer without exposing internal widget fields. */
function screen(app: ReturnType<typeof createApplication>): string {
  app.loop.renderRoot.flush();
  return app.loop.renderRoot
    .buffer()
    .rows()
    .map((row: readonly Cell[]) => row.map((cell: Cell) => cell.char).join(''))
    .join('\n');
}

test.each(LOCALES)('keeps representative package dialogs reachable at 80×24 for %s', async (locale) => {
  const i18n = await frameworkI18n(locale);

  const confirmationApp = createApplication({ caps, viewport: { width: 80, height: 24 }, i18n });
  const confirmation = confirm(confirmationApp, 'Caller-owned question');
  expectReachableDialog(confirmationApp);
  confirmationApp.loop.emitCommand('no');
  await confirmation;

  const editorApp = createApplication({ caps, viewport: { width: 80, height: 24 }, i18n });
  const editor = findDialog(editorApp, {
    find: 'Caller-owned value',
    options: { caseSensitive: true, wholeWords: false },
  });
  expectReachableDialog(editorApp);
  editorApp.loop.emitCommand('cancel');
  await editor;

  const formsApp = createApplication({ caps, viewport: { width: 80, height: 24 }, i18n });
  const form = formDialog(formsApp, {
    schema: z.object({ value: z.string() }),
    initial: { value: 'caller-owned' },
    width: 40,
    height: 10,
    body: () => new Group(),
  });
  expectReachableDialog(formsApp);
  formsApp.loop.emitCommand(Commands.cancel);
  await form;

  const filesApp = createApplication({ caps, viewport: { width: 80, height: 24 }, i18n });
  const fileDialog = new FileDialog({
    fs: nodeFileSystem,
    directory: signal(process.cwd()),
    i18n,
  });
  filesApp.desktop.addWindow(fileDialog);
  expectReachableDialog(filesApp);
  filesApp.desktop.removeWindow(fileDialog);

  const datagridApp = createApplication({ caps, viewport: { width: 80, height: 24 }, i18n });
  const rows = signal([{ id: 'row', value: 'caller-owned' }]);
  const grid = new EditableDataGrid({
    columns: [
      column<{ id: string; value: string }, string>({
        id: 'value',
        title: 'Caller title',
        value: (row) => row.value,
      }),
    ],
    source: fromRows(rows, { rowKey: (row) => row.id }),
    i18n,
  });
  const personalization = personalizeGrid(grid, {
    store: createMemoryVariantStore(),
    host: datagridApp,
  });
  expectReachableDialog(datagridApp);
  datagridApp.loop.emitCommand(Commands.cancel);
  await personalization;
});

test('falls back only the malformed application accelerator label', async () => {
  const locale = 'en';
  const module: Record<string, unknown> = await import(`@jsvision/ui/locales/${locale}`);
  const english = Object.values(module)[0] as Catalog;
  const application = defineCatalog({
    schema: 1,
    locale: 'en',
    messages: {
      'ui.action.yes': 'Accept',
      'ui.action.no': '~D~ecline',
    },
  });
  const app = createApplication({
    caps,
    viewport: { width: 80, height: 24 },
    i18n: createI18n({ locale: 'en', catalogs: [english, application] }),
  });
  const result = confirm(app, 'Caller-owned question');

  const rendered = screen(app);
  expect(rendered).toContain('Yes');
  expect(rendered).toContain('Decline');
  expect(rendered).not.toContain('Accept');

  app.loop.emitCommand(Commands.no);
  await result;
});
