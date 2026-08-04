import { defineCatalog } from '@jsvision/i18n';
import type { Catalog } from '@jsvision/i18n';

import {
  KANBAN_ACCELERATOR_MANIFEST,
  KANBAN_PLACEHOLDER_MANIFEST,
  type KanbanMessageMap,
  type KanbanPhaseBMessageMap,
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
      placeholderManifest: Object.freeze({}),
      acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
    },
  );
}
