import { createKanbanPhaseBTranslationCatalog, createKanbanTranslationCatalog } from '../translation.js';

/** Official reviewed Dutch Kanban catalog. */
export const kanbanNl = createKanbanTranslationCatalog('nl', {
  'kanban.board.label': 'Kanbanbord',
  'kanban.board.no-columns': 'Geen kolommen',
  'kanban.state.loading': 'Laden…',
  'kanban.state.refreshing': 'Vernieuwen…',
  'kanban.state.partial': 'Sommige kaarten zijn niet beschikbaar',
  'kanban.state.empty': 'Geen kaarten',
  'kanban.state.error': 'Kanbanbord kon niet worden geladen',
  'kanban.action.retry': 'Opnieuw proberen',
  'kanban.layout.minimum-size': 'Kanban heeft minimaal ${width} × ${height} cellen nodig',
  'kanban.count.unknown': 'Aantal onbekend',
  'kanban.count.truncated': '${count} of meer',
  'kanban.focused-column.previous': 'Vorige kolom',
  'kanban.focused-column.next': 'Volgende kolom',
  'kanban.focused-column.position': 'Kolom ${current} van ${total}',
  'kanban.card.invalid-title': 'Ongeldige kaart',
  'kanban.card.unknown-status': 'Onbekende status',
  'kanban.reason.source-unavailable': 'Bron niet beschikbaar',
  'kanban.reason.renderer-unavailable': 'Kaart niet beschikbaar',
});

/** Official reviewed Dutch Phase B Kanban overlay. */
export const kanbanPhaseBNl = createKanbanPhaseBTranslationCatalog('nl', {
  'kanban.state.descriptor-limit': '${count} kaarten vallen buiten de weergavelimiet',
  'kanban.action.open-card-editor': 'Kaarteditor openen',
  'kanban.card.feedback.pending': 'In behandeling',
  'kanban.card.feedback.invalid': 'Ongeldig',
  'kanban.card.feedback.rejected': 'Afgewezen',
  'kanban.state.filtered-empty': 'Geen kaarten voldoen aan de actieve filters',
  'kanban.state.collapsed': 'Ingeklapt',
  'kanban.action.clear-filters': 'Filters wissen',
  'kanban.workflow.definition-of-done': 'Definitie van klaar',
  'kanban.workflow.wip-minimum-not-met': 'WIP-minimum niet bereikt',
  'kanban.workflow.wip-maximum-exceeded': 'WIP-limiet overschreden',
  'kanban.workflow.wip-count-unavailable': 'WIP-aantal niet beschikbaar',
  'kanban.reason.transition-unavailable': 'Overgang niet beschikbaar',
  'kanban.swimlane.unavailable': 'Niet beschikbaar',
});
