/**
 * Line-count helper for the `grid.ts` delegation guards.
 *
 * Those guards exist to stop heavy logic being re-inlined into `grid.ts` after it was extracted
 * into its own modules — they are never meant to be met by moving logic back in. Counting raw
 * lines conflates that with documentation: the package requires an `@example` on every public
 * export, so a docs pass can trip the guard while adding no logic at all. Counting only the lines
 * that carry code measures what the guards actually assert.
 */

/**
 * Count the lines of `source` that carry executable code, ignoring blank lines, `//` comments and
 * `/* *\/` block comments (JSDoc included).
 *
 * A line with code before or after a comment still counts — only lines that are *entirely* comment
 * or whitespace are dropped.
 *
 * @param source The full text of a TypeScript source file.
 * @returns The number of code-bearing lines.
 * @example
 * const src = readFileSync('grid.ts', 'utf8');
 * expect(codeLines(src)).toBeLessThan(900);
 */
export function codeLines(source: string): number {
  let inBlockComment = false;
  let count = 0;

  for (const rawLine of source.split('\n')) {
    let line = rawLine.trim();

    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end < 0) continue; // the whole line is still inside the block comment
      inBlockComment = false;
      line = line.slice(end + 2).trim();
    }

    // Strip any block comments that open and close on this same line, so `/* note */ code();`
    // is still recognised as code.
    for (;;) {
      const open = line.indexOf('/*');
      if (open < 0) break;
      const close = line.indexOf('*/', open + 2);
      if (close < 0) {
        inBlockComment = true;
        line = line.slice(0, open).trim();
        break;
      }
      line = (line.slice(0, open) + ' ' + line.slice(close + 2)).trim();
    }

    if (line === '' || line.startsWith('//')) continue;
    count += 1;
  }

  return count;
}
