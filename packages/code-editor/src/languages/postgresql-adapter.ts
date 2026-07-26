import { parse } from 'pgsql-ast-parser';
import type { Statement } from 'pgsql-ast-parser';

import type { FoldRange, LanguageAdapter, LanguageCapabilityContext, SyntaxCategory, SyntaxSpan } from './contracts.js';
import { discoverBrackets, discoverFolds } from './structure.js';
import { postgresqlCommentMetadata } from './metadata.js';

const tokenPattern =
  /(?:--[^\r\n]*|\/\*[\s\S]*?\*\/)|(?:'(?:''|[^'])*')|(?:\b\d+(?:\.\d+)?\b)|(?:\b[A-Za-z_][\w$]*\b)|(?:[()[\]{};,.:])|(?:[+\-*/%=<>!&|?]+)/gu;
const keywords = new Set(['select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'table', 'join', 'as']);
const MAX_AST_REGION_LENGTH = 256;
const MAX_AST_REGIONS = 32;
const LEXICAL_YIELD_INTERVAL = 16_384;

function category(token: string): SyntaxCategory {
  if (token.startsWith('--') || token.startsWith('/*')) return 'comment';
  if (token.startsWith("'")) return 'string';
  if (/^\d/u.test(token)) return 'number';
  if (keywords.has(token.toLowerCase())) return 'keyword';
  if (/^[()[\]{};,.:]$/u.test(token)) return 'punctuation';
  if (/^[+\-*/%=<>!&|?]+$/u.test(token)) return 'operator';
  return 'variable';
}

async function syntax(
  text: string,
  context: LanguageCapabilityContext,
): Promise<{ readonly items: readonly SyntaxSpan[] }> {
  const items: SyntaxSpan[] = [];
  let processed = 0;
  for (const match of text.matchAll(tokenPattern)) {
    if (items.length >= context.maxResults) break;
    items.push({ from: match.index, to: match.index + match[0].length, category: category(match[0]) });
    if (match.index - processed >= LEXICAL_YIELD_INTERVAL) {
      processed = match.index;
      await context.yieldControl();
    }
  }
  return { items };
}

async function brackets(
  text: string,
  context: LanguageCapabilityContext,
): Promise<{ readonly items: ReturnType<typeof discoverBrackets> }> {
  const lexical = await syntax(text, context);
  return { items: discoverBrackets(text, lexical.items, context.maxResults) };
}

async function folds(
  text: string,
  context: LanguageCapabilityContext,
): Promise<{ readonly items: readonly FoldRange[] }> {
  const items: FoldRange[] = [];
  let parsedRegions = 0;
  for (const region of statementRegions(text)) {
    if (items.length >= context.maxResults || parsedRegions >= MAX_AST_REGIONS) break;
    await context.yieldControl();
    if (region.to - region.from > MAX_AST_REGION_LENGTH) continue;
    parsedRegions += 1;
    try {
      for (const statement of parse(text.slice(region.from, region.to), { locationTracking: true })) {
        if (!hasTrackedLocation(statement)) continue;
        const from = region.from + statement._location.start;
        const to = region.from + statement._location.end;
        if (text.slice(from, to).includes('\n')) items.push({ from, to });
        if (items.length >= context.maxResults) break;
      }
    } catch {
      // Incomplete source is normal while typing; lexical structure remains available.
    }
  }

  if (items.length < context.maxResults) {
    const lexical = await syntax(text, { ...context, maxResults: context.maxResults - items.length });
    const pairs = discoverBrackets(text, lexical.items, context.maxResults - items.length);
    items.push(...discoverFolds(text, pairs, context.maxResults - items.length));
  }
  return {
    items: items.sort((left, right) => left.from - right.from || left.to - right.to).slice(0, context.maxResults),
  };
}

function* statementRegions(text: string): Generator<{ readonly from: number; readonly to: number }> {
  let from = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 0x3b) {
      yield { from, to: index + 1 };
      from = index + 1;
    }
  }
  if (from < text.length) yield { from, to: text.length };
}

/**
 * Headless PostgreSQL adapter with bounded parser regions and lexical recovery.
 */
export const postgresqlLanguageAdapter: LanguageAdapter = Object.freeze({
  contractVersion: 1,
  id: 'postgresql',
  extensions: ['.sql', '.pgsql'],
  comments: postgresqlCommentMetadata,
  syntax,
  folds,
  brackets,
});

function hasTrackedLocation(
  statement: Statement,
): statement is Statement & { readonly _location: { readonly start: number; readonly end: number } } {
  return statement._location !== undefined;
}
