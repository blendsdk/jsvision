import { defineCatalog } from '@jsvision/i18n';
import type { Catalog, PlaceholderManifest } from '@jsvision/i18n';

import {
  KANBAN_ACCELERATOR_MANIFEST,
  KANBAN_ENGLISH_CATALOG,
  KANBAN_PHASE_B_ENGLISH_CATALOG,
  KANBAN_PHASE_B_PLACEHOLDER_MANIFEST,
  KANBAN_PLACEHOLDER_MANIFEST,
} from './catalog.js';
import { kanbanDe as kanbanFoundationDe, kanbanPhaseBDe } from './translations/de.js';
import { kanbanEs as kanbanFoundationEs, kanbanPhaseBEs } from './translations/es.js';
import { kanbanFr as kanbanFoundationFr, kanbanPhaseBFr } from './translations/fr.js';
import { kanbanIt as kanbanFoundationIt, kanbanPhaseBIt } from './translations/it.js';
import { kanbanNl as kanbanFoundationNl, kanbanPhaseBNl } from './translations/nl.js';
import { kanbanPl as kanbanFoundationPl, kanbanPhaseBPl } from './translations/pl.js';
import { kanbanPtPT as kanbanFoundationPtPT, kanbanPhaseBPtPT } from './translations/pt-PT.js';
import { kanbanRo as kanbanFoundationRo, kanbanPhaseBRo } from './translations/ro.js';
import { kanbanSv as kanbanFoundationSv, kanbanPhaseBSv } from './translations/sv.js';

/** Placeholder contract for the complete public Kanban locale catalog. */
const COMPLETE_PLACEHOLDER_MANIFEST: PlaceholderManifest = Object.freeze({
  ...KANBAN_PLACEHOLDER_MANIFEST,
  ...KANBAN_PHASE_B_PLACEHOLDER_MANIFEST,
});

/**
 * Combines the compatibility-preserving foundation and Phase B overlays behind one locale symbol.
 *
 * Keeping the overlay catalogs separate at their authored boundary lets each vocabulary remain
 * strict-reference validated. Public consumers still receive one catalog that can translate every
 * package-owned message without knowing which release introduced it.
 */
function completeCatalog(foundation: Catalog, phaseB: Catalog): Catalog {
  if (foundation.locale !== phaseB.locale) throw new Error('Kanban locale overlays must use the same locale');
  return defineCatalog(
    {
      schema: 1,
      locale: foundation.locale,
      messages: { ...foundation.messages, ...phaseB.messages },
    },
    {
      placeholderManifest: COMPLETE_PLACEHOLDER_MANIFEST,
      acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
    },
  );
}

/** Authored English catalog containing all public Kanban messages. */
export const kanbanEn = completeCatalog(KANBAN_ENGLISH_CATALOG, KANBAN_PHASE_B_ENGLISH_CATALOG);
/** Authored Dutch catalog containing all public Kanban messages. */
export const kanbanNl = completeCatalog(kanbanFoundationNl, kanbanPhaseBNl);
/** Authored German catalog containing all public Kanban messages. */
export const kanbanDe = completeCatalog(kanbanFoundationDe, kanbanPhaseBDe);
/** Authored French catalog containing all public Kanban messages. */
export const kanbanFr = completeCatalog(kanbanFoundationFr, kanbanPhaseBFr);
/** Authored Spanish catalog containing all public Kanban messages. */
export const kanbanEs = completeCatalog(kanbanFoundationEs, kanbanPhaseBEs);
/** Authored Italian catalog containing all public Kanban messages. */
export const kanbanIt = completeCatalog(kanbanFoundationIt, kanbanPhaseBIt);
/** Authored European Portuguese catalog containing all public Kanban messages. */
export const kanbanPtPT = completeCatalog(kanbanFoundationPtPT, kanbanPhaseBPtPT);
/** Authored Polish catalog containing all public Kanban messages. */
export const kanbanPl = completeCatalog(kanbanFoundationPl, kanbanPhaseBPl);
/** Authored Romanian catalog containing all public Kanban messages. */
export const kanbanRo = completeCatalog(kanbanFoundationRo, kanbanPhaseBRo);
/** Authored Swedish catalog containing all public Kanban messages. */
export const kanbanSv = completeCatalog(kanbanFoundationSv, kanbanPhaseBSv);
