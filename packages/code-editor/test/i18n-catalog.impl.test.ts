import { describe, expect, test } from 'vitest';

import { CODE_EDITOR_ENGLISH_CATALOG, createEnglishCodeEditorI18n } from '../src/i18n/catalog.js';
import {
  codeEditorDe,
  codeEditorEn,
  codeEditorEs,
  codeEditorFr,
  codeEditorIt,
  codeEditorNl,
  codeEditorPl,
  codeEditorPtPT,
  codeEditorRo,
  codeEditorSv,
} from '../src/i18n/locales.js';

const catalogs = [
  codeEditorEn,
  codeEditorNl,
  codeEditorDe,
  codeEditorFr,
  codeEditorEs,
  codeEditorIt,
  codeEditorPtPT,
  codeEditorPl,
  codeEditorRo,
  codeEditorSv,
] as const;

describe('Code Editor i18n catalog implementation', () => {
  test('keeps catalog objects and message maps immutable', () => {
    expect(Object.isFrozen(CODE_EDITOR_ENGLISH_CATALOG)).toBe(true);
    expect(Object.isFrozen(CODE_EDITOR_ENGLISH_CATALOG.messages)).toBe(true);
    for (const catalog of catalogs) {
      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.messages)).toBe(true);
    }
  });

  test('creates independent fallback services and bounded value-free diagnostics', () => {
    const first = createEnglishCodeEditorI18n();
    const second = createEnglishCodeEditorI18n();

    expect(first).not.toBe(second);
    expect(first.t('code-editor.unknown', { defaultMessage: 'Fallback' })).toBe('Fallback');
    expect(first.diagnostics).toEqual([
      expect.objectContaining({ code: 'MISSING_TRANSLATION', key: 'code-editor.unknown', locale: 'en' }),
    ]);
    expect(second.diagnostics).toEqual([]);
  });
});
