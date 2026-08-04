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
  'kanban.action.open-card-editor': 'Abrir editor de tarjetas',
  'kanban.card.feedback.pending': 'Pendiente',
  'kanban.card.feedback.invalid': 'No válida',
  'kanban.card.feedback.rejected': 'Rechazada',
});
