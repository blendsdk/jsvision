import { createKanbanTranslationCatalog } from '../translation.js';

/** Official European Portuguese Kanban catalog. */
export const kanbanPtPT = createKanbanTranslationCatalog('pt-PT', {
  'kanban.board.label': 'Quadro Kanban',
  'kanban.board.no-columns': 'Sem colunas',
  'kanban.state.loading': 'A carregar…',
  'kanban.state.refreshing': 'A atualizar…',
  'kanban.state.partial': 'Alguns cartões não estão disponíveis',
  'kanban.state.empty': 'Sem cartões',
  'kanban.state.error': 'Não foi possível carregar o quadro',
  'kanban.action.retry': 'Tentar novamente',
  'kanban.layout.minimum-size': 'O Kanban precisa de pelo menos ${width} × ${height} células',
  'kanban.count.unknown': 'Contagem desconhecida',
  'kanban.count.truncated': '${count} ou mais',
  'kanban.focused-column.previous': 'Coluna anterior',
  'kanban.focused-column.next': 'Coluna seguinte',
  'kanban.focused-column.position': 'Coluna ${current} de ${total}',
  'kanban.card.invalid-title': 'Cartão inválido',
  'kanban.card.unknown-status': 'Estado desconhecido',
  'kanban.reason.source-unavailable': 'Fonte indisponível',
  'kanban.reason.renderer-unavailable': 'Cartão indisponível',
});
