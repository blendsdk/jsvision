import { createKanbanColumnId, createKanbanInteractionController, resolveKanbanPresentation } from '@jsvision/kanban';
import type {
  KanbanInteractionControllerFactory,
  KanbanInteractionFacade,
  KanbanInteractionInspection,
  KanbanViewportInteractionAdapter,
} from '@jsvision/kanban';
import { KanbanPointerRouter, createWindowedKanbanFixture, routeKanbanKeyInput } from '@jsvision/kanban/testing';
import { kanbanDe } from '@jsvision/kanban/locales/de';
import { kanbanEn } from '@jsvision/kanban/locales/en';
import { kanbanEs } from '@jsvision/kanban/locales/es';
import { kanbanFr } from '@jsvision/kanban/locales/fr';
import { kanbanIt } from '@jsvision/kanban/locales/it';
import { kanbanNl } from '@jsvision/kanban/locales/nl';
import { kanbanPl } from '@jsvision/kanban/locales/pl';
import { kanbanPtPT } from '@jsvision/kanban/locales/pt-PT';
import { kanbanRo } from '@jsvision/kanban/locales/ro';
import { kanbanSv } from '@jsvision/kanban/locales/sv';

const defaultFactory: KanbanInteractionControllerFactory = createKanbanInteractionController;
type PublicInteractionSurface = KanbanInteractionFacade & KanbanViewportInteractionAdapter;
type PublicInteractionEvidence = KanbanInteractionInspection['focused'];
void (defaultFactory satisfies KanbanInteractionControllerFactory);

/** Keeps the type-only interaction contracts reachable from the packed root declaration. */
function acceptPublicInteractionTypes(
  _surface?: PublicInteractionSurface,
  _evidence?: PublicInteractionEvidence,
): void {}
acceptPublicInteractionTypes();

const columnId = createKanbanColumnId('ready-for-review');
const catalogs = [kanbanEn, kanbanNl, kanbanDe, kanbanFr, kanbanEs, kanbanIt, kanbanPtPT, kanbanPl, kanbanRo, kanbanSv];
const incompleteCatalog = catalogs.find(
  (catalog) =>
    typeof catalog.messages['kanban.board.label'] !== 'string' ||
    typeof catalog.messages['kanban.interaction.unavailable'] !== 'string',
);
if (
  columnId !== 'ready-for-review' ||
  typeof createKanbanInteractionController !== 'function' ||
  typeof resolveKanbanPresentation !== 'function' ||
  typeof createWindowedKanbanFixture !== 'function' ||
  typeof routeKanbanKeyInput !== 'function' ||
  typeof KanbanPointerRouter !== 'function' ||
  incompleteCatalog !== undefined
) {
  throw new Error('the packed Kanban identity contract returned an unexpected value');
}

console.log('kanban-contract-ok');
