import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { createRenderRoot, stringWidth } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';

import { createDiagnosticOverlay } from '../controller-overlay.js';
import { createDegradationState, formatCodeEditorDegradationNotice } from '../degradation.js';
import { CODE_EDITOR_ENGLISH_CATALOG } from '../i18n/catalog.js';
import {
  clipCodeEditorDisplayText,
  formatCodeEditorDiagnosticOverlay,
  formatCodeEditorStatus,
  formatInvisibleCharacterWarning,
} from '../i18n/presentation.js';
import { inspectInvisibleCharacters } from '../languages/invisibles.js';
import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';
import { projectCodeEditorSearchPresentation } from './search-presentation.js';
import type { CodeEditorSearchState } from './search-session.js';

const capabilities = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** Creates a locale service whose short translations make projection boundaries unambiguous. */
function createTestI18n() {
  return createI18n({
    locale: 'de',
    catalogs: [
      CODE_EDITOR_ENGLISH_CATALOG,
      defineCatalog({
        schema: 1,
        locale: 'de',
        messages: {
          'code-editor.diagnostic.severity.error': 'Fehler',
          'code-editor.degradation.feature-unavailable': '${feature} fehlt',
          'code-editor.degradation.operation-pending': '${feature} wartet',
          'code-editor.invisible.warning': 'unsichtbar ${codePoint}',
          'code-editor.search.find': 'Suchen',
          'code-editor.search.replace': 'Ersetzen',
          'code-editor.search.matches': {
            kind: 'plural',
            parameter: 'count',
            cases: { one: '${count} Treffer', other: '${count} Treffer' },
          },
          'code-editor.search.case-sensitive': 'Groß/Klein',
          'code-editor.search.case-sensitive.on': 'an',
          'code-editor.search.case-sensitive.off': 'aus',
          'code-editor.search.action.next': 'weiter',
          'code-editor.search.action.previous': 'zurück',
          'code-editor.search.action.replace': 'ersetzen',
          'code-editor.search.action.replace-all': 'alle ersetzen',
          'code-editor.search.action.close': 'schließen',
          'code-editor.status.line': 'Z',
          'code-editor.status.column': 'S',
        },
      }),
    ],
  });
}

/** Creates an immutable search state with caller fields kept separate from translated wrappers. */
function searchState(overrides: Partial<CodeEditorSearchState> = {}): CodeEditorSearchState {
  return Object.freeze({
    open: true,
    replace: false,
    activeField: 'query',
    query: 'needle',
    replacement: '',
    caseSensitive: false,
    current: 0,
    total: 0,
    ...overrides,
  });
}

describe('Code Editor localized presentation', () => {
  test('translates only diagnostic wrapper metadata and preserves normalized external detail exactly', () => {
    const overlay = createDiagnosticOverlay('error', 'literal ${feature}\u001b[31m', 80);
    const rows = formatCodeEditorDiagnosticOverlay(overlay, createTestI18n(), 80);

    expect(overlay.items).toEqual(['[error] literal ${feature}']);
    expect(overlay.diagnostic).toEqual({ severity: 'error', detail: 'literal ${feature}' });
    expect(rows).toEqual(['[Fehler] literal ${feature}']);
  });

  test('formats only recognized degradation reasons and fails closed for hostile input', () => {
    const degradation = createDegradationState();
    degradation.fail('parser');
    const notice = degradation.snapshot().notices[0];

    expect(notice?.message).toBe('An optional editor feature is unavailable.');
    expect(notice === undefined ? undefined : formatCodeEditorDegradationNotice(notice, createTestI18n())).toBe(
      'parser fehlt',
    );
    expect(
      formatCodeEditorDegradationNotice({
        feature: 'parser',
        reason: 'limit',
        nonModal: true,
        truncated: true,
        presented: 2,
        discarded: 3,
      }),
    ).toBeUndefined();

    let reads = 0;
    const hostile = Object.defineProperty({}, 'reason', {
      get() {
        reads += 1;
        throw new Error('must not run');
      },
    });
    expect(Reflect.apply(formatCodeEditorDegradationNotice, undefined, [hostile])).toBeUndefined();
    expect(reads).toBe(0);
  });

  test('localizes validated invisible warnings without changing detection offsets or source text', () => {
    const source = `safe\u202Etext`;
    const warning = inspectInvisibleCharacters(source)[0];

    expect(warning).toEqual({ offset: 4, codePoint: 'U+202E', label: 'warning U+202E' });
    expect(warning === undefined ? undefined : formatInvisibleCharacterWarning(warning, createTestI18n())).toBe(
      'unsichtbar U+202E',
    );
    expect(source).toBe(`safe\u202Etext`);
    expect(
      Reflect.apply(formatInvisibleCharacterWarning, undefined, [
        { offset: 4, codePoint: 'not-a-token', label: 'safe fallback' },
      ]),
    ).toBe('warning');
  });

  test('clips terminal text in display cells without splitting wide glyphs or detached combining marks', () => {
    expect(clipCodeEditorDisplayText('A界B', 3)).toBe('A界');
    expect(clipCodeEditorDisplayText('A界B', 2)).toBe('A…');
    expect(clipCodeEditorDisplayText(`e\u0301x`, 1, false)).toBe(`e\u0301`);
    expect(stringWidth(clipCodeEditorDisplayText('界界', 3))).toBeLessThanOrEqual(3);
  });

  test('projects closed, find, and replace search surfaces into zero, one, and two bounded rows', () => {
    const i18n = createTestI18n();

    expect(projectCodeEditorSearchPresentation(searchState({ open: false }), i18n, 40)).toEqual({
      rowCount: 0,
      rows: [],
    });
    const find = projectCodeEditorSearchPresentation(
      searchState({ query: '原文 ${count}', current: 2, total: 3, caseSensitive: true }),
      i18n,
      80,
    );
    const replace = projectCodeEditorSearchPresentation(
      searchState({
        replace: true,
        activeField: 'replacement',
        query: 'needle',
        replacement: '置換 ${feature}',
        current: 1,
        total: 1,
      }),
      i18n,
      80,
    );

    expect(find.rowCount).toBe(1);
    expect(find.rows[0]).toContain('Suchen: 原文 ${count}');
    expect(find.rows[0]).toMatch(/^›Suchen:/u);
    expect(find.rows[0]).toContain('3 Treffer');
    expect(find.rows[0]).toContain('Groß/Klein: an');
    expect(replace.rowCount).toBe(2);
    expect(replace.rows[1]).toContain('Ersetzen: 置換 ${feature}');
    expect(replace.rows[1]).toMatch(/^›Ersetzen:/u);
    const roomyReplace = projectCodeEditorSearchPresentation(
      searchState({ replace: true, activeField: 'replacement', replacement: 'value' }),
      i18n,
      180,
    );
    expect(roomyReplace.rows[1]).toContain('[search.replaceCurrent] ersetzen');
    expect(roomyReplace.rows[1]).toContain('[search.replaceAll] alle ersetzen');
    expect(replace.rows.every((row) => stringWidth(row) <= 80)).toBe(true);
  });

  test('keeps required search content first and clips every row at tiny and wide-glyph widths', () => {
    const projected = projectCodeEditorSearchPresentation(
      searchState({ query: '界界界', total: 12, caseSensitive: true }),
      createTestI18n(),
      9,
    );

    expect(projected.rows).toHaveLength(1);
    expect(projected.rows[0]).toMatch(/^›Suchen:/u);
    expect(stringWidth(projected.rows[0] ?? '')).toBeLessThanOrEqual(9);
    expect(projectCodeEditorSearchPresentation(searchState(), createTestI18n(), 0).rows).toEqual(['']);
  });

  test('reserves document rows for visible find and replace chrome in the same projection tick', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({ text: 'one\ntwo\nthree\nfour', languageId: 'plain' }),
    });
    const editor = new CodeEditor({ controller, i18n: createTestI18n() });

    expect(editor.project({ width: 30, height: 6, caps: capabilities }).cells).toHaveLength(6);
    editor.execute('search.open');
    expect(editor.project({ width: 30, height: 6, caps: capabilities }).cells).toHaveLength(5);
    editor.execute('search.replaceOpen');
    expect(editor.project({ width: 30, height: 6, caps: capabilities }).cells).toHaveLength(4);

    controller.dispose();
  });

  test('draws localized search chrome while preserving the caller query bytes and interaction state', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({ text: 'Needle needle', languageId: 'plain' }),
    });
    const editor = new CodeEditor({ controller, i18n: createTestI18n() });
    editor.setSearchQuery('Needle');
    editor.setSearchCaseSensitive(true);
    editor.execute('search.open');
    editor.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 50, height: 5 } });
    const root = createRenderRoot({ width: 50, height: 5 }, { caps: capabilities });
    root.mount(editor);
    root.flush();
    const rendered = root
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''))
      .join('\n');

    expect(rendered).toContain('Suchen: Needle');
    expect(editor.searchState).toMatchObject({ query: 'Needle', total: 1, caseSensitive: true });
    controller.dispose();
  });

  test('formats status with localized labels, localized numbers, and line/column priority', () => {
    expect(formatCodeEditorStatus({ language: 'typescript', line: 12, column: 34 }, createTestI18n(), 40)).toBe(
      'Z 12, S 34  typescript',
    );
    expect(formatCodeEditorStatus({ language: 'typescript', line: 12, column: 34 }, createTestI18n(), 10)).toBe(
      'Z 12, S 34',
    );
    expect(stringWidth(formatCodeEditorStatus({ language: '界界', line: 1, column: 2 }, createTestI18n(), 9))).toBe(9);
  });

  test('reconstructs with a new locale without retaining the disposed editor presentation', () => {
    const firstController = createCodeEditorController({
      document: createDocumentModel({ text: 'first' }),
      host: () => new Promise((resolve) => queueMicrotask(() => resolve(true))),
    });
    const first = new CodeEditor({ controller: firstController, i18n: createTestI18n() });
    first.execute('search.open');
    first.setSearchQuery('secret');
    first.openCompletion([{ label: 'retained assistance' }]);
    first.openModal({ kind: 'chooser' });
    first.execute('save');
    expect(first.retainedState).toMatchObject({ popupRows: 1, pendingHostEffects: 1 });
    first.dispose();
    expect(first.retainedState).toMatchObject({ popupRows: 0, pendingHostEffects: 0 });

    const secondController = createCodeEditorController({ document: createDocumentModel({ text: 'second' }) });
    const second = new CodeEditor({ controller: secondController });
    expect(second.searchState).toMatchObject({ open: false, query: '' });
    expect(projectCodeEditorSearchPresentation(second.searchState, second.i18n, 40).rows).toEqual([]);
    expect(second.retainedState).toMatchObject({ popupRows: 0, pendingHostEffects: 0 });
    second.dispose();
  });
});
