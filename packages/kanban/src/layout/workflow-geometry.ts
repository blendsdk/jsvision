/** Sticky row containing the joined top border of the workflow headers. */
export const KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROWS = 1;

/** Sticky row containing each horizontally padded workflow-lane label. */
export const KANBAN_WORKFLOW_HEADER_LABEL_ROWS = 1;

/** Sticky row containing the joined horizontal lane separator. */
export const KANBAN_WORKFLOW_HEADER_SEPARATOR_ROWS = 1;

/** Complete sticky workflow-header height before card and swimlane content begins. */
export const KANBAN_WORKFLOW_HEADER_ROWS =
  KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROWS + KANBAN_WORKFLOW_HEADER_LABEL_ROWS + KANBAN_WORKFLOW_HEADER_SEPARATOR_ROWS;

/** Viewport-local row occupied by the joined top border. */
export const KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROW = 0;

/** Viewport-local row occupied by workflow-lane label text. */
export const KANBAN_WORKFLOW_HEADER_LABEL_ROW = KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROWS;

/** Viewport-local row occupied by the joined horizontal lane separator. */
export const KANBAN_WORKFLOW_HEADER_SEPARATOR_ROW =
  KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROWS + KANBAN_WORKFLOW_HEADER_LABEL_ROWS;

/** Smallest viewport height that retains the compact header plus clipped usable card content. */
export const KANBAN_MINIMUM_VIEWPORT_ROWS = KANBAN_WORKFLOW_HEADER_ROWS + 2;

/** Additional trailing cell required for the board's visible right workflow boundary. */
export const KANBAN_WORKFLOW_TRAILING_BOUNDARY_COLUMNS = 1;
