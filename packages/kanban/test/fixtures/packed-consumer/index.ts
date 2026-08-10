import { createKanbanColumnId, createKanbanInteractionController, resolveKanbanPresentation } from '@jsvision/kanban';
import type {
  KanbanInteractionControllerFactory,
  KanbanInteractionFacade,
  KanbanInteractionInspection,
  KanbanViewportInteractionAdapter,
} from '@jsvision/kanban';
import { KanbanPointerRouter, createWindowedKanbanFixture, routeKanbanKeyInput } from '@jsvision/kanban/testing';
import { kanbanDe, kanbanPhaseBDe } from '@jsvision/kanban/locales/de';
import { kanbanEn, kanbanPhaseBEn } from '@jsvision/kanban/locales/en';
import { kanbanEs, kanbanPhaseBEs } from '@jsvision/kanban/locales/es';
import { kanbanFr, kanbanPhaseBFr } from '@jsvision/kanban/locales/fr';
import { kanbanIt, kanbanPhaseBIt } from '@jsvision/kanban/locales/it';
import { kanbanNl, kanbanPhaseBNl } from '@jsvision/kanban/locales/nl';
import { kanbanPhaseBPl, kanbanPl } from '@jsvision/kanban/locales/pl';
import { kanbanPhaseBPtPT, kanbanPtPT } from '@jsvision/kanban/locales/pt-PT';
import { kanbanPhaseBRo, kanbanRo } from '@jsvision/kanban/locales/ro';
import { kanbanPhaseBSv, kanbanSv } from '@jsvision/kanban/locales/sv';

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
const overlays = [
  kanbanPhaseBEn,
  kanbanPhaseBNl,
  kanbanPhaseBDe,
  kanbanPhaseBFr,
  kanbanPhaseBEs,
  kanbanPhaseBIt,
  kanbanPhaseBPtPT,
  kanbanPhaseBPl,
  kanbanPhaseBRo,
  kanbanPhaseBSv,
];
const incompleteCatalog = catalogs.find((catalog) => typeof catalog.messages['kanban.board.label'] !== 'string');
const incompleteOverlay = overlays.find(
  (catalog) => typeof catalog.messages['kanban.interaction.unavailable'] !== 'string',
);
if (
  columnId !== 'ready-for-review' ||
  typeof createKanbanInteractionController !== 'function' ||
  typeof resolveKanbanPresentation !== 'function' ||
  typeof createWindowedKanbanFixture !== 'function' ||
  typeof routeKanbanKeyInput !== 'function' ||
  typeof KanbanPointerRouter !== 'function' ||
  incompleteCatalog !== undefined ||
  incompleteOverlay !== undefined
) {
  throw new Error('the packed Kanban identity contract returned an unexpected value');
}

console.log('kanban-contract-ok');
