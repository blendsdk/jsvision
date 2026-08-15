import { defineCatalog } from '@jsvision/i18n';
import type { Catalog } from '@jsvision/i18n';

import {
  KANBAN_ACCELERATOR_MANIFEST,
  KANBAN_PLACEHOLDER_MANIFEST,
  KANBAN_PHASE_B_PLACEHOLDER_MANIFEST,
  KANBAN_PHASE_C_PLACEHOLDER_MANIFEST,
  KANBAN_PHASE_D_ACCELERATOR_MANIFEST,
  KANBAN_PHASE_D_ENGLISH_MESSAGES,
  type KanbanMessageMap,
  type KanbanPhaseBMessageMap,
  type KanbanPhaseCMessageMap,
  type KanbanPhaseDMessageMap,
} from './catalog.js';

/**
 * Builds one complete immutable authored Kanban catalog.
 *
 * This helper is package-internal: generated locale wrappers expose named catalog constants instead
 * of a runtime registration or partially typed catalog factory.
 */
export function createKanbanTranslationCatalog(locale: string, messages: KanbanMessageMap): Catalog {
  return defineCatalog(
    { schema: 1, locale, messages },
    {
      placeholderManifest: KANBAN_PLACEHOLDER_MANIFEST,
      acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
    },
  );
}

/** Builds one complete immutable authored Phase B translation overlay. */
export function createKanbanPhaseBTranslationCatalog(locale: string, messages: KanbanPhaseBMessageMap): Catalog {
  return defineCatalog(
    { schema: 1, locale, messages },
    {
      placeholderManifest: KANBAN_PHASE_B_PLACEHOLDER_MANIFEST,
      acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
    },
  );
}

/** Builds one complete immutable authored Phase C translation overlay. */
export function createKanbanPhaseCTranslationCatalog(locale: string, messages: KanbanPhaseCMessageMap): Catalog {
  return defineCatalog(
    { schema: 1, locale, messages },
    {
      placeholderManifest: KANBAN_PHASE_C_PLACEHOLDER_MANIFEST,
      acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
    },
  );
}

/**
 * Builds one complete Phase D locale overlay from the reviewed English fallback vocabulary.
 *
 * Native Phase D translations replace this fallback in a later language-review phase. Keeping a
 * locale-specific catalog now gives every supported locale identical keys and accelerator checks.
 */
export function createKanbanPhaseDTranslationCatalog(
  locale: string,
  messages: KanbanPhaseDMessageMap = KANBAN_PHASE_D_ENGLISH_MESSAGES,
): Catalog {
  return defineCatalog({ schema: 1, locale, messages }, { acceleratorManifest: KANBAN_PHASE_D_ACCELERATOR_MANIFEST });
}
