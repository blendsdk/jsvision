import { positionToOffset } from '../document/positions.js';
import type { CodeEditorDocumentModel } from '../document/model.js';
import type { DocumentEditInput } from '../document/types.js';
import { boundedArray, recordValue, validateRange } from './validation.js';

/** Validates a complete formatting response before it reaches the document transaction boundary. */
export function validateFormattingEdits(
  document: CodeEditorDocumentModel,
  value: unknown,
  maximumEdits: number,
  maximumReplacementCharacters: number,
): readonly DocumentEditInput[] | undefined {
  if (!Array.isArray(value) || value.length > maximumEdits) return undefined;
  const edits: DocumentEditInput[] = [];
  let replacementCharacters = 0;
  for (const candidate of boundedArray(value, maximumEdits)) {
    const record = recordValue(candidate);
    const range = validateRange(document.snapshot, record?.range);
    if (record === undefined || range === undefined || typeof record.newText !== 'string') return undefined;
    replacementCharacters += record.newText.length;
    if (replacementCharacters > maximumReplacementCharacters) return undefined;
    edits.push({
      range: {
        from: positionToOffset(document.snapshot, range.start),
        to: positionToOffset(document.snapshot, range.end),
      },
      text: record.newText,
    });
  }
  return Object.freeze(edits);
}
