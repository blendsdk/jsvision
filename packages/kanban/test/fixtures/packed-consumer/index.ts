import { createKanbanColumnId } from '@jsvision/kanban';

const columnId = createKanbanColumnId('ready-for-review');
if (columnId !== 'ready-for-review') {
  throw new Error('the packed Kanban identity contract returned an unexpected value');
}

console.log('kanban-contract-ok');
