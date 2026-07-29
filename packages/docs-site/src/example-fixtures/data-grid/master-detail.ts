import { Text, signal } from '@jsvision/ui';
import { EditableDataGrid, column, fromReactiveRows, masterDetail } from '@jsvision/datagrid';
import type { DataGridLabRow } from './data.js';

/** One work item shown beneath its owning customer in the master/detail laboratory. */
interface CustomerWorkItem {
  /** Stable detail-row identity. */
  readonly id: string;
  /** Stable key of the customer that owns this work item. */
  readonly customerId: string;
  /** Short work-item description. */
  readonly workItem: string;
  /** Team member responsible for the work. */
  readonly owner: string;
  /** Planned effort in hours. */
  readonly hours: number;
  /** Current delivery state. */
  readonly status: 'Planned' | 'Active' | 'Done';
}

/** Views that make up the vertically stacked Data Grid master/detail lesson. */
export interface DataGridMasterDetailLayout {
  /** Caption above the customer master grid. */
  readonly masterLabel: Text;
  /** Caption above the work-item detail grid. */
  readonly detailLabel: Text;
  /** Detail grid whose rows follow the master grid's focused customer. */
  readonly detailGrid: EditableDataGrid<CustomerWorkItem>;
}

/**
 * Move the master cursor through the same public keyboard seam used by the live grid.
 *
 * @param master Grid whose focused row drives the detail source.
 * @param target Whether to advance one row or return to the first master row.
 */
export function moveDataGridMasterCursor(master: EditableDataGrid<DataGridLabRow>, target: 'next' | 'first'): void {
  const event = {
    event: {
      type: 'key' as const,
      key: target === 'next' ? 'down' : 'home',
      ctrl: target === 'first',
      alt: false,
      shift: false,
    },
    handled: false,
  };
  master.rows.onEvent(event);
}

const CUSTOMER_WORK_ITEMS: readonly CustomerWorkItem[] = Object.freeze([
  { id: 'work-1', customerId: 'customer-1', workItem: 'Discovery', owner: 'Mina', hours: 12, status: 'Done' },
  { id: 'work-2', customerId: 'customer-1', workItem: 'Onboarding', owner: 'Ivo', hours: 8, status: 'Active' },
  { id: 'work-3', customerId: 'customer-2', workItem: 'Migration', owner: 'Noor', hours: 24, status: 'Active' },
  { id: 'work-4', customerId: 'customer-2', workItem: 'Validation', owner: 'Mina', hours: 10, status: 'Planned' },
  { id: 'work-5', customerId: 'customer-2', workItem: 'Cutover', owner: 'Ivo', hours: 6, status: 'Planned' },
  { id: 'work-6', customerId: 'customer-3', workItem: 'Renewal', owner: 'Noor', hours: 5, status: 'Active' },
  { id: 'work-7', customerId: 'customer-3', workItem: 'Training', owner: 'Mina', hours: 9, status: 'Planned' },
]);

/**
 * Create a real detail grid linked to the record under the master grid's cursor.
 *
 * The detail source filters by the master's stable row key. Sorting or filtering the master can
 * therefore move a customer without accidentally displaying another customer's work items.
 *
 * @param master Customer grid that owns keyboard focus and drives the detail rows.
 * @returns Labels and the linked detail grid for the shared responsive laboratory layout.
 */
export function createDataGridMasterDetailLayout(master: EditableDataGrid<DataGridLabRow>): DataGridMasterDetailLayout {
  const workItems = signal(CUSTOMER_WORK_ITEMS.map((item) => ({ ...item })));
  const { detail } = masterDetail(master, (focused) => {
    return new EditableDataGrid<CustomerWorkItem>({
      columns: [
        column({ id: 'workItem', title: 'Work item', value: (row) => row.workItem, width: 16 }),
        column({ id: 'owner', title: 'Owner', value: (row) => row.owner, width: 10 }),
        column({ id: 'hours', title: 'Hours', value: (row) => row.hours, width: 7, align: 'right' }),
        column({ id: 'status', title: 'Status', value: (row) => row.status, width: 10 }),
      ],
      source: fromReactiveRows(() => workItems().filter((item) => item.customerId === focused()?.id), {
        rowKey: (item) => item.id,
      }),
      zebra: true,
    });
  });

  return {
    masterLabel: new Text(() => `Customers — focused ${master.focusedRow()?.name ?? 'none'}`),
    detailLabel: new Text(() => `Work items for ${master.focusedRow()?.name ?? 'no customer'}`),
    detailGrid: detail,
  };
}
