import { createKanbanPhaseBTranslationCatalog, createKanbanTranslationCatalog } from '../translation.js';

/** Official reviewed European Portuguese Kanban catalog. */
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

/** Official reviewed European Portuguese Phase B Kanban overlay. */
export const kanbanPhaseBPtPT = createKanbanPhaseBTranslationCatalog('pt-PT', {
  'kanban.state.descriptor-limit': '${count} cartões estão fora do limite de visualização',
  'kanban.action.open-card-editor': 'Abrir editor de cartões',
  'kanban.card.feedback.pending': 'Pendente',
  'kanban.card.feedback.invalid': 'Inválido',
  'kanban.card.feedback.rejected': 'Rejeitado',
  'kanban.state.filtered-empty': 'Nenhum cartão corresponde aos filtros ativos',
  'kanban.state.collapsed': 'Recolhido',
  'kanban.action.clear-filters': 'Limpar filtros',
  'kanban.workflow.definition-of-done': 'Definição de concluído',
  'kanban.workflow.wip-minimum-not-met': 'Mínimo de trabalho em curso não atingido',
  'kanban.workflow.wip-maximum-exceeded': 'Limite de trabalho em curso excedido',
  'kanban.workflow.wip-count-unavailable': 'Contagem de trabalho em curso indisponível',
  'kanban.reason.transition-unavailable': 'Transição indisponível',
  'kanban.swimlane.unavailable': 'Indisponível',
});
