import type { BracketPair, FoldRange, SyntaxSpan } from './contracts.js';

/** Discovers balanced code brackets while excluding string and comment syntax. */
export function discoverBrackets(
  text: string,
  syntax: readonly SyntaxSpan[],
  maxResults = Number.MAX_SAFE_INTEGER,
): readonly BracketPair[] {
  const ignored = syntax.filter((span) => span.category === 'comment' || span.category === 'string');
  const opening = new Map<string, string>([
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ]);
  const stack: { readonly open: number; readonly close: string }[] = [];
  const pairs: BracketPair[] = [];
  let ignoredIndex = 0;
  for (let index = 0; index < text.length; index += 1) {
    while ((ignored[ignoredIndex]?.to ?? Number.MAX_SAFE_INTEGER) <= index) ignoredIndex += 1;
    const ignoredSpan = ignored[ignoredIndex];
    if (ignoredSpan !== undefined && index >= ignoredSpan.from && index < ignoredSpan.to) continue;
    const character = text[index] ?? '';
    const close = opening.get(character);
    if (close !== undefined) {
      stack.push({ open: index, close });
    } else if (character === ')' || character === ']' || character === '}') {
      const candidate = stack.at(-1);
      if (candidate?.close === character) {
        stack.pop();
        pairs.push({ open: candidate.open, close: index });
        if (pairs.length >= maxResults) break;
      } else {
        stack.length = 0;
      }
    }
  }
  return pairs.sort((left, right) => left.open - right.open);
}

/** Converts multiline structural pairs into fold ranges. */
export function discoverFolds(
  text: string,
  brackets: readonly BracketPair[],
  maxResults = Number.MAX_SAFE_INTEGER,
): readonly FoldRange[] {
  const newlinePrefix = new Uint32Array(text.length + 1);
  for (let index = 0; index < text.length; index += 1) {
    newlinePrefix[index + 1] = (newlinePrefix[index] ?? 0) + (text.charCodeAt(index) === 0x0a ? 1 : 0);
  }
  const folds: FoldRange[] = [];
  for (const pair of brackets) {
    if ((newlinePrefix[pair.close] ?? 0) > (newlinePrefix[pair.open] ?? 0)) {
      folds.push({ from: pair.open, to: pair.close + 1 });
      if (folds.length >= maxResults) break;
    }
  }
  return folds;
}
