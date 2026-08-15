import { createI18n, validateCatalog } from '@jsvision/i18n';
import { describe, expect, it } from 'vitest';

import {
  KANBAN_ACCELERATOR_MANIFEST,
  KANBAN_ENGLISH_CATALOG,
  KANBAN_PHASE_B_ENGLISH_CATALOG,
  KANBAN_PHASE_B_PLACEHOLDER_MANIFEST,
  KANBAN_PLACEHOLDER_MANIFEST,
} from '../src/index.js';
import * as locales from '../src/i18n/locales.js';

const ALL_CATALOGS = Object.freeze([
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
]);

/** Public compatibility overlays containing Phase B vocabulary. */
const ALL_PHASE_B_CATALOGS = Object.freeze([
  locales.kanbanPhaseBEn,
  locales.kanbanPhaseBNl,
  locales.kanbanPhaseBDe,
  locales.kanbanPhaseBFr,
  locales.kanbanPhaseBEs,
  locales.kanbanPhaseBIt,
  locales.kanbanPhaseBPtPT,
  locales.kanbanPhaseBPl,
  locales.kanbanPhaseBRo,
  locales.kanbanPhaseBSv,
]);

describe('Kanban authored catalog implementation', () => {
  it('keeps every foundation catalog deeply immutable and strict-reference valid', () => {
    for (const catalog of ALL_CATALOGS) {
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
      expect(Object.isFrozen(catalog.messages)).toBe(true);
    }
  });

  it('interpolates every locale with the same exact placeholder contract', () => {
    for (const catalog of ALL_CATALOGS) {
      const i18n = createI18n({ locale: catalog.locale, catalogs: [catalog] });
      const size = i18n.t('kanban.layout.minimum-size', { params: { width: 18, height: 8 } });
      const count = i18n.t('kanban.count.truncated', { params: { count: 42 } });
      const position = i18n.t('kanban.focused-column.position', { params: { current: 2, total: 5 } });

      expect(size).toContain('18');
      expect(size).toContain('8');
      expect(count).toContain('42');
      expect(position).toContain('2');
      expect(position).toContain('5');
      expect(`${size}${count}${position}`).not.toContain('${');
    }
  });

  it('exports the ten stable foundation catalogs and additive Phase B, C, and D overlays', () => {
    expect(Object.keys(locales).sort()).toEqual([
      'kanbanDe',
      'kanbanEn',
      'kanbanEs',
      'kanbanFr',
      'kanbanIt',
      'kanbanNl',
      'kanbanPhaseBDe',
      'kanbanPhaseBEn',
      'kanbanPhaseBEs',
      'kanbanPhaseBFr',
      'kanbanPhaseBIt',
      'kanbanPhaseBNl',
      'kanbanPhaseBPl',
      'kanbanPhaseBPtPT',
      'kanbanPhaseBRo',
      'kanbanPhaseBSv',
      'kanbanPhaseCDe',
      'kanbanPhaseCEn',
      'kanbanPhaseCEs',
      'kanbanPhaseCFr',
      'kanbanPhaseCIt',
      'kanbanPhaseCNl',
      'kanbanPhaseCPl',
      'kanbanPhaseCPtPT',
      'kanbanPhaseCRo',
      'kanbanPhaseCSv',
      'kanbanPhaseDDe',
      'kanbanPhaseDEn',
      'kanbanPhaseDEs',
      'kanbanPhaseDFr',
      'kanbanPhaseDIt',
      'kanbanPhaseDNl',
      'kanbanPhaseDPl',
      'kanbanPhaseDPtPT',
      'kanbanPhaseDRo',
      'kanbanPhaseDSv',
      'kanbanPl',
      'kanbanPtPT',
      'kanbanRo',
      'kanbanSv',
    ]);
  });

  it('keeps all ten Phase B overlays strict-reference valid and translated', () => {
    expect(KANBAN_PHASE_B_PLACEHOLDER_MANIFEST).toEqual({
      'kanban.state.descriptor-limit': ['count'],
      'kanban.interaction.selected-count': ['count'],
    });
    for (const catalog of ALL_PHASE_B_CATALOGS) {
      expect(
        validateCatalog(catalog, {
          mode: 'strict',
          official: true,
          referenceCatalog: KANBAN_PHASE_B_ENGLISH_CATALOG,
          placeholderManifest: KANBAN_PHASE_B_PLACEHOLDER_MANIFEST,
          acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
        }),
      ).toEqual([]);
      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.messages)).toBe(true);
    }

    const german = createI18n({ locale: 'de', catalogs: [locales.kanbanPhaseBDe] });
    expect(german.t('kanban.interaction.selection-limit-exceeded')).toBe('Auswahllimit erreicht');
  });

  it('enforces selected-count parameters from the public manifest without reference fallback', () => {
    const malformed = {
      schema: 1 as const,
      locale: 'en',
      messages: {
        ...KANBAN_PHASE_B_ENGLISH_CATALOG.messages,
        'kanban.interaction.selected-count': 'Selected',
      },
    };
    const issues = validateCatalog(malformed, {
      mode: 'strict',
      referenceKeys: Object.keys(KANBAN_PHASE_B_ENGLISH_CATALOG.messages),
      placeholderManifest: KANBAN_PHASE_B_PLACEHOLDER_MANIFEST,
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_PARAMETER',
          path: ['messages', 'kanban.interaction.selected-count', 'placeholders'],
        }),
      ]),
    );
  });
});
