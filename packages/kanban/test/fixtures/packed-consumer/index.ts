import {
  createKanbanColumnId,
  createKanbanInteractionController,
  createKanbanOperationIdRegistry,
  createKanbanRequestEnvelope,
  resolveKanbanPresentation,
  snapshotKanbanRequestProposal,
} from '@jsvision/kanban';
import type {
  KanbanExtensionRequest,
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
const standardProposal = snapshotKanbanRequestProposal({ kind: 'card-delete', cardKey: 42 });
const standardRequest = createKanbanRequestEnvelope(standardProposal, {
  operationId: 'packed-standard-1',
  expected: { source: 'source-r8' },
  signal: new AbortController().signal,
});
const legacyRequest: KanbanExtensionRequest<'example.review', { readonly cardKey: number }> = {
  kind: 'extension',
  extensionId: 'example.review',
  operationId: 'packed-legacy-1',
  expected: {},
  payload: { cardKey: 42 },
  signal: new AbortController().signal,
};
const adoptedLegacy = createKanbanRequestEnvelope(legacyRequest);
const operationIds = createKanbanOperationIdRegistry({ factory: () => 'packed-operation-1' });
const operationLease = operationIds.acquire();
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
  standardRequest.kind !== 'card-delete' ||
  standardRequest.operationId !== 'packed-standard-1' ||
  adoptedLegacy.operationId !== legacyRequest.operationId ||
  adoptedLegacy.signal !== legacyRequest.signal ||
  operationLease.operationId !== 'packed-operation-1' ||
  !operationLease.active() ||
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

operationLease.retain();
if (operationLease.active()) throw new Error('the packed operation ID lease did not complete');

console.log('kanban-contract-ok');
