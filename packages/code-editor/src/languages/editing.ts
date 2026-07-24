import type { CommentMetadata } from './contracts.js';

/**
 * Indents or dedents selected zero-based logical lines.
 * @example `indentLines('value', [0], { unit: '  ', direction: 'indent' })`
 */
export function indentLines(
  text: string,
  lines: readonly number[],
  options: { readonly unit: string; readonly direction: 'indent' | 'dedent' },
): string {
  const selected = new Set(lines);
  return text
    .split('\n')
    .map((line, index) => {
      if (!selected.has(index)) return line;
      if (options.direction === 'indent') return options.unit + line;
      let remove = 0;
      while (remove < options.unit.length && (line[remove] === ' ' || line[remove] === '\t')) remove += 1;
      return line.slice(remove);
    })
    .join('\n');
}

/**
 * Adds or removes the active adapter's line-comment delimiter.
 * @example `toggleLineComments('value', [0], { line: '//' })`
 */
export function toggleLineComments(text: string, lines: readonly number[], comments?: CommentMetadata): string {
  if (comments?.line === undefined) return text;
  const selected = new Set(lines);
  const source = text.split('\n');
  const targets = source.filter((_line, index) => selected.has(index));
  const nonblank = targets.filter((line) => line.trim().length > 0);
  if (nonblank.length === 0) return text;
  const minimumIndent = Math.min(...nonblank.map((line) => line.length - line.trimStart().length));
  const uncomment = nonblank.every((line) => line.slice(minimumIndent).startsWith(comments.line ?? ''));
  return source
    .map((line, index) => {
      if (!selected.has(index) || line.trim().length === 0) return line;
      return uncomment
        ? line.slice(0, minimumIndent) + line.slice(minimumIndent + comments.line!.length).replace(/^ /u, '')
        : line.slice(0, minimumIndent) + comments.line + ' ' + line.slice(minimumIndent);
    })
    .join('\n');
}
