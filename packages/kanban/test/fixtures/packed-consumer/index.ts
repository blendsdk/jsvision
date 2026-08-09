import { createKanbanColumnId, createKanbanInteractionController } from '@jsvision/kanban';
import type {
  KanbanInteractionControllerFactory,
  KanbanInteractionFacade,
  KanbanInteractionInspection,
  KanbanViewportInteractionAdapter,
} from '@jsvision/kanban';

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
if (columnId !== 'ready-for-review' || typeof createKanbanInteractionController !== 'function') {
  throw new Error('the packed Kanban identity contract returned an unexpected value');
}

console.log('kanban-contract-ok');
