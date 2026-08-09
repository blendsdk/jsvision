import { createKanbanPhaseBTranslationCatalog, createKanbanTranslationCatalog } from '../translation.js';

/** Official reviewed Polish Kanban catalog. */
export const kanbanPl = createKanbanTranslationCatalog('pl', {
  'kanban.board.label': 'Tablica Kanban',
  'kanban.board.no-columns': 'Brak kolumn',
  'kanban.state.loading': 'Ładowanie…',
  'kanban.state.refreshing': 'Odświeżanie…',
  'kanban.state.partial': 'Niektóre karty są niedostępne',
  'kanban.state.empty': 'Brak kart',
  'kanban.state.error': 'Nie udało się załadować tablicy',
  'kanban.action.retry': 'Ponów',
  'kanban.layout.minimum-size': 'Kanban wymaga co najmniej ${width} × ${height} komórek',
  'kanban.count.unknown': 'Liczba nieznana',
  'kanban.count.truncated': '${count} lub więcej',
  'kanban.focused-column.previous': 'Poprzednia kolumna',
  'kanban.focused-column.next': 'Następna kolumna',
  'kanban.focused-column.position': 'Kolumna ${current} z ${total}',
  'kanban.card.invalid-title': 'Nieprawidłowa karta',
  'kanban.card.unknown-status': 'Nieznany status',
  'kanban.reason.source-unavailable': 'Źródło niedostępne',
  'kanban.reason.renderer-unavailable': 'Karta niedostępna',
});

/** Official reviewed Polish Phase B Kanban overlay. */
export const kanbanPhaseBPl = createKanbanPhaseBTranslationCatalog('pl', {
  'kanban.state.descriptor-limit': '${count} kart przekracza limit wyświetlania',
  'kanban.action.open-card-editor': 'Otwórz edytor karty',
  'kanban.card.feedback.pending': 'Oczekuje',
  'kanban.card.feedback.invalid': 'Nieprawidłowa',
  'kanban.card.feedback.rejected': 'Odrzucona',
  'kanban.state.filtered-empty': 'Żadne karty nie pasują do aktywnych filtrów',
  'kanban.state.collapsed': 'Zwinięte',
  'kanban.action.clear-filters': 'Wyczyść filtry',
  'kanban.workflow.definition-of-done': 'Definicja ukończenia',
  'kanban.workflow.wip-minimum-not-met': 'Nie osiągnięto minimalnego WIP',
  'kanban.workflow.wip-maximum-exceeded': 'Przekroczono limit WIP',
  'kanban.workflow.wip-count-unavailable': 'Liczba WIP jest niedostępna',
  'kanban.reason.transition-unavailable': 'Przejście niedostępne',
  'kanban.swimlane.unavailable': 'Niedostępne',
});
