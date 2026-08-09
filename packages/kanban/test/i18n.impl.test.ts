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
import { kanbanPhaseBDe } from '../src/i18n/translations/de.js';
import { kanbanPhaseBEs } from '../src/i18n/translations/es.js';
import { kanbanPhaseBFr } from '../src/i18n/translations/fr.js';
import { kanbanPhaseBIt } from '../src/i18n/translations/it.js';
import { kanbanPhaseBNl } from '../src/i18n/translations/nl.js';
import { kanbanPhaseBPl } from '../src/i18n/translations/pl.js';
import { kanbanPhaseBPtPT } from '../src/i18n/translations/pt-PT.js';
import { kanbanPhaseBRo } from '../src/i18n/translations/ro.js';
import { kanbanPhaseBSv } from '../src/i18n/translations/sv.js';

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

/** Exact compatibility overlays kept ready for later public locale integration. */
const ALL_PHASE_B_CATALOGS = Object.freeze([
  KANBAN_PHASE_B_ENGLISH_CATALOG,
  kanbanPhaseBNl,
  kanbanPhaseBDe,
  kanbanPhaseBFr,
  kanbanPhaseBEs,
  kanbanPhaseBIt,
  kanbanPhaseBPtPT,
  kanbanPhaseBPl,
  kanbanPhaseBRo,
  kanbanPhaseBSv,
]);

describe('Kanban authored catalog implementation', () => {
  it('keeps every official catalog deeply immutable and strict-reference valid', () => {
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

  it('exports exactly the ten approved named locale values', () => {
    expect(Object.keys(locales).sort()).toEqual([
      'kanbanDe',
      'kanbanEn',
      'kanbanEs',
      'kanbanFr',
      'kanbanIt',
      'kanbanNl',
      'kanbanPl',
      'kanbanPtPT',
      'kanbanRo',
      'kanbanSv',
    ]);
  });

  it('keeps all ten Phase B overlays strict-reference valid and translated', () => {
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

    const german = createI18n({ locale: 'de', catalogs: [kanbanPhaseBDe] });
    expect(german.t('kanban.interaction.selection-limit-exceeded')).toBe('Auswahllimit erreicht');
  });
});
