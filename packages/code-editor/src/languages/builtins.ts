import type { TreeFragment } from '@lezer/common';
import { parser as javascriptParser } from '@lezer/javascript';

import type { LanguageAdapter, LanguageCapabilityContext, SyntaxCategory, SyntaxSpan } from './contracts.js';
import { parseLezer, updateLezerFragments } from './lezer.js';
import { discoverBrackets, discoverFolds } from './structure.js';
import { javascriptCommentMetadata } from './metadata.js';

const commonKeywords = new Set(['const', 'let', 'var', 'function', 'return', 'class', 'extends', 'if', 'else', 'for']);
const tokenPattern =
  /(?:\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)|(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(?:\b\d+(?:\.\d+)?\b)|(?:\b[A-Za-z_$][\w$]*\b)|(?:[()[\]{};,.:])|(?:[+\-*/%=<>!&|?]+)/gu;

async function lexicalSyntax(
  text: string,
  context: LanguageCapabilityContext,
): Promise<{ readonly items: readonly SyntaxSpan[] }> {
  const items: SyntaxSpan[] = [];
  let processed = 0;
  for (const match of text.matchAll(tokenPattern)) {
    if (items.length >= context.maxResults) break;
    items.push({ from: match.index, to: match.index + match[0].length, category: categorize(match[0]) });
    if (match.index - processed >= 16_384) {
      processed = match.index;
      await context.yieldControl();
    }
  }
  return { items };
}

function categorize(token: string): SyntaxCategory {
  if (token.startsWith('//') || token.startsWith('/*')) return 'comment';
  if (token.startsWith("'") || token.startsWith('"')) return 'string';
  if (/^\d/u.test(token)) return 'number';
  if (commonKeywords.has(token.toLowerCase())) return 'keyword';
  if (/^[()[\]{};,.:]$/u.test(token)) return 'punctuation';
  if (/^[+\-*/%=<>!&|?]+$/u.test(token)) return 'operator';
  if (/^[A-Z]/u.test(token)) return 'type';
  return 'variable';
}

function lezerAdapter(id: string, extensions: readonly string[]): LanguageAdapter {
  const parser = id === 'typescript' ? javascriptParser.configure({ dialect: 'ts' }) : javascriptParser;
  return Object.freeze({
    contractVersion: 1,
    id,
    extensions,
    comments: javascriptCommentMetadata,
    async syntax(text: string, context: LanguageCapabilityContext) {
      const previous = readLezerState(context.previousState);
      const fragments =
        previous !== undefined && context.previousText !== undefined
          ? updateLezerFragments(context.previousText, text, previous.fragments)
          : [];
      const parsed = await parseLezer(parser, text, context, fragments);
      return { items: parsed.syntax, state: parsed.state };
    },
    async folds(text: string, context: LanguageCapabilityContext) {
      const syntax = (await lexicalSyntax(text, context)).items;
      const brackets = discoverBrackets(text, syntax, context.maxResults);
      return { items: discoverFolds(text, brackets, context.maxResults) };
    },
    async brackets(text: string, context: LanguageCapabilityContext) {
      const syntax = (await lexicalSyntax(text, context)).items;
      return { items: discoverBrackets(text, syntax, context.maxResults) };
    },
  });
}

function readLezerState(value: object | undefined): { readonly fragments: readonly TreeFragment[] } | undefined {
  if (value === undefined) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, 'fragments');
  if (descriptor === undefined || !('value' in descriptor) || !Array.isArray(descriptor.value)) return undefined;
  return { fragments: descriptor.value };
}

export const plainLanguageAdapter: LanguageAdapter = Object.freeze({
  contractVersion: 1,
  id: 'plain',
  extensions: [],
});
export const javascriptLanguageAdapter = lezerAdapter('javascript', ['.js', '.mjs', '.cjs', '.jsx']);
export const typescriptLanguageAdapter = lezerAdapter('typescript', ['.ts', '.mts', '.cts', '.tsx']);
