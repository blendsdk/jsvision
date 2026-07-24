import type { DocumentEditInput } from '../document/types.js';
import { positionToOffset } from '../document/positions.js';
import type { CodeEditorDocumentModel } from '../document/model.js';
import type { PresentedCompletionItem } from './types.js';
import { boundedArray, recordValue, sanitizeProtocolText, validateRange } from './validation.js';

/** A parsed safe snippet and its numbered placeholder offsets. */
export interface ParsedSnippet {
  readonly text: string;
  readonly placeholders: ReadonlyMap<number, readonly [number, number]>;
}

/** Converts untrusted completion data into bounded inert presentation items. */
export function validateCompletionItems(
  value: unknown,
  maximumItems: number,
  maximumCharacters: number,
): readonly PresentedCompletionItem[] {
  const container = recordValue(value);
  const source = Array.isArray(value) ? value : container?.items;
  const items: PresentedCompletionItem[] = [];
  for (const candidate of boundedArray(source, maximumItems)) {
    const record = recordValue(candidate);
    const label = sanitizeProtocolText(record?.label, maximumCharacters);
    if (record === undefined || label === undefined || label.length === 0) continue;
    const additional = normalizeCompletionEdits(record.additionalTextEdits, maximumCharacters);
    if (additional === undefined) continue;
    const primary = normalizeCompletionEdit(record.textEdit, maximumCharacters);
    if (record.textEdit !== undefined && primary === undefined) continue;
    const item: PresentedCompletionItem = {
      label,
      ...(sanitizeProtocolText(record.detail, maximumCharacters) !== undefined
        ? { detail: sanitizeProtocolText(record.detail, maximumCharacters) }
        : {}),
      ...(sanitizeProtocolText(record.insertText, maximumCharacters) !== undefined
        ? { insertText: sanitizeProtocolText(record.insertText, maximumCharacters) }
        : {}),
      ...(primary !== undefined ? { textEdit: primary } : {}),
      ...(additional.length > 0 ? { additionalTextEdits: additional } : {}),
      ...(record.insertTextFormat !== undefined ? { insertTextFormat: record.insertTextFormat } : {}),
    };
    items.push(Object.freeze(item));
  }
  return Object.freeze(items);
}

function normalizeCompletionEdits(value: unknown, maximumCharacters: number): readonly unknown[] | undefined {
  if (value === undefined) return Object.freeze([]);
  let length: number;
  try {
    if (!Array.isArray(value)) return undefined;
    length = value.length;
  } catch {
    return undefined;
  }
  if (!Number.isSafeInteger(length) || length > 1_000) return undefined;
  const result: unknown[] = [];
  for (const candidate of boundedArray(value, 1_000)) {
    const edit = normalizeCompletionEdit(candidate, maximumCharacters);
    if (edit === undefined) return undefined;
    result.push(edit);
  }
  return Object.freeze(result);
}

function normalizeCompletionEdit(value: unknown, maximumCharacters: number): unknown | undefined {
  if (value === undefined) return undefined;
  const edit = recordValue(value);
  const range = recordValue(edit?.range);
  const start = recordValue(range?.start);
  const end = recordValue(range?.end);
  if (
    typeof edit?.newText !== 'string' ||
    edit.newText.length > maximumCharacters ||
    typeof start?.line !== 'number' ||
    typeof start.character !== 'number' ||
    typeof end?.line !== 'number' ||
    typeof end.character !== 'number'
  )
    return undefined;
  return Object.freeze({
    range: Object.freeze({
      start: Object.freeze({ line: start.line, character: start.character }),
      end: Object.freeze({ line: end.line, character: end.character }),
    }),
    newText: edit.newText,
  });
}

/** Parses numbered placeholders while leaving unsupported constructs as literal text. */
export function parseSafeSnippet(value: string): ParsedSnippet {
  const placeholders = new Map<number, readonly [number, number]>();
  let text = '';
  let cursor = 0;
  const pattern = /\$\{([0-9]+)(?::([^{}]*))?\}|\$([0-9]+)/gu;
  for (const match of value.matchAll(pattern)) {
    const index = match.index;
    text += value.slice(cursor, index);
    const number = Number(match[1] ?? match[3]);
    const placeholder = match[2] ?? '';
    const start = text.length;
    text += placeholder;
    if (Number.isSafeInteger(number) && number >= 0 && !placeholders.has(number)) {
      placeholders.set(number, Object.freeze([start, text.length]));
    }
    cursor = index + match[0].length;
  }
  text += value.slice(cursor);
  return Object.freeze({ text, placeholders });
}

/** Normalizes a completion's primary and additional current-document edits. */
export function completionEdits(
  document: CodeEditorDocumentModel,
  item: PresentedCompletionItem,
  maximumEdits: number,
  maximumReplacementCharacters: number,
):
  | {
      readonly edits: readonly DocumentEditInput[];
      readonly snippet?: ParsedSnippet;
      readonly snippetBase?: number;
    }
  | undefined {
  const edits: DocumentEditInput[] = [];
  let snippet: ParsedSnippet | undefined;
  let snippetBase: number | undefined;
  const primary = recordValue(item.textEdit);
  if (primary !== undefined) {
    const range = validateRange(document.snapshot, primary.range);
    const rawText =
      item.insertTextFormat === 'snippet' && item.insertText !== undefined
        ? item.insertText
        : typeof primary.newText === 'string'
          ? primary.newText
          : item.insertText;
    if (range === undefined || rawText === undefined || rawText.length > maximumReplacementCharacters) return undefined;
    const parsed = item.insertTextFormat === 'snippet' ? parseSafeSnippet(rawText) : undefined;
    snippet = parsed;
    if (parsed !== undefined) snippetBase = positionToOffset(document.snapshot, range.start);
    edits.push({
      range: {
        from: positionToOffset(document.snapshot, range.start),
        to: positionToOffset(document.snapshot, range.end),
      },
      text: parsed?.text ?? rawText,
    });
  } else if (item.insertText !== undefined) {
    const parsed = item.insertTextFormat === 'snippet' ? parseSafeSnippet(item.insertText) : undefined;
    snippet = parsed;
    const head = document.selection.head;
    if (parsed !== undefined) snippetBase = head;
    edits.push({ range: { from: head, to: head }, text: parsed?.text ?? item.insertText });
  }
  for (const candidate of item.additionalTextEdits ?? []) {
    if (edits.length >= maximumEdits) return undefined;
    const record = recordValue(candidate);
    const range = validateRange(document.snapshot, record?.range);
    if (record === undefined || range === undefined || typeof record.newText !== 'string') return undefined;
    edits.push({
      range: {
        from: positionToOffset(document.snapshot, range.start),
        to: positionToOffset(document.snapshot, range.end),
      },
      text: record.newText,
    });
  }
  if (edits.length > maximumEdits) return undefined;
  if (edits.reduce((total, edit) => total + edit.text.length, 0) > maximumReplacementCharacters) return undefined;
  const ordered = [...edits].sort((left, right) => left.range.from - right.range.from);
  for (let index = 1; index < ordered.length; index += 1) {
    if ((ordered[index - 1]?.range.to ?? 0) > (ordered[index]?.range.from ?? 0)) return undefined;
  }
  return edits.length === 0
    ? undefined
    : Object.freeze({
        edits: Object.freeze(edits),
        ...(snippet && snippetBase !== undefined ? { snippet, snippetBase } : {}),
      });
}

/** Applies one already-presented completion as a single validated document transaction. */
export function applyPresentedCompletion(
  document: CodeEditorDocumentModel,
  item: PresentedCompletionItem,
  maximumEdits: number,
  maximumReplacementCharacters: number,
): NonNullable<ReturnType<typeof completionEdits>> | undefined {
  const normalized = completionEdits(document, item, maximumEdits, maximumReplacementCharacters);
  if (normalized === undefined) return undefined;
  try {
    const transaction = document.createTransaction({
      base: document.identity,
      edits: normalized.edits,
      origin: 'completion',
    });
    return document.apply(transaction).accepted ? normalized : undefined;
  } catch {
    return undefined;
  }
}
