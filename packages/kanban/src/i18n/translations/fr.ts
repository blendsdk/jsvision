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
  'kanban.state.descriptor-limit': '${count} cartes dépassent la limite d’affichage',
  'kanban.action.open-card-editor': 'Ouvrir l’éditeur de carte',
  'kanban.card.feedback.pending': 'En attente',
  'kanban.card.feedback.invalid': 'Non valide',
  'kanban.card.feedback.rejected': 'Rejetée',
  'kanban.state.filtered-empty': 'Aucune carte ne correspond aux filtres actifs',
  'kanban.state.collapsed': 'Réduit',
  'kanban.action.clear-filters': 'Effacer les filtres',
  'kanban.workflow.definition-of-done': 'Définition de terminé',
  'kanban.workflow.wip-minimum-not-met': 'Minimum de travail en cours non atteint',
  'kanban.workflow.wip-maximum-exceeded': 'Limite de travail en cours dépassée',
  'kanban.workflow.wip-count-unavailable': 'Nombre de travaux en cours indisponible',
  'kanban.reason.transition-unavailable': 'Transition indisponible',
  'kanban.swimlane.unavailable': 'Indisponible',
  'kanban.interaction.navigation-pending': 'Déplacement du focus…',
  'kanban.interaction.navigation-unavailable': 'Destination indisponible',
  'kanban.interaction.navigation-error': 'Impossible de déplacer le focus',
  'kanban.interaction.selection-limit-exceeded': 'Limite de sélection atteinte',
  'kanban.interaction.selection-pruned': 'Sélection mise à jour',
  'kanban.interaction.selected-count': '${count} sélectionnées',
  'kanban.interaction.server-selection-active': 'Sélection serveur active',
  'kanban.interaction.unavailable': 'Interaction indisponible',
});
