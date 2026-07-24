import type { completionEdits } from './completion.js';
import type {
  CodeEditorLspOperation,
  CodeEditorLspPresentation,
  CreateCodeEditorLspCoordinatorOptions,
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

export type LspCommandAvailability = Readonly<
  Record<
    | 'completion'
    | 'hover'
    | 'signatureHelp'
    | 'diagnostics'
    | 'definition'
    | 'documentSymbols'
    | 'documentFormatting'
    | 'rangeFormatting',
    boolean
  >
>;

export function resolveCommandAvailability(
  languageId: string,
  capabilities: CodeEditorLspSession['capabilities'] | undefined,
): LspCommandAvailability {
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
