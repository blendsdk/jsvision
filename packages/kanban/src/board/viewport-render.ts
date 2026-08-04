import type { DrawContext } from '@jsvision/ui';

import type { KanbanTheme, KanbanThemeRole } from '../card/theme.js';
import type { KanbanViewportProjection } from './viewport-projector.js';

/** Returns the already-resolved terminal style for one allowlisted semantic role. */
function style(theme: KanbanTheme, role: KanbanThemeRole) {
  return theme.roles[role].style;
}

/**
 * Paints one clipped viewport projection without creating View objects per card.
 */
export function drawKanbanViewport(ctx: DrawContext, projection: KanbanViewportProjection, theme: KanbanTheme): void {
  ctx.fill(' ', style(theme, 'board.surface'));
  for (const column of projection.columns) {
    ctx.fillRect(
      column.rect.x,
      column.rect.y,
      column.rect.width,
      column.rect.height,
      ' ',
      style(theme, 'column.surface'),
    );
    if (column.rect.height > 0) {
      ctx.fillRect(column.rect.x, 0, column.rect.width, 1, ' ', style(theme, 'column.header'));
      ctx.text(column.rect.x, 0, column.label, style(theme, 'column.header'));
    }
    const separatorX = column.rect.x + column.rect.width;
    if (separatorX < ctx.size.width) {
      ctx.fillRect(separatorX, 0, 1, column.rect.height, ' ', style(theme, 'column.separator'));
    }
  }
  for (const card of projection.cards) {
    const descriptor = card.descriptor;
    ctx.fillRect(
      card.rect.x,
      card.rect.y,
      card.rect.width,
      card.rect.height,
      ' ',
      style(theme, descriptor.surfaceRole),
    );
    for (let row = 0; row < descriptor.rows.length && row < card.rect.height; row += 1) {
      const descriptorRow = descriptor.rows[row];
      if (descriptorRow === undefined) continue;
      for (const span of descriptorRow.spans) {
        ctx.text(card.rect.x + span.column, card.rect.y + row, span.text, style(theme, span.role));
      }
    }
    if (descriptor.marker.row < card.rect.height) {
      ctx.text(
        card.rect.x + descriptor.marker.column,
        card.rect.y + descriptor.marker.row,
        descriptor.marker.glyph,
        style(theme, descriptor.marker.role),
      );
    }
  }
  for (const projectedState of projection.states) {
    const column =
      projectedState.columnId === undefined
        ? undefined
        : projection.columns.find((candidate) => candidate.columnId === projectedState.columnId);
    const x = column?.rect.x ?? 0;
    const y = column === undefined ? 0 : Math.min(1, Math.max(0, ctx.size.height - 1));
    const role: KanbanThemeRole =
      projectedState.kind === 'no-columns' || projectedState.kind === 'empty'
        ? 'state.empty'
        : projectedState.kind === 'error'
          ? 'state.error'
          : projectedState.kind === 'loading'
            ? 'state.loading'
            : projectedState.kind === 'refreshing'
              ? 'state.refreshing'
              : 'state.partial';
    ctx.text(x, y, projectedState.label, style(theme, role));
  }
}
