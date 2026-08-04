import { createKanbanTranslationCatalog } from '../translation.js';

/** Official Romanian Kanban catalog. */
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
