import { createI18n, validateCatalog } from '@jsvision/i18n';
import type { Catalog } from '@jsvision/i18n';
import { describe, expect, it } from 'vitest';

import {
  KANBAN_ACCELERATOR_MANIFEST,
  KANBAN_ENGLISH_CATALOG,
  KANBAN_ENGLISH_MESSAGES,
  KANBAN_PLACEHOLDER_MANIFEST,
  createEnglishKanbanI18n,
} from '../src/index.js';

const EXPECTED_KEYS = [
  'kanban.action.retry',
  'kanban.board.label',
  'kanban.board.no-columns',
  'kanban.card.invalid-title',
  'kanban.card.unknown-status',
  'kanban.count.truncated',
  'kanban.count.unknown',
  'kanban.focused-column.next',
  'kanban.focused-column.position',
  'kanban.focused-column.previous',
  'kanban.layout.minimum-size',
  'kanban.reason.renderer-unavailable',
  'kanban.reason.source-unavailable',
  'kanban.state.empty',
  'kanban.state.error',
  'kanban.state.loading',
  'kanban.state.partial',
  'kanban.state.refreshing',
] as const;

const EXPECTED_LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt-PT', 'pl', 'ro', 'sv'] as const;

/** Returns the sorted key inventory used for exact catalog parity assertions. */
function keysOf(catalog: Catalog): string[] {
  return Object.keys(catalog.messages).sort();
}

describe('Kanban Phase A catalog contract', () => {
  it('should publish the exact English vocabulary, placeholders, and empty accelerator topology', () => {
    expect(Object.keys(KANBAN_ENGLISH_MESSAGES).sort()).toEqual(EXPECTED_KEYS);
    expect(KANBAN_ENGLISH_MESSAGES).toEqual({
      'kanban.board.label': 'Kanban board',
      'kanban.board.no-columns': 'No columns',
      'kanban.state.loading': 'Loading…',
      'kanban.state.refreshing': 'Refreshing…',
      'kanban.state.partial': 'Some cards are unavailable',
      'kanban.state.empty': 'No cards',
      'kanban.state.error': 'Could not load the board',
      'kanban.action.retry': 'Retry',
      'kanban.layout.minimum-size': 'Kanban needs at least ${width} × ${height} cells',
      'kanban.count.unknown': 'Count unknown',
      'kanban.count.truncated': '${count} or more',
      'kanban.focused-column.previous': 'Previous column',
      'kanban.focused-column.next': 'Next column',
      'kanban.focused-column.position': 'Column ${current} of ${total}',
      'kanban.card.invalid-title': 'Invalid card',
      'kanban.card.unknown-status': 'Unknown status',
      'kanban.reason.source-unavailable': 'Source unavailable',
      'kanban.reason.renderer-unavailable': 'Card unavailable',
    });
    expect(KANBAN_PLACEHOLDER_MANIFEST).toEqual({
      'kanban.layout.minimum-size': ['width', 'height'],
      'kanban.count.truncated': ['count'],
      'kanban.focused-column.position': ['current', 'total'],
    });
    expect(KANBAN_ACCELERATOR_MANIFEST).toEqual({ scopes: [] });
    expect(Object.isFrozen(KANBAN_PLACEHOLDER_MANIFEST)).toBe(true);
    expect(Object.isFrozen(KANBAN_ACCELERATOR_MANIFEST.scopes)).toBe(true);
  });

  it('should provide a complete immutable English catalog and isolated English service', () => {
    expect(KANBAN_ENGLISH_CATALOG.locale).toBe('en');
    expect(keysOf(KANBAN_ENGLISH_CATALOG)).toEqual(EXPECTED_KEYS);
    expect(Object.isFrozen(KANBAN_ENGLISH_CATALOG)).toBe(true);
    expect(Object.isFrozen(KANBAN_ENGLISH_CATALOG.messages)).toBe(true);

    const i18n = createEnglishKanbanI18n();
    expect(i18n.t('kanban.board.label')).toBe('Kanban board');
    expect(i18n.t('kanban.focused-column.position', { params: { current: 2, total: 4 } })).toBe('Column 2 of 4');
  });

  it('should keep all ten authored locale values exactly aligned with English', async () => {
    const locales = await import('../src/i18n/locales.js');
    const catalogs = [
      locales.kanbanEn,
      locales.kanbanNl,
      locales.kanbanDe,
      locales.kanbanFr,
      locales.kanbanEs,
      locales.kanbanIt,
      locales.kanbanPtPT,
      locales.kanbanPl,
      locales.kanbanRo,
      locales.kanbanSv,
    ];

    expect(catalogs.map((catalog) => catalog.locale)).toEqual(EXPECTED_LOCALES);
    for (const catalog of catalogs) {
      expect(keysOf(catalog)).toEqual(EXPECTED_KEYS);
      expect(
        validateCatalog(catalog, {
          mode: 'strict',
          official: true,
          referenceCatalog: KANBAN_ENGLISH_CATALOG,
          placeholderManifest: KANBAN_PLACEHOLDER_MANIFEST,
          acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
        }),
      ).toEqual([]);
      expect(Object.isFrozen(catalog)).toBe(true);
    }
  });

  it('should import authored locale catalogs without registering process-global locale state', async () => {
    const before = createI18n({ locale: 'nl' });
    expect(before.t('kanban.board.label')).toBe('kanban.board.label');

    await import('../src/i18n/locales.js');

    const after = createI18n({ locale: 'nl' });
    expect(after.t('kanban.board.label')).toBe('kanban.board.label');
  });
});
