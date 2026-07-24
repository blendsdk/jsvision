import type { DocumentSnapshot } from '../document/types.js';
import type { PresentedNavigationTarget } from './types.js';
import { boundedArray, isAllowedUri, recordValue, sanitizeProtocolText, validateRange } from './validation.js';

/** Validates and bounds definition-style navigation targets. */
export function validateNavigationTargets(
  snapshot: DocumentSnapshot,
  value: unknown,
  currentUri: string,
  maximum = 64,
): readonly PresentedNavigationTarget[] {
  const items: PresentedNavigationTarget[] = [];
  for (const candidate of boundedArray(value, maximum)) {
    const record = recordValue(candidate);
    const uri = record?.uri ?? record?.targetUri;
    if (!isAllowedUri(uri)) continue;
    const rawRange = record?.range ?? record?.targetSelectionRange;
    const validated = uri === currentUri ? validateRange(snapshot, rawRange) : validateForeignRange(rawRange);
    if (validated !== undefined) items.push(Object.freeze({ uri, range: validated }));
  }
  return Object.freeze(items);
}

function validateForeignRange(value: unknown): import('./types.js').ProtocolRange | undefined {
  const record = recordValue(value);
  const start = recordValue(record?.start);
  const end = recordValue(record?.end);
  if (
    typeof start?.line !== 'number' ||
    typeof start.character !== 'number' ||
    typeof end?.line !== 'number' ||
    typeof end.character !== 'number' ||
    ![start.line, start.character, end.line, end.character].every(
      (coordinate) => Number.isSafeInteger(coordinate) && coordinate >= 0,
    )
  ) {
    return undefined;
  }
  if (end.line < start.line || (end.line === start.line && end.character < start.character)) return undefined;
  return {
    start: { line: start.line, character: start.character },
    end: { line: end.line, character: end.character },
  };
}

/** Validates bounded current-document symbols for chooser presentation. */
export function validateDocumentSymbols(
  snapshot: DocumentSnapshot,
  value: unknown,
  maximum = 256,
): readonly { readonly label: string; readonly range: import('./types.js').ProtocolRange }[] {
  const items: { readonly label: string; readonly range: import('./types.js').ProtocolRange }[] = [];
  for (const candidate of boundedArray(value, maximum)) {
    const record = recordValue(candidate);
    const label = sanitizeProtocolText(record?.name, 256);
    const range = validateRange(snapshot, record?.selectionRange ?? record?.range);
    if (label !== undefined && range !== undefined) items.push(Object.freeze({ label, range }));
  }
  return Object.freeze(items);
}
