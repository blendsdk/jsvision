import { Attr, charWidth } from '@jsvision/core';
import type { ThemeRole, WidthMode } from '@jsvision/core';
import type { DrawContext } from '@jsvision/ui';

import type { KanbanTheme, KanbanThemeRole } from '../card/theme.js';
import {
  KANBAN_CARD_FRAME_COLUMNS,
  KANBAN_CARD_FRAME_INSET,
  KANBAN_CARD_FRAME_ROWS,
  KANBAN_LANE_HORIZONTAL_PADDING,
} from '../layout/card-geometry.js';
import {
  KANBAN_WORKFLOW_HEADER_LABEL_ROW,
  KANBAN_WORKFLOW_HEADER_ROWS,
  KANBAN_WORKFLOW_HEADER_SEPARATOR_ROW,
  KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROW,
} from '../layout/workflow-geometry.js';
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

/** Measures sanitized text in terminal cells under the active host width policy. */
function cellTextWidth(value: string, widthMode: WidthMode): number {
  let width = 0;
  for (const glyph of value) width += charWidth(glyph.codePointAt(0) ?? 0, widthMode);
  return width;
}

/** Horizontal crop inputs for one start-aligned or centered workflow-header label. */
interface KanbanHeaderTextPlacement {
  readonly leftInset: number;
  readonly leadingCells: number;
  readonly maximumCells: number;
}

/** Places a header label inside the complete lane while preserving padding through horizontal clips. */
function headerTextPlacement(
  column: KanbanViewportProjection['columns'][number],
  label: string,
  leadingBoundary: boolean,
  widthMode: WidthMode,
): KanbanHeaderTextPlacement {
  const contentStart = KANBAN_LANE_HORIZONTAL_PADDING + (leadingBoundary ? 1 : 0);
  const contentEnd = Math.max(contentStart, column.contentWidth - KANBAN_LANE_HORIZONTAL_PADDING);
  const availableWidth = contentEnd - contentStart;
  const centeredInset = Math.floor(Math.max(0, availableWidth - cellTextWidth(label, widthMode)) / 2);
  const labelStart = contentStart + (column.headerAlignment === 'center' ? centeredInset : 0);
  const leadingCells = Math.max(0, column.contentOffset - labelStart);
  const leftInset = Math.max(0, labelStart - column.contentOffset);
  const visibleLabelStart = Math.max(column.contentOffset, labelStart);
  return Object.freeze({
    leftInset,
    leadingCells,
    maximumCells: Math.min(Math.max(0, contentEnd - visibleLabelStart), Math.max(0, column.rect.width - leftInset)),
  });
}

/** Terminal-safe glyphs for one complete card frame. */
interface KanbanCardFrameGlyphs {
  readonly topLeft: string;
  readonly topRight: string;
  readonly bottomLeft: string;
  readonly bottomRight: string;
  readonly horizontal: string;
  readonly vertical: string;
}

/** Selects a visibly distinct focused frame while retaining an ASCII-only fallback. */
function cardFrameGlyphs(focused: boolean, boxDrawing: boolean): KanbanCardFrameGlyphs {
  if (!boxDrawing) {
    return focused
      ? { topLeft: '+', topRight: '+', bottomLeft: '+', bottomRight: '+', horizontal: '=', vertical: '!' }
      : { topLeft: '+', topRight: '+', bottomLeft: '+', bottomRight: '+', horizontal: '-', vertical: '|' };
  }
  return focused
    ? { topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝', horizontal: '═', vertical: '║' }
    : { topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘', horizontal: '─', vertical: '│' };
}

/** Keeps a semantic text foreground and attributes over one coherent card-surface background. */
function cardContentStyle(textStyle: ThemeRole, surfaceStyle: ThemeRole, bold = false): ThemeRole {
  return {
    ...textStyle,
    bg: surfaceStyle.bg,
    ...(bold ? { attrs: (textStyle.attrs ?? Attr.none) | Attr.bold } : {}),
  };
}

/** Returns the frame glyph at one complete-card coordinate, or nothing for an interior cell. */
function cardFrameGlyphAt(
  x: number,
  y: number,
  width: number,
  height: number,
  glyphs: KanbanCardFrameGlyphs,
): string | undefined {
  if (y === 0) {
    if (x === 0) return glyphs.topLeft;
    if (x === width - 1) return glyphs.topRight;
    return glyphs.horizontal;
  }
  if (y === height - 1) {
    if (x === 0) return glyphs.bottomLeft;
    if (x === width - 1) return glyphs.bottomRight;
    return glyphs.horizontal;
  }
  return x === 0 || x === width - 1 ? glyphs.vertical : undefined;
}

/** Draws the visible clipped portion of one card's stable frame. */
function drawCardFrame(
  ctx: DrawContext,
  card: KanbanViewportProjection['cards'][number],
  glyphs: KanbanCardFrameGlyphs,
  frameStyle: ThemeRole,
): void {
  const width = card.descriptor.width + KANBAN_CARD_FRAME_COLUMNS;
  const height = card.descriptor.measuredHeight + KANBAN_CARD_FRAME_ROWS;
  for (let row = 0; row < card.rect.height; row += 1) {
    const sourceY = row + card.descriptorRowOffset;
    for (let column = 0; column < card.rect.width; column += 1) {
      const sourceX = column + card.descriptorColumnOffset;
      const glyph = cardFrameGlyphAt(sourceX, sourceY, width, height, glyphs);
      if (glyph !== undefined) ctx.text(card.rect.x + column, card.rect.y + row, glyph, frameStyle);
    }
  }
}

/** Paints the joined sticky header separator and continuous workflow-lane boundaries. */
function drawWorkflowChrome(ctx: DrawContext, projection: KanbanViewportProjection, theme: KanbanTheme): void {
  const boxDrawing = ctx.caps.glyphs.boxDrawing;
  const vertical = boxDrawing ? '│' : '|';
  const horizontal = boxDrawing ? '─' : '-';
  const leftJunction = boxDrawing ? '├' : '+';
  const middleJunction = boxDrawing ? '┼' : '+';
  const rightJunction = boxDrawing ? '┤' : '+';
  const topLeftJunction = boxDrawing ? '┌' : '+';
  const topMiddleJunction = boxDrawing ? '┬' : '+';
  const topRightJunction = boxDrawing ? '┐' : '+';
  const separatorStyle = style(theme, 'column.separator');
  const firstBoardColumnId = projection.scene?.columns[0]?.columnId;
  const lastBoardColumnId = projection.scene?.columns.at(-1)?.columnId;

  for (const column of projection.columns) {
    if (KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROW < ctx.size.height) {
      ctx.fillRect(
        column.rect.x,
        KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROW,
        column.rect.width,
        1,
        horizontal,
        separatorStyle,
      );
    }
    if (KANBAN_WORKFLOW_HEADER_SEPARATOR_ROW < ctx.size.height) {
      ctx.fillRect(
        column.rect.x,
        KANBAN_WORKFLOW_HEADER_SEPARATOR_ROW,
        column.rect.width,
        1,
        horizontal,
        separatorStyle,
      );
    }
    if (column.columnId === firstBoardColumnId && column.contentOffset === 0) {
      ctx.fillRect(column.rect.x, 0, 1, column.rect.height, vertical, separatorStyle);
      if (KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROW < ctx.size.height) {
        ctx.text(column.rect.x, KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROW, topLeftJunction, separatorStyle);
      }
      if (KANBAN_WORKFLOW_HEADER_SEPARATOR_ROW < ctx.size.height) {
        ctx.text(column.rect.x, KANBAN_WORKFLOW_HEADER_SEPARATOR_ROW, leftJunction, separatorStyle);
      }
    }
    const separatorX = column.rect.x + column.rect.width;
    if (separatorX < ctx.size.width) {
      ctx.fillRect(separatorX, 0, 1, column.rect.height, vertical, separatorStyle);
      if (KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROW < ctx.size.height) {
        ctx.text(
          separatorX,
          KANBAN_WORKFLOW_HEADER_TOP_BORDER_ROW,
          column.columnId === lastBoardColumnId ? topRightJunction : topMiddleJunction,
          separatorStyle,
        );
      }
      if (KANBAN_WORKFLOW_HEADER_SEPARATOR_ROW < ctx.size.height) {
        ctx.text(
          separatorX,
          KANBAN_WORKFLOW_HEADER_SEPARATOR_ROW,
          column.columnId === lastBoardColumnId ? rightJunction : middleJunction,
          separatorStyle,
        );
      }
    }
  }
}

/**
 * Casts focused-card shadows before card faces so adjacent cards remain readable above the shadow.
 *
 * The renderer's native shadow is two cells wide. Shortening the caster by one cell leaves exactly
 * one visible shadow column outside the card after the face is repainted.
 */
function drawFocusedCardShadows(ctx: DrawContext, projection: KanbanViewportProjection): void {
  for (const card of projection.cards) {
    if (!card.descriptor.marker.cues.includes('focused')) continue;
    const completeWidth = card.descriptor.width + KANBAN_CARD_FRAME_COLUMNS;
    const completeHeight = card.descriptor.measuredHeight + KANBAN_CARD_FRAME_ROWS;
    const rightEdgeVisible = card.descriptorColumnOffset + card.rect.width === completeWidth;
    const bottomEdgeVisible = card.descriptorRowOffset + card.rect.height === completeHeight;
    if (!rightEdgeVisible || !bottomEdgeVisible || card.rect.width < 2) continue;
    ctx.shadow(card.rect.x, card.rect.y, card.rect.width - 1, card.rect.height, ctx.color('shadow'));
  }
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
      ctx.fillRect(
        column.rect.x,
        0,
        column.rect.width,
        KANBAN_WORKFLOW_HEADER_SEPARATOR_ROW,
        ' ',
        style(theme, 'column.header'),
      );
      const count = column.count?.quality === 'unknown' || column.count === undefined ? '' : ` ${column.count.value}`;
      const label = `${column.label}${count}`;
      const placement = headerTextPlacement(
        column,
        label,
        column.columnId === projection.scene?.columns[0]?.columnId,
        ctx.caps.unicode.widthMode,
      );
      ctx.text(
        column.rect.x + placement.leftInset,
        KANBAN_WORKFLOW_HEADER_LABEL_ROW,
        cropCellText(label, placement.leadingCells, placement.maximumCells, ctx.caps.unicode.widthMode),
        style(theme, 'column.header'),
      );
    }
  }
  for (const chrome of projection.geometry?.swimlaneChrome ?? []) {
    const surfaceRole: KanbanThemeRole =
      chrome.variant === 'separator'
        ? 'swimlane.separator'
        : chrome.variant === 'hybrid'
          ? 'swimlane.header'
          : 'swimlane.surface';
    ctx.fillRect(chrome.x, chrome.y, chrome.width, chrome.height, ' ', style(theme, surfaceRole));
    ctx.text(
      chrome.x,
      chrome.y,
      cropCellText(chrome.label, 0, chrome.width, ctx.caps.unicode.widthMode),
      style(theme, chrome.sticky ? 'swimlane.header.focused' : 'swimlane.header'),
    );
  }
  drawFocusedCardShadows(ctx, projection);
  for (const card of projection.cards) {
    const descriptor = card.descriptor;
    const focused = descriptor.marker.cues.includes('focused');
    const surfaceStyle = style(theme, descriptor.surfaceRole);
    const rawBorderStyle = style(theme, descriptor.borderRole);
    const borderStyle = cardContentStyle(rawBorderStyle, surfaceStyle);
    ctx.fillRect(card.rect.x, card.rect.y, card.rect.width, card.rect.height, ' ', surfaceStyle);
    drawCardFrame(ctx, card, cardFrameGlyphs(focused, ctx.caps.glyphs.boxDrawing), borderStyle);
    for (let row = 0; row < card.rect.height; row += 1) {
      const descriptorRow = descriptor.rows[row + card.descriptorRowOffset - KANBAN_CARD_FRAME_INSET];
      if (descriptorRow === undefined) continue;
      for (const span of descriptorRow.spans) {
        const relativeX = span.column + KANBAN_CARD_FRAME_INSET - card.descriptorColumnOffset;
        const x = Math.max(0, relativeX);
        if (x >= card.rect.width) continue;
        const text = cropCellText(span.text, Math.max(0, -relativeX), card.rect.width - x, ctx.caps.unicode.widthMode);
        if (text.length > 0) {
          ctx.text(
            card.rect.x + x,
            card.rect.y + row,
            text,
            cardContentStyle(style(theme, span.role), surfaceStyle, focused && span.role === 'content.title'),
          );
        }
      }
    }
    const markerRow = descriptor.marker.row + KANBAN_CARD_FRAME_INSET - card.descriptorRowOffset;
    const markerColumn = descriptor.marker.column + KANBAN_CARD_FRAME_INSET - card.descriptorColumnOffset;
    if (markerRow >= 0 && markerRow < card.rect.height && markerColumn >= 0 && markerColumn < card.rect.width) {
      ctx.text(
        card.rect.x + markerColumn,
        card.rect.y + markerRow,
        descriptor.marker.glyph,
        cardContentStyle(style(theme, descriptor.marker.role), surfaceStyle),
      );
    }
  }
  for (const projectedState of projection.states) {
    const column =
      projectedState.columnId === undefined
        ? undefined
        : projection.columns.find((candidate) => candidate.columnId === projectedState.columnId);
    const x = column?.rect.x ?? 0;
    const y = column === undefined ? 0 : Math.min(KANBAN_WORKFLOW_HEADER_ROWS, Math.max(0, ctx.size.height - 1));
    const role: KanbanThemeRole =
      projectedState.kind === 'no-columns' ||
      projectedState.kind === 'empty' ||
      projectedState.kind === 'filtered-empty'
        ? 'state.empty'
        : projectedState.kind === 'error'
          ? 'state.error'
          : projectedState.kind === 'loading'
            ? 'state.loading'
            : projectedState.kind === 'refreshing'
              ? 'state.refreshing'
              : 'state.partial';
    const contentOffset = column?.contentOffset ?? 0;
    const leftInset = column === undefined ? 0 : Math.max(0, KANBAN_LANE_HORIZONTAL_PADDING - contentOffset);
    const leadingCells = Math.max(0, contentOffset - KANBAN_LANE_HORIZONTAL_PADDING);
    const maximumWidth =
      column?.rect.width === undefined
        ? ctx.size.width
        : Math.max(0, column.rect.width - leftInset - KANBAN_LANE_HORIZONTAL_PADDING);
    ctx.text(
      x + leftInset,
      y,
      cropCellText(projectedState.label, leadingCells, maximumWidth, ctx.caps.unicode.widthMode),
      style(theme, role),
    );
  }
  drawWorkflowChrome(ctx, projection, theme);
}
