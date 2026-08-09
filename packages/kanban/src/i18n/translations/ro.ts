import { createKanbanPhaseBTranslationCatalog, createKanbanTranslationCatalog } from '../translation.js';

/** Official reviewed Romanian Kanban catalog. */
export const kanbanRo = createKanbanTranslationCatalog('ro', {
  'kanban.board.label': 'Panou Kanban',
  'kanban.board.no-columns': 'Nicio coloană',
  'kanban.state.loading': 'Se încarcă…',
  'kanban.state.refreshing': 'Se reîmprospătează…',
  'kanban.state.partial': 'Unele carduri nu sunt disponibile',
  'kanban.state.empty': 'Niciun card',
  'kanban.state.error': 'Panoul nu a putut fi încărcat',
  'kanban.action.retry': 'Reîncearcă',
  'kanban.layout.minimum-size': 'Kanban necesită cel puțin ${width} × ${height} celule',
  'kanban.count.unknown': 'Număr necunoscut',
  'kanban.count.truncated': '${count} sau mai multe',
  'kanban.focused-column.previous': 'Coloana precedentă',
  'kanban.focused-column.next': 'Coloana următoare',
  'kanban.focused-column.position': 'Coloana ${current} din ${total}',
  'kanban.card.invalid-title': 'Card nevalid',
  'kanban.card.unknown-status': 'Stare necunoscută',
  'kanban.reason.source-unavailable': 'Sursă indisponibilă',
  'kanban.reason.renderer-unavailable': 'Card indisponibil',
});

/** Official reviewed Romanian Phase B Kanban overlay. */
export const kanbanPhaseBRo = createKanbanPhaseBTranslationCatalog('ro', {
  'kanban.state.descriptor-limit': '${count} carduri depășesc limita de afișare',
  'kanban.action.open-card-editor': 'Deschide editorul de carduri',
  'kanban.card.feedback.pending': 'În așteptare',
  'kanban.card.feedback.invalid': 'Nevalid',
  'kanban.card.feedback.rejected': 'Respins',
  'kanban.state.filtered-empty': 'Niciun card nu corespunde filtrelor active',
  'kanban.state.collapsed': 'Restrâns',
  'kanban.action.clear-filters': 'Șterge filtrele',
  'kanban.workflow.definition-of-done': 'Definiția finalizării',
  'kanban.workflow.wip-minimum-not-met': 'Minimul de lucru în curs nu a fost atins',
  'kanban.workflow.wip-maximum-exceeded': 'Limita de lucru în curs a fost depășită',
  'kanban.workflow.wip-count-unavailable': 'Numărul lucrărilor în curs nu este disponibil',
  'kanban.reason.transition-unavailable': 'Tranziție indisponibilă',
  'kanban.swimlane.unavailable': 'Indisponibil',
  'kanban.interaction.navigation-pending': 'Se mută focalizarea…',
  'kanban.interaction.navigation-unavailable': 'Destinație indisponibilă',
  'kanban.interaction.navigation-error': 'Focalizarea nu a putut fi mutată',
  'kanban.interaction.selection-limit-exceeded': 'Limita de selecție a fost atinsă',
  'kanban.interaction.selection-pruned': 'Selecție actualizată',
  'kanban.interaction.unavailable': 'Interacțiune indisponibilă',
});
