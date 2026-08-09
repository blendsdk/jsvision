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
  'kanban.state.descriptor-limit': '${count} schede superano il limite di visualizzazione',
  'kanban.action.open-card-editor': 'Apri editor scheda',
  'kanban.card.feedback.pending': 'In attesa',
  'kanban.card.feedback.invalid': 'Non valida',
  'kanban.card.feedback.rejected': 'Rifiutata',
  'kanban.state.filtered-empty': 'Nessuna scheda corrisponde ai filtri attivi',
  'kanban.state.collapsed': 'Compresso',
  'kanban.action.clear-filters': 'Cancella filtri',
  'kanban.workflow.definition-of-done': 'Definizione di completato',
  'kanban.workflow.wip-minimum-not-met': 'Minimo del lavoro in corso non raggiunto',
  'kanban.workflow.wip-maximum-exceeded': 'Limite del lavoro in corso superato',
  'kanban.workflow.wip-count-unavailable': 'Conteggio del lavoro in corso non disponibile',
  'kanban.reason.transition-unavailable': 'Transizione non disponibile',
  'kanban.swimlane.unavailable': 'Non disponibile',
  'kanban.interaction.navigation-pending': 'Spostamento del focus…',
  'kanban.interaction.navigation-unavailable': 'Destinazione non disponibile',
  'kanban.interaction.navigation-error': 'Impossibile spostare il focus',
  'kanban.interaction.selection-limit-exceeded': 'Limite di selezione raggiunto',
  'kanban.interaction.selection-pruned': 'Selezione aggiornata',
  'kanban.interaction.unavailable': 'Interazione non disponibile',
});
