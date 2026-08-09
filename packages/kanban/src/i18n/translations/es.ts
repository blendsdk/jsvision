import { createKanbanPhaseBTranslationCatalog, createKanbanTranslationCatalog } from '../translation.js';

/** Official reviewed Spanish Kanban catalog. */
export const kanbanEs = createKanbanTranslationCatalog('es', {
  'kanban.board.label': 'Tablero Kanban',
  'kanban.board.no-columns': 'Sin columnas',
  'kanban.state.loading': 'Cargando…',
  'kanban.state.refreshing': 'Actualizando…',
  'kanban.state.partial': 'Algunas tarjetas no están disponibles',
  'kanban.state.empty': 'Sin tarjetas',
  'kanban.state.error': 'No se pudo cargar el tablero',
  'kanban.action.retry': 'Reintentar',
  'kanban.layout.minimum-size': 'Kanban necesita al menos ${width} × ${height} celdas',
  'kanban.count.unknown': 'Recuento desconocido',
  'kanban.count.truncated': '${count} o más',
  'kanban.focused-column.previous': 'Columna anterior',
  'kanban.focused-column.next': 'Columna siguiente',
  'kanban.focused-column.position': 'Columna ${current} de ${total}',
  'kanban.card.invalid-title': 'Tarjeta no válida',
  'kanban.card.unknown-status': 'Estado desconocido',
  'kanban.reason.source-unavailable': 'Fuente no disponible',
  'kanban.reason.renderer-unavailable': 'Tarjeta no disponible',
});

/** Official reviewed Spanish Phase B Kanban overlay. */
export const kanbanPhaseBEs = createKanbanPhaseBTranslationCatalog('es', {
  'kanban.state.descriptor-limit': '${count} tarjetas están fuera del límite de visualización',
  'kanban.action.open-card-editor': 'Abrir editor de tarjetas',
  'kanban.card.feedback.pending': 'Pendiente',
  'kanban.card.feedback.invalid': 'No válida',
  'kanban.card.feedback.rejected': 'Rechazada',
  'kanban.state.filtered-empty': 'Ninguna tarjeta coincide con los filtros activos',
  'kanban.state.collapsed': 'Contraído',
  'kanban.action.clear-filters': 'Borrar filtros',
  'kanban.workflow.definition-of-done': 'Definición de terminado',
  'kanban.workflow.wip-minimum-not-met': 'No se alcanzó el mínimo de trabajo en curso',
  'kanban.workflow.wip-maximum-exceeded': 'Se superó el límite de trabajo en curso',
  'kanban.workflow.wip-count-unavailable': 'Recuento de trabajo en curso no disponible',
  'kanban.reason.transition-unavailable': 'Transición no disponible',
  'kanban.swimlane.unavailable': 'No disponible',
  'kanban.interaction.navigation-pending': 'Moviendo el foco…',
  'kanban.interaction.navigation-unavailable': 'Destino no disponible',
  'kanban.interaction.navigation-error': 'No se pudo mover el foco',
  'kanban.interaction.selection-limit-exceeded': 'Se alcanzó el límite de selección',
  'kanban.interaction.selection-pruned': 'Selección actualizada',
  'kanban.interaction.selected-count': '${count} seleccionadas',
  'kanban.interaction.server-selection-active': 'Selección del servidor activa',
  'kanban.interaction.unavailable': 'Interacción no disponible',
});
