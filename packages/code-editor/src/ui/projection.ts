import type { CapabilityProfile } from '@jsvision/core';
import { offsetToPosition, offsetToVisualColumn } from '../document/positions.js';
import type { SyntaxCategory, SyntaxSpan } from '../languages/contracts.js';
import type { CodeEditorController } from '../controller.js';
import type { CodeEditorCellStyle, CodeEditorTheme } from '../theme/theme.js';

const MAX_WIDTH = 2_000;
const MAX_HEIGHT = 500;
const MAX_CELLS = 200_000;
const MAX_SPANS = 5_000;

/** A sanitized terminal cell plus semantic presentation metadata. */
export interface CodeEditorProjectedCell {
  readonly text: string;
  readonly width: 1;
  readonly role: string;
  readonly overlays: readonly string[];
  readonly style?: CodeEditorCellStyle;
  readonly documentOffset?: number;
}

/** Immutable viewport projection produced without a DOM or terminal serialization. */
export interface CodeEditorFrame {
  readonly cells: readonly (readonly CodeEditorProjectedCell[])[];
  readonly caret: { readonly visible: boolean; readonly x: number; readonly y: number };
  readonly precedence: readonly string[];
  readonly actions: readonly string[];
  readonly cellSignature: string;
  cellAtDocumentOffset(offset: number): CodeEditorProjectedCell | undefined;
}

/** Decoration span accepted by the presentation boundary. */
export interface CodeEditorDecorationSpan {
  readonly from: number;
  readonly to: number;
  readonly severity?: 'error' | 'warning' | 'information' | 'hint';
  readonly active?: boolean;
}

/** Inputs for one bounded editor projection. */
export interface ProjectCodeEditorOptions {
  readonly controller: CodeEditorController;
  readonly width: number;
  readonly height: number;
  readonly caps: CapabilityProfile;
  readonly syntax?: readonly SyntaxSpan[];
  readonly diagnostics?: readonly CodeEditorDecorationSpan[];
  readonly search?: readonly CodeEditorDecorationSpan[];
  readonly bracket?: CodeEditorDecorationSpan;
  readonly snippet?: readonly CodeEditorDecorationSpan[];
  readonly activeLine?: number;
  readonly caret?: number;
  readonly scrollX?: number;
  readonly scrollY?: number;
  /** Shows a fixed one-based line-number gutter when the viewport leaves usable text space. */
  readonly gutter?: boolean;
  readonly theme?: CodeEditorTheme;
  readonly themeName?: string;
}

/** Stable top-to-bottom visual precedence. */
export const codeEditorPresentationPrecedence = Object.freeze([
  'caret',
  'selection',
  'diagnostic',
  'snippet',
  'bracket',
  'search',
  'syntax',
  'activeLine',
  'base',
]);

/**
 * Projects an indexed document viewport into safe, clipped terminal cells.
 *
 * @example
 * ```ts
 * const frame = projectCodeEditor({ controller, width: 80, height: 24, caps });
 * ```
 */
export function projectCodeEditor(options: ProjectCodeEditorOptions): CodeEditorFrame {
  const width = dimension(options.width, MAX_WIDTH);
  const height = dimension(options.height, MAX_HEIGHT);
  if (width * height > MAX_CELLS) throw new RangeError('Editor viewport exceeds the frame cell limit.');
  const snapshot = options.controller.document.snapshot;
  const caretOffset = clamp(options.caret ?? Number(options.controller.document.selection.head), 0, snapshot.length);
  const caretPosition = offsetToPosition(snapshot, caretOffset);
  const scrollY = options.scrollY ?? Math.max(0, Number(caretPosition.line) - Math.max(0, height - 1));
  const scrollX = Math.max(0, options.scrollX ?? 0);
  const numberWidth = String(snapshot.lineCount).length;
  const gutterWidth = options.gutter === true && width >= numberWidth + 10 ? numberWidth + 2 : 0;
  const textWidth = width - gutterWidth;
  const spans = {
    diagnostics: normalizeSpans(options.diagnostics, snapshot.length),
    snippets: normalizeSpans(options.snippet, snapshot.length),
    search: normalizeSpans(options.search, snapshot.length),
    syntax: normalizeSyntax(options.syntax, snapshot.length),
    bracket: normalizeSpan(options.bracket, snapshot.length),
  };
  const cells: CodeEditorProjectedCell[][] = [];
  const offsets = new Map<number, CodeEditorProjectedCell>();
  let signature = hashSeed(options.themeName ?? options.theme?.name ?? 'default');
  for (let row = 0; row < height; row += 1) {
    const lineNumber = scrollY + row;
    const logical = lineNumber < snapshot.lineCount ? snapshot.line(lineNumber) : undefined;
    const sourceCells = projectLine(
      logical?.text ?? '',
      logical?.from ?? snapshot.length,
      lineNumber,
      textWidth,
      scrollX,
      options,
      spans,
    );
    const projected =
      gutterWidth === 0
        ? sourceCells
        : [
            ...projectGutter(
              lineNumber,
              logical !== undefined,
              numberWidth,
              lineNumber === Number(caretPosition.line),
              options,
            ),
            ...sourceCells,
          ];
    cells.push(projected);
    for (const cell of projected) {
      if (cell.documentOffset !== undefined) offsets.set(cell.documentOffset, cell);
      signature = hashCell(signature, cell);
    }
  }
  const visualCaret = Number(offsetToVisualColumn(snapshot, caretOffset, options.controller.document.tabSize));
  const caretX = gutterWidth + visualCaret - scrollX;
  const caretY = Number(caretPosition.line) - scrollY;
  const caret = Object.freeze({
    visible: width > 0 && height > 0 && caretX >= 0 && caretX < width && caretY >= 0 && caretY < height,
    x: clamp(caretX, 0, Math.max(0, width - 1)),
    y: clamp(caretY, 0, Math.max(0, height - 1)),
  });
  return Object.freeze({
    cells: Object.freeze(cells.map((row) => Object.freeze(row))),
    caret,
    precedence: codeEditorPresentationPrecedence,
    actions: Object.freeze(['edit', 'search', 'fold', 'assist', 'navigate', 'format', 'save', 'close']),
    cellSignature: signature.toString(16),
    cellAtDocumentOffset(offset: number) {
      return offsets.get(offset);
    },
  });
}

function projectGutter(
  lineNumber: number,
  hasDocumentLine: boolean,
  numberWidth: number,
  active: boolean,
  options: ProjectCodeEditorOptions,
): CodeEditorProjectedCell[] {
  const label = hasDocumentLine ? String(lineNumber + 1).padStart(numberWidth, ' ') : ' '.repeat(numberWidth);
  const separator = active ? '>' : options.caps.glyphs.boxDrawing ? '│' : '|';
  return [...label, ' ', separator].map((text) =>
    Object.freeze({
      text,
      width: 1 as const,
      role: active ? 'lineNumber' : 'gutter',
      overlays: Object.freeze([]),
      style: styleForRole(options.theme, active ? 'lineNumber' : 'gutter'),
    }),
  );
}

type NormalizedSpan = Readonly<{
  from: number;
  to: number;
  severity?: 'error' | 'warning' | 'information' | 'hint';
  active?: boolean;
  category?: SyntaxCategory;
}>;

function projectLine(
  text: string,
  lineStart: number,
  lineNumber: number,
  width: number,
  scrollX: number,
  options: ProjectCodeEditorOptions,
  spans: {
    diagnostics: readonly NormalizedSpan[];
    snippets: readonly NormalizedSpan[];
    search: readonly NormalizedSpan[];
    syntax: readonly NormalizedSpan[];
    bracket: NormalizedSpan | undefined;
  },
): CodeEditorProjectedCell[] {
  const row = Array.from({ length: width }, () => emptyCell(options.theme));
  let visual = 0;
  for (let index = 0; index < text.length && visual < scrollX + width;) {
    const codePoint = text.codePointAt(index) ?? 0x20;
    const raw = String.fromCodePoint(codePoint);
    const offset = lineStart + index;
    if (raw === '\t') {
      const count = options.controller.document.tabSize - (visual % options.controller.document.tabSize);
      for (let part = 0; part < count; part += 1) {
        place(row, visual++ - scrollX, decorateCell(part === 0 ? '→' : ' ', offset, lineNumber, options, spans));
      }
    } else if (isCombining(codePoint)) {
      // Combining marks occupy the previous grapheme cell and never create a terminal cell alone.
    } else {
      place(row, visual++ - scrollX, decorateCell(safeGlyph(raw, options.caps), offset, lineNumber, options, spans));
      if (codePoint >= 0x1100) place(row, visual++ - scrollX, decorateCell(' ', offset, lineNumber, options, spans));
    }
    index += raw.length;
  }
  return row;
}

function place(row: CodeEditorProjectedCell[], x: number, cell: CodeEditorProjectedCell): void {
  if (x >= 0 && x < row.length) row[x] = cell;
}

function decorateCell(
  text: string,
  offset: number,
  line: number,
  options: ProjectCodeEditorOptions,
  spans: {
    diagnostics: readonly NormalizedSpan[];
    snippets: readonly NormalizedSpan[];
    search: readonly NormalizedSpan[];
    syntax: readonly NormalizedSpan[];
    bracket: NormalizedSpan | undefined;
  },
): CodeEditorProjectedCell {
  const from = Math.min(
    Number(options.controller.document.selection.anchor),
    Number(options.controller.document.selection.head),
  );
  const to = Math.max(
    Number(options.controller.document.selection.anchor),
    Number(options.controller.document.selection.head),
  );
  const selected = offset >= from && offset < to;
  const diagnostic = findSpan(spans.diagnostics, offset);
  const snippet = findSpan(spans.snippets, offset);
  const bracket = contains(spans.bracket, offset);
  const search = findSpan(spans.search, offset);
  const syntax = findSpan(spans.syntax, offset);
  const overlays: string[] = [];
  if (diagnostic !== undefined) overlays.push(`diagnostic.${diagnostic.severity ?? 'information'}`);
  if (snippet !== undefined) overlays.push(snippet.active ? 'snippet.active' : 'snippet');
  if (bracket) overlays.push('bracket');
  if (search !== undefined) overlays.push('search');
  const role = selected
    ? 'selection'
    : diagnostic !== undefined
      ? `diagnostic.${diagnostic.severity ?? 'information'}`
      : snippet !== undefined
        ? snippet.active
          ? 'snippet.active'
          : 'snippet'
        : bracket
          ? 'bracket'
          : search !== undefined
            ? 'search'
            : (syntax?.category ?? (options.activeLine === line ? 'activeLine' : 'base'));
  return Object.freeze({
    text,
    width: 1,
    role,
    overlays: Object.freeze(overlays),
    style: styleForRole(options.theme, role),
    documentOffset: offset,
  });
}

function normalizeSpans(value: unknown, length: number): readonly NormalizedSpan[] {
  const result: NormalizedSpan[] = [];
  try {
    if (!Array.isArray(value) || value.length > MAX_SPANS) return Object.freeze([]);
    for (const item of value) {
      const normalized = normalizeSpan(item, length);
      if (normalized !== undefined) result.push(normalized);
    }
  } catch {
    return Object.freeze([]);
  }
  return freezeNonOverlapping(result);
}

function normalizeSyntax(value: unknown, length: number): readonly NormalizedSpan[] {
  const result: NormalizedSpan[] = [];
  try {
    if (!Array.isArray(value) || value.length > MAX_SPANS) return Object.freeze([]);
    for (const item of value) {
      const span = normalizeSpan(item, length);
      const category = ownValue(item, 'category');
      if (span !== undefined && typeof category === 'string')
        result.push(Object.freeze({ ...span, category: category as SyntaxCategory }));
    }
  } catch {
    return Object.freeze([]);
  }
  return freezeNonOverlapping(result);
}

function freezeNonOverlapping(result: NormalizedSpan[]): readonly NormalizedSpan[] {
  result.sort((left, right) => left.from - right.from || left.to - right.to);
  for (let index = 1; index < result.length; index += 1) {
    if ((result[index]?.from ?? 0) < (result[index - 1]?.to ?? 0)) return Object.freeze([]);
  }
  return Object.freeze(result);
}

function normalizeSpan(value: unknown, length: number): NormalizedSpan | undefined {
  const from = ownValue(value, 'from');
  const to = ownValue(value, 'to');
  if (
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to) ||
    (from as number) < 0 ||
    (to as number) <= (from as number) ||
    (to as number) > length
  )
    return undefined;
  const severity = ownValue(value, 'severity');
  const active = ownValue(value, 'active');
  return Object.freeze({
    from: from as number,
    to: to as number,
    ...(typeof severity === 'string' ? { severity: severity as NormalizedSpan['severity'] } : {}),
    ...(typeof active === 'boolean' ? { active } : {}),
  });
}

function ownValue(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

function findSpan(spans: readonly NormalizedSpan[], offset: number): NormalizedSpan | undefined {
  let low = 0;
  let high = spans.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const span = spans[middle];
    if (span === undefined) return undefined;
    if (offset < span.from) high = middle - 1;
    else if (offset >= span.to) low = middle + 1;
    else return span;
  }
  return undefined;
}

function contains(span: NormalizedSpan | undefined, offset: number): boolean {
  return span !== undefined && offset >= span.from && offset < span.to;
}

function styleForRole(theme: CodeEditorTheme | undefined, role: string): CodeEditorCellStyle | undefined {
  if (theme === undefined) return undefined;
  if (role === 'selection') return theme.surfaces.selection;
  if (role === 'activeLine') return theme.surfaces.activeLine;
  if (role === 'base') return theme.surfaces.editor;
  if (role.startsWith('diagnostic.')) return theme.diagnostics[role.slice(11) as keyof CodeEditorTheme['diagnostics']];
  if (role === 'snippet.active') return theme.assistance.snippetActive;
  if (role === 'snippet') return theme.assistance.snippet;
  if (role in theme.structure) return theme.structure[role as keyof CodeEditorTheme['structure']];
  return theme.syntax[role as keyof CodeEditorTheme['syntax']] ?? theme.surfaces.editor;
}

function safeGlyph(value: string, caps: CapabilityProfile): string {
  const code = value.codePointAt(0) ?? 0x20;
  if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return caps.glyphs.boxDrawing ? '·' : '.';
  if (!caps.unicode.utf8 && code > 0x7e) return '?';
  if (code >= 0x1100) return caps.unicode.utf8 ? '□' : '?';
  return value;
}

function isCombining(codePoint: number): boolean {
  return /\p{Mark}/u.test(String.fromCodePoint(codePoint));
}

function emptyCell(theme: CodeEditorTheme | undefined): CodeEditorProjectedCell {
  return Object.freeze({
    text: ' ',
    width: 1,
    role: 'base',
    overlays: Object.freeze([]),
    ...(theme === undefined ? {} : { style: theme.surfaces.editor }),
  });
}

function dimension(value: number, ceiling: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > ceiling)
    throw new RangeError('Invalid editor viewport dimension.');
  return value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  return hash >>> 0;
}

function hashCell(hash: number, cell: CodeEditorProjectedCell): number {
  return Math.imul(hash ^ (cell.text.codePointAt(0) ?? 0) ^ cell.role.length, 16_777_619) >>> 0;
}
