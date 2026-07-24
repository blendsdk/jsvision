import type { DocumentIdentity } from '../document/types.js';

export const syntaxCategories = [
  'keyword',
  'comment',
  'string',
  'number',
  'operator',
  'punctuation',
  'variable',
  'property',
  'function',
  'type',
  'namespace',
  'invalid',
] as const;

export type SyntaxCategory = (typeof syntaxCategories)[number];
export type LanguageServiceState = 'ready' | 'degraded';

export interface SyntaxSpan {
  readonly from: number;
  readonly to: number;
  readonly category: SyntaxCategory;
}

export interface FoldRange {
  readonly from: number;
  readonly to: number;
}

export interface BracketPair {
  readonly open: number;
  readonly close: number;
}

export interface CommentMetadata {
  readonly line?: string;
  readonly block?: readonly [string, string];
}

export interface LanguageCapabilityContext {
  readonly maxResults: number;
  readonly previousState?: object;
  readonly previousText?: string;
  readonly signal?: AbortSignal;
  yieldControl(): Promise<void>;
}

export interface LanguageCapabilityResult<T> {
  readonly items: readonly T[];
  readonly state?: object;
}

export type LanguageCapability<T> = (
  text: string,
  context: LanguageCapabilityContext,
) => Promise<LanguageCapabilityResult<T>>;

export interface LanguageAdapter {
  readonly contractVersion: 1;
  readonly id: string;
  readonly extensions: readonly string[];
  readonly comments?: CommentMetadata;
  readonly indentation?: { readonly preserveLeading: true };
  readonly lsp?: { readonly languageId: string };
  readonly syntax?: LanguageCapability<SyntaxSpan>;
  readonly folds?: LanguageCapability<FoldRange>;
  readonly brackets?: LanguageCapability<BracketPair>;
}

export interface LocalLanguageResult {
  readonly syntax: readonly SyntaxSpan[];
  readonly folds: readonly FoldRange[];
  readonly brackets: readonly BracketPair[];
  readonly identity: DocumentIdentity;
  readonly adapterId: string;
  readonly generation: number;
  readonly state: LanguageServiceState;
  readonly failure?: string;
}
