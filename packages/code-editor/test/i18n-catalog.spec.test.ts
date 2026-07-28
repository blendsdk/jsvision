import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { createRenderRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';

import {
  CODE_EDITOR_ACCELERATOR_MANIFEST,
  CodeEditor,
  CodeEditorWindow,
  createCodeEditorController,
  createDocumentModel,
} from '../src/index.js';
import { CODE_EDITOR_ENGLISH_CATALOG } from '../src/i18n/catalog.js';
import { codeEditorNl } from '../src/i18n/locales.js';

const capabilities = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

const EXPECTED_KEYS = [
  'code-editor.degradation.feature-unavailable',
  'code-editor.degradation.operation-pending',
  'code-editor.diagnostic.severity.error',
  'code-editor.diagnostic.severity.hint',
  'code-editor.diagnostic.severity.information',
  'code-editor.diagnostic.severity.warning',
  'code-editor.invisible.warning',
  'code-editor.search.action.close',
  'code-editor.search.action.next',
  'code-editor.search.action.previous',
  'code-editor.search.action.replace',
  'code-editor.search.action.replace-all',
  'code-editor.search.case-sensitive',
  'code-editor.search.case-sensitive.off',
  'code-editor.search.case-sensitive.on',
  'code-editor.search.find',
  'code-editor.search.matches',
  'code-editor.search.replace',
  'code-editor.status.column',
  'code-editor.status.line',
  'code-editor.window.title',
] as const;

/** Creates a disposable controller with stable source and optional end-of-document caret status. */
function createController(text = 'const waarde = 1;') {
  const document = createDocumentModel({ text, languageId: 'typescript' });
  document.setSelection({ anchor: text.length, head: text.length });
  return createCodeEditorController({ document });
}

/** Reads the composed terminal characters from one mounted window. */
function renderWindow(window: CodeEditorWindow): string {
  window.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 46, height: 10 } });
  const root = createRenderRoot({ width: 46, height: 10 }, { caps: capabilities });
  root.mount(window);
  root.flush();
  return root
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

describe('Code Editor internationalization catalog and injection', () => {
  test('publishes one canonical complete English catalog with no accelerator scopes', () => {
    expect(CODE_EDITOR_ENGLISH_CATALOG).toMatchObject({ schema: 1, locale: 'en' });
    expect(Object.keys(CODE_EDITOR_ENGLISH_CATALOG.messages).sort()).toEqual([...EXPECTED_KEYS].sort());
    expect(CODE_EDITOR_ENGLISH_CATALOG.messages['code-editor.search.matches']).toEqual({
      kind: 'plural',
      parameter: 'count',
      cases: {
        one: '${count} match',
        other: '${count} matches',
      },
    });
    expect(CODE_EDITOR_ACCELERATOR_MANIFEST).toEqual({ scopes: [] });
  });

  test('renders historical English from isolated fallback services with no overlay or diagnostic sharing', () => {
    const firstController = createController();
    const secondController = createController();
    const first = new CodeEditor({ controller: firstController });
    const second = new CodeEditor({ controller: secondController });
    const firstWindowController = createController();
    const secondWindowController = createController();
    const firstWindow = new CodeEditorWindow({ controller: firstWindowController });
    const secondWindow = new CodeEditorWindow({ controller: secondWindowController });

    expect(first.i18n).not.toBe(second.i18n);
    expect(firstWindow.editor).toBeInstanceOf(CodeEditor);
    expect(renderWindow(firstWindow)).toContain('Ln 1, Col 18');
    expect(renderWindow(secondWindow)).toContain('Ln 1, Col 18');

    first.i18n.setCatalog(
      defineCatalog({ schema: 1, locale: 'en', messages: { 'code-editor.window.title': 'Overlay' } }),
    );
    first.i18n.t('code-editor.missing', { defaultMessage: 'fallback' });
    expect(first.i18n.t('code-editor.window.title')).toBe('Overlay');
    expect(first.i18n.diagnostics).toHaveLength(1);
    expect(second.i18n.t('code-editor.window.title')).toBe('Code Editor');
    expect(second.i18n.diagnostics).toEqual([]);

    firstController.dispose();
    secondController.dispose();
    firstWindowController.dispose();
    secondWindowController.dispose();
  });

  test('forwards the exact supplied service and localizes default window chrome', () => {
    const controller = createController(`${'\n'.repeat(11)}${'x'.repeat(33)}`);
    const i18n = createI18n({ locale: 'nl', catalogs: [CODE_EDITOR_ENGLISH_CATALOG, codeEditorNl] });
    const window = new CodeEditorWindow({ controller, i18n });
    const rendered = renderWindow(window);

    expect(window.i18n).toBe(i18n);
    expect(window.editor.i18n).toBe(i18n);
    expect(window.title()).toBe('Code-editor');
    expect(window.status).toEqual({ language: 'typescript', line: 12, column: 34 });
    expect(rendered).toContain('Reg 12, Kol 34');

    controller.dispose();
  });

  test('preserves an explicit caller title while application overrides win', () => {
    const controller = createController();
    const overrides = defineCatalog({
      schema: 1,
      locale: 'nl',
      messages: {
        'code-editor.window.title': 'Broneditor',
        'code-editor.status.line': 'R',
        'code-editor.status.column': 'K',
      },
    });
    const i18n = createI18n({
      locale: 'nl',
      catalogs: [CODE_EDITOR_ENGLISH_CATALOG, codeEditorNl, overrides],
    });
    const window = new CodeEditorWindow({ controller, i18n, title: 'main.ts' });
    const rendered = renderWindow(window);

    expect(window.title()).toBe('main.ts');
    expect(rendered).toContain('R 1, K 1');

    controller.dispose();
  });

  test('falls back to safe historical English for a missing localized entry', () => {
    const controller = createController();
    const incomplete = defineCatalog({
      schema: 1,
      locale: 'nl',
      messages: { 'code-editor.window.title': 'Code-editor' },
    });
    const i18n = createI18n({ locale: 'nl', catalogs: [incomplete] });
    const window = new CodeEditorWindow({ controller, i18n });
    const rendered = renderWindow(window);

    expect(rendered).toContain('Ln 1, Col 1');
    expect(i18n.diagnostics.map(({ code }) => code)).toContain('MISSING_TRANSLATION');

    controller.dispose();
  });

  test('selects zero, one, and other match messages through the service', () => {
    const i18n = createI18n({ locale: 'en', catalogs: [CODE_EDITOR_ENGLISH_CATALOG] });

    expect(i18n.t('code-editor.search.matches', { params: { count: 0 } })).toBe('0 matches');
    expect(i18n.t('code-editor.search.matches', { params: { count: 1 } })).toBe('1 match');
    expect(i18n.t('code-editor.search.matches', { params: { count: 2 } })).toBe('2 matches');
  });

  test('keeps the browser main entry free of Node exports while the Node subpath remains available', async () => {
    const main: Record<string, unknown> = await import('@jsvision/code-editor');
    const node: Record<string, unknown> = await import('@jsvision/code-editor/node');

    expect(main).not.toHaveProperty('createCodeEditorNodeRuntime');
    expect(main).not.toHaveProperty('createCodeEditorNodeSession');
    expect(node.createCodeEditorNodeRuntime).toBeTypeOf('function');
    expect(node.createCodeEditorNodeSession).toBeTypeOf('function');
  });
});
