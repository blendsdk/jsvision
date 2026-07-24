import type { completionEdits } from './completion.js';
import type {
  CodeEditorLspOperation,
  CodeEditorLspCommandAvailability,
  CodeEditorLspPresentation,
  CreateCodeEditorLspCoordinatorOptions,
  PresentedCompletionItem,
  ProtocolRange,
  ProtocolPosition,
} from './types.js';
import type { CodeEditorLspSession } from './session.js';
import { sanitizeProtocolText } from './validation.js';

/** Resolved immutable ceilings used by one coordinator. */
export interface ResolvedLspLimits {
  readonly completionItems: number;
  readonly diagnostics: number;
  readonly contentCharacters: number;
  readonly edits: number;
  readonly replacementCharacters: number;
}

export function resolveCommandAvailability(
  languageId: string,
  capabilities: CodeEditorLspSession['capabilities'] | undefined,
): CodeEditorLspCommandAvailability {
  const enabled = languageId !== 'plain';
  return Object.freeze({
    completion: enabled && capabilities?.completion === true,
    hover: enabled && capabilities?.hover === true,
    signatureHelp: enabled && capabilities?.signatureHelp === true,
    diagnostics: enabled && capabilities?.diagnostics === true,
    definition: enabled && capabilities?.definition === true,
    documentSymbols: enabled && capabilities?.documentSymbols === true,
    documentFormatting: enabled && capabilities?.documentFormatting === true,
    rangeFormatting: enabled && capabilities?.rangeFormatting === true,
  });
}

export function emptyPresentation(): CodeEditorLspPresentation {
  return Object.freeze({
    diagnostics: Object.freeze({ items: Object.freeze([]), totalCount: 0, truncated: false, versioned: false }),
  });
}

/**
 * Detaches and deeply freezes render-facing language-service state.
 *
 * Mutable protocol arrays and records never escape through coordinator snapshots. Unknown
 * completion edit payloads are copied only when they are inert plain data; unsupported values are
 * omitted and will be rejected if that completion is later accepted.
 */
export function immutablePresentation(
  value: CodeEditorLspPresentation,
  limits: ResolvedLspLimits,
  previous?: CodeEditorLspPresentation,
): CodeEditorLspPresentation {
  const completionSource =
    value.completion === undefined
      ? undefined
      : value.completion.items === previous?.completion?.items
        ? previous.completion.items
        : boundedDataArray(value.completion.items, limits.completionItems);
  const completion =
    value.completion === undefined || completionSource === undefined
      ? undefined
      : Object.freeze({
          items:
            completionSource === previous?.completion?.items
              ? completionSource
              : Object.freeze(completionSource.map((item) => immutableCompletionItem(item, limits.edits))),
          selected: value.completion.selected,
          filter: value.completion.filter,
          lineage: value.completion.lineage,
          revision: value.completion.revision,
          sessionGeneration: value.completion.sessionGeneration,
          coordinatorGeneration: value.completion.coordinatorGeneration,
        });
  const hover =
    value.hover === previous?.hover
      ? previous?.hover
      : value.hover === undefined
        ? undefined
        : Object.freeze({
            text: value.hover.text,
            clipped: value.hover.clipped,
            resourcesActive: false as const,
          });
  const signature =
    value.signature === previous?.signature
      ? previous?.signature
      : value.signature === undefined
        ? undefined
        : Object.freeze({
            lines: boundedDataArray(value.signature.lines, 64) ?? Object.freeze([]),
          });
  const diagnostics =
    value.diagnostics === previous?.diagnostics ? previous.diagnostics : immutableDiagnostics(value, limits);
  const navigationChooser =
    value.navigationChooser === previous?.navigationChooser
      ? previous?.navigationChooser
      : value.navigationChooser === undefined
        ? undefined
        : Object.freeze({
            items: Object.freeze(
              (boundedDataArray(value.navigationChooser.items, limits.completionItems) ?? Object.freeze([])).map(
                (item) => Object.freeze({ uri: item.uri, range: immutableRange(item.range) }),
              ),
            ),
          });
  const symbolChooser =
    value.symbolChooser === previous?.symbolChooser
      ? previous?.symbolChooser
      : value.symbolChooser === undefined
        ? undefined
        : Object.freeze({
            items: Object.freeze(
              (boundedDataArray(value.symbolChooser.items, limits.completionItems) ?? Object.freeze([])).map((item) =>
                Object.freeze({ label: item.label, range: immutableRange(item.range) }),
              ),
            ),
          });
  return Object.freeze({
    ...(hover === undefined ? {} : { hover }),
    ...(signature === undefined ? {} : { signature }),
    ...(completion === undefined ? {} : { completion }),
    diagnostics,
    ...(navigationChooser === undefined ? {} : { navigationChooser }),
    ...(symbolChooser === undefined ? {} : { symbolChooser }),
  });
}

/** Detaches one diagnostics collection when its validated identity changed. */
function immutableDiagnostics(
  value: CodeEditorLspPresentation,
  limits: ResolvedLspLimits,
): CodeEditorLspPresentation['diagnostics'] {
  const diagnosticItems = boundedDataArray(value.diagnostics.items, limits.diagnostics) ?? Object.freeze([]);
  return Object.freeze({
    items: Object.freeze(
      diagnosticItems.map((item) =>
        Object.freeze({
          range: immutableRange(item.range),
          message: item.message,
          severity: item.severity,
        }),
      ),
    ),
    totalCount: value.diagnostics.totalCount,
    truncated: value.diagnostics.truncated,
    versioned: value.diagnostics.versioned,
  });
}

function immutableCompletionItem(item: PresentedCompletionItem, editLimit: number): PresentedCompletionItem {
  const textEdit = immutablePlainData(item.textEdit);
  const additionalTextEdits =
    item.additionalTextEdits === undefined
      ? undefined
      : Object.freeze(
          (boundedDataArray(item.additionalTextEdits, editLimit) ?? Object.freeze([])).map((edit) =>
            immutablePlainData(edit),
          ),
        );
  const insertTextFormat = immutablePlainData(item.insertTextFormat);
  return Object.freeze({
    label: item.label,
    ...(item.detail === undefined ? {} : { detail: item.detail }),
    ...(item.insertText === undefined ? {} : { insertText: item.insertText }),
    ...(textEdit === undefined ? {} : { textEdit }),
    ...(additionalTextEdits === undefined ? {} : { additionalTextEdits }),
    ...(insertTextFormat === undefined ? {} : { insertTextFormat }),
  });
}

function boundedDataArray<T>(value: readonly T[], limit: number): readonly T[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      lengthDescriptor === undefined ||
      !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value)
    ) {
      return undefined;
    }
    const length = Math.min(lengthDescriptor.value, limit);
    const result: T[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !('value' in descriptor)) return undefined;
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return undefined;
  }
}

function immutableRange(range: ProtocolRange): ProtocolRange {
  return Object.freeze({
    start: Object.freeze({ line: range.start.line, character: range.start.character }),
    end: Object.freeze({ line: range.end.line, character: range.end.character }),
  });
}

function immutablePlainData(value: unknown, depth = 0): unknown {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (depth >= 8 || typeof value !== 'object') return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value)) {
      if (value.length > 1_000) return undefined;
      const result: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !('value' in descriptor)) return undefined;
        result.push(immutablePlainData(descriptor.value, depth + 1));
      }
      return Object.freeze(result);
    }
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const entries: [string, unknown][] = [];
    const keys = Object.keys(value);
    if (keys.length > 64) return undefined;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !('value' in descriptor)) return undefined;
      entries.push([key, immutablePlainData(descriptor.value, depth + 1)]);
    }
    return Object.freeze(Object.fromEntries(entries));
  } catch {
    return undefined;
  }
}

export function resolveLspLimits(options: CreateCodeEditorLspCoordinatorOptions['limits']): ResolvedLspLimits {
  return Object.freeze({
    completionItems: boundedLimit(options?.completionItems, 12, 512),
    diagnostics: boundedLimit(options?.diagnostics, 500, 5_000),
    contentCharacters: boundedLimit(options?.contentCharacters, 16_384, 65_536),
    edits: boundedLimit(options?.edits, 1_000, 5_000),
    replacementCharacters: boundedLimit(options?.replacementCharacters, 1_048_576, 1_048_576),
  });
}

export function boundedLimit(value: number | undefined, fallback: number, ceiling: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) {
    throw new RangeError('LSP limit is outside the supported range.');
  }
  return value;
}

export function unavailableOperation(): CodeEditorLspOperation {
  return Object.freeze({
    requestId: 0,
    settled: Promise.resolve({ outcome: 'unavailable' as const }),
    cancel() {},
  });
}

export function boundedCommandArguments(value: unknown): readonly unknown[] | undefined {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 32) return undefined;
  const result: unknown[] = [];
  try {
    for (const item of value) {
      if (typeof item === 'string') {
        const safe = sanitizeProtocolText(item, 256);
        if (safe === undefined) return undefined;
        result.push(safe);
      } else if (typeof item === 'number' || typeof item === 'boolean' || item === null) {
        result.push(item);
      } else {
        return undefined;
      }
    }
  } catch {
    return undefined;
  }
  return Object.freeze(result);
}

export function mapSnippetRanges(
  normalized: NonNullable<ReturnType<typeof completionEdits>>,
): ReadonlyMap<number, readonly [number, number]> {
  if (normalized.snippet === undefined || normalized.snippetBase === undefined) return new Map();
  let base = normalized.snippetBase;
  let skippedPrimary = false;
  for (const edit of normalized.edits) {
    if (!skippedPrimary && edit.range.from === normalized.snippetBase && edit.text === normalized.snippet.text) {
      skippedPrimary = true;
      continue;
    }
    if (edit.range.to <= normalized.snippetBase) base += edit.text.length - (edit.range.to - edit.range.from);
  }
  const ranges = new Map<number, readonly [number, number]>();
  for (const [number, range] of normalized.snippet.placeholders) {
    ranges.set(number, Object.freeze([base + range[0], base + range[1]]));
  }
  return ranges;
}

export function endPosition(text: string): ProtocolPosition {
  let line = 0;
  let character = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 0x0a) {
      line += 1;
      character = 0;
    } else {
      character += 1;
    }
  }
  return { line, character };
}
