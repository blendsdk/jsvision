import { charWidth } from '@jsvision/core';
import type { WidthMode } from '@jsvision/core';

import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { snapshotPresentationText } from './presentation-value.js';

/** Result of clipping one safe card string to a terminal-cell budget. */
export interface KanbanClippedText {
  /** Complete-glyph prefix plus the requested omission marker when clipping occurred. */
  readonly text: string;
  /** Terminal-cell width of `text` under the requested width mode. */
  readonly cells: number;
  /** Whether at least one visible source glyph was omitted. */
  readonly clipped: boolean;
}

/** Converts untrusted application text to one bounded terminal-safe display line. */
export function normalizeKanbanCardText(value: string): string {
  return snapshotPresentationText(value) ?? '';
}

/** Measures one safe line using the active terminal width policy. */
export function measureKanbanCardText(value: string, widthMode: WidthMode): number {
  let width = 0;
  for (const character of value) width += charWidth(character.codePointAt(0) ?? 0, widthMode);
  return width;
}

/** Returns the longest complete-code-point prefix that fits the requested terminal-cell budget. */
function fittingPrefix(value: string, maximumCells: number, widthMode: WidthMode): string {
  let result = '';
  let used = 0;
  for (const character of value) {
    const width = charWidth(character.codePointAt(0) ?? 0, widthMode);
    if (width === 0) {
      if (result.length > 0) result += character;
      continue;
    }
    if (used + width > maximumCells) break;
    result += character;
    used += width;
  }
  return result;
}

/**
 * Clips safe card text to terminal cells without splitting wide glyphs or trailing combining marks.
 *
 * The omission marker is package/application presentation, not card data. Pass an empty marker for
 * hard clipping or `...` when the active glyph policy requires ASCII-only output.
 */
export function clipKanbanCardText(
  value: string,
  maximumCells: number,
  widthMode: WidthMode,
  omissionMarker = '…',
): KanbanClippedText {
  if (!Number.isSafeInteger(maximumCells) || maximumCells < 0) throw new KanbanInvalidDescriptorError();
  const sourceCells = measureKanbanCardText(value, widthMode);
  if (sourceCells <= maximumCells) return Object.freeze({ text: value, cells: sourceCells, clipped: false });

  const markerCells = measureKanbanCardText(omissionMarker, widthMode);
  const marker = markerCells > 0 && markerCells <= maximumCells ? omissionMarker : '';
  const prefix = fittingPrefix(value, maximumCells - (marker.length === 0 ? 0 : markerCells), widthMode);
  const text = `${prefix}${marker}`;
  return Object.freeze({ text, cells: measureKanbanCardText(text, widthMode), clipped: true });
}

/** Wraps safe text into bounded terminal-cell rows and ellipsizes evidence beyond the final row. */
export function wrapKanbanCardText(
  value: string,
  maximumCells: number,
  maximumRows: number,
  widthMode: WidthMode,
): readonly string[] {
  if (
    !Number.isSafeInteger(maximumCells) ||
    maximumCells < 1 ||
    !Number.isSafeInteger(maximumRows) ||
    maximumRows < 0
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  if (maximumRows === 0 || value.length === 0) return Object.freeze([]);
  const rows: string[] = [];
  let current = '';
  let currentCells = 0;
  let consumedCharacters = 0;
  const characters = Array.from(value);
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]!;
    const width = charWidth(character.codePointAt(0) ?? 0, widthMode);
    if (width === 0) {
      if (current.length > 0) current += character;
      consumedCharacters = index + 1;
      continue;
    }
    if (currentCells + width <= maximumCells) {
      current += character;
      currentCells += width;
      consumedCharacters = index + 1;
      continue;
    }
    rows.push(current);
    if (rows.length === maximumRows) {
      const last = rows.length - 1;
      rows[last] = clipKanbanCardText(`${rows[last]}${characters.slice(index).join('')}`, maximumCells, widthMode).text;
      return Object.freeze(rows);
    }
    current = character;
    currentCells = width;
    consumedCharacters = index + 1;
  }
  if (current.length > 0) rows.push(current);
  if (consumedCharacters < characters.length && rows.length > 0) {
    const last = rows.length - 1;
    rows[last] = clipKanbanCardText(
      `${rows[last]}${characters.slice(consumedCharacters).join('')}`,
      maximumCells,
      widthMode,
    ).text;
  }
  return Object.freeze(rows.slice(0, maximumRows));
}
