/** Implementation coverage for complete Phase D locale fallback and accelerator parity. */
import { validateCatalog } from '@jsvision/i18n';
import { describe, expect, it } from 'vitest';

import {
  KANBAN_PHASE_D_ACCELERATOR_MANIFEST,
  KANBAN_PHASE_D_ENGLISH_CATALOG,
  KANBAN_PHASE_D_ENGLISH_MESSAGES,
} from '../src/index.js';
import * as locales from '../src/i18n/locales.js';

const EXPECTED_LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt-PT', 'pl', 'ro', 'sv'] as const;

describe('Phase D locale fallback overlays', () => {
  it('keeps every official locale complete, immutable, and accelerator-valid', () => {
    const catalogs = [
      locales.kanbanPhaseDEn,
      locales.kanbanPhaseDNl,
      locales.kanbanPhaseDDe,
      locales.kanbanPhaseDFr,
      locales.kanbanPhaseDEs,
      locales.kanbanPhaseDIt,
      locales.kanbanPhaseDPtPT,
      locales.kanbanPhaseDPl,
      locales.kanbanPhaseDRo,
      locales.kanbanPhaseDSv,
    ];

    expect(catalogs.map((catalog) => catalog.locale)).toEqual(EXPECTED_LOCALES);
    for (const catalog of catalogs) {
      expect(catalog.messages).toEqual(KANBAN_PHASE_D_ENGLISH_MESSAGES);
      expect(
        validateCatalog(catalog, {
          mode: 'strict',
          official: true,
          referenceCatalog: KANBAN_PHASE_D_ENGLISH_CATALOG,
          acceleratorManifest: KANBAN_PHASE_D_ACCELERATOR_MANIFEST,
        }),
      ).toEqual([]);
      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.messages)).toBe(true);
    }
  });
});
