import { createKanbanPhaseBTranslationCatalog, createKanbanTranslationCatalog } from '../translation.js';

/** Official reviewed French Kanban catalog. */
export const kanbanFr = createKanbanTranslationCatalog('fr', {
  'kanban.board.label': 'Tableau Kanban',
  'kanban.board.no-columns': 'Aucune colonne',
  'kanban.state.loading': 'Chargement…',
  'kanban.state.refreshing': 'Actualisation…',
  'kanban.state.partial': 'Certaines cartes ne sont pas disponibles',
  'kanban.state.empty': 'Aucune carte',
  'kanban.state.error': 'Impossible de charger le tableau',
  'kanban.action.retry': 'Réessayer',
  'kanban.layout.minimum-size': 'Kanban nécessite au moins ${width} × ${height} cellules',
  'kanban.count.unknown': 'Nombre inconnu',
  'kanban.count.truncated': '${count} ou plus',
  'kanban.focused-column.previous': 'Colonne précédente',
  'kanban.focused-column.next': 'Colonne suivante',
  'kanban.focused-column.position': 'Colonne ${current} sur ${total}',
  'kanban.card.invalid-title': 'Carte non valide',
  'kanban.card.unknown-status': 'Statut inconnu',
  'kanban.reason.source-unavailable': 'Source indisponible',
  'kanban.reason.renderer-unavailable': 'Carte indisponible',
});

/** Official reviewed French Phase B Kanban overlay. */
export const kanbanPhaseBFr = createKanbanPhaseBTranslationCatalog('fr', {
  'kanban.action.open-card-editor': 'Ouvrir l’éditeur de carte',
});
