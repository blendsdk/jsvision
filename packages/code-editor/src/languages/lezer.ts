import type { Parser, Tree, TreeFragment } from '@lezer/common';
import { TreeFragment as LezerTreeFragment } from '@lezer/common';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';

import { syntaxCategories } from './contracts.js';
import type { LanguageCapabilityContext, SyntaxCategory, SyntaxSpan } from './contracts.js';

const highlighter = tagHighlighter([
  { tag: tags.keyword, class: 'keyword' },
  { tag: [tags.lineComment, tags.blockComment, tags.comment], class: 'comment' },
  { tag: [tags.string, tags.regexp], class: 'string' },
  { tag: tags.number, class: 'number' },
  { tag: [tags.operator, tags.arithmeticOperator, tags.logicOperator], class: 'operator' },
  { tag: [tags.punctuation, tags.separator, tags.paren], class: 'punctuation' },
  { tag: [tags.variableName, tags.definition(tags.variableName)], class: 'variable' },
  { tag: tags.propertyName, class: 'property' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: 'function' },
  { tag: [tags.typeName, tags.className], class: 'type' },
  { tag: tags.namespace, class: 'namespace' },
  { tag: tags.invalid, class: 'invalid' },
]);

export interface LezerState {
  readonly fragments: readonly TreeFragment[];
}

/**
 * Advances a headless Lezer parse cooperatively and bounds produced highlight spans.
 */
export async function parseLezer(
  parser: Parser,
  text: string,
  context: LanguageCapabilityContext,
  fragments: readonly TreeFragment[] = [],
): Promise<{ readonly tree: Tree; readonly state: LezerState; readonly syntax: readonly SyntaxSpan[] }> {
  const parse = parser.startParse(text, fragments);
  let tree: Tree | null = null;
  while (tree === null) {
    if (context.signal?.aborted === true) throw new Error('Language analysis was cancelled.');
    tree = parse.advance();
    if (tree === null) await context.yieldControl();
  }

  const syntax: SyntaxSpan[] = [];
  highlightTree(tree, highlighter, (from, to, classes) => {
    if (syntax.length < context.maxResults && isSyntaxCategory(classes)) {
      syntax.push({ from, to, category: classes });
    }
  });
  return {
    tree,
    state: { fragments: LezerTreeFragment.addTree(tree) },
    syntax,
  };
}

function isSyntaxCategory(value: string): value is SyntaxCategory {
  return syntaxCategories.some((category) => category === value);
}

/** Maps one contiguous edit into retained Lezer fragments. */
export function updateLezerFragments(
  previousText: string,
  text: string,
  fragments: readonly TreeFragment[],
): readonly TreeFragment[] {
  let prefix = 0;
  while (prefix < previousText.length && prefix < text.length && previousText[prefix] === text[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < previousText.length - prefix &&
    suffix < text.length - prefix &&
    previousText[previousText.length - suffix - 1] === text[text.length - suffix - 1]
  ) {
    suffix += 1;
  }
  return LezerTreeFragment.applyChanges(fragments, [
    {
      fromA: prefix,
      toA: previousText.length - suffix,
      fromB: prefix,
      toB: text.length - suffix,
    },
  ]);
}
