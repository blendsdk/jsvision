import type { DocumentEditInput } from '../document/types.js';

/** Classification used by source-oriented caret and selection navigation. */
export type SourceCharacterClass = 'word' | 'whitespace' | 'punctuation';

/** One complete Unicode code point together with its source-navigation class. */
interface SourceCharacter {
  readonly from: number;
  readonly to: number;
  readonly kind: SourceCharacterClass;
}

/** Returns the ASCII identifier range surrounding a completion caret. */
export function currentWordRange(text: string, caret: number): { readonly from: number; readonly to: number } {
  let from = Math.max(0, Math.min(caret, text.length));
  let to = from;
  while (from > 0 && /[A-Za-z0-9_$]/u.test(text[from - 1] ?? '')) from -= 1;
  while (to < text.length && /[A-Za-z0-9_$]/u.test(text[to] ?? '')) to += 1;
  return { from, to };
}

/**
 * Returns the identifier or punctuation run under a mouse-selected source offset.
 *
 * Whitespace intentionally remains a collapsed caret because selecting an arbitrary indentation
 * run on double-click is surprising in a source editor.
 */
export function sourceRunRange(text: string, offset: number): { readonly from: number; readonly to: number } {
  const bounded = Math.max(0, Math.min(offset, text.length));
  const initial = sourceCharacterAt(text, bounded);
  if (initial === undefined || initial.kind === 'whitespace') return { from: bounded, to: bounded };
  return {
    from: retreatCharacterRun(text, bounded, initial.kind),
    to: advanceCharacterRun(text, bounded, initial.kind),
  };
}

/** Reads one complete Unicode code point and assigns its navigation class. */
export function sourceCharacterAt(text: string, offset: number): SourceCharacter | undefined {
  if (offset < 0 || offset >= text.length) return undefined;
  const point = text.codePointAt(offset);
  if (point === undefined) return undefined;
  const character = String.fromCodePoint(point);
  return {
    from: offset,
    to: offset + character.length,
    kind: classifySourceCharacter(character),
  };
}

/** Reads the complete Unicode code point immediately before an offset. */
export function sourceCharacterBefore(text: string, offset: number): SourceCharacter | undefined {
  if (offset <= 0 || offset > text.length) return undefined;
  const low = text.charCodeAt(offset - 1);
  const prior = text.charCodeAt(offset - 2);
  const from =
    low >= 0xdc00 && low <= 0xdfff && offset > 1 && prior >= 0xd800 && prior <= 0xdbff ? offset - 2 : offset - 1;
  return sourceCharacterAt(text, from);
}

/** Advances across one homogeneous Unicode character run. */
export function advanceCharacterRun(text: string, offset: number, kind: SourceCharacterClass): number {
  let head = offset;
  while (head < text.length) {
    const character = sourceCharacterAt(text, head);
    if (character === undefined || character.kind !== kind) break;
    head = character.to;
  }
  return head;
}

/** Retreats across one homogeneous Unicode character run. */
export function retreatCharacterRun(text: string, offset: number, kind: SourceCharacterClass): number {
  let head = offset;
  while (head > 0) {
    const character = sourceCharacterBefore(text, head);
    if (character === undefined || character.kind !== kind) break;
    head = character.from;
  }
  return head;
}

/**
 * Counts leading whitespace characters that remove one visual indentation level.
 *
 * Removing a prefix rather than blindly deleting `tabSize` code units preserves residual mixed
 * indentation such as the two spaces following a leading tab.
 */
export function removableIndentationLength(text: string, tabSize: number): number {
  const prefix = text.match(/^[\t ]*/u)?.[0] ?? '';
  if (prefix.length === 0) return 0;
  const targetWidth = Math.max(0, whitespaceVisualWidth(prefix, tabSize) - tabSize);
  for (let remove = 1; remove <= prefix.length; remove += 1) {
    if (whitespaceVisualWidth(prefix.slice(remove), tabSize) <= targetWidth) return remove;
  }
  return prefix.length;
}

/**
 * Maps an original document offset through a sorted atomic edit set.
 *
 * Insertions at the offset are treated as preceding it so selected content stays selected after
 * indentation. Offsets inside removed text collapse to the replacement.
 */
export function transformOffset(offset: number, edits: readonly DocumentEditInput[]): number {
  let delta = 0;
  for (const edit of edits) {
    const { from, to } = edit.range;
    if (offset < from) break;
    if (from === to) {
      delta += edit.text.length;
      continue;
    }
    if (offset <= to) return from + delta + Math.min(edit.text.length, offset - from);
    delta += edit.text.length - (to - from);
  }
  return offset + delta;
}

/** Returns the preferred newline sequence for a document's detected line-ending policy. */
export function lineSeparator(lineEnding: 'none' | 'lf' | 'crlf' | 'cr' | 'mixed'): string {
  if (lineEnding === 'crlf') return '\r\n';
  if (lineEnding === 'cr') return '\r';
  return '\n';
}

/** Classifies identifiers, whitespace, and punctuation into deterministic navigation runs. */
function classifySourceCharacter(character: string): SourceCharacterClass {
  if (/^[\p{L}\p{N}_$]$/u.test(character)) return 'word';
  if (/^\s$/u.test(character)) return 'whitespace';
  return 'punctuation';
}

/** Measures tabs and spaces using the same tab-stop rule as document visual columns. */
function whitespaceVisualWidth(text: string, tabSize: number): number {
  let column = 0;
  for (const character of text) {
    column += character === '\t' ? tabSize - (column % tabSize) : 1;
  }
  return column;
}
