import type { DocumentSnapshot } from '../document/types.js';
import { positionToOffset } from '../document/positions.js';
import type { ProtocolPosition, ProtocolRange } from './types.js';

const terminalControls =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/gu;

/** Removes terminal and directional controls from untrusted presentation text. */
export function sanitizeProtocolText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const safeMaximum = Number.isSafeInteger(maximum) && maximum >= 0 ? maximum : 0;
  return value
    .slice(0, Math.min(value.length, safeMaximum * 4 + 64))
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/gu, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '')
    .replace(terminalControls, '')
    .slice(0, safeMaximum);
}

/** Converts the approved Markdown subset into inert bounded terminal text. */
export function renderSafeMarkdown(
  value: unknown,
  maximum: number,
): { readonly text: string; readonly clipped: boolean } {
  if (typeof value !== 'string') return { text: '', clipped: false };
  const boundedValue = value.slice(0, Math.min(value.length, maximum * 4 + 64));
  let text = boundedValue
    .replace(/<[^>]*>/gu, '')
    .replace(/!\[([^[]*)\]\([^)]*\)/gu, '')
    .replace(/\[([^[]+)\]\([^)]*\)/gu, '$1')
    .replace(/[*_~`#>]/gu, '');
  text = sanitizeProtocolText(text, maximum + 1) ?? '';
  const clipped = text.length > maximum;
  return { text: clipped ? text.slice(0, maximum) : text, clipped: clipped || value.length > maximum };
}

/** Validates a zero-based UTF-16 position against a snapshot. */
export function validatePosition(snapshot: DocumentSnapshot, value: unknown): ProtocolPosition | undefined {
  const record = recordValue(value);
  if (record === undefined) return undefined;
  const line = record.line;
  const character = record.character;
  if (!isCoordinate(line) || !isCoordinate(character)) return undefined;
  try {
    positionToOffset(snapshot, { line, character });
    return { line, character };
  } catch {
    return undefined;
  }
}

/** Validates a half-open UTF-16 range against one exact snapshot. */
export function validateRange(snapshot: DocumentSnapshot, value: unknown): ProtocolRange | undefined {
  const record = recordValue(value);
  if (record === undefined) return undefined;
  const start = validatePosition(snapshot, record.start);
  const end = validatePosition(snapshot, record.end);
  if (start === undefined || end === undefined) return undefined;
  const startOffset = positionToOffset(snapshot, start);
  const endOffset = positionToOffset(snapshot, end);
  return startOffset <= endOffset ? { start, end } : undefined;
}

/** Safely reads a plain record without invoking application logic on invalid primitives. */
export function recordValue(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  try {
    if (Object.keys(value).length > 64) return undefined;
    return Object.freeze({ ...value });
  } catch {
    return undefined;
  }
}

/** Returns a bounded plain array or an empty array for hostile values. */
export function boundedArray(value: unknown, maximum: number): readonly unknown[] {
  try {
    if (!Array.isArray(value)) return Object.freeze([]);
    const length = value.length;
    if (!Number.isSafeInteger(length) || length < 0) return Object.freeze([]);
    const result: unknown[] = [];
    for (let index = 0; index < Math.min(length, maximum); index += 1) result.push(value[index]);
    return Object.freeze(result);
  } catch {
    return Object.freeze([]);
  }
}

/** Determines whether a URI is an absolute, traversal-free file resource. */
export function isAllowedUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096 || value.includes('\0')) return false;
  try {
    const rawPath = decodeURIComponent(value.slice('file://'.length));
    if (rawPath.split(/[\\/]/u).some((segment) => segment === '..' || segment === '.')) return false;
    const url = new URL(value);
    if (url.protocol !== 'file:') return false;
    const segments = url.pathname.split('/');
    return !segments.includes('..') && !segments.includes('.');
  } catch {
    return false;
  }
}

/** Normalizes a bounded cross-document workspace edit into an inert host DTO. */
export function validateWorkspaceEdit(
  value: unknown,
  maximumEdits: number,
  maximumCharacters: number,
): import('./types.js').ValidatedWorkspaceEdit | undefined {
  const root = recordValue(value);
  const changes = recordValue(root?.changes);
  if (changes === undefined) return undefined;
  const result: Record<string, readonly { readonly range: ProtocolRange; readonly newText: string }[]> = {};
  let editCount = 0;
  let characterCount = 0;
  for (const [uri, rawEdits] of Object.entries(changes)) {
    if (!isAllowedUri(uri)) return undefined;
    const source = boundedArray(rawEdits, maximumEdits + 1);
    if (!Array.isArray(rawEdits) || source.length !== rawEdits.length) return undefined;
    const edits: { readonly range: ProtocolRange; readonly newText: string }[] = [];
    for (const candidate of source) {
      const edit = recordValue(candidate);
      const range = validateUnboundRange(edit?.range);
      if (range === undefined || typeof edit?.newText !== 'string') return undefined;
      editCount += 1;
      characterCount += edit.newText.length;
      if (editCount > maximumEdits || characterCount > maximumCharacters) return undefined;
      edits.push(Object.freeze({ range, newText: edit.newText }));
    }
    result[uri] = Object.freeze(edits);
  }
  return Object.freeze({ changes: Object.freeze(result) });
}

function validateUnboundRange(value: unknown): ProtocolRange | undefined {
  const range = recordValue(value);
  const start = recordValue(range?.start);
  const end = recordValue(range?.end);
  const startLine = start?.line;
  const startCharacter = start?.character;
  const endLine = end?.line;
  const endCharacter = end?.character;
  if (
    !isCoordinate(startLine) ||
    !isCoordinate(startCharacter) ||
    !isCoordinate(endLine) ||
    !isCoordinate(endCharacter)
  )
    return undefined;
  if (endLine < startLine || (endLine === startLine && endCharacter < startCharacter)) return undefined;
  return { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } };
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
