import { charWidth } from '@jsvision/core';
import type { WidthMode } from '@jsvision/core';
import type { DrawContext } from '@jsvision/ui';

import type { KanbanTheme, KanbanThemeRole } from '../card/theme.js';
import type { KanbanViewportProjection } from './viewport-projector.js';

/** Returns the already-resolved terminal style for one allowlisted semantic role. */
function style(theme: KanbanTheme, role: KanbanThemeRole) {
  return theme.roles[role].style;
}

/** Crops safe text by terminal cells without emitting a partial wide glyph. */
function cropCellText(value: string, leadingCells: number, maximumCells: number, widthMode: WidthMode): string {
  if (maximumCells <= 0) return '';
  let sourceCells = 0;
  let outputCells = 0;
  let output = '';
  let canAttachCombining = false;
  for (const glyph of value) {
    const width = charWidth(glyph.codePointAt(0) ?? 0, widthMode);
    if (width === 0) {
      if (canAttachCombining) output += glyph;
      continue;
    }
    if (sourceCells < leadingCells) {
      const glyphEnd = sourceCells + width;
      if (glyphEnd > leadingCells) {
        const visibleRemainder = Math.min(glyphEnd - leadingCells, maximumCells - outputCells);
        output += ' '.repeat(visibleRemainder);
        outputCells += visibleRemainder;
      }
      sourceCells += width;
      canAttachCombining = false;
      continue;
    }
    if (outputCells + width > maximumCells) break;
    output += glyph;
    outputCells += width;
    sourceCells += width;
    canAttachCombining = true;
  }
  return output;
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
      ctx.text(
        column.rect.x,
        0,
        cropCellText(column.label, column.contentOffset, column.rect.width, ctx.caps.unicode.widthMode),
        style(theme, 'column.header'),
      );
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
    for (let row = 0; row < card.rect.height; row += 1) {
      const descriptorRow = descriptor.rows[row + card.descriptorRowOffset];
      if (descriptorRow === undefined) continue;
      for (const span of descriptorRow.spans) {
        const relativeX = span.column - card.descriptorColumnOffset;
        const x = Math.max(0, relativeX);
        if (x >= card.rect.width) continue;
        const text = cropCellText(span.text, Math.max(0, -relativeX), card.rect.width - x, ctx.caps.unicode.widthMode);
        if (text.length > 0) ctx.text(card.rect.x + x, card.rect.y + row, text, style(theme, span.role));
      }
    }
    const markerRow = descriptor.marker.row - card.descriptorRowOffset;
    const markerColumn = descriptor.marker.column - card.descriptorColumnOffset;
    if (markerRow >= 0 && markerRow < card.rect.height && markerColumn >= 0 && markerColumn < card.rect.width) {
      ctx.text(
        card.rect.x + markerColumn,
        card.rect.y + markerRow,
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
    const contentOffset = column?.contentOffset ?? 0;
    const maximumWidth = column?.rect.width ?? ctx.size.width;
    ctx.text(
      x,
      y,
      cropCellText(projectedState.label, contentOffset, maximumWidth, ctx.caps.unicode.widthMode),
      style(theme, role),
    );
  }
}
