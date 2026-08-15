import {
  captureKanbanSavedView,
  createKanbanActionRegistry,
  createKanbanColumnId,
  createKanbanEditorCoordinator,
  createKanbanEventHub,
  createKanbanHistoryBinding,
  createKanbanInteractionController,
  createKanbanOperationIdRegistry,
  createKanbanRequestEnvelope,
  createKanbanViewController,
  createStandardKanbanEditorAdapter,
  openKanbanCardCreateDialog,
  openKanbanColumnConfigurationDialog,
  parseKanbanSavedView,
  resolveKanbanPresentation,
  snapshotKanbanRequestProposal,
} from '@jsvision/kanban';
import { z } from 'zod';
import type {
  KanbanActionRegistry,
  KanbanConfigurationSession,
  KanbanEventHub,
  KanbanExtensionRequest,
  KanbanHistoryBinding,
  KanbanInteractionControllerFactory,
  KanbanInteractionFacade,
  KanbanInteractionInspection,
  KanbanViewportInteractionAdapter,
  KanbanViewState,
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
  _view?: KanbanViewState,
  _configuration?: KanbanConfigurationSession,
  _actions?: KanbanActionRegistry,
  _events?: KanbanEventHub,
  _history?: KanbanHistoryBinding,
): void {}
acceptPublicInteractionTypes();

const phaseDPublicValues = [
  createKanbanViewController,
  captureKanbanSavedView,
  parseKanbanSavedView,
  createKanbanEditorCoordinator,
  createStandardKanbanEditorAdapter,
  openKanbanCardCreateDialog,
  openKanbanColumnConfigurationDialog,
  createKanbanActionRegistry,
  createKanbanEventHub,
  createKanbanHistoryBinding,
] as const;

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
const editor = createStandardKanbanEditorAdapter({
  fields: ['title', 'status'],
  schema: z.object({ title: z.string(), status: z.string() }),
});
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
  editor.schema.fields.length !== 2 ||
  typeof createKanbanInteractionController !== 'function' ||
  typeof resolveKanbanPresentation !== 'function' ||
  typeof createWindowedKanbanFixture !== 'function' ||
  typeof routeKanbanKeyInput !== 'function' ||
  typeof KanbanPointerRouter !== 'function' ||
  phaseDPublicValues.some((value) => typeof value !== 'function') ||
  incompleteCatalog !== undefined ||
  incompleteOverlay !== undefined
) {
  throw new Error('the packed Kanban identity contract returned an unexpected value');
}

operationLease.retain();
if (operationLease.active()) throw new Error('the packed operation ID lease did not complete');

console.log('kanban-contract-ok');
