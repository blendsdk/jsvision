import {
  createKanbanPhaseBTranslationCatalog,
  createKanbanPhaseDTranslationCatalog,
  createKanbanPhaseCTranslationCatalog,
  createKanbanTranslationCatalog,
} from '../translation.js';

/** Phase D sv overlay using the reviewed English fallback until native language review. */
export const kanbanPhaseDSv = createKanbanPhaseDTranslationCatalog('sv');

/** Official reviewed Swedish Kanban catalog. */
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

/** Official reviewed Swedish Phase C Kanban overlay. */
export const kanbanPhaseCSv = createKanbanPhaseCTranslationCatalog('sv', {
  'kanban.drag.card': 'Flyttar kort',
  'kanban.drag.cards': '${count} kort',
  'kanban.drop.allowed': 'Flytta hit',
  'kanban.drop.warning': 'Flytta med varning',
  'kanban.drop.blocked': 'Flytt blockerad',
  'kanban.drop.unavailable': 'Målet är inte tillgängligt',
  'kanban.operation.pending': 'Flytt väntar',
  'kanban.operation.accepted': 'Väntar på uppdatering av tavlan',
  'kanban.operation.rejected': 'Flytt avvisad',
  'kanban.operation.cancelled': 'Flytt avbruten',
  'kanban.operation.superseded': 'Tavlan har ändrats',
  'kanban.operation.conflict': 'Motstridig åtgärd är inte tillgänglig',
  'kanban.operation.stale-placement': 'Placeringen har ändrats',
  'kanban.operation.sorted-placement': 'Placerad enligt aktuell sortering',
  'kanban.operation.filtered-placement': 'Kortet kan filtreras bort',
  'kanban.operation.transition-blocked': 'Övergång blockerad',
  'kanban.operation.wip-blocked': 'WIP-gränsen blockerar flytten',
  'kanban.operation.definition-of-done': 'Definitionen av klart är inte uppfylld',
  'kanban.operation.reorder': 'Ändrar ordning',
});

/** Official reviewed Swedish Phase B Kanban overlay. */
export const kanbanPhaseBSv = createKanbanPhaseBTranslationCatalog('sv', {
  'kanban.state.descriptor-limit': '${count} kort ligger utanför visningsgränsen',
  'kanban.action.open-card-editor': 'Öppna kortredigeraren',
  'kanban.card.feedback.pending': 'Väntar',
  'kanban.card.feedback.invalid': 'Ogiltigt',
  'kanban.card.feedback.rejected': 'Avvisat',
  'kanban.state.filtered-empty': 'Inga kort matchar de aktiva filtren',
  'kanban.state.collapsed': 'Komprimerad',
  'kanban.action.clear-filters': 'Rensa filter',
  'kanban.workflow.definition-of-done': 'Definition av klart',
  'kanban.workflow.wip-minimum-not-met': 'Miniminivån för pågående arbete har inte uppnåtts',
  'kanban.workflow.wip-maximum-exceeded': 'Gränsen för pågående arbete har överskridits',
  'kanban.workflow.wip-count-unavailable': 'Antal pågående arbeten är inte tillgängligt',
  'kanban.reason.transition-unavailable': 'Övergång inte tillgänglig',
  'kanban.swimlane.unavailable': 'Inte tillgänglig',
  'kanban.interaction.navigation-pending': 'Flyttar fokus…',
  'kanban.interaction.navigation-unavailable': 'Målet är inte tillgängligt',
  'kanban.interaction.navigation-error': 'Det gick inte att flytta fokus',
  'kanban.interaction.selection-limit-exceeded': 'Urvalsgränsen har nåtts',
  'kanban.interaction.selection-pruned': 'Urvalet har uppdaterats',
  'kanban.interaction.selected-count': '${count} markerade',
  'kanban.interaction.server-selection-active': 'Serverurval aktivt',
  'kanban.interaction.unavailable': 'Interaktion är inte tillgänglig',
});
