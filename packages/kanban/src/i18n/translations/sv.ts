import { createKanbanTranslationCatalog } from '../translation.js';

/** Official Swedish Kanban catalog. */
export const kanbanSv = createKanbanTranslationCatalog('sv', {
  'kanban.board.label': 'Kanbantavla',
  'kanban.board.no-columns': 'Inga kolumner',
  'kanban.state.loading': 'Läser in…',
  'kanban.state.refreshing': 'Uppdaterar…',
  'kanban.state.partial': 'Vissa kort är inte tillgängliga',
  'kanban.state.empty': 'Inga kort',
  'kanban.state.error': 'Det gick inte att läsa in tavlan',
  'kanban.action.retry': 'Försök igen',
  'kanban.layout.minimum-size': 'Kanban behöver minst ${width} × ${height} celler',
  'kanban.count.unknown': 'Antal okänt',
  'kanban.count.truncated': '${count} eller fler',
  'kanban.focused-column.previous': 'Föregående kolumn',
  'kanban.focused-column.next': 'Nästa kolumn',
  'kanban.focused-column.position': 'Kolumn ${current} av ${total}',
  'kanban.card.invalid-title': 'Ogiltigt kort',
  'kanban.card.unknown-status': 'Okänd status',
  'kanban.reason.source-unavailable': 'Källa inte tillgänglig',
  'kanban.reason.renderer-unavailable': 'Kort inte tillgängligt',
});
