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
  'kanban.action.open-card-editor': 'Kaarteditor openen',
  'kanban.card.feedback.pending': 'In behandeling',
  'kanban.card.feedback.invalid': 'Ongeldig',
  'kanban.card.feedback.rejected': 'Afgewezen',
});
