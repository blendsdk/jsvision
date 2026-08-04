import { createKanbanTranslationCatalog } from '../translation.js';

/** Official German Kanban catalog. */
export const kanbanDe = createKanbanTranslationCatalog('de', {
  'kanban.board.label': 'Kanban-Board',
  'kanban.board.no-columns': 'Keine Spalten',
  'kanban.state.loading': 'Wird geladen…',
  'kanban.state.refreshing': 'Wird aktualisiert…',
  'kanban.state.partial': 'Einige Karten sind nicht verfügbar',
  'kanban.state.empty': 'Keine Karten',
  'kanban.state.error': 'Das Kanban-Board konnte nicht geladen werden',
  'kanban.action.retry': 'Erneut versuchen',
  'kanban.layout.minimum-size': 'Kanban benötigt mindestens ${width} × ${height} Zellen',
  'kanban.count.unknown': 'Anzahl unbekannt',
  'kanban.count.truncated': '${count} oder mehr',
  'kanban.focused-column.previous': 'Vorherige Spalte',
  'kanban.focused-column.next': 'Nächste Spalte',
  'kanban.focused-column.position': 'Spalte ${current} von ${total}',
  'kanban.card.invalid-title': 'Ungültige Karte',
  'kanban.card.unknown-status': 'Unbekannter Status',
  'kanban.reason.source-unavailable': 'Quelle nicht verfügbar',
  'kanban.reason.renderer-unavailable': 'Karte nicht verfügbar',
});
