import {
  createKanbanPhaseBTranslationCatalog,
  createKanbanPhaseDTranslationCatalog,
  createKanbanPhaseCTranslationCatalog,
  createKanbanTranslationCatalog,
} from '../translation.js';

/** Phase D pl overlay using the reviewed English fallback until native language review. */
export const kanbanPhaseDPl = createKanbanPhaseDTranslationCatalog('pl');

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

/** Official reviewed Polish Phase C Kanban overlay. */
export const kanbanPhaseCPl = createKanbanPhaseCTranslationCatalog('pl', {
  'kanban.drag.card': 'Przenoszenie karty',
  'kanban.drag.cards': '${count} kart',
  'kanban.drop.allowed': 'Przenieś tutaj',
  'kanban.drop.warning': 'Przenieś z ostrzeżeniem',
  'kanban.drop.blocked': 'Przenoszenie zablokowane',
  'kanban.drop.unavailable': 'Miejsce docelowe niedostępne',
  'kanban.operation.pending': 'Przenoszenie oczekuje',
  'kanban.operation.accepted': 'Oczekiwanie na aktualizację tablicy',
  'kanban.operation.rejected': 'Przenoszenie odrzucone',
  'kanban.operation.cancelled': 'Przenoszenie anulowane',
  'kanban.operation.superseded': 'Tablica została zmieniona',
  'kanban.operation.conflict': 'Sprzeczna akcja niedostępna',
  'kanban.operation.stale-placement': 'Położenie uległo zmianie',
  'kanban.operation.sorted-placement': 'Umieszczono według bieżącego sortowania',
  'kanban.operation.filtered-placement': 'Karta może zostać odfiltrowana',
  'kanban.operation.transition-blocked': 'Przejście zablokowane',
  'kanban.operation.wip-blocked': 'Limit WIP blokuje to przeniesienie',
  'kanban.operation.definition-of-done': 'Definicja ukończenia nie została spełniona',
  'kanban.operation.reorder': 'Zmiana kolejności',
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
  'kanban.interaction.navigation-pending': 'Przenoszenie fokusu…',
  'kanban.interaction.navigation-unavailable': 'Miejsce docelowe niedostępne',
  'kanban.interaction.navigation-error': 'Nie udało się przenieść fokusu',
  'kanban.interaction.selection-limit-exceeded': 'Osiągnięto limit zaznaczenia',
  'kanban.interaction.selection-pruned': 'Zaznaczenie zaktualizowane',
  'kanban.interaction.selected-count': 'Wybrano: ${count}',
  'kanban.interaction.server-selection-active': 'Wybór serwerowy aktywny',
  'kanban.interaction.unavailable': 'Interakcja niedostępna',
});
