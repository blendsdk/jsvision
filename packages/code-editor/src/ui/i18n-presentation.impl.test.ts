import { createI18n } from '@jsvision/i18n';
import { stringWidth } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';

import { createDiagnosticOverlay } from '../controller-overlay.js';
import { CODE_EDITOR_ENGLISH_CATALOG } from '../i18n/catalog.js';
import {
  clipCodeEditorDisplayText,
  formatCodeEditorDiagnosticOverlay,
  formatCodeEditorStatus,
  formatInvisibleCharacterWarning,
} from '../i18n/presentation.js';
import { CodeEditorAssistanceView } from './assistance.js';
import { projectCodeEditorSearchPresentation } from './search-presentation.js';

const english = createI18n({ locale: 'en', catalogs: [CODE_EDITOR_ENGLISH_CATALOG] });

describe('Code Editor i18n presentation boundaries', () => {
  test('freezes projected search rows and stops after the first higher-priority segment cannot fit', () => {
    const state = Object.freeze({
      open: true,
      replace: false,
      activeField: 'query' as const,
      query: 'needle',
      replacement: '',
      caseSensitive: true,
      current: 1,
      total: 2,
    });
    const narrow = projectCodeEditorSearchPresentation(state, english, 14);
    const wide = projectCodeEditorSearchPresentation(state, english, 120);

    expect(Object.isFrozen(narrow)).toBe(true);
    expect(Object.isFrozen(narrow.rows)).toBe(true);
    expect(narrow.rows).toEqual(['›Find: needle']);
    expect(narrow.rows[0]).not.toContain('[Enter]');
    expect(wide.rows[0]).toContain('2 matches');
    expect(wide.rows[0]).toContain('[Enter] next');
  });

  test('handles invalid widths, ASCII ellipses, leading combining marks, and wide popup labels', () => {
    expect(clipCodeEditorDisplayText('abcdef', Number.NaN)).toBe('');
    expect(clipCodeEditorDisplayText('abcdef', 4)).toBe('abc…');
    expect(clipCodeEditorDisplayText(`\u0301a`, 1, false)).toBe('a');

    const assistance = new CodeEditorAssistanceView({ maxWidth: 4 });
    assistance.show(['界界界']);
    expect(assistance.items).toEqual(['界界']);
    expect(stringWidth(assistance.items[0] ?? '')).toBe(4);
    expect(assistance.layout.rect?.width).toBeLessThanOrEqual(6);
  });

  test('retains compatible custom overlay rows when diagnostic metadata is absent', () => {
    const custom = Object.freeze({
      kind: 'diagnostic' as const,
      items: Object.freeze(['legacy 界 row']),
      selected: 0,
    });

    expect(formatCodeEditorDiagnosticOverlay(custom, english, 8)).toEqual(['legacy …']);
    expect(createDiagnosticOverlay('warning', 'detail', 20).items).toEqual(['[warning] detail']);
  });

  test('fails closed for proxy warnings and clips status coordinates before language text', () => {
    const hostile = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('blocked');
        },
      },
    );

    expect(Reflect.apply(formatInvisibleCharacterWarning, undefined, [hostile, english])).toBe('warning');
    expect(
      Reflect.apply(formatInvisibleCharacterWarning, undefined, [
        { codePoint: 'invalid', label: '\u001b[2Jowned' },
        english,
      ]),
    ).toBe('warning');
    expect(formatCodeEditorStatus({ language: 'typescript', line: 123, column: 456 }, english, 8)).toBe('Ln 123,…');
    expect(
      stringWidth(formatCodeEditorStatus({ language: '界界', line: 1, column: 2 }, english, 12)),
    ).toBeLessThanOrEqual(12);
  });

  test('does not invoke accessors on hostile public diagnostic, search, or status projector input', () => {
    let reads = 0;
    const hostile = Object.defineProperty({}, 'diagnostic', {
      get() {
        reads += 1;
        throw new Error('must not run');
      },
    });

    expect(Reflect.apply(formatCodeEditorDiagnosticOverlay, undefined, [hostile, english, 20])).toEqual([]);
    expect(Reflect.apply(projectCodeEditorSearchPresentation, undefined, [hostile, english, 20])).toEqual({
      rowCount: 0,
      rows: [],
    });
    expect(Reflect.apply(formatCodeEditorStatus, undefined, [hostile, english, 20])).toBe('Ln 1, Col 1');
    expect(reads).toBe(0);
  });
});
