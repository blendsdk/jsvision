/** Terminal cells inset between a card's outer edge and renderer-owned content. */
export const KANBAN_CARD_FRAME_INSET = 1;

/** Horizontal terminal cells reserved by the left and right card frame edges. */
export const KANBAN_CARD_FRAME_COLUMNS = KANBAN_CARD_FRAME_INSET * 2;

/** Vertical terminal rows reserved by the top and bottom card frame edges. */
export const KANBAN_CARD_FRAME_ROWS = KANBAN_CARD_FRAME_INSET * 2;

/** Horizontal terminal cells kept clear between each card and its workflow-lane edges. */
export const KANBAN_LANE_HORIZONTAL_PADDING = 1;

/** Returns the complete framed width for one validated content descriptor width. */
export function framedKanbanCardWidth(contentWidth: number): number {
  return contentWidth + KANBAN_CARD_FRAME_COLUMNS;
}

/** Returns the complete framed height for one validated content descriptor height. */
export function framedKanbanCardHeight(contentHeight: number): number {
  return contentHeight + KANBAN_CARD_FRAME_ROWS;
}

/**
 * Returns renderer content width inside one validated workflow-column width.
 *
 * The first board lane reserves one additional cell for the board's leading vertical boundary.
 */
export function kanbanCardContentWidth(columnWidth: number, leadingBoardBoundary = false): number {
  return Math.max(
    2,
    columnWidth - KANBAN_CARD_FRAME_COLUMNS - KANBAN_LANE_HORIZONTAL_PADDING * 2 - (leadingBoardBoundary ? 1 : 0),
  );
}
