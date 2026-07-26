import type { DocumentSnapshot } from '../document/types.js';
import type { PresentedDiagnostic } from './types.js';
import { boundedArray, recordValue, sanitizeProtocolText, validateRange } from './validation.js';

const severityNames = ['error', 'warning', 'information', 'hint'] as const;

/** Validates, sanitizes, orders, and bounds one diagnostic publication. */
export function validateDiagnostics(
  snapshot: DocumentSnapshot,
  value: unknown,
  maximumItems: number,
  maximumCharacters: number,
): {
  readonly items: readonly PresentedDiagnostic[];
  readonly totalCount: number;
  readonly truncated: boolean;
} {
  const source = Array.isArray(value) ? value : [];
  const items: PresentedDiagnostic[] = [];
  for (const candidate of boundedArray(source, Math.max(maximumItems * 4, maximumItems))) {
    const record = recordValue(candidate);
    const range = validateRange(snapshot, record?.range);
    const message = sanitizeProtocolText(record?.message, maximumCharacters);
    if (record === undefined || range === undefined || message === undefined) continue;
    const severityNumber =
      typeof record.severity === 'number' && Number.isSafeInteger(record.severity)
        ? Math.min(4, Math.max(1, record.severity))
        : 3;
    items.push(Object.freeze({ range, message, severity: severityNames[severityNumber - 1] }));
  }
  items.sort((left, right) => severityNames.indexOf(left.severity) - severityNames.indexOf(right.severity));
  return Object.freeze({
    items: Object.freeze(items.slice(0, maximumItems)),
    totalCount: source.length,
    truncated: source.length > maximumItems,
  });
}
