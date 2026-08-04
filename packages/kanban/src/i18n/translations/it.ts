import { createKanbanPhaseBTranslationCatalog, createKanbanTranslationCatalog } from '../translation.js';

/** Official reviewed Italian Kanban catalog. */
export const kanbanIt = createKanbanTranslationCatalog('it', {
  'kanban.board.label': 'Bacheca Kanban',
  'kanban.board.no-columns': 'Nessuna colonna',
  'kanban.state.loading': 'Caricamento…',
  'kanban.state.refreshing': 'Aggiornamento…',
  'kanban.state.partial': 'Alcune schede non sono disponibili',
  'kanban.state.empty': 'Nessuna scheda',
  'kanban.state.error': 'Impossibile caricare la bacheca',
  'kanban.action.retry': 'Riprova',
  'kanban.layout.minimum-size': 'Kanban richiede almeno ${width} × ${height} celle',
  'kanban.count.unknown': 'Conteggio sconosciuto',
  'kanban.count.truncated': '${count} o più',
  'kanban.focused-column.previous': 'Colonna precedente',
  'kanban.focused-column.next': 'Colonna successiva',
  'kanban.focused-column.position': 'Colonna ${current} di ${total}',
  'kanban.card.invalid-title': 'Scheda non valida',
  'kanban.card.unknown-status': 'Stato sconosciuto',
  'kanban.reason.source-unavailable': 'Origine non disponibile',
  'kanban.reason.renderer-unavailable': 'Scheda non disponibile',
});

/** Official reviewed Italian Phase B Kanban overlay. */
export const kanbanPhaseBIt = createKanbanPhaseBTranslationCatalog('it', {
  'kanban.action.open-card-editor': 'Apri editor scheda',
});
