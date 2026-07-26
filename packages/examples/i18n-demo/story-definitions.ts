import {
  formatCodeEditorDiagnosticOverlay,
  formatInvisibleCharacterWarning,
  inspectInvisibleCharacters,
} from '@jsvision/code-editor';
import type { CodeEditorOverlayPresentation } from '@jsvision/code-editor';
import { column, createMemoryVariantStore, EditableDataGrid, fromRows, personalizeGrid } from '@jsvision/datagrid';
import { changeDir, errorBox, nodeFileSystem, openFile } from '@jsvision/files';
import { formDialog } from '@jsvision/forms';
import { at, confirm, findDialog, Group, inputBox, Input, messageBox, replaceDialog, signal } from '@jsvision/ui';
import { z } from 'zod';
import {
  action,
  COMPONENT_VIEWPORTS,
  decorateCodeEditor,
  decorateDatagrid,
  decorateUi,
  EDITOR_VIEWPORTS,
  metadata,
  modalHost,
  modalStory,
  PERSONALIZATION_VIEWPORTS,
  story,
  translated,
  VERTICAL_VIEWPORTS,
} from './story-runtime.js';
import type { I18nStoryDefinition } from './story-runtime.js';

/** Internal builders for every registry category and required coverage family. */
export const I18N_STORY_DEFINITIONS: readonly I18nStoryDefinition[] = Object.freeze([
  story(metadata('standard/single', 'standard-actions', 'Single action', ['single']), (i18n) => ({
    title: translated(i18n, 'ui.dialog.confirm.title', 'Confirm'),
    body: 'One framework-owned action at its natural display-cell width.',
    actions: [action('ok', translated(i18n, 'ui.action.ok', '~O~K'))],
    arrangement: 'single',
  })),
  story(metadata('standard/pair', 'standard-actions', 'Action pair', ['pair']), (i18n) => ({
    title: 'Translated action pair',
    body: 'A translated primary action remains paired with an independent framework action.',
    actions: [
      action('cancel', translated(i18n, 'ui.action.cancel', '~C~ancel')),
      action('help', translated(i18n, 'files.action.help', '~H~elp')),
    ],
    arrangement: 'pair',
  })),
  story(metadata('standard/one-row', 'standard-actions', 'Long one-row group', ['one-row', 'long']), (i18n) => ({
    title: 'One-row actions',
    body: 'Framework actions share equal cells without changing their source order.',
    actions: [
      action('forms-ok', translated(i18n, 'ui.action.ok', '~O~K')),
      action('forms-cancel', translated(i18n, 'forms.action.cancel', '~C~ancel')),
    ],
    arrangement: 'one-row',
  })),
  story(metadata('standard/wrapped', 'standard-actions', 'Wrapped actions', ['wrapped']), (i18n) => ({
    title: 'Wrapped actions',
    body: 'Long confirmation choices wrap as one complete logical group.',
    actions: [
      action('yes', translated(i18n, 'ui.action.yes', '~Y~es')),
      action('no', translated(i18n, 'ui.action.no', '~N~o')),
    ],
    arrangement: 'wrapped',
  })),
  story(
    metadata('standard/vertical', 'standard-actions', 'Vertical actions', ['vertical'], VERTICAL_VIEWPORTS),
    (i18n) => ({
      title: 'Vertical actions',
      body: 'A vertical action rail preserves command and focus order.',
      actions: [
        action('ok', translated(i18n, 'ui.action.ok', '~O~K')),
        action('cancel', translated(i18n, 'ui.action.cancel', '~C~ancel')),
        action('yes', translated(i18n, 'ui.action.yes', '~Y~es')),
        action('no', translated(i18n, 'ui.action.no', '~N~o')),
        action('close', translated(i18n, 'ui.action.close', '~C~lose')),
      ],
      arrangement: 'vertical',
    }),
  ),
  modalStory(metadata('ui/message', 'ui', 'Message dialog', ['message'], COMPONENT_VIEWPORTS), ({ application }) => ({
    completion: messageBox(modalHost(application), {
      title: 'Localized message',
      text: 'Caller-owned message content',
      buttons: 'okCancel',
    }),
    actions: [],
    arrangement: 'pair',
  })),
  modalStory(
    metadata('ui/confirm', 'ui', 'Confirmation dialog', ['confirm'], COMPONENT_VIEWPORTS),
    ({ application }) => ({
      completion: confirm(modalHost(application), 'Caller-owned question'),
      actions: [],
      arrangement: 'pair',
    }),
  ),
  modalStory(metadata('ui/input', 'ui', 'Input dialog', ['input'], COMPONENT_VIEWPORTS), ({ application }) => ({
    completion: inputBox(modalHost(application), {
      title: 'Localized input',
      label: '~V~alue',
      value: signal('caller-owned'),
    }),
    actions: [],
    arrangement: 'pair',
  })),
  modalStory(
    metadata('ui/find', 'ui', 'Find editor dialog', ['find', 'editor-dialog'], COMPONENT_VIEWPORTS),
    ({ application }) => ({
      completion: findDialog(modalHost(application), {
        find: 'caller-owned',
        options: { caseSensitive: false, wholeWords: false },
      }),
      actions: [],
      arrangement: 'pair',
    }),
  ),
  modalStory(
    metadata('ui/replace', 'ui', 'Replace editor dialog', ['replace'], COMPONENT_VIEWPORTS),
    ({ application }) => ({
      completion: replaceDialog(modalHost(application), {
        find: 'caller-owned',
        replace: 'replacement',
        options: { caseSensitive: false, wholeWords: false },
        promptOnReplace: true,
        replaceAll: false,
      }),
      actions: [],
      arrangement: 'pair',
    }),
  ),
  story(
    metadata(
      'ui/surfaces',
      'ui',
      'Dialogs, dropdowns, Switch, and Calendar',
      ['dropdown', 'popup', 'switch', 'calendar', 'date-picker'],
      COMPONENT_VIEWPORTS,
    ),
    (i18n) => ({
      title: translated(i18n, 'ui.editor.find.title', 'Find'),
      body: [
        translated(i18n, 'ui.editor.find.label', '~F~ind'),
        translated(i18n, 'ui.editor.replace.label', '~R~eplace'),
        translated(i18n, 'ui.switch.on', 'On'),
        translated(i18n, 'ui.calendar.month.september', 'September'),
        translated(i18n, 'ui.calendar.today', 'Today'),
      ].join(' · '),
      actions: [
        action('ui-ok', translated(i18n, 'ui.action.ok', '~O~K')),
        action('ui-cancel', translated(i18n, 'ui.action.cancel', '~C~ancel')),
      ],
      arrangement: 'pair',
    }),
    decorateUi,
  ),
  modalStory(
    metadata('forms/dialogs', 'forms', 'Synchronous and asynchronous forms', ['sync', 'async'], COMPONENT_VIEWPORTS),
    ({ application }) => ({
      completion: formDialog(modalHost(application), {
        schema: z.object({ name: z.string().min(1) }),
        initial: { name: 'caller-owned' },
        asyncValidators: { name: async () => null },
        asyncDebounceMs: 0,
        title: 'Localized form',
        width: 44,
        height: 10,
        body: (form) => {
          const body = new Group();
          body.add(at(new Input({ value: form.field('name').value }), 1, 1, 30, 1));
          return body;
        },
      }),
      actions: [],
      arrangement: 'pair',
    }),
  ),
  modalStory(metadata('files/open', 'files', 'File dialog', ['file'], COMPONENT_VIEWPORTS), ({ application }) => ({
    completion: openFile(modalHost(application), { fs: nodeFileSystem, directory: process.cwd() }),
    actions: [],
    arrangement: 'vertical',
  })),
  modalStory(
    metadata('files/change-directory', 'files', 'Change-directory dialog', ['change-directory'], COMPONENT_VIEWPORTS),
    ({ application }) => ({
      completion: changeDir(modalHost(application), { fs: nodeFileSystem, directory: process.cwd() }),
      actions: [],
      arrangement: 'vertical',
    }),
  ),
  modalStory(
    metadata('files/error', 'files', 'File error dialog', ['error'], COMPONENT_VIEWPORTS),
    ({ application }) => ({
      completion: errorBox(modalHost(application), 'Caller-owned file error'),
      actions: [],
      arrangement: 'single',
    }),
  ),
  story(
    metadata(
      'datagrid/tools',
      'datagrid',
      'Filter and personalization tools',
      ['filter', 'value-list'],
      COMPONENT_VIEWPORTS,
    ),
    (i18n) => ({
      title: translated(i18n, 'datagrid.personalize.title', 'Personalize columns'),
      body: [
        translated(i18n, 'datagrid.filter.field.search', 'Search'),
        translated(i18n, 'datagrid.filter.status.truncated', 'list truncated — refine search'),
      ].join(' · '),
      actions: [
        action('grid-select-all', translated(i18n, 'datagrid.filter.action.select-all', 'Select All')),
        action('grid-save', translated(i18n, 'datagrid.personalize.action.save', 'Save')),
        action('grid-apply', translated(i18n, 'datagrid.personalize.action.apply', 'Apply')),
        action('grid-delete', translated(i18n, 'datagrid.personalize.action.delete', 'Delete')),
        action('grid-reset', translated(i18n, 'datagrid.personalize.action.reset', 'Reset')),
      ],
      arrangement: 'wrapped',
    }),
    decorateDatagrid,
  ),
  modalStory(
    metadata(
      'datagrid/personalization',
      'datagrid',
      'Grid personalization',
      ['personalization'],
      PERSONALIZATION_VIEWPORTS,
    ),
    ({ application, i18n }) => {
      interface DemoRow {
        readonly id: string;
        readonly value: string;
      }
      const grid = new EditableDataGrid<DemoRow>({
        columns: [column({ id: 'value', title: 'Caller value', value: (row) => row.value })],
        source: fromRows(signal([{ id: '1', value: 'caller-owned' }]), { rowKey: (row) => row.id }),
        i18n,
      });
      return {
        completion: personalizeGrid(grid, {
          store: createMemoryVariantStore(),
          host: modalHost(application),
        }),
        actions: [],
        arrangement: 'wrapped',
      };
    },
  ),
  story(
    metadata('formatting/examples', 'formatting', 'Locale formatting', ['number', 'date', 'plural', 'parameters']),
    (i18n) => ({
      title: 'Locale formatting',
      body: [
        i18n.number(1234567.89),
        i18n.date(Date.UTC(2026, 6, 26), { dateStyle: 'long', timeZone: 'UTC' }),
        i18n.t('code-editor.search.matches', { params: { count: 2 }, defaultMessage: '${count} matches' }),
      ].join(' · '),
      actions: [action('format-close', translated(i18n, 'ui.action.ok', '~O~K'))],
      arrangement: 'single',
    }),
  ),
  story(
    metadata('overrides/application', 'overrides', 'Application catalog overrides', [
      'long-caption',
      'malformed-accelerator',
    ]),
    (i18n) => ({
      title: 'Application overrides',
      body: 'Validated application messages override framework defaults without changing commands.',
      actions: [
        action('override-yes', translated(i18n, 'ui.action.yes', '~Y~es')),
        action('override-no', translated(i18n, 'ui.action.no', '~N~o')),
      ],
      arrangement: 'vertical',
    }),
  ),
  story(
    metadata('unicode/display-cells', 'unicode', 'Wide and combining glyphs', ['wide', 'emoji', 'combining']),
    () => ({
      title: 'Unicode display cells',
      body: '資料 · 🙂 · e\u0301 · complete glyphs are clipped only at cell boundaries.',
      actions: [action('unicode-confirm', '~確~認🙂'), action('unicode-cancel', '~E\u0301~取消')],
      arrangement: 'vertical',
    }),
  ),
  story(
    metadata(
      'code-editor/presentation',
      'code-editor',
      'Code Editor presentation',
      ['search', 'replace', 'diagnostics', 'assistance', 'status', 'degradation', 'invisible-warning'],
      EDITOR_VIEWPORTS,
    ),
    (i18n) => ({
      title: translated(i18n, 'code-editor.window.title', 'Code Editor'),
      body: [
        translated(i18n, 'code-editor.search.find', 'Find'),
        translated(i18n, 'code-editor.search.replace', 'Replace'),
        formatCodeEditorDiagnosticOverlay(
          {
            kind: 'diagnostic',
            items: ['[warning] Caller-owned diagnostic'],
            selected: 0,
            diagnostic: { severity: 'warning', detail: 'Caller-owned diagnostic' },
          } satisfies CodeEditorOverlayPresentation,
          i18n,
        )[0] ?? '',
        i18n.t('code-editor.degradation.feature-unavailable', {
          params: { feature: 'LSP' },
          defaultMessage: '${feature} unavailable',
        }),
        (() => {
          const warning = inspectInvisibleCharacters('caller\u202Eowned')[0];
          return warning === undefined ? '' : formatInvisibleCharacterWarning(warning, i18n);
        })(),
      ].join(' · '),
      actions: [
        action('editor-next', translated(i18n, 'code-editor.search.action.next', 'next')),
        action('editor-previous', translated(i18n, 'code-editor.search.action.previous', 'previous')),
        action('editor-replace', translated(i18n, 'code-editor.search.action.replace', 'replace')),
        action('editor-close', translated(i18n, 'code-editor.search.action.close', 'close')),
      ],
      arrangement: 'wrapped',
    }),
    decorateCodeEditor,
  ),
]);
