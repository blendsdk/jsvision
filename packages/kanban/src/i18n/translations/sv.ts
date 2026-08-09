import { createKanbanPhaseBTranslationCatalog, createKanbanTranslationCatalog } from '../translation.js';

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
});
