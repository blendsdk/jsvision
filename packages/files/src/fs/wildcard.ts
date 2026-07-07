/**
 * The DOS-style `*`/`?` filename matcher used to filter file listings. Pure, dependency-free, and
 * bounds-checked for any pattern or name length.
 *
 * Matching rules:
 *   - `?` matches exactly one character.
 *   - `*` matches zero or more characters (greedy — a trailing `*` matches the rest of the name).
 *   - any other character is an exact, **case-sensitive** compare (case is significant on every
 *     platform, so `README` does not match `readme`).
 *   - the whole pattern must consume the whole name.
 *   - `"*.*"` is treated as `"*"`, so it also matches names with no extension.
 */

/**
 * Whether a pattern actually contains a wildcard (`*` or `?`), i.e. is not a plain literal name.
 * The file dialog uses this to decide whether a typed value re-filters the listing or names a file.
 *
 * @param pattern The value to test.
 * @returns `true` if it contains `*` or `?`.
 * @example
 * import { isWild } from '@jsvision/files';
 *
 * isWild('*.ts');    // → true  (a filter)
 * isWild('main.ts'); // → false (a literal filename)
 */
export function isWild(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?');
}

/**
 * Match a whole `name` against a `*`/`?` `pattern`, case-sensitively (`"*.*"` behaves as `"*"`).
 *
 * @param pattern The wildcard pattern, e.g. `'*.ts'` or `'file?.txt'`.
 * @param name    The candidate filename.
 * @returns Whether the entire name matches the entire pattern.
 * @example
 * import { wildcardMatch } from '@jsvision/files';
 *
 * wildcardMatch('*.ts', 'main.ts');    // → true
 * wildcardMatch('*.ts', 'main.tsx');   // → false
 * wildcardMatch('file?.txt', 'file1.txt'); // → true
 * wildcardMatch('*.*', 'README');      // → true  ("*.*" matches extensionless names)
 */
export function wildcardMatch(pattern: string, name: string): boolean {
  const pat = pattern === '*.*' ? '*' : pattern; // "*.*" also matches extensionless names
  return match(pat, 0, name, 0);
}

/** Recursive matcher over string indices: a `*` tries every split point of the remaining name. */
function match(pattern: string, pi: number, name: string, ni: number): boolean {
  for (; pi < pattern.length; pi += 1) {
    const pc = pattern[pi];
    if (pc === '?') {
      if (ni >= name.length) return false; // '?' needs a character
      ni += 1;
    } else if (pc === '*') {
      if (pi + 1 >= pattern.length) return true; // trailing '*' matches the rest
      for (let i = ni; i < name.length; i += 1) if (match(pattern, pi + 1, name, i)) return true;
      return false;
    } else {
      if (name[ni] !== pc) return false; // exact, case-sensitive
      ni += 1;
    }
  }
  return ni === name.length; // both fully consumed
}
